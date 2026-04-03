import React from 'react';
import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';
import { useSpeech } from '../hooks/useSpeech';

export function ControlBar() {
  const [textInput, setTextInput] = React.useState('');
  const [showTextInput, setShowTextInput] = React.useState(false);

  const avatarStore = useAvatarStore();
  const avatarState = avatarStore.avatarState;
  const settings = avatarStore.settings;
  const updateSettings = avatarStore.updateSettings;

  const { startRecording, stopRecording, stopPlayback } = useSpeech();

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    // For text input, we can still use the store's addMessage and then trigger the AI flow
    // or just let the existing logic handle it. 
    // However, the repo's useSpeech is primarily audio-focused.
    // I'll add a simple text processing bridge in a future step if needed.
    // For now, let's focus on the primary voice interactions requested.
    setTextInput('');
    setShowTextInput(false);
  };

  const isRecording = avatarState === AVATAR_STATES.LISTENING;
  const isProcessing = avatarState === AVATAR_STATES.THINKING;

  return (
    <div className="flex flex-col relative w-full mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Expanded Text Input Box */}
      {showTextInput && (
        <form onSubmit={handleTextSubmit} className="absolute bottom-18 left-0 right-0 p-2 bg-white/10 backdrop-blur-xl rounded-2xl border border-black/20 z-50 shadow-2xl flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="Message..."
            className="flex-1 bg-black/40 text-white px-4 py-2 rounded-xl outline-none text-sm border border-white/5 active:border-white/20 transition-all"
            autoFocus
          />
          <button type="submit" className="px-4 py-2 bg-blue-500 hover:bg-blue-400 rounded-xl text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20">
            Send
          </button>
        </form>
      )}

      <div className="flex items-center justify-center gap-6 w-full h-16 px-4 relative overflow-hidden">

        {/* Visual Pulse for active states */}
        {isRecording && <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />}
        {isProcessing && <div className="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none" />}

        {/* Input Toggle */}
        <button
          onClick={() => setShowTextInput(!showTextInput)}
          className={`p-2 transition-all duration-300 rounded-xl ${showTextInput ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
          title="Text Input"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" /></svg>
        </button>

        {/* Main Voice Button */}
        <div className="relative flex items-center justify-center">
          {!isRecording && !isProcessing ? (
            <button
              onPointerDown={() => {
                startRecording();
              }}
              className="p-4 bg-blue-600 hover:bg-blue-500 rounded-full transition-all active:scale-90 shadow-xl shadow-blue-600/30 group"
              title="Hold to Talk"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
              <div className="absolute inset-0 rounded-full border border-blue-400 opacity-0 group-hover:animate-ping-slow pointer-events-none" />
            </button>
          ) : isRecording ? (
            <button
              onPointerUp={() => {
                stopRecording();
              }}
              className="p-4 bg-red-500 rounded-full active:scale-95 shadow-xl shadow-red-500/40 relative z-10"
              title="Release to Send"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /></svg>
              <div className="absolute -inset-1 rounded-full border-2 border-red-500/50 animate-ping-slow pointer-events-none" />
            </button>
          ) : (
            <div className="p-4 bg-white/10 rounded-full cursor-wait opacity-80 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

