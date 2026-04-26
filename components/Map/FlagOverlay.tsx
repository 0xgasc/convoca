'use client';

import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl';
import { FLAG_TYPE_DISPLAY } from '@/lib/constants';
import type { FlagRow } from './MapView';

export function renderFlagOverlay(map: MapboxMap, flags: FlagRow[]): () => void {
  const markers: Marker[] = [];

  for (const flag of flags) {
    const meta = FLAG_TYPE_DISPLAY[flag.flag_type] ?? FLAG_TYPE_DISPLAY.other;
    const isUrgent = flag.severity === 'urgent';

    const el = document.createElement('div');
    el.dataset.marker = 'flag';
    el.className = 'flex items-center justify-center rounded-full text-white font-bold shadow-md cursor-pointer select-none';
    const size = isUrgent ? '26px' : '20px';
    el.style.cssText = `
      background:${meta.color};
      height:${size};width:${size};
      border:2px solid white;
      font-size:${isUrgent ? '8px' : '7px'};
      letter-spacing:0;
      line-height:1;
    `;
    el.textContent = meta.abbr;
    el.title = meta.label_en;

    const flagDate = new Date(flag.created_at);
    const dateStr = flagDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeStr = flagDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const expiresStr = new Date(flag.expires_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    const popupHtml = `
      <div style="font-size:12px;line-height:1.5;max-width:240px">
        <div style="font-weight:700;color:${meta.color};margin-bottom:3px">${escapeHtml(meta.label_en)}${isUrgent ? ' — Urgent' : ''}</div>
        ${flag.note ? `<div style="color:#262626;margin-bottom:4px">${escapeHtml(flag.note)}</div>` : ''}
        <div style="color:#737373;font-size:11px">
          ${dateStr} · ${timeStr} &nbsp;·&nbsp; ${flag.confirmation_count} ${flag.confirmation_count === 1 ? 'report' : 'reports'} &nbsp;·&nbsp; expires ${expiresStr}
        </div>
      </div>
    `;

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([flag.lng, flag.lat])
      .setPopup(new mapboxgl.Popup({ offset: 14, closeButton: false }).setHTML(popupHtml))
      .addTo(map);

    el.addEventListener('click', e => {
      e.stopPropagation();
      marker.togglePopup();
    });

    markers.push(marker);
  }

  return () => {
    for (const m of markers) m.remove();
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c
  ));
}
