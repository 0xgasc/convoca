'use client';

import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl';
import { EVENT_TYPE_DISPLAY } from '@/lib/constants';
import type { CanonicalEvent } from '@/lib/types';
import type { FlagRow } from './MapView';

interface RenderOpts {
  highlightedIds?: Set<string>;
  flags?: FlagRow[];
  onClick?: (event: CanonicalEvent) => void;
}

export function renderEventMarkers(
  map: MapboxMap,
  events: CanonicalEvent[],
  opts: RenderOpts = {},
): () => void {
  const markers: Marker[] = [];

  const flagsByEvent = new Map<string, FlagRow[]>();
  for (const f of opts.flags ?? []) {
    if (f.event_id) {
      const arr = flagsByEvent.get(f.event_id) ?? [];
      arr.push(f);
      flagsByEvent.set(f.event_id, arr);
    }
  }

  for (const ev of events) {
    if (typeof ev.lat !== 'number' || typeof ev.lng !== 'number') continue;
    const meta = EVENT_TYPE_DISPLAY[ev.event_type] ?? EVENT_TYPE_DISPLAY.other;
    const highlighted = opts.highlightedIds?.has(ev.id);
    const evFlags = flagsByEvent.get(ev.id) ?? [];
    const hasUrgent = evFlags.some(f => f.severity === 'urgent');
    const hasFlags = evFlags.length > 0;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'flex items-center justify-center rounded-full shadow-md transition-transform select-none cursor-pointer';
    el.title = ev.title;
    el.setAttribute('aria-label', ev.title);
    const size = highlighted ? '30px' : '22px';
    el.style.cssText = `
      background:${highlighted ? meta.color : meta.color + '18'};
      border:2px solid ${meta.color};
      height:${size};width:${size};
      font-size:7px;font-weight:700;letter-spacing:0;line-height:1;
      color:${highlighted ? '#fff' : meta.color};
      ${highlighted ? 'transform:scale(1.1);' : ''}
    `;
    el.textContent = meta.icon;

    if (opts.onClick) {
      el.addEventListener('click', e => {
        e.stopPropagation();
        opts.onClick?.(ev);
      });
    }

    // Wrap in relative container so we can position the flag dot
    const wrapper = document.createElement('div');
    wrapper.dataset.marker = 'event';
    wrapper.style.cssText = 'position:relative;display:inline-flex;will-change:transform;';
    wrapper.appendChild(el);

    if (hasFlags) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        position:absolute;top:-3px;right:-3px;
        width:9px;height:9px;border-radius:50%;
        background:${hasUrgent ? '#dc2626' : '#f59e0b'};
        border:1.5px solid white;
      `;
      wrapper.appendChild(dot);
    }

    const flagLines = evFlags.map(f =>
      `<div style="color:#92400e;font-size:11px;margin-top:3px">▲ ${escapeHtml(f.flag_type.replace(/_/g, ' '))}${f.note ? ` — ${escapeHtml(f.note)}` : ''}</div>`
    ).join('');

    const popupHtml = `
      <div style="font-size:12px;line-height:1.3;max-width:220px">
        <div style="font-weight:600;margin-bottom:2px">${escapeHtml(ev.title)}</div>
        ${ev.datetime_text_raw ? `<div style="color:#525252">${escapeHtml(ev.datetime_text_raw)}</div>` : ''}
        ${ev.location_text ? `<div style="color:#525252">${escapeHtml(ev.location_text)}</div>` : ''}
        ${ev.organizer ? `<div style="color:#737373;margin-top:2px">by ${escapeHtml(ev.organizer)}</div>` : ''}
        ${flagLines}
        <a href="/events/${ev.id}" style="display:inline-block;margin-top:4px;color:#1d4ed8;text-decoration:underline">Open</a>
      </div>
    `;

    const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'center' })
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
