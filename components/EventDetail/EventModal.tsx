'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  X, ExternalLink, Calendar, MapPin, Users as UsersIcon, Link as LinkIcon,
  Flag, Loader2,
} from 'lucide-react';
import { CITIES, CAUSE_DISPLAY, EVENT_TYPE_DISPLAY } from '@/lib/constants';
import { getEventIcon } from '@/lib/icons';
import type { CanonicalEvent, CitySlug } from '@/lib/types';
import { OpenInMaps } from './OpenInMaps';
import { SignupCTA } from './SignupCTA';
import { SourcesList } from './SourcesList';
import { ReasoningTrace } from './ReasoningTrace';
import { EventComments } from './EventComments';
import { FlagModal } from '@/components/Map/FlagModal';

interface EventDetailPayload {
  event: CanonicalEvent & { source_image_url?: string | null };
  sources: Parameters<typeof SourcesList>[0]['sources'];
  flags: Array<{ id: string; flag_type: string; severity: string; note: string | null; created_at: string }>;
  dedup_runs: Parameters<typeof ReasoningTrace>[0]['runs'];
}

interface EventModalProps {
  eventId: string;
  sessionId: string;
  isVerified: boolean;
  onClose: () => void;
  onRequestSignIn: () => void;
  language?: 'en' | 'es';
}

export function EventModal({ eventId, sessionId, isVerified, onClose, onRequestSignIn, language = 'en' }: EventModalProps) {
  const [data, setData] = useState<EventDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: EventDetailPayload = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const event = data?.event;
  const lang = language;
  const Icon = event ? getEventIcon(event.event_type) : MapPin;
  const meta = event ? (EVENT_TYPE_DISPLAY[event.event_type] ?? EVENT_TYPE_DISPLAY.other) : null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-start md:items-center justify-center p-0 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-none md:rounded-xl shadow-xl w-full max-w-2xl my-0 md:my-4 max-h-screen md:max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="w-5 h-5 text-neutral-700 shrink-0" />
            <span className="text-xs uppercase tracking-wide text-neutral-500 truncate">
              {meta ? (lang === 'es' ? meta.label_es : meta.label_en) : (event?.event_type ?? '')}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/events/${eventId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 px-2 py-1 rounded hover:bg-neutral-100"
              title={lang === 'es' ? 'Abrir en pestaña nueva' : 'Open in new tab'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {lang === 'es' ? 'Pestaña' : 'New tab'}
            </a>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 p-1" aria-label="close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="p-10 flex items-center justify-center text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
        {error && (
          <div className="m-4 rounded bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">{error}</div>
        )}

        {event && !loading && (
          <div className="p-4 space-y-5">
            {/* Title block */}
            <div>
              <h1 className="text-xl font-semibold text-neutral-900 leading-snug">{event.title}</h1>
              {event.extraction_confidence != null && (
                <div className="mt-1 text-[11px] text-neutral-500">
                  {lang === 'es' ? 'Confianza de extracción' : 'Extraction confidence'}: {event.extraction_confidence.toFixed(2)}
                </div>
              )}
            </div>

            {/* Metadata grid */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {event.datetime_text_raw && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 mt-0.5 text-neutral-500 shrink-0" />
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{lang === 'es' ? 'Fecha' : 'When'}</dt>
                    <dd className="text-neutral-900">{event.datetime_text_raw}</dd>
                    {event.datetime_iso && (
                      <dd className="text-[11px] text-neutral-500">{new Date(event.datetime_iso).toLocaleString()}</dd>
                    )}
                  </div>
                </div>
              )}
              {event.location_text && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-neutral-500 shrink-0" />
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{lang === 'es' ? 'Lugar' : 'Where'}</dt>
                    <dd className="text-neutral-900">{event.location_text}</dd>
                  </div>
                </div>
              )}
              {event.organizer && (
                <div className="flex items-start gap-2">
                  <UsersIcon className="w-4 h-4 mt-0.5 text-neutral-500 shrink-0" />
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{lang === 'es' ? 'Organiza' : 'Organizer'}</dt>
                    <dd className="text-neutral-900">{event.organizer}</dd>
                  </div>
                </div>
              )}
              {event.signup_url && (
                <div className="flex items-start gap-2">
                  <LinkIcon className="w-4 h-4 mt-0.5 text-neutral-500 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{lang === 'es' ? 'Enlace' : 'Link'}</dt>
                    <dd>
                      <a href={event.signup_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline truncate inline-block max-w-full">
                        {event.signup_url.replace(/^https?:\/\//, '')}
                      </a>
                    </dd>
                  </div>
                </div>
              )}
            </dl>

            {/* Cause tags */}
            {event.cause_tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {event.cause_tags.map(tag => {
                  const c = CAUSE_DISPLAY[tag];
                  return (
                    <span key={tag} className="text-xs px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-700">
                      {c ? (lang === 'es' ? c.label_es : c.label_en) : tag}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Open in maps */}
            <OpenInMaps
              title={event.title}
              lat={event.lat}
              lng={event.lng}
              address={event.location_text}
              language={lang}
            />

            {/* Action CTA */}
            <SignupCTA event={event} language={lang} />

            {/* Flag CTA */}
            <button
              onClick={() => isVerified ? setFlagOpen(true) : onRequestSignIn()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            >
              <Flag className="w-4 h-4" />
              <span>{lang === 'es' ? 'Reportar aviso comunitario' : 'Add a community flag'}</span>
              {!isVerified && (
                <span className="text-[10px] uppercase tracking-wide text-amber-700 ml-1">
                  ({lang === 'es' ? 'requiere sesión' : 'sign-in needed'})
                </span>
              )}
            </button>

            {/* Live flags on this event */}
            {data && data.flags.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-amber-800 mb-1">
                  {lang === 'es' ? 'Avisos en tiempo real' : 'Live community flags'}
                </div>
                <ul className="space-y-1 text-amber-900">
                  {data.flags.map(f => (
                    <li key={f.id}>
                      <span className="font-medium">{f.flag_type.replace(/_/g, ' ')}</span>
                      {f.note && <span> — {f.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sources + dedup trace */}
            {data && <SourcesList sources={data.sources} language={lang} />}
            {data && <ReasoningTrace runs={data.dedup_runs} eventTitle={event.title} language={lang} />}

            {/* Comments */}
            <EventComments
              eventId={eventId}
              sessionId={sessionId}
              isVerified={isVerified}
              onRequestSignIn={onRequestSignIn}
              language={lang}
            />
          </div>
        )}
      </div>

      {flagOpen && event && (
        <FlagModal
          city={event.city_slug as CitySlug}
          sessionId={sessionId}
          lngLat={{
            lng: event.lng ?? CITIES[event.city_slug as CitySlug].center.lng,
            lat: event.lat ?? CITIES[event.city_slug as CitySlug].center.lat,
          }}
          eventId={eventId}
          language={lang}
          onClose={() => setFlagOpen(false)}
          onSubmitted={() => { setFlagOpen(false); void load(); }}
        />
      )}
    </div>
  );
}
