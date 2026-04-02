import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import useAvatarStore, { AVATAR_STATES } from '../../store/avatarStore';
import FaceAnimation from './FaceAnimation';

// Fuzzy bone matching
function findBone(scene, namePatterns) {
  let foundBone = null;
  scene.traverse((node) => {
    if (node.isBone && !foundBone) {
      for (const pattern of namePatterns) {
        if (node.name.toLowerCase().includes(pattern.toLowerCase())) {
          foundBone = node;
          break;
        }
      }
    }
  });
  return foundBone;
}

// Declarative Dictionary of Base Poses (Offsets from Rest Pose)
const POSES = {
  IDLE: {
    RightArm: { z: 5.23, x: 0.65, y: -1 },
    LeftArm: { z: -5.23, x: 0.65, y: 1 },
    RightForeArm: { x: 0, z: 0 },
    LeftForeArm: { x: 0, z: 0 },
    RightHand: { x: 0, y: 0, z: 0 },
    LeftHand: { x: 0, y: 0, z: 0 },
    Head: { x: 0, z: 0 },
    Neck: { x: 0 },
  },
  FRONT_REST: {
    RightArm: { z: 5.23, x: 0.65, y: -1 },
    LeftArm: { z: -5.23, x: 0.65, y: 1 },
    RightForeArm: { x: 0.6 },
    LeftForeArm: { x: 0.6 },
    RightHand: { z: 0.1 },
    LeftHand: { z: -0.1 },
    Head: { x: 0, z: 0 },
    Neck: { x: 0 },
  },
  THINKING: {
    RightArm: { z: 5.23, x: 0.65, y: -1 },
    RightForeArm: { x: 1.5 },
    RightHand: { z: 0.1 },
    LeftArm: { z: -5.23, x: 0.65, y: 1 },
    LeftForeArm: { x: 0.6 },
    LeftHand: { z: -0.1 },
    Head: { x: 0.08, z: -0.08 },
    Neck: { x: 0 },
  }
};

// Declarative Gestures Overlay Dictionary
const GESTURES = {
  cross_arms: {
    LeftArm: { z: -5.23, x: 0.65, y: 1 }, LeftForeArm: { x: 1.6 },
    RightArm: { z: 5.23, x: 0.65, y: -1 }, RightForeArm: { x: 1.6 }
  },
  explain_hands: {
    LeftArm: { z: -5.23, x: 0.65, y: 1 }, LeftForeArm: { x: 0.8 },
    RightArm: { z: 5.23, x: 0.65, y: -1 }, RightForeArm: { x: 0.8 },
    Head: { x: -0.1 }
  },
  open_hand_gesture: {
    LeftArm: { z: -5.23, x: 0.65, y: 1 }, LeftForeArm: { x: 0.8 },
    RightArm: { z: 5.23, x: 0.65, y: -1 }, RightForeArm: { x: 0.8 },
  },
  both_hands_open: {
    LeftArm: { z: -5.23, x: 0.65, y: 1 }, LeftForeArm: { x: 0.8 },
    RightArm: { z: 5.23, x: 0.65, y: -1 }, RightForeArm: { x: 0.8 },
  },
  point_forward: {
    RightArm: { z: 5.23, x: 0.65, y: -1 }, RightForeArm: { x: 0.1 }
  },
  counting_fingers: {
    LeftArm: { x: 0.6, z: -0.3 }, LeftForeArm: { x: 1.5 },
    RightArm: { x: 0.4, z: 0.6 }, RightForeArm: { x: 1.0 }
  },
  wave_hello: {
    RightArm: { z: 1.5, x: 0.2 }, RightForeArm: { x: 0.5 }
  },
  shrug: {
    LeftShoulder: { z: 0.3 }, RightShoulder: { z: -0.3 },
    LeftArm: { z: -0.4 }, RightArm: { z: 0.4 },
    Head: { x: 0.1 }
  }
};

export default function AvatarModel({ onHeadMeshesLinked }) {
  // Load the realistic GLB
  const gltf = useGLTF('/models/avatar.glb');
  const scene = gltf.scene;
  const skeletonRef = useRef(null);
  const morphMeshesRef = useRef([]);
  // We now strictly save THREE.Quaternion instead of raw euler angles for stability!
  const initialQuatsRef = useRef({});
  
  // High-level animation tracker
  const animStateRef = useRef({
    breathPhase: 0,
    swayPhase: 0,
    headNodPhase: 0,
    blinkTimer: 0,
    nextBlinkTime: 3,
    isBlinking: false,
    blinkProgress: 0,
    saccadeTimer: 0,
    saccadeX: 0,
    saccadeY: 0,
    gestureProgress: 0,
    gestureActive: false,
    gestureType: null,
  });

  // Extract Rig and Morphs
  const { boneMap, morphMeshes } = useMemo(() => {
    const map = {};
    
    // Fuzzy match standard humanoid bones
    map.Hips = findBone(scene, ['hips', 'pelvis']);
    map.Spine = findBone(scene, ['spine', 'spine1']);
    map.Spine1 = findBone(scene, ['spine1', 'spine2']);
    map.Spine2 = findBone(scene, ['spine2', 'chest']);
    map.Neck = findBone(scene, ['neck']);
    map.Head = findBone(scene, ['head']);
    
    map.LeftShoulder = findBone(scene, ['leftshoulder', 'shoulder_l']);
    map.LeftArm = findBone(scene, ['leftarm', 'upperarm_l', 'leftuparm']);
    map.LeftForeArm = findBone(scene, ['leftforearm', 'lowerarm_l']);
    map.LeftHand = findBone(scene, ['lefthand', 'hand_l']);
    
    map.RightShoulder = findBone(scene, ['rightshoulder', 'shoulder_r']);
    map.RightArm = findBone(scene, ['rightarm', 'upperarm_r', 'rightuparm']);
    map.RightForeArm = findBone(scene, ['rightforearm', 'lowerarm_r']);
    map.RightHand = findBone(scene, ['righthand', 'hand_r']);
    
    map.LeftEye = findBone(scene, ['lefteye', 'eye_l']);
    map.RightEye = findBone(scene, ['righteye', 'eye_r']);

    // Find all meshes with morph targets
    const meshesWithMorphs = [];
    scene.traverse((node) => {
      if (node.isSkinnedMesh || node.isMesh) {
        if (node.morphTargetDictionary && node.morphTargetInfluences) {
          meshesWithMorphs.push(node);
        }
        if (node.material) {
          node.material.roughness = Math.max(0.4, node.material.roughness || 0);
          if (node.material.transparent) {
            node.material.depthWrite = true;
          }
        }
      }
    });

    return { boneMap: map, morphMeshes: meshesWithMorphs };
  }, [scene]);

  // Normalization and Initialization
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      
      // Auto-scale to roughly 1.7m tall
      const scaleFactor = 1.7 / size.y;
      scene.scale.setScalar(scaleFactor);
      
      // Recompute and center horizontally
      const newBox = new THREE.Box3().setFromObject(scene);
      const newCenter = newBox.getCenter(new THREE.Vector3());
      scene.position.x = -newCenter.x;
      scene.position.z = -newCenter.z;
      // Snap feet to floor
      scene.position.y = -newBox.min.y;
    }
    
    // Mathematically robust capture of base native Quaternions, ignoring gimbal axes
    Object.keys(boneMap).forEach(key => {
      if (boneMap[key]) {
        initialQuatsRef.current[boneMap[key].uuid] = boneMap[key].quaternion.clone();
      }
    });

    skeletonRef.current = boneMap;
    morphMeshesRef.current = morphMeshes;
    
    // Pass strictly connected morphs upward
    if (onHeadMeshesLinked) {
      onHeadMeshesLinked(morphMeshes);
    }

    setTimeout(() => {
      useAvatarStore.getState().setLoadingProgress(100);
      useAvatarStore.getState().setLoading(false);
    }, 500);
  }, [scene, boneMap, morphMeshes, onHeadMeshesLinked]);

  // Avoid garbage collection stutter
  const targetEuler = useMemo(() => new THREE.Euler(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);

  // Main Quaternion-based animation loop
  useFrame((state, delta) => {
    if (!skeletonRef.current) return;

    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;
    const anim = animStateRef.current;
    const b = skeletonRef.current;
    const store = useAvatarStore.getState();
    const avatarState = store.avatarState;

    /**
     * applyPose: Combines static target poses and dynamic offsets into a final target 
     * Quaternion relative to the model's native rest pose, and SLERPs towards it cleanly.
     * Prevents all Gimbal Lock math faults seen in the previous iteration.
     */
    const applyPose = (bone, poseOffsets, dynamicOffsets = {}, weight = 1, speed = 4) => {
      if (!bone || !initialQuatsRef.current[bone.uuid]) return;

      const x = (poseOffsets.x || 0) + (dynamicOffsets.x || 0);
      const y = (poseOffsets.y || 0) + (dynamicOffsets.y || 0);
      const z = (poseOffsets.z || 0) + (dynamicOffsets.z || 0);

      // Convert requested offset to quaternion
      targetEuler.set(x, y, z, 'XYZ');
      targetQuat.setFromEuler(targetEuler);

      // Apply offset mathematically ON TOP of the initial perfectly native Rest Pose
      const finalQuat = initialQuatsRef.current[bone.uuid].clone().multiply(targetQuat);

      if (weight >= 0.99) {
        bone.quaternion.slerp(finalQuat, dt * speed);
      } else {
        // Blend intermediate states for fading gestures smoothly
        const tempQuat = bone.quaternion.clone().slerp(finalQuat, dt * speed);
        bone.quaternion.slerp(tempQuat, weight);
      }
    };

    // ==========================================
    // 1. BASE BODY EVALUATION (STATIC STATE POSE)
    // ==========================================
    let basePose = POSES.IDLE;
    if (avatarState === AVATAR_STATES.THINKING) basePose = POSES.THINKING;
    else if (avatarState === AVATAR_STATES.LISTENING || avatarState === AVATAR_STATES.SPEAKING) {
      basePose = POSES.FRONT_REST;
    }

    // ==========================================
    // 2. DYNAMIC WAVES (BREATHING, WAGGLING)
    // ==========================================
    anim.breathPhase += dt * 0.8;
    anim.swayPhase += dt * 0.3;
    const breath = Math.sin(anim.breathPhase) * 0.01;
    
    // Core body motion applies globally
    applyPose(b.Spine, {}, { x: breath }, 1, 2);
    applyPose(b.Spine1, {}, { x: breath * 0.8 }, 1, 2);
    applyPose(b.Spine2, {}, { x: breath * 0.6 }, 1, 2);
    if (b.Hips) applyPose(b.Hips, {}, { z: Math.sin(anim.swayPhase) * 0.015 }, 1, 2);

    let headDyn = { x: 0, y: 0, z: 0 };
    let neckDyn = { x: 0, y: 0, z: 0 };
    let rightArmDyn = { x: 0, y: 0, z: 0 };
    let leftArmDyn = { x: 0, y: 0, z: 0 };
    let rightForeDyn = { x: 0, y: 0, z: 0 };

    if (avatarState === AVATAR_STATES.SPEAKING) {
      anim.headNodPhase += dt * 5;
      headDyn = { x: Math.sin(anim.headNodPhase) * 0.05, z: Math.sin(anim.headNodPhase * 0.6) * 0.03 };
      neckDyn = { x: 0.02 };
      
      // Arm conversational waggle added to FRONT_REST
      rightArmDyn = { z: Math.sin(time * 1.5) * 0.05, x: Math.sin(time * 0.9) * 0.05 };
      rightForeDyn = { x: Math.sin(time * 1.2) * 0.05 };
      leftArmDyn = { z: -Math.sin(time * 1.3) * 0.05, x: Math.sin(time * 0.8) * 0.05 };
    } 
    else if (avatarState === AVATAR_STATES.LISTENING) {
      headDyn = { z: Math.sin(time * 0.5) * 0.04, x: 0.05 + Math.sin(time * 0.3) * 0.02 };
      neckDyn = { x: 0.04 };
      if (morphMeshesRef.current.length > 0) {
        // Direct eyebrows engagement
        morphMeshesRef.current.forEach(mesh => {
            const inf = mesh.morphTargetInfluences;
            const dict = mesh.morphTargetDictionary;
            if (dict['browInnerUp'] !== undefined) {
              inf[dict['browInnerUp']] += (Math.max(0, Math.sin(time * 0.4) * 0.4) - inf[dict['browInnerUp']]) * dt * 4;
            }
        });
      }
    } else {
      anim.headNodPhase = 0; // IDLE
    }

    // Pass resolved final matrixes
    applyPose(b.Head, basePose.Head || {}, headDyn, 1, 3);
    applyPose(b.Neck, basePose.Neck || {}, neckDyn, 1, 2);
    applyPose(b.RightArm, basePose.RightArm || {}, rightArmDyn, 1, 2.5);
    applyPose(b.RightForeArm, basePose.RightForeArm || {}, rightForeDyn, 1, 2.5);
    applyPose(b.RightHand, basePose.RightHand || {}, {}, 1, 2.5);
    applyPose(b.LeftArm, basePose.LeftArm || {}, leftArmDyn, 1, 2.5);
    applyPose(b.LeftForeArm, basePose.LeftForeArm || {}, {}, 1, 2.5);
    applyPose(b.LeftHand, basePose.LeftHand || {}, {}, 1, 2.5);

    // ==========================================
    // 3. EXPLICIT GESTURE OVERLAY ("More Actions")
    // ==========================================
    const gesture = store.activeGesture;
    if (gesture && gesture !== anim.gestureType) {
      anim.gestureType = gesture;
      anim.gestureActive = true;
      anim.gestureProgress = 0;
    }

    if (anim.gestureActive && GESTURES[anim.gestureType]) {
      anim.gestureProgress += dt;
      const totalDur = 2.5; 
      // Smooth bell curve [0 -> 1 -> 0] over total duration
      const fadeIn = Math.min(anim.gestureProgress / 0.5, 1);
      const fadeOut = Math.max(0, 1 - Math.max(0, anim.gestureProgress - (totalDur - 0.7)) / 0.7);
      const w = fadeIn * fadeOut;
      
      const gPose = GESTURES[anim.gestureType];

      // Highly prioritised blending mathematically overriding the Base State above
      if (w > 0.01) {
        if (gPose.RightArm) applyPose(b.RightArm, gPose.RightArm, {}, w, 4);
        if (gPose.RightForeArm) applyPose(b.RightForeArm, gPose.RightForeArm, {}, w, 4);
        if (gPose.LeftArm) applyPose(b.LeftArm, gPose.LeftArm, {}, w, 4);
        if (gPose.LeftForeArm) applyPose(b.LeftForeArm, gPose.LeftForeArm, {}, w, 4);
        if (gPose.Head) applyPose(b.Head, gPose.Head, {}, w, 4);
        if (gPose.LeftShoulder) applyPose(b.LeftShoulder, gPose.LeftShoulder, {}, w, 4);
        if (gPose.RightShoulder) applyPose(b.RightShoulder, gPose.RightShoulder, {}, w, 4);
      }

      // Procedural Gesture Flourishes
      if (anim.gestureType === 'wave_hello' && b.RightHand) {
        b.RightHand.rotation.z += Math.sin(anim.gestureProgress * 10) * 0.6 * w * dt * 5;
      }
      if (anim.gestureType === 'counting_fingers' && b.RightHand) {
        b.RightHand.rotation.z += Math.sin(anim.gestureProgress * 5) * 0.3 * w * dt * 4;
      }
      if (anim.gestureType === 'nod_yes' && b.Head) {
        b.Head.rotation.x += Math.sin(anim.gestureProgress * 8) * 0.15 * w;
      }
      if (anim.gestureType === 'shake_no' && b.Head) {
        b.Head.rotation.y += Math.sin(anim.gestureProgress * 10) * 0.2 * w;
      }

      if (anim.gestureProgress >= totalDur) {
        anim.gestureActive = false;
        anim.gestureType = null;
      }
    }

    // ==========================================
    // 4. FACIAL MORPHS & EYE TRACKING SACCADES
    // ==========================================
    anim.blinkTimer += dt;
    if (!anim.isBlinking && anim.blinkTimer >= anim.nextBlinkTime) {
      anim.isBlinking = true;
      anim.blinkProgress = 0;
      anim.blinkTimer = 0;
      anim.nextBlinkTime = 2.5 + Math.random() * 3.0;
    }
    
    if (anim.isBlinking) {
      anim.blinkProgress += dt * 8; 
      if (anim.blinkProgress >= 1) anim.isBlinking = false;
    }

    const blinkW = anim.isBlinking
      ? (anim.blinkProgress < 0.5 ? anim.blinkProgress * 2 : 2 - anim.blinkProgress * 2)
      : 0;

    morphMeshesRef.current.forEach(mesh => {
      const dict = mesh.morphTargetDictionary;
      const inf = mesh.morphTargetInfluences;
      if (dict && inf) {
        if (dict['eyeBlinkLeft'] !== undefined) inf[dict['eyeBlinkLeft']] += (blinkW - inf[dict['eyeBlinkLeft']]) * dt * 15;
        if (dict['eyeBlinkRight'] !== undefined) inf[dict['eyeBlinkRight']] += (blinkW - inf[dict['eyeBlinkRight']]) * dt * 15;
        
        // Emotion target morphs controlled externally 
        const emotion = store.currentEmotion;
        const smileW = emotion === 'happy' ? 0.6 : 0;
        const frownW = emotion === 'sad' ? 0.5 : 0;
        
        ['mouthSmileLeft', 'mouthSmileRight', 'mouthSmile'].forEach(name => {
          if (dict[name] !== undefined) inf[dict[name]] += (smileW - inf[dict[name]]) * dt * 4;
        });
        ['mouthFrownLeft', 'mouthFrownRight', 'mouthFrown'].forEach(name => {
          if (dict[name] !== undefined) inf[dict[name]] += (frownW - inf[dict[name]]) * dt * 4;
        });
      }
    });

    // Subconscious eye-tracking movement
    anim.saccadeTimer += dt;
    if (anim.saccadeTimer >= 0.8 + Math.random() * 0.5) {
      anim.saccadeTimer = 0;
      anim.saccadeX = (Math.random() - 0.5) * 0.1;
      anim.saccadeY = (Math.random() - 0.5) * 0.08;
    }
    if (b.LeftEye && b.RightEye) {
      // Eye micro-movements run flawlessly by directly adding simple quaternion rotations against their root geometry
      const saccadeEuler = new THREE.Euler(anim.saccadeY, anim.saccadeX, 0);
      const saccadeQuat = new THREE.Quaternion().setFromEuler(saccadeEuler);
      if (initialQuatsRef.current[b.LeftEye.uuid]) {
         b.LeftEye.quaternion.slerp(initialQuatsRef.current[b.LeftEye.uuid].clone().multiply(saccadeQuat), dt * 5);
      }
      if (initialQuatsRef.current[b.RightEye.uuid]) {
         b.RightEye.quaternion.slerp(initialQuatsRef.current[b.RightEye.uuid].clone().multiply(saccadeQuat), dt * 5);
      }
    }

  });

  return (
    <group position={[0, 0, 0]}>
      <primitive object={scene} />
      <FaceAnimation morphMeshes={morphMeshesRef.current} />
    </group>
  );
}

// Preload to bypass visual snapping during initial mount loading lifecycle
useGLTF.preload('/models/avatar.glb');
