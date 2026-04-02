import { useCallback, useRef } from 'react';
import useAvatarStore from '../store/avatarStore';

const GESTURE_MAP = [
  { pattern: /\b(hello|hi|hey|welcome|greetings|namaste|namaskar)\b/i, gesture: 'wave_hello' },
  { pattern: /\b(first|second|third|1\.|step|list)\b/i, gesture: 'counting_fingers' },
  { pattern: /\b(wait|listen|however|but|actually)\b/i, gesture: 'cross_arms' },
  { pattern: /\b(not sure|maybe|perhaps|i don'?t know|might be|possibly)\b/i, gesture: 'shrug' },
  { pattern: /\b(explain|because|reason|understand|you see|basically)\b/i, gesture: 'explain_hands' },
  { pattern: /\b(important|key point|note that|remember|crucial|significant|look|there)\b/i, gesture: 'point_forward' },
  { pattern: /\b(think|consider|hmm|let me think|ponder|wondering)\b/i, gesture: 'thinking_pose' },
  { pattern: /\b(yes|correct|right|exactly|absolutely|indeed|sure)\b/i, gesture: 'nod_yes' },
  { pattern: /\b(no|wrong|incorrect|not really|nope|negative)\b/i, gesture: 'shake_no' },
  { pattern: /\b(welcome|come|join|together|everyone|all of you|open)\b/i, gesture: 'both_hands_open' },
];

// Emotion detection from text
const EMOTION_PATTERNS = {
  happy: /\b(happy|great|wonderful|amazing|excellent|fantastic|love|glad|joy|awesome|beautiful|excited)\b/i,
  sad: /\b(sorry|sad|unfortunate|regret|apolog|disappoint|unfortunately|bad news)\b/i,
};

export function useGesture() {
  const gestureTimeoutRef = useRef(null);
  const lastGestureTimeRef = useRef(0);

  // Detect gesture from text
  const detectGesture = useCallback((text) => {
    if (!text) return null;

    const now = Date.now();
    // Throttle: minimum 2s between gestures
    if (now - lastGestureTimeRef.current < 2000) return null;

    for (const { pattern, gesture } of GESTURE_MAP) {
      if (pattern.test(text)) {
        lastGestureTimeRef.current = now;
        return gesture;
      }
    }
    return null;
  }, []);

  // Detect emotion from text
  const detectEmotion = useCallback((text) => {
    if (!text) return 'neutral';

    for (const [emotion, pattern] of Object.entries(EMOTION_PATTERNS)) {
      if (pattern.test(text)) {
        return emotion;
      }
    }
    return 'neutral';
  }, []);

  // Trigger gesture on avatar
  const triggerGesture = useCallback((text) => {
    const gesture = detectGesture(text);
    const emotion = detectEmotion(text);

    if (gesture) {
      useAvatarStore.getState().setActiveGesture(gesture);

      // Clear gesture after duration
      if (gestureTimeoutRef.current) {
        clearTimeout(gestureTimeoutRef.current);
      }

      gestureTimeoutRef.current = setTimeout(() => {
        useAvatarStore.getState().setActiveGesture(null);
      }, 2500);
    }

    if (emotion !== 'neutral') {
      useAvatarStore.getState().setCurrentEmotion(emotion);

      // Reset emotion after a while
      setTimeout(() => {
        useAvatarStore.getState().setCurrentEmotion('neutral');
      }, 4000);
    }
  }, [detectGesture, detectEmotion]);

  return {
    detectGesture,
    detectEmotion,
    triggerGesture,
  };
}
