import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { SceneFrame } from '../components/SceneFrame';

const ITINERARY = [
  { time: '10:00', title: 'Food distribution — Bushwick', travel: 18 },
  { time: '13:00', title: 'Tenant Power Rally — Foley Square', travel: 22 },
  { time: '16:00', title: 'Vigil for migrant workers — WSP', travel: null },
];

export const Schedule: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <SceneFrame bg="#0a0a0a">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, height: '100%' }}>
        <div style={{ fontSize: 32, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: 2 }}>
          Saved events → agent-built schedule
        </div>
        <div style={{
          fontSize: 54, fontWeight: 200,
          opacity: interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          &quot;plan my Saturday&quot;
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32 }}>
          {ITINERARY.map((it, i) => {
            const start = fps * (1.5 + i * 1.4);
            const enter = spring({ frame: frame - start, fps, durationInFrames: fps * 0.6, config: { damping: 14 } });
            const opacity = interpolate(enter, [0, 1], [0, 1]);
            const tx = interpolate(enter, [0, 1], [80, 0]);
            return (
              <React.Fragment key={it.title}>
                <div style={{
                  opacity, transform: `translateX(${tx}px)`,
                  background: '#fafafa', color: '#171717',
                  borderRadius: 18, padding: 32,
                  display: 'flex', alignItems: 'baseline', gap: 32,
                }}>
                  <div style={{
                    fontSize: 56, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    color: '#525252', minWidth: 200,
                  }}>{it.time}</div>
                  <div style={{ fontSize: 44, fontWeight: 600, flex: 1 }}>{it.title}</div>
                </div>
                {it.travel != null && (
                  <div style={{
                    paddingLeft: 240, color: '#737373', fontSize: 26,
                    opacity: interpolate(frame, [start + fps * 0.6, start + fps * 1], [0, 1], { extrapolateRight: 'clamp' }),
                  }}>
                    ↓ travel ~{it.travel} min
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </SceneFrame>
  );
};
