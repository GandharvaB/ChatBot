import React from 'react';
import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';
import { useSpeech } from '../hooks/useSpeech';

export function DevControls() {
  const avatarStore = useAvatarStore();
  const { startRecording, stopRecording } = useSpeech();

  const states = Object.values(AVATAR_STATES);

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2 z-50">
      <div className="flex gap-2 flex-wrap">
        {states.map((s) => (
          <button
            key={s}
            onClick={() => avatarStore.setAvatarState(s)}
            className={`px-4 py-2 rounded shadow-md text-sm font-semibold transition-colors cursor-pointer
              ${avatarStore.avatarState === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}
          >
            {s}
          </button>
        ))}
      </div>
      
      <div className="flex gap-2 mt-4">
          <button 
            onMouseDown={startRecording} 
            onMouseUp={stopRecording} 
            className={`px-6 py-3 rounded-full font-bold shadow-xl transition-all ${avatarStore.avatarState === AVATAR_STATES.LISTENING ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-800 hover:bg-blue-50'}`}
          >
            🎤 Hold to Record
          </button>
      </div>

      {(avatarStore.currentTranscript || avatarStore.currentResponse) && (
        <div className="mt-4 p-4 bg-black/50 text-white text-sm max-w-sm rounded-lg backdrop-blur-md">
          <p><strong>You:</strong> {avatarStore.currentTranscript}</p>
          <p className="mt-2 text-blue-300"><strong>AI:</strong> {avatarStore.currentResponse}</p>
        </div>
      )}
    </div>
  );
}

