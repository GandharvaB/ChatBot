"use client";

import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, useGLTF } from '@react-three/drei';
import { Suspense, useState, useEffect } from 'react';
import { Avatar3D } from '../components/Avatar3D';
import { ChatOverlay } from '../components/ChatOverlay';
import * as THREE from 'three';

// Fallback skeleton
function AvatarSkeleton() {
  return (
    <mesh position={[0, 1.5, 0]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#444" wireframe />
    </mesh>
  );
}

export default function Home() {
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);

  return (
    <main className="w-full h-screen bg-black overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <h1 className="text-white/10 text-9xl font-bold select-none">AI Agent</h1>
      </div>
      
      {/* Fixed Widget Container Bottom-Right */}
      <div className="fixed bottom-6 right-6 w-[380px] h-[600px] bg-[#0a0a0a] rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-50">
        
        {/* 3D Canvas Background Layer (Bounded) */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <Canvas
            dpr={[1, 2]}
            camera={{ position: [0, 0.4, 3.8], fov: 38 }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
              toneMapping: THREE.ACESFilmicToneMapping,
              outputColorSpace: THREE.SRGBColorSpace
            }}
          >
            <color attach="background" args={['#0a0a0a']} />
            <ambientLight intensity={1.0} />
            <directionalLight position={[1, 2, 3]} intensity={2.0} castShadow />

            <Suspense fallback={<AvatarSkeleton />}>
              <group position={[-0.2, -0.9, 0]}>
                <Avatar3D audioData={audioData} />
              </group>
              <Environment preset="city" blur={0.8} />
            </Suspense>

            <OrbitControls 
              target={[0, 0.3, 0]} 
              enableZoom={false} 
              enablePan={false} 
              enableRotate={false} 
            />
          </Canvas>
        </div>

        {/* Floating UI Overlay (Bounded) */}
        <ChatOverlay setAudioData={setAudioData} />

      </div>
    </main>
  );
}
