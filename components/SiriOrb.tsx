"use client";

import { motion } from 'framer-motion';
import { useChatState } from '../hooks/useChatState';

export function SiriOrb() {
  const appState = useChatState(s => s.appState);

  let animateProps = {};
  let gradient = "";

  switch (appState) {
    case 'IDLE':
      gradient = "radial-gradient(circle, #6ca0dc 0%, #3a5f8f 100%)";
      animateProps = {
        scale: [1, 1.05, 1],
        opacity: [0.6, 0.8, 0.6],
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
      };
      break;
    case 'LISTENING':
      gradient = "radial-gradient(circle, #00d2ff 0%, #3a7bd5 100%)";
      animateProps = {
        scale: [1, 1.2, 1],
        opacity: [0.8, 1, 0.8],
        transition: { duration: 1, repeat: Infinity, ease: "easeInOut" }
      };
      break;
    case 'THINKING':
      gradient = "radial-gradient(circle, #b224ef 0%, #7579ff 100%)";
      animateProps = {
        rotate: [0, 360],
        scale: [1, 1.1, 1],
        transition: { rotate: { duration: 2, repeat: Infinity, ease: "linear" }, scale: { duration: 1, repeat: Infinity } }
      };
      break;
    case 'SPEAKING':
      gradient = "radial-gradient(circle, #11998e 0%, #38ef7d 100%)";
      animateProps = {
        scale: [1, 1.3, 1.1, 1.4, 1],
        opacity: [0.7, 1, 0.8, 1, 0.7],
        transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
      };
      break;
    case 'ERROR':
      gradient = "radial-gradient(circle, #ff416c 0%, #ff4b2b 100%)";
      animateProps = {
        scale: 1,
        opacity: 0.5,
      };
      break;
  }

  const labelMap: Record<string, string> = {
    IDLE: "Tap mic to speak",
    LISTENING: "Listening...",
    THINKING: "Thinking...",
    SPEAKING: "Speaking...",
    ERROR: "Error occurred",
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        className="w-16 h-16 rounded-full shadow-lg"
        style={{ background: gradient, boxShadow: "0 0 20px rgba(0,0,0,0.5)" }}
        animate={animateProps}
      />
      <div className="text-white/80 text-sm font-medium tracking-wide">
        {labelMap[appState]}
      </div>
    </div>
  );
}
