import React from 'react';
import { AbsoluteFill } from 'remotion';

interface SceneFrameProps {
  bg?: string;
  children: React.ReactNode;
}

export const SceneFrame: React.FC<SceneFrameProps> = ({ bg = '#0a0a0a', children }) => (
  <AbsoluteFill
    style={{
      background: bg,
      color: 'white',
      fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
      padding: 80,
    }}
  >
    {children}
  </AbsoluteFill>
);
