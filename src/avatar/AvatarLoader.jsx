import React, { useEffect, useState, useRef } from 'react';
import { useGraph, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { useAvatarStore } from '../hooks/useAvatarStore';

export function AvatarLoader({ url }) {
  const [vrm, setVrm] = useState(null);
  const mode = useAvatarStore((state) => state.mode);

  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.crossOrigin = 'anonymous';
    loader.register((parser) => {
      return new VRMLoaderPlugin(parser, {
        autoUpdateHumanBones: true,
      });
    });
  });

  useEffect(() => {
    if (gltf) {
      if (gltf.userData.vrm) {
        const vrmInstance = gltf.userData.vrm;
        setVrm(vrmInstance);
        vrmInstance.scene.rotation.y = Math.PI;
      } else {
        // Handle standard GLB
        setVrm({
          scene: gltf.scene,
          humanoid: null,
          expressionManager: null,
          isStandard: true,
          animations: gltf.animations,
          mixer: new THREE.AnimationMixer(gltf.scene),
          update: (delta) => { }
        });
        gltf.scene.rotation.y = 0.4; // Testing if model is inverted
      }
    }

    if (gltf && !gltf.userData.vrm && gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(gltf.scene);
      const action = mixer.clipAction(gltf.animations[0]);
      action.play();
      setVrm(prev => ({ ...prev, mixer }));
    }

    const handleViseme = (e) => {
      targetState.current.visemes = e.detail;
    };
    window.addEventListener('avatar-viseme', handleViseme);
    return () => window.removeEventListener('avatar-viseme', handleViseme);

  }, [gltf]);

  const blinkState = useRef({ nextBlink: 0, isBlinking: false });
  // Store target values for lerping
  const targetState = useRef({
    headPitch: 0,
    headYaw: 0,
    smile: 0,
    browInnerUp: 0,
    eyesDown: 0,
  });

  useFrame((state, delta) => {
    if (!vrm) return;

    const time = state.clock.elapsedTime;

    // Standard GLB doesn't support the same humanoid/expression logic easily without mapping
    if (vrm.isStandard) {
      if (vrm.mixer) vrm.mixer.update(delta);
      return;
    }

    // --- State Machine Target Definitions ---
    if (mode === 'IDLE') {
      targetState.current.headPitch = Math.sin(time * 0.5) * 0.02;
      targetState.current.headYaw = Math.cos(time * 0.3) * 0.02;
      targetState.current.smile = 0;
      targetState.current.browInnerUp = 0;
      targetState.current.eyesDown = 0;
    } else if (mode === 'LISTENING') {
      targetState.current.headPitch = -0.1; // head tilted forward
      targetState.current.headYaw = 0;     // locked to camera
      targetState.current.smile = 0.2;     // soft attentive smile
      targetState.current.browInnerUp = 0.3; // attentive brow
      targetState.current.eyesDown = 0;
    } else if (mode === 'THINKING') {
      targetState.current.headPitch = -0.05 + Math.sin(time) * 0.02;
      targetState.current.headYaw = Math.sin(time * 2) * 0.1;
      targetState.current.smile = 0;
      targetState.current.browInnerUp = 0;
      targetState.current.eyesDown = 0.5;  // eyes shifting down/internal focus
    } else if (mode === 'SPEAKING') {
      targetState.current.headPitch = Math.sin(time * 3) * 0.03; // slight nods
      targetState.current.headYaw = Math.cos(time * 1.5) * 0.05;
      targetState.current.smile = 0.1;
      targetState.current.browInnerUp = 0.1;
      targetState.current.eyesDown = 0;
    }

    // --- Apply Lerped Transitions ---
    const humanoid = vrm.humanoid;
    if (!humanoid) return;

    const spine = humanoid.getNormalizedBoneNode('spine');
    const head = humanoid.getNormalizedBoneNode('head');
    const leftEye = humanoid.getNormalizedBoneNode('leftEye');
    const rightEye = humanoid.getNormalizedBoneNode('rightEye');

    // Breathing (Always active but scales slightly with state)
    if (spine) {
      const breathingAmp = mode === 'LISTENING' ? 0.002 : 0.003;
      spine.position.y = THREE.MathUtils.lerp(
        spine.position.y,
        Math.sin(time) * breathingAmp,
        0.1
      );
    }

    // Head rotation
    if (head) {
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetState.current.headPitch, 0.05);
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetState.current.headYaw, 0.05);
    }

    // Expressions
    if (vrm.expressionManager) {
      const exp = vrm.expressionManager;

      // Standard Visemes (Happy, Brow, etc depending on VRM schema)
      const currentSmile = exp.getValue('happy') || 0;
      exp.setValue('happy', THREE.MathUtils.lerp(currentSmile, targetState.current.smile, 0.1));

      // Eye movements downward for thinking
      if (leftEye && rightEye) {
        leftEye.rotation.x = THREE.MathUtils.lerp(leftEye.rotation.x, targetState.current.eyesDown, 0.1);
        rightEye.rotation.x = THREE.MathUtils.lerp(rightEye.rotation.x, targetState.current.eyesDown, 0.1);
      }
    }

    // Lip sync Visemes logic
    if (vrm.expressionManager) {
      const exp = vrm.expressionManager;

      const vTarg = targetState.current.visemes || { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
      exp.setValue('aa', THREE.MathUtils.lerp(exp.getValue('aa') || 0, vTarg.aa, 0.4));
      exp.setValue('ih', THREE.MathUtils.lerp(exp.getValue('ih') || 0, vTarg.ih, 0.4));
      exp.setValue('ou', THREE.MathUtils.lerp(exp.getValue('ou') || 0, vTarg.ou, 0.4));
      exp.setValue('ee', THREE.MathUtils.lerp(exp.getValue('ee') || 0, vTarg.ee, 0.4));
      exp.setValue('oh', THREE.MathUtils.lerp(exp.getValue('oh') || 0, vTarg.oh, 0.4));
    }

    // --- Independent Blinking Loop ---
    if (time >= blinkState.current.nextBlink && !blinkState.current.isBlinking) {
      blinkState.current.isBlinking = true;
      setTimeout(() => {
        if (vrm?.expressionManager) vrm.expressionManager.setValue('blink', 0.0);
        blinkState.current.isBlinking = false;
        blinkState.current.nextBlink = time + 3 + Math.random() * 3;
      }, 120);
      if (vrm?.expressionManager) vrm.expressionManager.setValue('blink', 1.0);
    }

    vrm.update(delta);
  });

  if (!vrm) return null;

  return <primitive object={vrm.scene} dispose={null} />;

}
