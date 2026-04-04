import React from 'react';
import { WidgetShell } from './components/WidgetShell';
import { DevControls } from './components/DevControls';
import { VoiceManager } from './voice/VoiceManager';

export default function App() {
  return (
    <div className="w-full h-screen bg-[#E29BBB] overflow-hidden relative font-sans text-slate-900">

      {/* Background content representing a placeholder website */}
      <div className="absolute inset-0 p-12 overflow-auto">
        <h1 className="text-4xl text-slate-900 font-bold mb-6">Welcome to Your Platform</h1>
        <p className="max-w-xl text-lg text-slate-600 mb-6">
          This is your primary website interface. The voice-interactive 3D Avatar Chatbot resides persistently in the bottom-right corner as a floating widget to assist visitors dynamically without breaking the page context.
        </p>
        <div className="grid grid-cols-3 gap-6 opacity-30 pointer-events-none mt-16">
          <div className="h-48 bg-white/10 rounded-2xl" />
          <div className="h-48 bg-white/10 rounded-2xl" />
          <div className="h-48 bg-white/10 rounded-2xl" />
        </div>
      </div>

      {/* Dev UI - keep for testing */}
      <DevControls />

      {/* The Actual Voice AI Widget */}
      <VoiceManager />
      <WidgetShell />

    </div>
  );
}
