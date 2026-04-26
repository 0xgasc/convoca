'use client';

import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';

const SOURCE_ID = 'convoca-nyc-boroughs';
const FILL_LAYER = 'convoca-nyc-boroughs-fill';
const LINE_LAYER = 'convoca-nyc-boroughs-line';

// Public CDN-served simplified NYC borough boundaries (~100KB, MIT-licensed).
const BOROUGH_GEOJSON_URL = 'https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@master/public/data/new-york-city-boroughs.geojson';

// Map the GeoJSON's "name" property to our borough slug
const NAME_TO_SLUG: Record<string, string> = {
  'Manhattan': 'manhattan',
  'Brooklyn': 'brooklyn',
  'Queens': 'queens',
  'Bronx': 'bronx',
  'Staten Island': 'staten_island',
};

export interface RenderOptions {
  selected: Set<string>;
  onToggle: (boroughSlug: string) => void;
}

let cachedGeoJson: GeoJSON.FeatureCollection | null = null;

export async function renderBoroughOverlay(map: MapboxMap, opts: RenderOptions): Promise<() => void> {
  // Load + cache the GeoJSON
  if (!cachedGeoJson) {
    try {
      const res = await fetch(BOROUGH_GEOJSON_URL);
      if (!res.ok) throw new Error(`geo fetch ${res.status}`);
      cachedGeoJson = await res.json();
    } catch (err) {
      console.error('[BoroughOverlay] geo load failed', err);
      return () => {};
    }
  }

  // Annotate features with our slug so we can filter in expressions
  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: (cachedGeoJson?.features ?? []).map(f => {
      const name = (f.properties as { name?: string } | null)?.name ?? '';
      const slug = NAME_TO_SLUG[name] ?? '';
      return { ...f, properties: { ...(f.properties ?? {}), convoca_slug: slug } };
    }),
  };

  // Add or update source
  const existing = map.getSource(SOURCE_ID);
  if (existing && (existing as mapboxgl.GeoJSONSource).setData) {
    (existing as mapboxgl.GeoJSONSource).setData(fc);
  } else {
    map.addSource(SOURCE_ID, { type: 'geojson', data: fc });
  }

  // Fill layer
  if (!map.getLayer(FILL_LAYER)) {
    map.addLayer({
      id: FILL_LAYER,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': [
          'case',
          ['in', ['get', 'convoca_slug'], ['literal', Array.from(opts.selected)]], '#1d4ed8',
          '#1d4ed8',
        ],
        'fill-opacity': [
          'case',
          ['in', ['get', 'convoca_slug'], ['literal', Array.from(opts.selected)]], 0.18,
          0.04,
        ],
      },
    });
  } else {
    map.setPaintProperty(FILL_LAYER, 'fill-opacity', [
      'case',
      ['in', ['get', 'convoca_slug'], ['literal', Array.from(opts.selected)]], 0.18,
      0.04,
    ]);
  }

  // Line layer
  if (!map.getLayer(LINE_LAYER)) {
    map.addLayer({
      id: LINE_LAYER,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color': [
          'case',
          ['in', ['get', 'convoca_slug'], ['literal', Array.from(opts.selected)]], '#1d4ed8',
          '#737373',
        ],
        'line-width': [
          'case',
          ['in', ['get', 'convoca_slug'], ['literal', Array.from(opts.selected)]], 2.5,
          1,
        ],
      },
    });
  } else {
    map.setPaintProperty(LINE_LAYER, 'line-color', [
      'case',
      ['in', ['get', 'convoca_slug'], ['literal', Array.from(opts.selected)]], '#1d4ed8',
      '#737373',
    ]);
    map.setPaintProperty(LINE_LAYER, 'line-width', [
      'case',
      ['in', ['get', 'convoca_slug'], ['literal', Array.from(opts.selected)]], 2.5,
      1,
    ]);
  }

  // Hover cursor
  const onEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
  const onLeave = () => { map.getCanvas().style.cursor = ''; };
  map.on('mouseenter', FILL_LAYER, onEnter);
  map.on('mouseleave', FILL_LAYER, onLeave);

  // Click toggles
  const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const slug = (f.properties as { convoca_slug?: string } | null)?.convoca_slug;
    if (slug) {
      opts.onToggle(slug);
      e.originalEvent?.stopPropagation?.();
    }
  };
  map.on('click', FILL_LAYER, onClick);

  return () => {
    try { map.off('click', FILL_LAYER, onClick); } catch {}
    try { map.off('mouseenter', FILL_LAYER, onEnter); } catch {}
    try { map.off('mouseleave', FILL_LAYER, onLeave); } catch {}
    if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER);
    if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  };
}
