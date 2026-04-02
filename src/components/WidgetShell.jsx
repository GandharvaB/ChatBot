import React, { Suspense, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { EffectComposer, DepthOfField, Bloom } from '@react-three/postprocessing';
import AvatarModel from './Avatar/AvatarModel';
import { ControlBar } from './ControlBar';
import useAvatarStore from '../store/avatarStore';

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
  const avatarStore = useAvatarStore();
  const isHeadless = navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent);

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 flex flex-col z-50">
      
      {/* 3D Container Box */}
      <div className="flex-1 relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Chat / Fallback Status Overhead */}
        {currentResponse && (
          <div className="absolute top-4 left-4 right-4 z-10 
                          bg-white/10 backdrop-blur-md rounded-xl p-3 text-sm text-white border border-white/20 shadow-md transform transition-all max-h-24 overflow-y-auto">
             {currentResponse}
          </div>
        )}

        {/* 3D Canvas */}
        <ErrorBoundary>
        <Canvas
          camera={{ position: [0, 1.45, 1.5], fov: 35 }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
          shadows={true}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[1, 2, 3]} intensity={1.5} castShadow />
          
          <Suspense fallback={<HtmlFallback />}>
            <group position={[0, -0.4, 0]}>
               <AvatarModel />
            </group>
            <Environment preset="apartment" blur={0.8} />
          </Suspense>

          {/* Post Processing Effects - disabled for headless tests */}
          {!isHeadless && (
            <EffectComposer disableNormalPass multisampling={4}>
              <DepthOfField focusDistance={1} focalLength={0.02} bokehScale={2} height={480} />
              <Bloom luminanceThreshold={1} luminanceSmoothing={0.9} height={300} intensity={0.5} />
            </EffectComposer>
          )}

          <OrbitControls 
            target={[0, 1.3, 0]} 
            enableZoom={false} 
            enablePan={false} 
            enableRotate={false} 
          />
        </Canvas>

        </ErrorBoundary>

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

