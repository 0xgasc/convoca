'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { CITIES } from '@/lib/constants';
import type { CanonicalEvent, CitySlug, FlagType } from '@/lib/types';
import { renderEventMarkers } from './EventMarkers';
import { renderBoroughOverlay } from './BoroughOverlay';

export interface FlagRow {
  id: string;
  event_id: string | null;
  city_slug: CitySlug;
  flag_type: FlagType;
  severity: 'info' | 'caution' | 'urgent';
  lat: number;
  lng: number;
  note: string | null;
  confirmation_count: number;
  status: string;
  created_at: string;
  expires_at: string;
}

interface MapViewProps {
  city: CitySlug;
  events: CanonicalEvent[];
  flags: FlagRow[];
  highlightedIds?: Set<string>;
  selectedBoroughs?: Set<string>;
  onEventClick?: (event: CanonicalEvent) => void;
  onBoroughToggle?: (slug: string) => void;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export function MapView({ city, events, flags, highlightedIds, selectedBoroughs, onEventClick, onBoroughToggle }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const cleanupRef = useRef<{ events?: () => void; boroughs?: () => void }>({});
  const [styleReady, setStyleReady] = useState(false);
  const [tokenMissing] = useState(!MAPBOX_TOKEN);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current || tokenMissing) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const center = CITIES[city].center;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [center.lng, center.lat],
      zoom: 11,
      attributionControl: true,
    });
    mapRef.current = map;
    map.on('style.load', () => setStyleReady(true));

    // Explicitly resize when container dimensions change (e.g. right panel open/close)
    const ro = new ResizeObserver(() => { map.resize(); });
    ro.observe(containerRef.current!);

    return () => {
      ro.disconnect();
      const evCleanup = cleanupRef.current.events;
      evCleanup?.();
      map.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenMissing]);

  // Re-center on city change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = CITIES[city].center;
    map.flyTo({ center: [center.lng, center.lat], zoom: 11, essential: true });
  }, [city]);

  // Render event markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const prev = cleanupRef.current.events;
    prev?.();
    cleanupRef.current.events = renderEventMarkers(map, events, {
      highlightedIds,
      flags,
      onClick: onEventClick,
    });
  }, [events, flags, styleReady, highlightedIds, onEventClick]);

  // Render NYC borough overlay (only when in NYC and a toggle handler is set)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const prevBoroughs = cleanupRef.current.boroughs;
    prevBoroughs?.();
    cleanupRef.current.boroughs = undefined;
    if (city !== 'nyc' || !onBoroughToggle) return;
    let cleanup: (() => void) | undefined;
    void renderBoroughOverlay(map, {
      selected: selectedBoroughs ?? new Set(),
      onToggle: onBoroughToggle,
    }).then(c => { cleanup = c; cleanupRef.current.boroughs = c; });
    return () => { cleanup?.(); };
  }, [city, styleReady, selectedBoroughs, onBoroughToggle]);

  if (tokenMissing) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-neutral-100 text-sm text-neutral-600 px-6 text-center">
        <div>
          <div className="font-medium text-neutral-800 mb-1">Mapbox token missing</div>
          <div className="text-xs text-neutral-500">
            Set <code className="bg-neutral-200 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code className="bg-neutral-200 px-1 rounded">.env.local</code> to render the map.
          </div>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
