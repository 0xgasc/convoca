import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { SceneFrame } from '../components/SceneFrame';

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <SceneFrame bg="white">
      <div style={{
        opacity, color: '#171717',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        height: '100%', gap: 32,
      }}>
        <div style={{ fontSize: 240, fontWeight: 800, letterSpacing: -8 }}>Convoca</div>
        <div style={{ fontSize: 40, color: '#737373' }}>
          Open source · Community-fed · Agent-amplified
        </div>
      </div>
    </SceneFrame>
  );
};
