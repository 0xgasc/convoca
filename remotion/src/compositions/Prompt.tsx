import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { SceneFrame } from '../components/SceneFrame';

const AGENTS = ['intent_parse', 'discovery', 'harvester', 'vision_extractor', 'dedup', 'recommender'];

export const Prompt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Type out the prompt
  const PROMPT = 'housing actions this weekend in Brooklyn, attend or volunteer';
  const typedChars = Math.min(PROMPT.length, Math.floor((frame - fps * 0.5) * 2));
  const typedText = PROMPT.slice(0, Math.max(0, typedChars));

  return (
    <SceneFrame bg="#fafafa">
      <div style={{ color: '#171717', display: 'flex', flexDirection: 'column', gap: 60, height: '100%', justifyContent: 'center' }}>
        <div style={{ fontSize: 32, color: '#737373', textTransform: 'uppercase', letterSpacing: 2 }}>One prompt</div>
        <div style={{
          background: 'white', borderRadius: 18, padding: 36, fontSize: 48,
          border: '2px solid #e5e5e5', minHeight: 120,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        }}>
          {typedText}
          <span style={{ opacity: Math.floor(frame / 12) % 2 ? 1 : 0 }}>|</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>
          {AGENTS.map((agent, i) => {
            const startFrame = fps * (3 + i * 1.5);
            const opacity = interpolate(frame, [startFrame, startFrame + fps * 0.4], [0.2, 1], { extrapolateRight: 'clamp' });
            const isActive = frame >= startFrame && frame < startFrame + fps * 2;
            const isDone = frame >= startFrame + fps * 2;
            return (
              <div key={agent} style={{
                opacity,
                padding: '14px 24px', borderRadius: 999,
                fontSize: 28, fontWeight: 500,
                background: isDone ? '#dcfce7' : isActive ? '#dbeafe' : '#f5f5f5',
                color: isDone ? '#15803d' : isActive ? '#1d4ed8' : '#525252',
                border: `2px solid ${isDone ? '#86efac' : isActive ? '#93c5fd' : '#d4d4d4'}`,
              }}>
                {agent.replace(/_/g, ' ')}
              </div>
            );
          })}
        </div>
      </div>
    </SceneFrame>
  );
};
