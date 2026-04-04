import React, { Suspense, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { EffectComposer, DepthOfField, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import AvatarModel from './Avatar/AvatarModel';
import AvaturnEditor from './Avatar/AvaturnEditor';
import { ControlBar } from './ControlBar';
import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.warn("WebGL Canvas crashed:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex w-full h-full items-center justify-center bg-gray-900 text-white text-xs p-4 text-center">
          3D Avatar unavailable due to a WebGL error. Using lightweight mode.
        </div>
      );
    }
    return this.props.children;
  }
}

export function WidgetShell() {
  const currentResponse = useAvatarStore(s => s.currentResponse);
  const avatarStore     = useAvatarStore();
  const avatarState     = useAvatarStore(s => s.avatarState);
  const currentTranscript = useAvatarStore(s => s.currentTranscript);
  const isGreeting      = avatarState === AVATAR_STATES.GREETING;
  const isListening     = avatarState === AVATAR_STATES.LISTENING;
  const isThinking      = avatarState === AVATAR_STATES.THINKING;
  const isPassive       = avatarState === AVATAR_STATES.PASSIVE;
  const isHeadless = navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent);

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 flex flex-col z-50">
      
      {/* 3D Container Box */}
      <div className="flex-1 relative overflow-hidden">
        
        {/* Chat / Fallback Status Overhead - REMOVED per user request */}

        {/* 3D Canvas */}
        <ErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0.6, 3.2], fov: 45 }} // Moved back and down
          gl={{ 
            antialias: true, 
            alpha: true, 
            preserveDrawingBuffer: true, 
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            outputColorSpace: THREE.SRGBColorSpace
          }}
          shadows={true}
        >
          <ambientLight intensity={1.2} />
          <directionalLight position={[1, 2, 5]} intensity={2.5} castShadow />
          
          <Suspense fallback={<HtmlFallback />}>
            <group position={[0, -0.65, 0]}> {/* Adjusted group Y */}
               <AvatarModel />
            </group>
            <Environment preset="apartment" blur={0.8} />
          </Suspense>

          {!isHeadless && (
            <EffectComposer disableNormalPass multisampling={8}>
              <DepthOfField 
                focusDistance={3.2} 
                focalLength={0.05} 
                bokehScale={1.2} 
                height={720} 
              />
              <Bloom luminanceThreshold={1.2} luminanceSmoothing={1.0} height={480} intensity={0.4} />
            </EffectComposer>
          )}

          <OrbitControls 
            target={[0, 0.6, 0]} // Lowered target to center feet/body better
            enableZoom={false} 
            enablePan={false} 
            enableRotate={false} 
          />
        </Canvas>

        </ErrorBoundary>

        {/* Greeting Overlay */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: isGreeting ? 1 : 0,
          transform: isGreeting ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #60efff, #0061ff)',
            boxShadow: '0 0 8px #60efff',
            flexShrink: 0,
            animation: isGreeting ? 'greetPulse 1.2s ease-in-out infinite' : 'none',
          }} />
          <p style={{
            margin: 0,
            color: '#fff',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '0.01em',
            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
          }}>
            Hello! 👋 How can I help you today?
          </p>
        </div>

        {/* Siri-style Status Overlays */}
        
        {/* Phase 3: Listening Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '16px',
          background: 'linear-gradient(to bottom, rgba(30,58,138,0.4) 0%, transparent 100%)',
          opacity: isListening ? 1 : 0,
          transform: isListening ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
          zIndex: 20
        }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_#60a5fa]" />
            <span className="text-blue-100 text-xs font-semibold tracking-wider uppercase">Listening...</span>
          </div>
          <p className="text-white text-sm mt-2 font-medium leading-tight drop-shadow-md italic opacity-90 transition-all duration-200">
            {currentTranscript || "Say something..."}
          </p>
        </div>

        {/* Phase 4: Thinking Overlay */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${isThinking ? 1 : 0.8})`,
          opacity: isThinking ? 1 : 0,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 rounded-full bg-white animate-bounce" />
          </div>
          <span className="text-white text-[10px] font-bold tracking-[0.2em] uppercase opacity-60">Thinking</span>
        </div>

        {/* Phase 1: Passive/Idle Hint */}
        <div style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          opacity: isPassive ? 0.6 : 0,
          transition: 'opacity 0.6s ease',
          pointerEvents: 'none'
        }}>
           <span className="text-white/40 text-[10px] font-medium tracking-tight">Say "Hi Belli" to start...</span>
        </div>

        {/* Store Progress Indicator */}
        {avatarStore.isLoading && (
          <div className="absolute bottom-2 left-0 right-0 px-4">
             <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${avatarStore.loadingProgress}%` }} />
             </div>
          </div>
        )}
      </div>

      <ControlBar />
      <AvaturnEditor />
    </div>
  );
}

function HtmlFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial color="gray" wireframe />
    </mesh>
  );
}

