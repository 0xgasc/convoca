import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';
import { SceneFrame } from '../components/SceneFrame';

// JSON output that matches what the vision agent produces for flyer2.html
// (Know Your Rights / Conoce Tus Derechos — Brooklyn Immigrant Defense Project)
const JSON_KEYS: Array<{ key: string; value: string }> = [
  { key: '"is_event"',             value: 'true' },
  { key: '"title"',                value: '"Know Your Rights — Conoce Tus Derechos"' },
  { key: '"event_type"',           value: '"teach_in"' },
  { key: '"datetime_iso"',         value: '"2025-05-08T18:30:00-04:00"' },
  { key: '"location_text"',        value: '"Red Hook Community Justice Center, Brooklyn"' },
  { key: '"organizer"',            value: '"Brooklyn Immigrant Defense Project"' },
  { key: '"cause_tags"',           value: '["immigration", "civil_rights", "language_access"]' },
  { key: '"language"',             value: '"mixed"' },
  { key: '"action_type"',          value: '"register"' },
  { key: '"signup_url"',           value: '"bidp.org/events"' },
  { key: '"confidence"',           value: '0.93' },
];

// Placeholder flyer shown when remotion/public/flyer.png doesn't exist yet.
// Replace by placing the flyer2.html screenshot at remotion/public/flyer.png.
const FlyerPlaceholder: React.FC = () => (
  <div style={{
    width: '100%', height: '100%',
    background: 'linear-gradient(145deg, #0f3460 0%, #16213e 100%)',
    borderRadius: 14,
    display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 40,
    fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
  }}>
    <div>
      <div style={{ fontSize: 14, color: '#a8b2d8', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
        Brooklyn Immigrant Defense Project
      </div>
      <div style={{ fontSize: 88, fontWeight: 900, color: '#fff', lineHeight: 1.0, textTransform: 'uppercase', letterSpacing: -2 }}>
        Know Your<br />Rights
      </div>
      <div style={{ fontSize: 56, fontWeight: 900, color: '#cc2a2a', lineHeight: 1.0, textTransform: 'uppercase', marginTop: 8 }}>
        Conoce Tus<br />Derechos
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 26, color: '#ccd6f6' }}>📅 Thursday May 8 · 6:30 PM</div>
      <div style={{ fontSize: 26, color: '#ccd6f6' }}>📍 Red Hook Community Justice Center</div>
      <div style={{ fontSize: 22, color: '#8892b0', fontStyle: 'italic' }}>Free · No ID required · Childcare available</div>
      <div style={{ fontSize: 20, color: '#cc2a2a', fontWeight: 700 }}>@BKImmigrantDef · bidp.org/events</div>
    </div>
  </div>
);

export const Vision: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <SceneFrame bg="#0a0a0a">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, height: '100%' }}>
        {/* Left: flyer — swap to <Img src={staticFile('flyer.png')} style={{borderRadius:18,objectFit:'cover',width:'100%',height:'100%'}}/> once screenshot is ready */}
        <div style={{ borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <FlyerPlaceholder />
        </div>

        {/* Right: streaming JSON */}
        <div style={{
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 24, color: '#e5e5e5',
          background: '#171717', borderRadius: 18, padding: 32,
          overflow: 'hidden',
        }}>
          <div style={{ color: '#737373', marginBottom: 16, fontSize: 18 }}>// vision_extractor · claude-opus-4-7</div>
          <div style={{ color: '#737373' }}>{'{'}</div>
          {JSON_KEYS.map((k, i) => {
            const startFrame = fps * (0.8 + i * 0.65);
            const opacity = interpolate(frame, [startFrame, startFrame + 6], [0, 1], { extrapolateRight: 'clamp' });
            const x = interpolate(frame, [startFrame, startFrame + 8], [-20, 0], { extrapolateRight: 'clamp' });
            return (
              <div key={k.key} style={{ paddingLeft: 28, opacity, transform: `translateX(${x}px)`, marginBottom: 4 }}>
                <span style={{ color: '#86efac' }}>{k.key}</span>
                <span style={{ color: '#737373' }}>: </span>
                <span style={{ color: '#fde68a' }}>{k.value}</span>
                {i < JSON_KEYS.length - 1 && <span style={{ color: '#737373' }}>,</span>}
              </div>
            );
          })}
          <div style={{ color: '#737373' }}>{'}'}</div>
          {/* Confidence callout appears at end */}
          <div style={{
            marginTop: 24,
            opacity: interpolate(frame, [fps * 9, fps * 10], [0, 1], { extrapolateRight: 'clamp' }),
            background: '#15803d22', border: '1px solid #86efac44',
            borderRadius: 8, padding: '10px 16px',
            fontSize: 20, color: '#86efac',
          }}>
            ✓ confidence 0.93 · 8.2s · pin on map
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
