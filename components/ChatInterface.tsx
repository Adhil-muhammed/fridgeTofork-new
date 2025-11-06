
import React, { useState, useEffect, useRef, useCallback } from 'react';
import geminiService from '../services/geminiService';
import { ChatMessage } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { v4 as uuidv4 } from 'uuid';
import { FunctionCall, LiveServerMessage, Chat, Session } from '@google/genai';

interface ChatInterfaceProps {
  viewMode: 'hidden' | 'tab' | 'overlay'; // New prop
  onClose: () => void; // Still needed for overlay mode
  setLiveSessionActive: (active: boolean) => void;
  setThinking: (thinking: boolean) => void;
  setStartLiveSession: React.Dispatch<React.SetStateAction<(initialPrompt?: string) => Promise<void>>>;
  setStopLiveSession: React.Dispatch<React.SetStateAction<() => void>>;
}

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
          urlRegex.test(part) ? <a key={`${i}-${j}`} href={part} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-200">{part}</a> : part
        );
      }
      return segment;
    });

  return <>{formattedContent}</>;
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  viewMode,
  onClose,
  setLiveSessionActive,
  setThinking,
  setStartLiveSession,
  setStopLiveSession,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [isLiveSessionActiveInternal, setIsLiveSessionActiveInternal] = useState<boolean>(false);
  const [isThinkingInternal, setIsThinkingInternal] = useState<boolean>(false);
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false); // NEW: AI speaking indicator

  // Live session specific refs
  const liveSessionRef = useRef<Promise<Session> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextOutputAudioStartTimeRef = useRef<number>(0);
  const outputAudioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Chat specific refs
  const chatRef = useRef<Chat | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Propagate internal states to parent
  useEffect(() => {
    setLiveSessionActive(isLiveSessionActiveInternal);
  }, [isLiveSessionActiveInternal, setLiveSessionActive]);

  useEffect(() => {
    setThinking(isThinkingInternal);
  }, [isThinkingInternal, setThinking]);


  useEffect(() => {
    if (!chatRef.current) {
      chatRef.current = geminiService.createChatSession();
      console.log('Gemini Chat session initialized.');
      // Add initial greeting message
      setMessages([{
        id: uuidv4(),
        sender: 'gemini',
        text: "Hello! How can Chef Fridge help you today?",
        timestamp: new Date(),
      }]);
    }

    if (viewMode !== 'hidden' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [viewMode]); // Removed messages, liveTranscription from deps to prevent re-runs

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [...prev, { id: uuidv4(), timestamp: new Date(), ...message }]);
  }, []);

  const handleSendMessage = useCallback(async (messageText: string, useSearchGrounding = false) => {
    if (!messageText.trim()) return;

    setCurrentInput('');
    addMessage({ sender: 'user', text: messageText });
    setIsThinkingInternal(true);
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

        const responseStream = await chatRef.current.sendMessageStream({
          message: messageText,
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
      setIsThinkingInternal(false);
    }
  }, [addMessage]);

  const stopAllAudioPlayback = useCallback(() => {
    for (const source of outputAudioSourcesRef.current.values()) {
      source.stop();
      outputAudioSourcesRef.current.delete(source);
    }
    nextOutputAudioStartTimeRef.current = 0;
    setIsSpeaking(false);
  }, []);

  const stopLiveSession = useCallback(() => {
    stopAllAudioPlayback();
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
      scriptProcessorRef.current.onaudioprocess = null;
      scriptProcessorRef.current = null;
    }
    setIsLiveSessionActiveInternal(false);
    setIsThinkingInternal(false);
    setLiveTranscription('');
    setError(null); // Clear error on stop
    console.log('Live session stopped and resources released.');
  }, [micStream, stopAllAudioPlayback]);


  const handleLiveSessionMessage = useCallback(async (message: LiveServerMessage) => {
    const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64EncodedAudioString && outputAudioContextRef.current) {
      setIsSpeaking(true); // Chef Fridge is speaking
      nextOutputAudioStartTimeRef.current = Math.max(
        nextOutputAudioStartTimeRef.current,
        outputAudioContextRef.current.currentTime,
      );
      try {
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
          if (outputAudioSourcesRef.current.size === 0) {
            setIsSpeaking(false); // No more audio chunks, stop speaking indicator
          }
        });

        source.start(nextOutputAudioStartTimeRef.current);
        nextOutputAudioStartTimeRef.current = nextOutputAudioStartTimeRef.current + audioBuffer.duration;
        outputAudioSourcesRef.current.add(source);
      } catch (audioError: any) {
        console.error("Error decoding or playing audio:", audioError);
        setError(`Audio playback error: ${audioError.message}`);
        setIsSpeaking(false);
      }
    }

    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text;
      setMessages((prev) => {
        const lastGeminiMessage = prev[prev.length - 1];
        if (lastGeminiMessage && lastGeminiMessage.sender === 'gemini' && lastGeminiMessage.isStreaming) {
          // Append to the last streaming message
          return prev.map(msg => msg.id === lastGeminiMessage.id ? { ...msg, text: lastGeminiMessage.text + text } : msg);
        } else {
          // If no streaming message, create a new one
          return [...prev, { id: uuidv4(), sender: 'gemini', text, isStreaming: true, timestamp: new Date() }];
        }
      });
    }

    if (message.serverContent?.inputTranscription) {
      const text = message.serverContent.inputTranscription.text;
      setLiveTranscription(text); // User's live transcription
    }

    if (message.serverContent?.turnComplete) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg,
        ),
      );
      setLiveTranscription('');
      setIsSpeaking(false); // Ensure speaking indicator is off when turn is complete
      setIsThinkingInternal(false); // AI is done processing and speaking
    }

    if (message.serverContent?.interrupted) {
      stopAllAudioPlayback();
    }

    if (message.toolCall && message.toolCall.functionCalls.length > 0) {
      const functionCalls: FunctionCall[] = message.toolCall.functionCalls;
      console.log('Function calls received:', functionCalls);
      addMessage({ sender: 'gemini', text: `Executing function: ${functionCalls.map(fc => fc.name).join(', ')}`, functionCalls });

      liveSessionRef.current?.then(session => {
        for (const fc of functionCalls) {
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


  const startLiveSession = useCallback(async (initialPrompt?: string) => {
    if (isLiveSessionActiveInternal) return;

    setError(null);
    setIsThinkingInternal(true);

    try {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);

      liveSessionRef.current = geminiService.connectLiveSession({
        onOpen: () => {
          console.log('Gemini Live session opened');
          setIsLiveSessionActiveInternal(true);
          setIsThinkingInternal(false);
          
          if (inputAudioContextRef.current) {
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = geminiService.createAudioBlob(inputData);
              liveSessionRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
            scriptProcessorRef.current = scriptProcessor;
          }
          // Send initial prompt if provided, and add to chat history
          liveSessionRef.current?.then((session) => {
            if (initialPrompt) {
              session.sendRealtimeInput({ text: initialPrompt });
              addMessage({ sender: 'user', text: initialPrompt, isStreaming: false }); // Add to chat history
            }
          });
        },
        onMessage: handleLiveSessionMessage,
        onError: (e) => {
          console.error('Gemini Live session error:', e);
          const errorMessage = (e.error && e.error.message) || e.message || 'Unknown error';
          if (errorMessage.includes("permission denied")) {
            setError("Microphone access denied. Please enable it in your browser settings.");
          } else {
            setError(`Live session error: ${errorMessage}. Please try again.`);
          }
          setIsLiveSessionActiveInternal(false);
          setIsThinkingInternal(false);
          stopLiveSession();
          addMessage({ sender: 'gemini', text: `Sorry, an error occurred in the live chat: ${errorMessage}` });
        },
        onClose: (e) => {
          console.log('Gemini Live session closed', e);
          setIsLiveSessionActiveInternal(false);
          setIsThinkingInternal(false);
          stopLiveSession();
          if (e.code !== 1000) { // 1000 is normal closure
            addMessage({ sender: 'gemini', text: `Live chat session disconnected: ${e.reason || 'Please try reconnecting.'}` });
          }
        },
        inputAudioContext: inputAudioContextRef.current,
        outputAudioContext: outputAudioContextRef.current,
      });
    } catch (err: any) {
      console.error('Failed to start live session:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Microphone access denied. Please enable it in your browser settings to use voice chat.");
      } else {
        setError(`Failed to connect to live session: ${err.message || 'Unknown error'}. Please try again.`);
      }
      setIsThinkingInternal(false);
      stopLiveSession();
    }
  }, [isLiveSessionActiveInternal, handleLiveSessionMessage, addMessage, stopAllAudioPlayback, stopLiveSession]);


  useEffect(() => {
    setStartLiveSession(() => startLiveSession);
    setStopLiveSession(() => stopLiveSession);
  }, [startLiveSession, stopLiveSession, setStartLiveSession, setStopLiveSession]);


  useEffect(() => {
    // Cleanup function: stop live session when component unmounts or viewMode changes away from active
    return () => {
      // Only stop if moving to hidden or if in tab/overlay mode but the session is not internally active
      if (viewMode === 'hidden' && isLiveSessionActiveInternal) {
         stopLiveSession();
      }
    };
  }, [viewMode, isLiveSessionActiveInternal, stopLiveSession]);

  const chatContainerClasses = `
    flex flex-col bg-gray-900 shadow-2xl z-50 transition-all duration-300 ease-out
    ${viewMode === 'overlay' ? 'fixed inset-x-0 bottom-0 h-[85vh] rounded-t-3xl' : ''}
    ${viewMode === 'tab' ? 'flex-1 h-full rounded-none' : ''}
    ${viewMode === 'hidden' ? 'hidden' : ''}
    ${viewMode === 'overlay' && !isLiveSessionActiveInternal && !isThinkingInternal ? 'translate-y-full' : 'translate-y-0'}
  `;

  if (viewMode === 'hidden') {
    return null;
  }

  // Determine status text and icon
  let statusText = 'Idle';
  let statusIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM7 9a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1zm6-1a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ); // Idle/Default

  if (error) {
    statusText = 'Error';
    statusIcon = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM7 9a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1zm6-1a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ); // Error
  } else if (isThinkingInternal && !isLiveSessionActiveInternal) {
    statusText = 'Connecting Chef Fridge...';
    statusIcon = (
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400 mr-1"></div>
    );
  } else if (isLiveSessionActiveInternal) {
    if (isSpeaking) {
      statusText = 'Chef Fridge is speaking...';
      statusIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-emerald-400 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7.001 7.001 0 006 6.93V17h-2a1 1 0 100 2h4a1 1 0 100-2h-2v-2.07z" clipRule="evenodd" />
        </svg>
      );
    } else if (liveTranscription) {
      statusText = 'Listening...';
      statusIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-cyan-400 animate-bounce" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7.001 7.001 0 006 6.93V17h-2a1 1 0 100 2h4a1 1 0 100-2h-2v-2.07z" clipRule="evenodd" />
        </svg>
      );
    } else {
      statusText = 'Connected';
      statusIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    }
  }

  const headerClasses = `flex items-center justify-between p-4 bg-gray-800 text-gray-100 font-bold text-xl relative z-10
    ${viewMode === 'overlay' ? 'rounded-t-3xl' : 'rounded-none'}
  `;

  return (
    <div className={chatContainerClasses}>
      <div className={headerClasses}>
        <div className="flex items-center">
          <span className="text-cyan-400 mr-2">Chef Fridge Live</span>
          <span className="text-sm font-medium flex items-center">
            {statusIcon}
            {statusText}
          </span>
        </div>
        {viewMode === 'overlay' && ( // Only show close button in overlay mode
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close chat">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex mb-4 ${
              message.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-xl shadow-md ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-700 text-gray-100 rounded-bl-none'
              }`}
            >
              <MarkdownContent content={message.text} />
              {message.isStreaming && (
                <span className="animate-pulse ml-2">...</span>
              )}
              {message.functionCalls && (
                <div className="mt-2 text-sm text-yellow-300">
                  <p>Function Calls:</p>
                  <pre className="bg-gray-800 p-2 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(message.functionCalls, null, 2)}
                  </pre>
                </div>
              )}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-2 text-xs text-gray-300">
                  <p className="font-semibold">Sources:</p>
                  <ul className="list-disc list-inside">
                    {message.sources.map((source, idx) => (
                      <li key={idx}>
                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                          {source.title || source.uri}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {liveTranscription && isLiveSessionActiveInternal && (
          <div className="flex justify-end mb-4 animate-fade-in">
            <div className="max-w-[70%] p-3 rounded-xl shadow-md bg-blue-700/50 text-blue-200 rounded-br-none italic">
              {liveTranscription}
              <span className="animate-pulse ml-2">...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700 bg-gray-900">
        {error && <p className="text-rose-400 text-center mb-2 text-sm">{error}</p>}
        <div className="flex space-x-2">
          {/* Microphone button */}
          <button
            onClick={() => {
              if (isLiveSessionActiveInternal) {
                stopLiveSession();
              } else {
                startLiveSession();
              }
            }}
            className={`p-3 rounded-xl transition duration-200 shadow-md flex items-center justify-center
              ${isLiveSessionActiveInternal ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse-light' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}
              ${isThinkingInternal ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            disabled={isThinkingInternal}
            aria-label={isLiveSessionActiveInternal ? "Stop voice input" : "Start voice input"}
          >
            {isLiveSessionActiveInternal ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7v1m0 0v1m0-1a7 7 0 01-7-7m7 7a7 7 0 007-7m0 0a7 7 0 01-7-7m7 7h1m0 0h1m0-1a7 7 0 01-7-7m7 7v-1m0 0v-1m0 1a7 7 0 00-7 7m0 0a7 7 0 01-7-7m7 7h-1m0 0h-1m0-1a7 7 0 017-7m0 0a7 7 0 00-7 7" />
              </svg>
            )}
          </button>

          <input
            type="text"
            className="flex-1 p-3 rounded-xl bg-gray-800 text-gray-100 border border-gray-700 focus:ring-cyan-400 focus:border-cyan-400 text-base"
            placeholder={isLiveSessionActiveInternal ? "Speaking..." : "Type your message..."}
            value={isLiveSessionActiveInternal ? liveTranscription : currentInput}
            onChange={(e) => !isLiveSessionActiveInternal && setCurrentInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isLiveSessionActiveInternal) {
                handleSendMessage(currentInput);
              }
            }}
            disabled={isLiveSessionActiveInternal || isThinkingInternal}
            aria-label={isLiveSessionActiveInternal ? "Voice input active" : "Chat input"}
          />
          <button
            onClick={() => handleSendMessage(currentInput)}
            className="bg-cyan-600 text-white p-3 rounded-xl hover:bg-cyan-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLiveSessionActiveInternal || isThinkingInternal || !currentInput.trim()}
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;