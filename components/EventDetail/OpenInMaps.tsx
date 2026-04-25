'use client';

import { Apple, Map as MapIcon } from 'lucide-react';

interface OpenInMapsProps {
  title?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  language?: 'en' | 'es';
}

export function OpenInMaps({ title, lat, lng, address, language = 'en' }: OpenInMapsProps) {
  if ((lat == null || lng == null) && !address) return null;

  const q = encodeURIComponent(title ? `${title}` : address ?? '');
  const apple = lat != null && lng != null
    ? `https://maps.apple.com/?ll=${lat},${lng}${q ? `&q=${q}` : ''}`
    : `https://maps.apple.com/?q=${q}`;
  const google = lat != null && lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={apple}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800"
      >
        <Apple className="w-4 h-4" />
        <span>{language === 'es' ? 'Apple Mapas' : 'Apple Maps'}</span>
      </a>
      <a
        href={google}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800"
      >
        <MapIcon className="w-4 h-4" />
        <span>{language === 'es' ? 'Google Mapas' : 'Google Maps'}</span>
      </a>
    </div>
  );
}
