'use client';

import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl';
import { EVENT_TYPE_DISPLAY } from '@/lib/constants';
import type { CanonicalEvent } from '@/lib/types';

interface RenderOpts {
  highlightedIds?: Set<string>;
  onClick?: (event: CanonicalEvent) => void;
}

export function renderEventMarkers(
  map: MapboxMap,
  events: CanonicalEvent[],
  opts: RenderOpts = {},
): () => void {
  const markers: Marker[] = [];

  for (const ev of events) {
    if (typeof ev.lat !== 'number' || typeof ev.lng !== 'number') continue;
    const meta = EVENT_TYPE_DISPLAY[ev.event_type] ?? EVENT_TYPE_DISPLAY.other;
    const highlighted = opts.highlightedIds?.has(ev.id);

    const el = document.createElement('button');
    el.type = 'button';
    el.className = [
      'flex items-center justify-center rounded-full shadow-md text-base transition-transform',
      highlighted
        ? 'h-9 w-9 bg-amber-300 ring-2 ring-amber-500 scale-110'
        : 'h-7 w-7 bg-white border border-neutral-300 hover:scale-110',
    ].join(' ');
    el.title = ev.title;
    el.textContent = meta.icon;
    el.setAttribute('aria-label', ev.title);

    if (opts.onClick) {
      el.addEventListener('click', e => {
        e.stopPropagation();
        opts.onClick?.(ev);
      });
    }

    const popupHtml = `
      <div style="font-size:12px;line-height:1.3;max-width:220px">
        <div style="font-weight:600;margin-bottom:2px">${escapeHtml(ev.title)}</div>
        ${ev.datetime_text_raw ? `<div style="color:#525252">${escapeHtml(ev.datetime_text_raw)}</div>` : ''}
        ${ev.location_text ? `<div style="color:#525252">${escapeHtml(ev.location_text)}</div>` : ''}
        ${ev.organizer ? `<div style="color:#737373;margin-top:2px">by ${escapeHtml(ev.organizer)}</div>` : ''}
        <a href="/events/${ev.id}" style="display:inline-block;margin-top:4px;color:#1d4ed8;text-decoration:underline">Open</a>
      </div>
    `;

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([ev.lng, ev.lat])
      .setPopup(new mapboxgl.Popup({ offset: 16, closeButton: false }).setHTML(popupHtml))
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
