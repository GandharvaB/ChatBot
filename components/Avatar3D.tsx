"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useChatState } from '../hooks/useChatState';

export function Avatar3D({ audioData }: { audioData: Uint8Array | null }) {
  const group = useRef<THREE.Group>(null);
  
  // Load Base Mesh
  const { scene } = useGLTF('/models/M1.glb');
  
  // Load Animations
  const animM2 = useGLTF('/models/M2.glb'); // Idle
  const animM3 = useGLTF('/models/M3.glb'); // Dance
  const animM4 = useGLTF('/models/M4.glb'); // Dance (Shuffle)
  const animM5 = useGLTF('/models/M5.glb'); // Idle 2
  const animM6 = useGLTF('/models/M6.glb'); // Speaking

  const appState = useChatState(s => s.appState);
  const currentAction = useChatState(s => s.currentAction);

  // Consolidate all external animations into one master array dynamically
  const mergedAnimations = useMemo(() => {
    const arr: THREE.AnimationClip[] = [];
    if (animM2.animations?.length) {
       const clip = animM2.animations[0].clone();
       clip.name = 'idle';
       arr.push(clip);
    }
    if (animM5.animations?.length) {
       const clip = animM5.animations[0].clone();
       clip.name = 'listening';
       arr.push(clip);
    }
    if (animM6.animations?.length) {
       const clip = animM6.animations[0].clone();
       clip.name = 'speaking';
       arr.push(clip);
    }
    if (animM3.animations?.length) {
       const clip = animM3.animations[0].clone();
       clip.name = 'dance';
       arr.push(clip);
    }
    if (animM4.animations?.length) {
       const clip = animM4.animations[0].clone();
       clip.name = 'shuffle';
       arr.push(clip);
    }
    return arr;
  }, [animM2, animM3, animM4, animM5, animM6]);

  const { actions, mixer } = useAnimations(mergedAnimations, group);

  // We no longer need procedural sway or breath as baked animations handle it.
  // We keep a reference to current running action for smooth crossfades
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    if (!scene) return;
    
    // Reset before measuring to avoid recursive Hot Reload offsets
    scene.scale.setScalar(1);
    scene.position.set(0, 0, 0);
    // Apply a specific rotation offset because M1.glb/animations have a biased 'front'
    scene.rotation.set(0, 0.45, 0); 


    // Scale and position dynamically
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const scaleFactor = 1.55 / Math.max(0.1, size.y);
    scene.scale.setScalar(scaleFactor);
    
    // Recompute box after scaling to find new bounds
    const newBox = new THREE.Box3().setFromObject(scene);
    const newCenter = newBox.getCenter(new THREE.Vector3());
    scene.position.x = -newCenter.x;
    scene.position.z = -newCenter.z;
    scene.position.y = -newBox.min.y; // Snap feet to Y=0

    // Force materials mapping if needed
    scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
         const mesh = node as THREE.Mesh;
         const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
         materials.forEach(mat => {
           mat.transparent = false;
           mat.depthWrite = true;
         });
      }
    });
  }, [scene]);

  useEffect(() => {
    // Determine target clip name
    let clipName = 'idle';

    if (currentAction) {
       const lw = currentAction.toLowerCase();
       if (lw.includes('dance')) clipName = 'dance';
       else if (lw.includes('shuffle')) clipName = 'shuffle';
       else if (actions[currentAction]) clipName = currentAction;
    } else {
       if (appState === 'IDLE') clipName = 'idle';
       else if (appState === 'LISTENING' || appState === 'THINKING') clipName = 'listening';
       else if (appState === 'SPEAKING') clipName = 'speaking';
    }

    // High-priority override: if speaking, don't allow idle tags to stop the movement
    if (appState === 'SPEAKING' && (clipName === 'idle' || !clipName)) {
       clipName = 'speaking';
    }

    // Default fallback
    if (!actions[clipName]) {
       clipName = 'idle';
    }

    const action = actions[clipName];
    if (action) {
      // Adjust speed for specific clips
      if (clipName === 'dance' || clipName === 'shuffle') {
        action.setEffectiveTimeScale(0.6);
      } else {
        action.setEffectiveTimeScale(1.0);
      }

      // Crossfade smoothly
      if (activeActionRef.current && activeActionRef.current !== action) {
          activeActionRef.current.fadeOut(0.3);
      }
      activeActionRef.current = action;
      
      action.reset().fadeIn(0.3).play();
    }


  }, [appState, currentAction, actions]);

  // Keep Lip Sync logic for speaking state (even if no morph targets exist currently, 
  // keeping it mapped ensures robustness if model swaps later)
  useFrame((state, delta) => {
     mixer?.update(delta);
     // Note: Removed procedural math sine waves as baked animations (M2-M6) 
     // fully contain body mechanics!
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload('/models/M1.glb');
useGLTF.preload('/models/M2.glb');
useGLTF.preload('/models/M3.glb');
useGLTF.preload('/models/M4.glb');
useGLTF.preload('/models/M5.glb');
useGLTF.preload('/models/M6.glb');
