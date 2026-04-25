'use client';

import { useEffect, useState } from 'react';
import { FlagModal } from '@/components/Map/FlagModal';
import { CITIES } from '@/lib/constants';
import type { CitySlug } from '@/lib/types';

interface EventFlagButtonProps {
  city: CitySlug;
  eventId: string;
  fallbackLat?: number | null;
  fallbackLng?: number | null;
  language?: 'en' | 'es';
}

const SESSION_KEY = 'convoca_session_id';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function EventFlagButton({ city, eventId, fallbackLat, fallbackLng, language = 'en' }: EventFlagButtonProps) {
  const [sessionId, setSessionId] = useState('');
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { setSessionId(getOrCreateSessionId()); }, []);

  const center = CITIES[city].center;
  const lat = fallbackLat ?? center.lat;
  const lng = fallbackLng ?? center.lng;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
      >
        🚩 <span>{language === 'es' ? 'Reportar aviso' : 'Add a flag'}</span>
      </button>
      {open && sessionId && (
        <FlagModal
          city={city}
          sessionId={sessionId}
          lngLat={{ lng, lat }}
          eventId={eventId}
          language={language}
          onClose={() => setOpen(false)}
          onSubmitted={review => {
            setToast(
              review.decision === 'approve'
                ? (language === 'es' ? '✓ Aviso publicado' : '✓ Flag published')
                : review.decision === 'review'
                  ? (language === 'es' ? 'En revisión humana' : 'Sent to human review')
                  : (language === 'es' ? 'Bloqueado por la revisión' : 'Blocked by Safety Review'),
            );
            setTimeout(() => setToast(null), 4500);
          }}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-neutral-900 text-white text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </>
  );
}
