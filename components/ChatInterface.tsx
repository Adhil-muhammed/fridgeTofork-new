import React, { useState, useEffect, useRef, useCallback } from 'react';
import geminiService from '../services/geminiService';
import { ChatMessage } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { v4 as uuidv4 } from 'uuid';
import { FunctionCall, LiveServerMessage, Chat, Session } from '@google/genai';

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  setLiveSessionActive: (active: boolean) => void;
  setThinking: (thinking: boolean) => void;
  // Fix: Update the prop types to correctly reflect that they are `useState` setter functions.
  // These setters accept `React.SetStateAction<T>`, which can be a direct value `T` or a function `(prevState: T) => T`.
  // When setting a function value, it's common to use `() => funcValue` to avoid the setter interpreting `funcValue` as a state updater.
  setStartLiveSession: React.Dispatch<React.SetStateAction<() => Promise<void>>>;
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
  isOpen,
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

    if (isOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [isOpen, messages, liveTranscription]);

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
    console.log('Live session stopped and resources released.');
  }, [micStream, stopAllAudioPlayback]);


  const handleLiveSessionMessage = useCallback(async (message: LiveServerMessage) => {
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

    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text;
      setMessages((prev) => {
        const lastGeminiMessage = prev[prev.length - 1];
        if (lastGeminiMessage && lastGeminiMessage.sender === 'gemini' && lastGeminiMessage.isStreaming) {
          return prev.map(msg => msg.id === lastGeminiMessage.id ? { ...msg, text: lastGeminiMessage.text + text } : msg);
        } else {
          return [...prev, { id: uuidv4(), sender: 'gemini', text, isStreaming: true, timestamp: new Date() }];
        }
      });
    }

    if (message.serverContent?.inputTranscription) {
      const text = message.serverContent.inputTranscription.text;
      setLiveTranscription(text);
    }

    if (message.serverContent?.turnComplete) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg,
        ),
      );
      setLiveTranscription('');
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


  const startLiveSession = useCallback(async () => {
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
          // Initial greeting from the model is already added in useEffect
          // addMessage({ sender: 'gemini', text: "Hello! How can Chef Fridge help you today?", isStreaming: false });

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
        },
        onMessage: handleLiveSessionMessage,
        onError: (e) => {
          console.error('Gemini Live session error:', e);
          setError(`Live session error: ${e.message || 'Unknown error'}`);
          setIsLiveSessionActiveInternal(false);
          setIsThinkingInternal(false);
          stopLiveSession();
          addMessage({ sender: 'gemini', text: `Sorry, an error occurred in the live chat: ${e.message || 'Please check your connection and try again.'}` });
        },
        onClose: (e) => {
          console.log('Gemini Live session closed', e);
          setIsLiveSessionActiveInternal(false);
          setIsThinkingInternal(false);
          stopLiveSession();
          if (e.code !== 1000) {
            addMessage({ sender: 'gemini', text: `Live chat session disconnected: ${e.reason || 'Please try reconnecting.'}` });
          }
        },
        inputAudioContext: inputAudioContextRef.current,
        outputAudioContext: outputAudioContextRef.current,
      });
    } catch (err: any) {
      console.error('Failed to start live session:', err);
      setError(`Failed to connect to live session: ${err.message || 'Please ensure microphone access is granted and try again.'}`);
      setIsThinkingInternal(false);
      stopLiveSession();
    }
  }, [isLiveSessionActiveInternal, handleLiveSessionMessage, addMessage, stopAllAudioPlayback, stopLiveSession]);


  useEffect(() => {
    // Fix: The `setStartLiveSession` and `setStopLiveSession` props are `useState` setter functions.
    // To set a function as the state value, wrap it in an arrow function `() => value` to prevent `useState`
    // from interpreting the `value` itself as a functional update.
    setStartLiveSession(() => startLiveSession);
    setStopLiveSession(() => stopLiveSession);
  }, [startLiveSession, stopLiveSession, setStartLiveSession, setStopLiveSession]);


  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, [stopLiveSession]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 h-[85vh] bg-gray-950 rounded-t-3xl shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Chef Fridge Live Chat"
    >
      <div className="relative p-6 border-b border-gray-700 flex items-center justify-between bg-gray-900">
        <h2 className="text-3xl font-bold text-gray-100 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 mr-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7v1m0 0v1m0-1a7 7 0 01-7-7m7 7a7 7 0 007-7m0 0a7 7 0 01-7-7m7 7h1m0 0h1m0-1a7 7 0 01-7-7m7 7v-1m0 0v-1m0 1a7 7 0 00-7 7m0 0a7 7 0 01-7-7m7 7h-1m0 0h-1m0-1a7 7 0 017-7m0 0a7 7 0 00-7 7" />
          </svg>
          Chef Fridge Live
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition duration-200 text-gray-300"
          aria-label="Close chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 bg-gray-900 mb-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
            <div
              className={`max-w-[80%] p-4 rounded-xl shadow-md text-lg leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-700/50 backdrop-blur-sm text-gray-100'
              }`}
              role="status"
            >
              <MarkdownContent content={msg.text} />
              {msg.isStreaming && msg.sender === 'gemini' && (
                <span className="animate-pulse text-sm ml-2 text-gray-300">...</span>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 text-sm text-gray-300 border-t border-gray-600 pt-3">
                  <p className="font-semibold mb-1">Sources:</p>
                  <ul className="list-disc list-inside">
                    {msg.sources.map((source, idx) => (
                      <li key={idx}>
                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-200">
                          {source.title || source.uri}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
               {msg.functionCalls && msg.functionCalls.length > 0 && (
                <div className="mt-3 text-sm text-gray-300 border-t border-gray-600 pt-3">
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
              <div className="text-right text-xs mt-2 opacity-80">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {liveTranscription && (
          <div className="flex justify-end mb-4">
            <div className="max-w-[80%] p-4 rounded-xl shadow-md text-lg bg-blue-900/50 text-blue-200 italic">
              {liveTranscription} <span className="animate-pulse text-sm ml-1">...</span>
            </div>
          </div>
        )}
        {(isThinkingInternal && !isLiveSessionActiveInternal) && (
          <div className="flex justify-start mb-4">
            <div className="max-w-[80%] p-4 rounded-xl shadow-md text-lg bg-gray-700/50 text-gray-100 flex items-center">
              <LoadingSpinner message="Connecting Chef Fridge..." />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-rose-400 text-center mb-4 text-sm">{error}</p>}

      <div className="flex items-center space-x-3 p-4 border-t border-gray-700 bg-gray-900">
        <input
          type="text"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !isThinkingInternal && currentInput.trim() && !isLiveSessionActiveInternal) {
              handleSendMessage(currentInput);
            }
          }}
          placeholder="Ask Chef Fridge anything..."
          className="flex-1 p-4 border border-gray-600 rounded-xl focus:ring-cyan-400 focus:border-cyan-400 text-lg bg-gray-800 text-gray-100"
          disabled={isThinkingInternal || isLiveSessionActiveInternal}
          aria-label="Chat input"
        />
        <button
          onClick={() => handleSendMessage(currentInput)}
          className="p-4 bg-gradient-to-r from-cyan-400 to-emerald-500 text-white rounded-xl hover:from-cyan-500 hover:to-emerald-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          disabled={!currentInput.trim() || isThinkingInternal || isLiveSessionActiveInternal}
          aria-label="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
        <button
          onClick={() => handleSendMessage(currentInput, true)}
          className="p-4 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl hover:from-indigo-600 hover:to-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          disabled={!currentInput.trim() || isThinkingInternal || isLiveSessionActiveInternal}
          title="Send with Google Search Grounding"
          aria-label="Send message with Google Search Grounding"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;