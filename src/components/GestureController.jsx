import React from 'react';
import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';

export default function GestureController() {
  // This component doesn't render anything visible.
  // Gesture logic is handled in useGesture hook and applied in AvatarModel.
  // This component can be used for debugging gesture state visualization.
  return null;
}
