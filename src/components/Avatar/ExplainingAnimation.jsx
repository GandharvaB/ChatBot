import { useEffect, useRef } from 'react';
import { useFBX } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ExplainingAnimation
 *
 * Loads animation clips from a dedicated FBX file (`/models/AN1.fbx`) and
 * plays them on the provided avatar `scene` via a retargeted AnimationMixer.
 * Three.js correctly binds animation tracks to live scene bones by matching
 * bone names.
 *
 * Loops the first animation clip continuously while the SPEAKING state is active.
 * Mounts/unmounts with the SPEAKING state — React handles the lifecycle.
 *
 * @param {{ scene: THREE.Object3D }} props
 */
export default function ExplainingAnimation({ scene }) {
  const fbx = useFBX('/models/AN1.fbx');
  const animations = fbx.animations;
  const mixerRef = useRef(null);

  useEffect(() => {
    if (!scene || !animations || animations.length === 0) return;

    // Create a fresh mixer on the LIVE scene — same object AvatarModel uses,
    // so bone name lookups always succeed.
    const mixer = new THREE.AnimationMixer(scene);

    // Clone the clip so we can safely mutate track names for retargeting
    const clip = animations[0].clone();

    // 1. UNIVERSAL RETARGETING: Strip all prefixes (e.g. 'mixamorig:', 'Node|') 
    // to match M1.glb's clean bone names.
    clip.tracks = clip.tracks.filter((track) => {
      // Always remove position tracks for humanoid retargeting (avoids scale/floating issues)
      if (track.name.toLowerCase().includes('.position')) return false;

      // Strip prefixes: 'mixamorig:Hips.rotation' -> 'Hips.rotation'
      const oldName = track.name;
      track.name = track.name.replace(/^.*[:|]/, '');

      // 2. SAFETY CHECK: Does this bone actually exist in our target scene?
      const boneName = track.name.split('.')[0];
      const targetNode = scene.getObjectByName(boneName);
      
      if (!targetNode) {
        // console.warn(`[ExplainingAnimation] Skipping track for missing bone: ${boneName} (was ${oldName})`);
        return false;
      }
      
      return true;
    });

    if (clip.tracks.length === 0) {
      console.error('[ExplainingAnimation] Failed: No compatible tracks left after retargeting!');
      return;
    }

    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();

    mixerRef.current = mixer;

    return () => {
      action.fadeOut(0.2);
      const t = setTimeout(() => {
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
      }, 250);
      return () => clearTimeout(t);
    };
  }, [scene, animations]);

  useFrame((_, delta) => {
    try {
      mixerRef.current?.update(Math.min(delta, 0.05));
    } catch (e) {
      console.error('[ExplainingAnimation] Mixer update crash:', e);
      mixerRef.current = null;
    }
  });

  return null;
}

// Eagerly preload the animation file
useFBX.preload('/models/AN1.fbx');
