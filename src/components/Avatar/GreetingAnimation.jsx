import { useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useAvatarStore, { AVATAR_STATES } from '../../store/avatarStore';

/**
 * GreetingAnimation
 * Loads only the animation clips from AV1.glb and plays them on the provided
 * avatar `scene` via a retargeted AnimationMixer (Three.js matches bones by name).
 * Fires once, then transitions the store to IDLE.
 *
 * @param {{ scene: THREE.Object3D }} props
 */
export default function GreetingAnimation({ scene }) {
  const { animations } = useGLTF('/models/AV1.glb');
  const mixerRef = useRef(null);
  const doneRef  = useRef(false);

  useEffect(() => {
    if (!scene || !animations || animations.length === 0) return;
    if (doneRef.current) return;

    // Build a mixer on the MAIN avatar scene so bone names resolve correctly
    const mixer = new THREE.AnimationMixer(scene);
    
    // Clone and retarget the clip
    const originalClip = animations[0];
    const clip = originalClip.clone();
    clip.tracks = clip.tracks.filter(track => {
      if (track.name.toLowerCase().includes('.position')) return false;
      track.name = track.name.replace(/^.*[:|]/, '');
      return !!scene.getObjectByName(track.name.split('.')[0]);
    });

    if (clip.tracks.length === 0) {
      console.warn('[GreetingAnimation] No usable tracks found after retargeting.');
      useAvatarStore.getState().setAvatarState(AVATAR_STATES.LISTENING);
      useAvatarStore.getState().setGreetingDone();
      return;
    }

    mixerRef.current = mixer;

    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();

    const onFinished = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      useAvatarStore.getState().setAvatarState(AVATAR_STATES.LISTENING);
      useAvatarStore.getState().setGreetingDone();
    };

    mixer.addEventListener('finished', onFinished);

    // Safety net: force IDLE if animation is suspiciously long
    const safetyTimer = setTimeout(onFinished, (clip.duration + 1) * 1000);

    return () => {
      clearTimeout(safetyTimer);
      mixer.removeEventListener('finished', onFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
    };
  }, [scene, animations]);

  useFrame((_, delta) => {
    mixerRef.current?.update(Math.min(delta, 0.05));
  });

  return null;
}

// Eagerly preload so it's ready when the model finishes loading
useGLTF.preload('/models/AV1.glb');
