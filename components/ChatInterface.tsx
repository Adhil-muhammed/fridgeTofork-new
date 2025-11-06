import React, { useState, useEffect, useRef, useCallback } from 'react';
import geminiService from '../services/geminiService';
import { ChatMessage, AudioBufferData } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { v4 as uuidv4 } from 'uuid';
// FIX: Import Session from @google/genai instead of defining a local interface.
import { FunctionCall, LiveServerMessage, Chat, Session } from '@google/genai';

// FIX: Removed the local interface for LiveSession as the Session type from @google/genai is used directly.

// Utility component to display Markdown content
const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  // Simple markdown-like rendering for bold and links.
  const formattedContent = content
    .split('**').map((text, i) => i % 2 === 1 ? <strong key={i}>{text}</strong> : text)
    .flatMap((segment, i) => {
      if (typeof segment === 'string') {
        // Regex to find URLs and convert them to anchor tags
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return segment.split(urlRegex).map((part, j) =>
          urlRegex.test(part) ? <a key={`${i}-${j}`} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">{part}</a> : part
        );
      }
      return segment;
    });

  return <>{formattedContent}</>;
};

const ChatInterface: React.FC = () => { // Removed initialChatMessages prop
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [isLiveSessionActive, setIsLiveSessionActive] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false); // This state is not currently used for microphone recording.
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null); // Not used
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]); // Not used
  const [error, setError] = useState<string | null>(null);

  // Live session specific refs
  // FIX: Use the imported Session interface from @google/genai for the ref.
  const liveSessionRef = useRef<Promise<Session> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextOutputAudioStartTimeRef = useRef<number>(0);
  const outputAudioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Chat specific refs
  const chatRef = useRef<Chat | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize the chat session
    if (!chatRef.current) {
      chatRef.current = geminiService.createChatSession();
      console.log('Gemini Chat session initialized.');
    }

    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, liveTranscription]);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [...prev, { id: uuidv4(), timestamp: new Date(), ...message }]);
  }, []);

  const handleSendMessage = useCallback(async (messageText: string, useSearchGrounding = false) => {
    if (!messageText.trim()) return;

    setCurrentInput('');
    addMessage({ sender: 'user', text: messageText });
    setIsThinking(true);
    setError(null);

    try {
      if (useSearchGrounding) {
        const { text, sources } = await geminiService.getGroundedResponse(messageText);
        addMessage({ sender: 'gemini', text, sources });
      } else {
        if (!chatRef.current) {
          throw new Error("Chat session not initialized.");
        }
        let fullResponseText = '';
        addMessage({ sender: 'gemini', text: '', isStreaming: true });

        // Stream text response using the chat session
        const responseStream = await chatRef.current.sendMessageStream({
          message: messageText, // Only send the current user message
        });

        for await (const chunk of responseStream) {
          const chunkText = chunk.text;
          if (chunkText) {
            fullResponseText += chunkText;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.isStreaming ? { ...msg, text: fullResponseText, isStreaming: true } : msg,
              ),
            );
          }
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.isStreaming ? { ...msg, text: fullResponseText, isStreaming: false } : msg,
          ),
        );
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(`Failed to get response: ${err.message || 'Unknown error'}`);
      addMessage({
        sender: 'gemini',
        text: `Sorry, I encountered an error: ${err.message || 'Unknown error'}. Please try again.`,
      });
    } finally {
      setIsThinking(false);
    }
  }, [addMessage]);

  const stopAllAudioPlayback = useCallback(() => {
    for (const source of outputAudioSourcesRef.current.values()) {
      source.stop();
      outputAudioSourcesRef.current.delete(source);
    }
    nextOutputAudioStartTimeRef.current = 0;
  }, []);

  // Fix: Move stopLiveSession declaration before startLiveSession
  const stopLiveSession = useCallback(() => {
    stopAllAudioPlayback();
    // FIX: Access the resolved Session object before calling close()
    liveSessionRef.current?.then(session => session.close());
    liveSessionRef.current = null;
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      setMicStream(null);
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current.onaudioprocess = null; // Prevent memory leak
      scriptProcessorRef.current = null;
    }
    setIsLiveSessionActive(false);
    setIsRecording(false); // Ensure recording state is reset
    setLiveTranscription('');
    setIsThinking(false); // Ensure thinking state is reset
    console.log('Live session stopped and resources released.');
  }, [micStream, stopAllAudioPlayback]);


  const handleLiveSessionMessage = useCallback(async (message: LiveServerMessage) => {
    // Handle model output audio
    const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64EncodedAudioString && outputAudioContextRef.current) {
      nextOutputAudioStartTimeRef.current = Math.max(
        nextOutputAudioStartTimeRef.current,
        outputAudioContextRef.current.currentTime,
      );
      const audioBuffer = await geminiService.decodeAudioData(
        geminiService.decode(base64EncodedAudioString),
        outputAudioContextRef.current,
        24000,
        1,
      );
      const source = outputAudioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outputAudioContextRef.current.destination);
      source.addEventListener('ended', () => {
        outputAudioSourcesRef.current.delete(source);
      });

      source.start(nextOutputAudioStartTimeRef.current);
      nextOutputAudioStartTimeRef.current = nextOutputAudioStartTimeRef.current + audioBuffer.duration;
      outputAudioSourcesRef.current.add(source);
    }

    // Handle transcription for model output
    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text;
      setMessages((prev) => {
        const lastGeminiMessage = prev[prev.length - 1];
        if (lastGeminiMessage && lastGeminiMessage.sender === 'gemini' && lastGeminiMessage.isStreaming) {
          // Append to the last streaming message
          return prev.map(msg => msg.id === lastGeminiMessage.id ? { ...msg, text: lastGeminiMessage.text + text } : msg);
        } else {
          // Create a new streaming message
          return [...prev, { id: uuidv4(), sender: 'gemini', text, isStreaming: true, timestamp: new Date() }];
        }
      });
    }

    // Handle transcription for user input
    if (message.serverContent?.inputTranscription) {
      const text = message.serverContent.inputTranscription.text;
      setLiveTranscription(text);
    }

    // Handle turn complete
    if (message.serverContent?.turnComplete) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg,
        ),
      );
      setLiveTranscription(''); // Clear user transcription after turn
    }

    // Handle interruptions
    if (message.serverContent?.interrupted) {
      stopAllAudioPlayback();
    }

    // Handle function calls
    if (message.toolCall && message.toolCall.functionCalls.length > 0) {
      // Simulate execution of function calls
      const functionCalls: FunctionCall[] = message.toolCall.functionCalls;
      console.log('Function calls received:', functionCalls);
      // Display function calls in chat
      addMessage({ sender: 'gemini', text: `Executing function: ${functionCalls.map(fc => fc.name).join(', ')}`, functionCalls });

      // Send tool responses back to the model
      liveSessionRef.current?.then(session => {
        for (const fc of functionCalls) {
          // In a real app, you would execute fc.name with fc.args
          const result = `Successfully controlled light with brightness: ${fc.args.brightness}, colorTemperature: ${fc.args.colorTemperature}`;
          session.sendToolResponse({
            functionResponses: {
              id: fc.id,
              name: fc.name,
              response: { result: result },
            },
          });
          console.log(`Sent tool response for ${fc.name}: ${result}`);
        }
      });
    }
  }, [addMessage, stopAllAudioPlayback]);


  const startLiveSession = useCallback(async () => {
    if (isLiveSessionActive) return;

    setError(null);
    setIsThinking(true); // Indicate that the session is connecting

    try {
      // Fix: Add (window as any).webkitAudioContext for broader compatibility
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // Fix: Add (window as any).webkitAudioContext for broader compatibility
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);

      liveSessionRef.current = geminiService.connectLiveSession({
        onOpen: () => {
          console.log('Gemini Live session opened');
          setIsLiveSessionActive(true);
          setIsThinking(false); // Session is active, stop thinking indicator
          addMessage({ sender: 'gemini', text: "Hello! How can Chef Fridge help you today?", isStreaming: false });

          // Start streaming microphone audio
          if (inputAudioContextRef.current) {
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = geminiService.createAudioBlob(inputData);
              // CRITICAL: Solely rely on sessionPromise resolves and then call `session.sendRealtimeInput`, **do not** add other condition checks.
              liveSessionRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
            scriptProcessorRef.current = scriptProcessor;
          }
        },
        onMessage: handleLiveSessionMessage,
        onError: (e) => {
          console.error('Gemini Live session error:', e);
          setError(`Live session error: ${e.message || 'Unknown error'}`);
          setIsLiveSessionActive(false);
          setIsThinking(false);
          stopLiveSession(); // Clean up on error
          addMessage({ sender: 'gemini', text: `Sorry, an error occurred in the live chat: ${e.message || 'Please check your connection and try again.'}` });
        },
        onClose: (e) => {
          console.log('Gemini Live session closed', e);
          setIsLiveSessionActive(false);
          setIsThinking(false);
          stopLiveSession(); // Clean up on close
          if (e.code !== 1000) { // 1000 is normal closure
            addMessage({ sender: 'gemini', text: `Live chat session disconnected: ${e.reason || 'Please try reconnecting.'}` });
          }
        },
        inputAudioContext: inputAudioContextRef.current,
        outputAudioContext: outputAudioContextRef.current,
      });
    } catch (err: any) {
      console.error('Failed to start live session:', err);
      setError(`Failed to connect to live session: ${err.message || 'Please ensure microphone access is granted and try again.'}`);
      setIsThinking(false);
      stopLiveSession();
    }
  }, [isLiveSessionActive, handleLiveSessionMessage, addMessage, stopAllAudioPlayback, stopLiveSession]);


  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      stopLiveSession();
      // No explicit cleanup for chatRef.current needed, as it's stateless after creation (until a new message)
    };
  }, [stopLiveSession]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md max-w-2xl mx-auto my-6 p-4">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Chef Fridge Live Chat</h2>

      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-2 border rounded-md bg-gray-50 mb-4 h-[calc(100vh-350px)]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
            <div
              className={`max-w-[75%] p-3 rounded-lg shadow-sm text-sm ${
                msg.sender === 'user'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              <MarkdownContent content={msg.text} />
              {msg.isStreaming && msg.sender === 'gemini' && (
                <span className="animate-pulse text-xs ml-2">...</span>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 text-xs text-gray-600 border-t border-gray-300 pt-2">
                  <p className="font-semibold mb-1">Sources:</p>
                  <ul className="list-disc list-inside">
                    {msg.sources.map((source, idx) => (
                      <li key={idx}>
                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                          {source.title || source.uri}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
               {msg.functionCalls && msg.functionCalls.length > 0 && (
                <div className="mt-2 text-xs text-gray-600 border-t border-gray-300 pt-2">
                  <p className="font-semibold mb-1">Function Calls:</p>
                  <ul className="list-disc list-inside">
                    {msg.functionCalls.map((fc, idx) => (
                      <li key={idx}>
                        {fc.name}({JSON.stringify(fc.args)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-right text-xs mt-1 opacity-75">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {liveTranscription && (
          <div className="flex justify-end mb-3">
            <div className="max-w-[75%] p-3 rounded-lg shadow-sm text-sm bg-blue-100 text-blue-800 italic">
              {liveTranscription} <span className="animate-pulse text-xs ml-1">...</span>
            </div>
          </div>
        )}
        {(isThinking && !isLiveSessionActive) && (
          <div className="flex justify-start mb-3">
            <div className="max-w-[75%] p-3 rounded-lg shadow-sm text-sm bg-gray-200 text-gray-800 flex items-center">
              <LoadingSpinner message="Connecting..." />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-center mb-4">{error}</p>}

      <div className="flex items-center space-x-2 p-2 border-t pt-4">
        <input
          type="text"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !isThinking && currentInput.trim()) { // Only send if input is not empty
              handleSendMessage(currentInput);
            }
          }}
          placeholder="Ask Chef Fridge..."
          className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
          disabled={isThinking || isLiveSessionActive}
        />
        <button
          onClick={() => handleSendMessage(currentInput)}
          className="p-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!currentInput.trim() || isThinking || isLiveSessionActive}
        >
          Send
        </button>
        <button
          onClick={() => handleSendMessage(currentInput, true)} // Send with search grounding
          className="p-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!currentInput.trim() || isThinking || isLiveSessionActive}
          title="Send with Google Search Grounding"
        >
          Search & Ask
        </button>

        <button
          onClick={isLiveSessionActive ? stopLiveSession : startLiveSession}
          className={`p-3 rounded-full text-white transition duration-200
            ${isLiveSessionActive ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-600 hover:bg-purple-700'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={isThinking}
          title={isLiveSessionActive ? 'Stop Live Session' : 'Start Live Session'}
        >
          {isLiveSessionActive ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7v1m0 0v1m0-1a7 7 0 01-7-7m7 7a7 7 0 007-7m0 0a7 7 0 01-7-7m7 7h1m0 0h1m0-1a7 7 0 01-7-7m7 7v-1m0 0v-1m0 1a7 7 0 00-7 7m0 0a7 7 0 01-7-7m7 7h-1m0 0h-1m0-1a7 7 0 017-7m0 0a7 7 0 00-7 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;