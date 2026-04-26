import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';

interface AnimatedNumberProps {
  from: number;
  to: number;
  startFrame: number;
  durationFrames: number;
  style?: React.CSSProperties;
  format?: (n: number) => string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  from, to, startFrame, durationFrames, style, format = n => Math.round(n).toString(),
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - startFrame,
    fps,
    durationInFrames: durationFrames,
    config: { damping: 18 },
  });
  const value = interpolate(progress, [0, 1], [from, to]);
  return <span style={style}>{format(value)}</span>;
};
