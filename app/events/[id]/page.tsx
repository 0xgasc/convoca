import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Calendar, MapPin, Users } from 'lucide-react';
import { SignupCTA } from '@/components/EventDetail/SignupCTA';
import { SourcesList } from '@/components/EventDetail/SourcesList';
import { ReasoningTrace } from '@/components/EventDetail/ReasoningTrace';
import { EventFlagButton } from '@/components/EventDetail/EventFlagButton';
import { EVENT_TYPE_DISPLAY, CAUSE_DISPLAY } from '@/lib/constants';
import type { CanonicalEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function fetchEvent(id: string) {
  const h = headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const base = `${proto}://${host}`;
  const res = await fetch(`${base}/api/events/${id}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load event: ${res.status}`);
  return res.json() as Promise<{
    event: CanonicalEvent;
    sources: Parameters<typeof SourcesList>[0]['sources'];
    flags: Array<{ id: string; flag_type: string; severity: string; note: string | null; created_at: string }>;
    dedup_runs: Parameters<typeof ReasoningTrace>[0]['runs'];
  }>;
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const data = await fetchEvent(params.id);
  if (!data) notFound();

  const { event, sources, flags, dedup_runs } = data;
  const lang: 'en' | 'es' = event.city_slug === 'guatemala_city' ? 'es' : 'en';
  const meta = EVENT_TYPE_DISPLAY[event.event_type] ?? EVENT_TYPE_DISPLAY.other;

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link href="/" className="text-sm text-blue-700 hover:underline">← {lang === 'es' ? 'Volver al mapa' : 'Back to map'}</Link>

        <header className="mt-3 mb-6">
          <div className="flex items-baseline gap-2 text-xs uppercase tracking-wide" style={{ color: meta.color }}>
            <span>{lang === 'es' ? meta.label_es : meta.label_en}</span>
            {event.extraction_confidence !== null && (
              <span>· {lang === 'es' ? 'confianza' : 'confidence'} {event.extraction_confidence.toFixed(2)}</span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900 mt-1">{event.title}</h1>
          <div className="mt-2 text-sm text-neutral-700 space-y-0.5">
            {event.datetime_text_raw && <div className="flex items-start gap-1.5"><Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0 text-neutral-400" />{event.datetime_text_raw}</div>}
            {event.location_text && <div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-neutral-400" />{event.location_text}</div>}
            {event.organizer && <div className="flex items-start gap-1.5"><Users className="w-3.5 h-3.5 mt-0.5 shrink-0 text-neutral-400" />{lang === 'es' ? 'organizado por' : 'organized by'} {event.organizer}</div>}
          </div>
          {event.cause_tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {event.cause_tags.map(t => {
                const c = CAUSE_DISPLAY[t];
                return (
                  <span key={t} className="text-xs px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-700">
                    {c ? (lang === 'es' ? c.label_es : c.label_en) : t}
                  </span>
                );
              })}
            </div>
          )}
        </header>

        <div className="mb-4">
          <EventFlagButton
            city={event.city_slug}
            eventId={event.id}
            fallbackLat={event.lat}
            fallbackLng={event.lng}
            language={lang}
          />
        </div>

        <div className="space-y-4">
          <SignupCTA event={event} language={lang} />

          {flags.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs uppercase tracking-wide text-amber-800 mb-2">
                {lang === 'es' ? 'Avisos en tiempo real' : 'Live community flags'}
              </div>
              <ul className="space-y-1 text-sm text-amber-900">
                {flags.map(f => (
                  <li key={f.id}>
                    <span className="font-medium">{f.flag_type.replace(/_/g, ' ')}</span>
                    {f.note && <span> — {f.note}</span>}
                    <span className="text-xs text-amber-700 ml-2">{new Date(f.created_at).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <SourcesList sources={sources} language={lang} />
          <ReasoningTrace runs={dedup_runs} eventTitle={event.title} language={lang} />
        </div>
      </div>
    </main>
  );
}
