import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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

export default function FaceAnimation({ morphMeshes }) {
  useFrame((state, delta) => {
    if (!morphMeshes || morphMeshes.length === 0) return;

    const dt = Math.min(delta, 0.05);
    const store = useAvatarStore.getState();
    const analyser = getActiveAnalyser(); // From audioCapture service

    // Only do lip sync during SPEAKING state with active audio analyser
    if (store.avatarState === AVATAR_STATES.SPEAKING && analyser) {
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);

      // Calculate band energies
      const getEnergy = (start, end) => {
        let sum = 0;
        for (let i = start; i < Math.min(end, freqData.length); i++) {
          sum += freqData[i];
        }
        return sum / ((end - start) * 255); // Normalize 0-1
      };

      const lowEnergy = Math.min(0.6, getEnergy(VISEME_BANDS.low.start, VISEME_BANDS.low.end) * 1.2);
      const midEnergy = Math.min(0.8, getEnergy(VISEME_BANDS.mid.start, VISEME_BANDS.mid.end) * 1.0);
      const highEnergy = Math.min(0.8, getEnergy(VISEME_BANDS.high.start, VISEME_BANDS.high.end) * 1.2);

      const lerpFactor = dt * 15; // smooth fast interpolation

      morphMeshes.forEach(mesh => {
        const dict = mesh.morphTargetDictionary;
        const inf = mesh.morphTargetInfluences;
        if (!dict || !inf) return;

        const applyTarget = (visemeArray, energy) => {
          visemeArray.forEach(name => {
            if (dict[name] !== undefined) {
              inf[dict[name]] += (energy - inf[dict[name]]) * lerpFactor;
            } else if (name === 'jawOpen' && dict['mouthOpen'] !== undefined) {
              inf[dict['mouthOpen']] += (energy - inf[dict['mouthOpen']]) * lerpFactor;
            }
          });
        };

        applyTarget(VISEME_BANDS.low.visemes, lowEnergy);
        applyTarget(VISEME_BANDS.mid.visemes, midEnergy);
        applyTarget(VISEME_BANDS.high.visemes, highEnergy);
      });

    } else {
      // Smoothly decay all viseme weights when not speaking
      morphMeshes.forEach(mesh => {
        const dict = mesh.morphTargetDictionary;
        const inf = mesh.morphTargetInfluences;
        if (!dict || !inf) return;

        ALL_VISEMES.forEach((name) => {
          if (dict[name] !== undefined && inf[dict[name]] > 0.001) {
            inf[dict[name]] *= 0.85; // Faster decay
          }
        });
      });
    }
  });

  return null;
}
