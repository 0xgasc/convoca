import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { SceneFrame } from '../components/SceneFrame';

const SOURCES = [
  { org: 'Bushwick Ayuda Mutua', text: 'Distribución de comida sábado 11am' },
  { org: 'Hispanic Federation', text: 'Free groceries Saturday morning, Sunset Park' },
  { org: 'Bay Ridge Bushwick Coalition', text: 'Food distribution this Sat. 11:00am Sunset Park' },
];

const REASONING = [
  'Same parish — Maria Hernandez Park',
  'Datetimes within 30 minutes',
  'Organizers in known coalition',
];

export const Dedup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mergeStart = fps * 6;
  const mergeProgress = spring({ frame: frame - mergeStart, fps, durationInFrames: fps * 1.5, config: { damping: 14 } });

  return (
    <SceneFrame bg="#fafafa">
      <div style={{ color: '#171717', display: 'flex', flexDirection: 'column', gap: 40, height: '100%' }}>
        <div style={{ fontSize: 32, color: '#737373', textTransform: 'uppercase', letterSpacing: 2 }}>Cross-source dedup</div>

        {/* Three cards converge into one */}
        <div style={{ position: 'relative', height: 380, marginTop: 20 }}>
          {SOURCES.map((s, i) => {
            const startX = (i - 1) * 580;
            const x = interpolate(mergeProgress, [0, 1], [startX, 0]);
            const scale = interpolate(mergeProgress, [0, 1], [1, 0.85 - i * 0.05]);
            const opacity = i === 1
              ? 1
              : interpolate(mergeProgress, [0.6, 1], [1, 0.4], { extrapolateRight: 'clamp' });
            return (
              <div key={s.org} style={{
                position: 'absolute', left: '50%', top: 0,
                width: 520, padding: 28, background: 'white', borderRadius: 18,
                border: '2px solid #e5e5e5',
                transform: `translateX(calc(-50% + ${x}px)) scale(${scale})`,
                opacity, zIndex: i === 1 ? 10 : 1,
              }}>
                <div style={{ fontSize: 22, color: '#737373', marginBottom: 8 }}>{s.org}</div>
                <div style={{ fontSize: 30, fontWeight: 600 }}>{s.text}</div>
              </div>
            );
          })}
        </div>

        {/* Reasoning */}
        <div style={{
          background: '#dcfce7', borderRadius: 18, padding: 32,
          opacity: interpolate(frame, [fps * 9, fps * 9.6], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          <div style={{ fontSize: 24, color: '#15803d', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
            Dedup agent reasoning
          </div>
          <ol style={{ fontSize: 30, color: '#14532d', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REASONING.map((r, i) => {
              const start = fps * (10 + i);
              const opacity = interpolate(frame, [start, start + fps * 0.4], [0, 1], { extrapolateRight: 'clamp' });
              return <li key={r} style={{ opacity }}>{i + 1}. {r}</li>;
            })}
          </ol>
        </div>
      </div>
    </SceneFrame>
  );
};
