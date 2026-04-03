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

    // Retargeting: Clean up names and prevent avatar floating/sinking
    clip.tracks = clip.tracks.filter((track) => {
      // 1. Remove position tracks (Mixamo uses different leg lengths/scales)
      if (track.name.endsWith('.position')) return false;

      // 2. Remove common Mixamo FBX prefixes
      track.name = track.name.replace(/^.*mixamorig/i, '');
      track.name = track.name.replace(/^.*?\|/, '');

      return true;
    });

    if (clip.tracks.length === 0) return;

    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.timeScale = 1.0;
    action.fadeIn(0.3);
    action.play();

    mixerRef.current = mixer;

    return () => {
      // Smooth fade-out, then clean up
      action.fadeOut(0.3);
      const t = setTimeout(() => {
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
      }, 350);
      return () => clearTimeout(t);
    };
  }, [scene, animations]);

  useFrame((_, delta) => {
    mixerRef.current?.update(Math.min(delta, 0.05));
  });

  return null;
}

// Eagerly preload the animation file
useFBX.preload('/models/AN1.fbx');
