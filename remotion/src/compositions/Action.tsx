import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { SceneFrame } from '../components/SceneFrame';

export const Action: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tap = spring({ frame: frame - fps * 1, fps, durationInFrames: fps * 0.4, config: { damping: 12 } });
  const flagDrop = spring({ frame: frame - fps * 11, fps, durationInFrames: fps * 0.6, config: { damping: 14 } });
  const safetyApprove = interpolate(frame, [fps * 13, fps * 14], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <SceneFrame bg="#fafafa">
      <div style={{ color: '#171717', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, height: '100%' }}>
        {/* Left: RSVP tap */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
          <div style={{ fontSize: 32, color: '#737373', textTransform: 'uppercase', letterSpacing: 2 }}>One tap → action</div>
          <div style={{
            background: 'white', borderRadius: 24, border: '2px solid #e5e5e5', padding: 32,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ fontSize: 28, color: '#525252' }}>Tenant Power Rally</div>
            <div style={{ fontSize: 22, color: '#737373' }}>Saturday 2pm · Foley Square</div>
            <button style={{
              marginTop: 12, padding: '24px 32px', borderRadius: 14, border: 'none',
              background: tap > 0.5 ? '#16a34a' : '#171717',
              color: 'white', fontSize: 32, fontWeight: 600,
              transform: `scale(${interpolate(tap, [0, 0.5, 1], [1, 0.95, 1])})`,
            }}>
              {tap > 0.5 ? '✓ RSVP\u2019d via Mobilize' : 'RSVP'}
            </button>
          </div>
        </div>

        {/* Right: flag drop + safety approve */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
          <div style={{ fontSize: 32, color: '#737373', textTransform: 'uppercase', letterSpacing: 2 }}>Real-time community safety</div>
          <div style={{
            background: '#fef3c7', borderRadius: 24, padding: 32,
            border: '2px solid #fcd34d',
            opacity: interpolate(frame, [fps * 10, fps * 10.4], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            <div style={{
              transform: `translateY(${interpolate(flagDrop, [0, 1], [-30, 0])}px) scale(${interpolate(flagDrop, [0, 1], [0.8, 1])})`,
              opacity: flagDrop,
            }}>
              <div style={{ fontSize: 28, color: '#92400e', fontWeight: 600 }}>+ Medical aid station</div>
              <div style={{ fontSize: 22, color: '#78350f', marginTop: 8 }}>Foley Square — south end</div>
            </div>
            <div style={{
              marginTop: 24, padding: 16, background: 'white', borderRadius: 12,
              opacity: safetyApprove,
              transform: `translateY(${interpolate(safetyApprove, [0, 1], [12, 0])}px)`,
            }}>
              <div style={{ fontSize: 18, color: '#525252', textTransform: 'uppercase', letterSpacing: 1.5 }}>Safety review · approved</div>
              <div style={{ fontSize: 22, color: '#171717', marginTop: 4 }}>0.6s · safe community info</div>
            </div>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
