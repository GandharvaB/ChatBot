import React, { useCallback, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';
import { useSpeech } from '../hooks/useSpeech';
import { useGesture } from '../hooks/useGesture';

export default function MicButton() {
  const avatarState = useAvatarStore((s) => s.avatarState);
  const isMicActive = useAvatarStore((s) => s.isMicActive);
  const micVolume = useAvatarStore((s) => s.micVolume);
  const [isPressed, setIsPressed] = useState(false);

  const { startRecording, stopRecording, stopPlayback } = useSpeech();
  const { triggerGesture } = useGesture();

  // Watch for new AI responses to trigger gestures
  const messages = useAvatarStore((s) => s.messages);
  const lastProcessedRef = useRef(0);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.id !== lastProcessedRef.current) {
        lastProcessedRef.current = lastMsg.id;
        triggerGesture(lastMsg.content);
      }
    }
  }, [messages, triggerGesture]);

  // Push-to-talk handlers
  const handlePointerDown = useCallback(async (e) => {
    e.preventDefault();

    if (avatarState === AVATAR_STATES.SPEAKING) {
      stopPlayback();
      return;
    }

    setIsPressed(true);
    await startRecording();
  }, [avatarState, startRecording, stopPlayback]);

  const handlePointerUp = useCallback(async (e) => {
    e.preventDefault();
    if (!isPressed) return;
    setIsPressed(false);
    await stopRecording();
  }, [isPressed, stopRecording]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        if (avatarState === AVATAR_STATES.LISTENING || avatarState === AVATAR_STATES.IDLE) {
          setIsPressed(true);
          startRecording();
        }
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        stopPlayback();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        if (isPressed) {
          setIsPressed(false);
          stopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [avatarState, isPressed, startRecording, stopRecording, stopPlayback]);

  // Determine button state
  const isListening = avatarState === AVATAR_STATES.LISTENING;
  const isSpeaking = avatarState === AVATAR_STATES.SPEAKING;
  const isThinking = avatarState === AVATAR_STATES.THINKING;

  const ringScale = isListening ? 1 + micVolume * 3 : 1;

  return (
    <div className="mic-button-container">
      {/* Keyboard hint */}
      <div className="mic-hint">
        {isListening ? 'Release to send' : isSpeaking ? 'Click to stop' : 'Hold Space or press to talk'}
      </div>

      {/* Animated ring */}
      <motion.div
        className={`mic-ring ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''} ${isThinking ? 'thinking' : ''}`}
        animate={{
          scale: ringScale,
          opacity: isListening || isSpeaking ? 1 : 0.5,
        }}
        transition={{ duration: 0.1 }}
      />

      {/* Waveform bars for speaking */}
      {isSpeaking && (
        <div className="speaking-bars">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="speaking-bar"
              animate={{
                scaleY: [0.3, 1, 0.5, 0.8, 0.3],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.1,
              }}
            />
          ))}
        </div>
      )}

      {/* Main button */}
      <motion.button
        className={`mic-button ${isListening ? 'active' : ''} ${isSpeaking ? 'speaking' : ''} ${isThinking ? 'thinking' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={(e) => {
          if (isPressed) {
            setIsPressed(false);
            stopRecording();
          }
        }}
        whileTap={{ scale: 0.92 }}
        disabled={isThinking}
      >
        {isListening ? (
          // Listening icon
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : isSpeaking ? (
          // Stop icon
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : isThinking ? (
          // Thinking spinner
          <motion.svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </motion.svg>
        ) : (
          // Mic icon
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}
      </motion.button>
    </div>
  );
}
