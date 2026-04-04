"use client";

import { useChat } from 'ai/react';
import type { Message } from 'ai';
import { useEffect, useRef, useState } from 'react';
import { useChatState } from '../hooks/useChatState';
import { Mic, MicOff } from 'lucide-react';
import { SiriOrb } from './SiriOrb';

// Add TypeScript support for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function ChatOverlay({ setAudioData }: { setAudioData: (data: Uint8Array | null) => void }) {
  const { appState, setAppState, currentTranscript, setCurrentTranscript, isMicMuted, toggleMic } = useChatState();
  const { messages, append } = useChat({
    api: '/api/chat',
    onFinish: (message: Message) => {
      // AI stream finished, now speak it
      speakText(message.content);
    },
    onError: (error: Error) => {
      setAppState('ERROR');
      console.error(error);
    }
  });

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const hasGreeted = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    // Only auto-greet when the user has clicked start
    if (hasStarted && !hasGreeted.current) {
        hasGreeted.current = true;
        if (!audioContextRef.current && typeof window !== 'undefined') {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        speakText("Hello! I am your AI agent. How can I assist you today?");
    }

    // Initialize Speech Recognition
    if (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        const currentText = finalTranscript || interimTranscript;
        setCurrentTranscript(currentText);
        
        if (finalTranscript && !!finalTranscript.trim()) {
          setAppState('THINKING');
          useChatState.getState().setCurrentAction(''); // reset action
          append({ role: 'user', content: finalTranscript });
        }
      };

      recognitionRef.current.onend = () => {
        if (!isMicMuted && (useChatState.getState().appState === 'IDLE' || useChatState.getState().appState === 'LISTENING')) {
           try {
              recognitionRef.current?.start();
           } catch(e) {}
        }
      };
      
      recognitionRef.current.onstart = () => {
         if (useChatState.getState().appState === 'IDLE') {
             setAppState('LISTENING');
         }
      }
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isMicMuted && appState === 'IDLE') {
       try {
         recognitionRef.current?.start();
       } catch(e) {}
    } else if (isMicMuted || appState === 'SPEAKING' || appState === 'THINKING') {
      try {
         recognitionRef.current?.stop();
      } catch(e){}
    }
  }, [appState, isMicMuted]);

  const speakText = async (text: string) => {
    setAppState('SPEAKING');

    // Parse [ANIM: xxx] command
    const animRegex = /\[ANIM:\s*([a-zA-Z0-9_-]+)\]/i;
    const match = text.match(animRegex);
    let spokenText = text;
    
    if (match && match[1]) {
       useChatState.getState().setCurrentAction(match[1]);
       spokenText = text.replace(animRegex, '').trim();
    } else {
       useChatState.getState().setCurrentAction('');
    }

    if (!spokenText.trim()) {
       // If there's no text but there was an action, just play the action
       // with a fallback to prevent 400 Bad Request
       spokenText = "..."; 
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const response = await fetch('/api/speak', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ text: spokenText })
      });

      if (!response.ok) throw new Error("TTS failed to return audio");
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      sourceRef.current = audioContextRef.current.createBufferSource();
      sourceRef.current.buffer = audioBuffer;
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.5;

      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);

      sourceRef.current.onended = () => {
         setAudioData(null);
         if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
         // Small delay before returning to idle to finish animations naturally
         setTimeout(() => {
            setAppState('IDLE');
            useChatState.getState().setCurrentAction('');
         }, 500);
      };

      sourceRef.current.start();

      const analyzeAudio = () => {
         if (analyserRef.current) {
             const bufferLength = analyserRef.current.frequencyBinCount;
             const dataArray = new Uint8Array(bufferLength);
             analyserRef.current.getByteFrequencyData(dataArray);
             setAudioData(dataArray);
         }
         animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };
      
      analyzeAudio();

    } catch (err) {
      console.error(err);
      setAppState('ERROR');
      setTimeout(() => setAppState('IDLE'), 2000);
    }
  };

  const handleToggleMic = () => {
    toggleMic();
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 pb-20">
      
      {!hasStarted && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 pointer-events-auto p-8 text-center">
           <div className="mb-6 w-16 h-16 bg-white/10 rounded-full flex items-center justify-center animate-pulse">
             <Mic className="text-white w-8 h-8" />
           </div>
           <h2 className="text-white text-xl font-semibold mb-2">Ready to chat?</h2>
           <p className="text-white/60 text-sm mb-8">Start the experience to talk with your AI agent.</p>
           <button 
             onClick={() => setHasStarted(true)} 
             className="w-full py-4 bg-white text-black hover:bg-white/90 rounded-2xl font-bold transition-all shadow-xl"
           >
             Start Experience
           </button>
        </div>
      )}

      <div className="w-full flex justify-center">
         <div className="w-full max-h-48 overflow-y-auto pointer-events-auto bg-black/20 backdrop-blur-sm rounded-xl p-3 flex flex-col gap-2 border border-white/5">
            {messages.length === 0 && <p className="text-white/30 text-[10px] uppercase tracking-widest text-center mt-2 font-bold">Chat history</p>}
            {messages.map((m: Message) => (
               <div key={m.id} className={`text-xs px-3 py-1.5 rounded-lg max-w-[85%] ${m.role === 'user' ? 'bg-blue-600/30 text-blue-100 self-end text-right' : 'bg-white/5 text-white/90 self-start text-left'}`}>
                  {m.content}
               </div>
            ))}
         </div>
      </div>
      
      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4 pointer-events-auto">
        {currentTranscript && (appState === 'LISTENING' || appState === 'THINKING') && (
            <div className="flex flex-col items-center gap-2 px-4 w-full">
               <div className="text-sm text-white font-medium bg-black/60 px-4 py-2 rounded-2xl backdrop-blur-md animate-pulse border border-white/10 text-center w-full max-w-[280px]">
                  {appState === 'THINKING' ? "Checking that..." : currentTranscript}
               </div>
            </div>
        )}
        
        <div className="scale-75">
           <SiriOrb />
        </div>
        
        <button 
           onClick={handleToggleMic}
           className={`p-5 rounded-full transition-all flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 ${isMicMuted ? 'bg-red-500/80' : 'bg-white text-black'}`}
        >
           {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
      </div>

    </div>
  );
}
