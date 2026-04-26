import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { SceneFrame } from '../components/SceneFrame';
import { AnimatedNumber } from '../components/AnimatedNumber';

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <SceneFrame>
      <div style={{ opacity: fadeIn, display: 'flex', flexDirection: 'column', gap: 40, justifyContent: 'center', height: '100%' }}>
        <div style={{ fontSize: 56, fontWeight: 200, color: '#a3a3a3' }}>Last weekend in NYC</div>
        <div style={{ fontSize: 280, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          <AnimatedNumber from={0} to={200} startFrame={fps * 1} durationFrames={fps * 4} />
          <span style={{ color: '#737373', fontWeight: 200, fontSize: 80, marginLeft: 24 }}>civic events</span>
        </div>
        <div style={{ fontSize: 56, fontWeight: 200, color: '#a3a3a3' }}>The average New Yorker who cared heard about</div>
        <div style={{ fontSize: 280, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: '#fda4af' }}>
          <AnimatedNumber from={0} to={8} startFrame={fps * 8} durationFrames={fps * 3} />
        </div>
      </div>
    </SceneFrame>
  );
};
