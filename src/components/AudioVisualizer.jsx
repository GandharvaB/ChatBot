import React, { useRef, useEffect } from 'react';
import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';

export default function AudioVisualizer() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const avatarState = useAvatarStore((s) => s.avatarState);
  const micVolume = useAvatarStore((s) => s.micVolume);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = 120;
    canvas.width = size * 2;
    canvas.height = size * 2;

    const centerX = size;
    const centerY = size;
    const radius = 42;

    let phase = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isListening = avatarState === AVATAR_STATES.LISTENING;
      const isSpeaking = avatarState === AVATAR_STATES.SPEAKING;
      const isThinking = avatarState === AVATAR_STATES.THINKING;

      if (!isListening && !isSpeaking && !isThinking) {
        // Subtle idle pulse
        phase += 0.02;
        const pulseRadius = radius + Math.sin(phase) * 2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      phase += 0.05;
      const bars = 32;

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;

        let amplitude;
        if (isListening) {
          amplitude = micVolume * 80 + Math.sin(phase + i * 0.3) * 5;
        } else if (isSpeaking) {
          amplitude = Math.sin(phase * 2 + i * 0.5) * 12 + Math.cos(phase * 3 + i * 0.7) * 8;
        } else {
          amplitude = Math.sin(phase + i * 0.2) * 3;
        }

        amplitude = Math.max(2, Math.abs(amplitude));

        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + amplitude);
        const y2 = centerY + Math.sin(angle) * (radius + amplitude);

        let color;
        if (isListening) {
          color = `rgba(74, 222, 128, ${0.6 + amplitude * 0.01})`;
        } else if (isSpeaking) {
          color = `rgba(251, 191, 36, ${0.5 + amplitude * 0.02})`;
        } else {
          color = `rgba(147, 197, 253, ${0.3 + amplitude * 0.01})`;
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Glow ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
      if (isListening) {
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
      } else if (isSpeaking) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
      } else {
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.2)';
      }
      ctx.lineWidth = 2;
      ctx.stroke();

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [avatarState, micVolume]);

  return (
    <canvas
      ref={canvasRef}
      className="audio-visualizer"
      style={{
        position: 'absolute',
        width: '120px',
        height: '120px',
        pointerEvents: 'none',
      }}
    />
  );
}
