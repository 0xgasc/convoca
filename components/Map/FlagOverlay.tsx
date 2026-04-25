'use client';

import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl';
import { FLAG_TYPE_DISPLAY } from '@/lib/constants';
import type { FlagRow } from './MapView';

export function renderFlagOverlay(map: MapboxMap, flags: FlagRow[]): () => void {
  const markers: Marker[] = [];

  for (const flag of flags) {
    const meta = FLAG_TYPE_DISPLAY[flag.flag_type] ?? FLAG_TYPE_DISPLAY.other;

    const el = document.createElement('div');
    el.className = 'flex items-center justify-center rounded-full text-white text-[11px] font-semibold shadow-md';
    el.style.background = meta.color;
    el.style.height = flag.severity === 'urgent' ? '24px' : '20px';
    el.style.width = flag.severity === 'urgent' ? '24px' : '20px';
    el.style.border = '2px solid white';
    el.title = `${meta.label_en}${flag.note ? ` — ${flag.note}` : ''}`;
    el.textContent = meta.icon;

    const popupHtml = `
      <div style="font-size:12px;line-height:1.3;max-width:220px">
        <div style="font-weight:600;color:${meta.color}">${meta.icon} ${escapeHtml(meta.label_en)}</div>
        ${flag.note ? `<div style="color:#404040;margin-top:2px">${escapeHtml(flag.note)}</div>` : ''}
        <div style="color:#737373;margin-top:4px;font-size:11px">
          ${flag.confirmation_count} ${flag.confirmation_count === 1 ? 'report' : 'reports'} ·
          ${new Date(flag.created_at).toLocaleTimeString()}
        </div>
      </div>
    `;

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([flag.lng, flag.lat])
      .setPopup(new mapboxgl.Popup({ offset: 14, closeButton: false }).setHTML(popupHtml))
      .addTo(map);

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
