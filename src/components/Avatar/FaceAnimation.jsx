import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useAvatarStore, { AVATAR_STATES } from '../../store/avatarStore';
import { getActiveAnalyser } from '../../services/audioCapture';

/*
 * FaceAnimation component — handles lip sync from audio analyser,
 * overlaying viseme weights onto the avatar's morph targets dynamically.
 */

// Viseme mapping: frequency band → morph target names (ARKit standards)
const VISEME_BANDS = {
  low: { start: 2, end: 8, visemes: ['viseme_aa', 'jawOpen', 'mouthOpen'] },
  mid: { start: 8, end: 24, visemes: ['viseme_U', 'viseme_O', 'viseme_PP', 'viseme_FF'] },
  high: { start: 24, end: 48, visemes: ['viseme_I', 'viseme_E', 'viseme_TH'] },
};

const ALL_VISEMES = [
  ...VISEME_BANDS.low.visemes,
  ...VISEME_BANDS.mid.visemes,
  ...VISEME_BANDS.high.visemes,
  'viseme_DD', 'viseme_kk', 'viseme_nn', 'viseme_RR', 'viseme_sil'
];

export default function FaceAnimation({ morphMeshes, boneMap }) {
  const initialHeadQuat = useRef(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const store = useAvatarStore.getState();
    const analyser = getActiveAnalyser();
    const time = state.clock.elapsedTime;

    // 1. DETERMINE "MOUTH ENERGY" (how much the mouth should be open)
    let energy = 0;
    if (store.avatarState === AVATAR_STATES.SPEAKING) {
      if (analyser) {
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);
        const getEnergy = (start, end) => {
          let sum = 0;
          for (let i = start; i < Math.min(end, freqData.length); i++) {
            sum += freqData[i];
          }
          return sum / ((end - start) * 255);
        };
        energy = Math.min(0.8, getEnergy(VISEME_BANDS.low.start, VISEME_BANDS.low.end) * 1.5);
      } else if (store.isMouthOpen) {
        energy = 0.3 + Math.sin(time * 18) * 0.2; // Fast rhythmic mashing
      }
    }

    // 2. APPLY TO MORPH TARGETS (if available)
    if (morphMeshes && morphMeshes.length > 0) {
      const lerpFactor = dt * 15;
      morphMeshes.forEach(mesh => {
        const dict = mesh.morphTargetDictionary;
        const inf = mesh.morphTargetInfluences;
        if (!dict || !inf) return;

        ALL_VISEMES.forEach(name => {
          if (dict[name] !== undefined) {
            const target = (energy > 0.01 && VISEME_BANDS.low.visemes.includes(name)) ? energy : 0;
            inf[dict[name]] += (target - inf[dict[name]]) * lerpFactor;
          }
        });
      });
    }

    // 3. APPLY TO BONES (Procedural fallback for models like M1 without morphs)
    // We rotate the head slightly downward when speaking to simulate jaw-opening if no jaw bone is found.
    const head = boneMap?.Head;
    if (head && (!morphMeshes || morphMeshes.length === 0)) {
       if (!initialHeadQuat.current) initialHeadQuat.current = head.quaternion.clone();
       
       // Rhythmic "jaw-waggle" via head rotation
       const jawWaggle = energy * 0.15; // 0 to 0.15 radians (~8 degrees)
       const targetQuat = initialHeadQuat.current.clone().multiply(
         new THREE.Quaternion().setFromEuler(new THREE.Euler(jawWaggle, 0, 0))
       );
       head.quaternion.slerp(targetQuat, dt * 20);
    }
  });

  return null;
}
