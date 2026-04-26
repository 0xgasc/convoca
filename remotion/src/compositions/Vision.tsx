import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';
import { SceneFrame } from '../components/SceneFrame';

const JSON_KEYS: Array<{ key: string; value: string }> = [
  { key: '"is_event"', value: 'true' },
  { key: '"title"', value: '"Tenant Power Rally"' },
  { key: '"event_type"', value: '"rally"' },
  { key: '"datetime_iso"', value: '"2026-04-26T14:00:00-04:00"' },
  { key: '"location_text"', value: '"Foley Square, Manhattan"' },
  { key: '"organizer"', value: '"Met Council on Housing"' },
  { key: '"cause_tags"', value: '["housing", "anti_displacement"]' },
  { key: '"language"', value: '"en"' },
  { key: '"action_type"', value: '"attend"' },
  { key: '"confidence"', value: '0.91' },
];

export const Vision: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <SceneFrame bg="#0a0a0a">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, height: '100%' }}>
        {/* Left: flyer */}
        <div style={{
          background: '#fafafa', borderRadius: 18, padding: 24,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          color: '#171717', textAlign: 'center',
        }}>
          {/* Replace with <Img src={staticFile('flyer.png')} /> when asset available */}
          <div style={{ fontSize: 100, fontWeight: 800 }}>TENANT</div>
          <div style={{ fontSize: 100, fontWeight: 800 }}>POWER</div>
          <div style={{ fontSize: 80, fontWeight: 200, marginTop: 24 }}>RALLY</div>
          <div style={{ fontSize: 40, marginTop: 32, color: '#525252' }}>Sat April 26 · 2pm</div>
          <div style={{ fontSize: 40, color: '#525252' }}>Foley Square</div>
          <div style={{ fontSize: 32, marginTop: 20, color: '#737373' }}>Met Council on Housing</div>
        </div>
        {/* Right: streaming JSON */}
        <div style={{
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 26, color: '#e5e5e5',
          background: '#171717', borderRadius: 18, padding: 32,
          overflow: 'hidden',
        }}>
          <div style={{ color: '#737373', marginBottom: 16 }}>// vision_extractor</div>
          <div>{'{'}</div>
          {JSON_KEYS.map((k, i) => {
            const startFrame = fps * (1 + i * 0.7);
            const opacity = interpolate(frame, [startFrame, startFrame + 6], [0, 1], { extrapolateRight: 'clamp' });
            const x = interpolate(frame, [startFrame, startFrame + 8], [-20, 0], { extrapolateRight: 'clamp' });
            return (
              <div key={k.key} style={{ paddingLeft: 32, opacity, transform: `translateX(${x}px)` }}>
                <span style={{ color: '#86efac' }}>{k.key}</span>
                <span style={{ color: '#737373' }}>: </span>
                <span style={{ color: '#fde68a' }}>{k.value}</span>
                {i < JSON_KEYS.length - 1 && <span>,</span>}
              </div>
            );
          })}
          <div>{'}'}</div>
        </div>
      </div>
    </SceneFrame>
  );
};
