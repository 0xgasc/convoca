'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  X, Sparkles, BookmarkPlus, Clock, ThumbsDown, Loader2, MapPin, Calendar, Users,
  ExternalLink, RefreshCw, ChevronRight,
} from 'lucide-react';
import { getEventIcon } from '@/lib/icons';
import { EVENT_TYPE_DISPLAY, CAUSE_DISPLAY, NYC_BOROUGHS } from '@/lib/constants';
import type { CitySlug, CanonicalEvent } from '@/lib/types';

interface CuratedItem {
  event_id: string;
  score: number;
  why: string;
  event: CanonicalEvent;
}

// Top causes to show in the quick picker (most common civic causes)
const QUICK_CAUSES = [
  'housing', 'immigration', 'labor', 'mutual_aid', 'climate',
  'racial_justice', 'lgbtq_rights', 'education', 'healthcare',
  'police_accountability', 'food_security', 'arts_culture',
];

interface CurateCardStackProps {
  sessionId: string;
  city: CitySlug;
  language?: 'en' | 'es';
  initialCauses?: string[];
  initialBorough?: string;
  onClose: () => void;
  onSaved?: (eventId: string) => void;
  onOpenEvent?: (eventId: string) => void;
}

const COPY = {
  en: {
    title: 'Curated for you',
    blurb: 'Picked by an agent based on your causes, neighborhood, and what you\'ve saved before. Accept or pass — it learns from each call.',
    loading: 'Curator agent thinking…',
    none: 'No fresh events to suggest right now.',
    save: 'Save',
    pass: 'Not for me',
    maybe: 'Maybe later',
    of: 'of',
    rerun: 'Refresh suggestions',
    summary: 'What I skipped',
  },
  es: {
    title: 'Curado para vos',
    blurb: 'Elegido por un agente según tus causas, barrio y lo que guardaste antes. Aceptá o descartá — aprende con cada elección.',
    loading: 'El agente curador está pensando…',
    none: 'No hay eventos frescos para sugerir ahora.',
    save: 'Guardar',
    pass: 'No me interesa',
    maybe: 'Tal vez después',
    of: 'de',
    rerun: 'Refrescar sugerencias',
    summary: 'Lo que descarté',
  },
};

export function CurateCardStack({ sessionId, city, language = 'en', initialCauses = [], initialBorough, onClose, onSaved, onOpenEvent }: CurateCardStackProps) {
  const t = COPY[language];
  const [items, setItems] = useState<CuratedItem[]>([]);
  const [skipped, setSkipped] = useState<string>('');
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Preference picker state — shown first if no causes known
  const [pickedCauses, setPickedCauses] = useState<string[]>(initialCauses);
  const [pickedBorough, setPickedBorough] = useState<string>(initialBorough ?? '');
  const [prefsDone, setPrefsDone] = useState(initialCauses.length > 0);

  const load = useCallback(async (causes: string[], borough: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, city, language, maxResults: 12, cause_prefs: causes, borough: borough || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setItems(json.curated ?? []);
      setSkipped(json.skipped_summary ?? '');
      setIdx(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId, city, language]);

  useEffect(() => {
    if (prefsDone) void load(pickedCauses, pickedBorough);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsDone]);

  const current = items[idx];

  const advance = () => setIdx(i => Math.min(i + 1, items.length));

  const save = async () => {
    if (!current) return;
    setActionBusy(true);
    try {
      await fetch('/api/saves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, eventId: current.event_id, status: 'saved' }),
      });
      onSaved?.(current.event_id);
      advance();
    } finally { setActionBusy(false); }
  };

  const pass = async (decision: 'pass' | 'maybe') => {
    if (!current) return;
    setActionBusy(true);
    try {
      await fetch('/api/passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, eventId: current.event_id, decision }),
      });
      advance();
    } finally { setActionBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-start md:items-center justify-center p-0 md:p-6 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white rounded-none md:rounded-xl shadow-xl w-full max-w-xl my-0 md:my-4 max-h-screen md:max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-neutral-900">{t.title}</h2>
            {!loading && items.length > 0 && (
              <span className="text-xs text-neutral-500 ml-2">
                {Math.min(idx + 1, items.length)} {t.of} {items.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => void load(pickedCauses, pickedBorough)}
              disabled={loading}
              className="text-xs text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-100"
              title={t.rerun}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 p-1" aria-label="close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Preference picker (shown before first run) ── */}
        {!prefsDone && (
          <div className="px-4 pt-4 pb-2 space-y-4">
            <p className="text-sm text-neutral-600">
              {language === 'es' ? '¿Qué te importa? Elegí algunas causas y el agente filtra para vos.' : 'What do you care about? Pick a few causes and the agent filters for you.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_CAUSES.map(c => {
                const meta = CAUSE_DISPLAY[c];
                const label = meta ? (language === 'es' ? meta.label_es : meta.label_en) : c;
                const active = pickedCauses.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => setPickedCauses(prev => active ? prev.filter(x => x !== c) : [...prev, c])}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-700 hover:border-neutral-500'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {city === 'nyc' && (
              <div>
                <div className="text-xs text-neutral-500 mb-1.5">{language === 'es' ? 'Barrio (opcional)' : 'Borough (optional)'}</div>
                <div className="flex flex-wrap gap-2">
                  {NYC_BOROUGHS.map(b => (
                    <button
                      key={b.slug}
                      onClick={() => setPickedBorough(prev => prev === b.slug ? '' : b.slug)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${pickedBorough === b.slug ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-700 hover:border-neutral-500'}`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => setPrefsDone(true)}
              disabled={pickedCauses.length === 0}
              className="w-full py-2.5 rounded-full bg-neutral-900 text-white text-sm font-medium disabled:opacity-40 inline-flex items-center justify-center gap-1.5 hover:bg-neutral-800"
            >
              <Sparkles className="w-4 h-4" />
              {language === 'es' ? 'Curar para mí' : 'Curate for me'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {prefsDone && pickedCauses.length > 0 && (
          <div className="px-4 pt-2 flex flex-wrap gap-1.5 items-center">
            {pickedCauses.map(c => {
              const meta = CAUSE_DISPLAY[c];
              return <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{meta ? (language === 'es' ? meta.label_es : meta.label_en) : c}</span>;
            })}
            {pickedBorough && <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{NYC_BOROUGHS.find(b => b.slug === pickedBorough)?.name}</span>}
            <button onClick={() => { setPrefsDone(false); setItems([]); }} className="text-[11px] text-neutral-400 hover:text-neutral-700 ml-1">edit</button>
          </div>
        )}

        {loading && (
          <div className="p-12 flex items-center justify-center text-neutral-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">{t.loading}</span>
          </div>
        )}

        {error && (
          <div className="m-4 rounded bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">{error}</div>
        )}

        {!loading && items.length === 0 && !error && (
          <div className="p-10 text-center text-sm text-neutral-500">{t.none}</div>
        )}

        {/* Card */}
        {!loading && current && (
          <div className="p-4">
            <CardView
              item={current}
              language={language}
              onOpen={() => onOpenEvent?.(current.event_id)}
            />

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => void pass('pass')}
                disabled={actionBusy}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 text-sm text-neutral-700 disabled:opacity-50"
              >
                <ThumbsDown className="w-4 h-4" /> {t.pass}
              </button>
              <button
                onClick={() => void pass('maybe')}
                disabled={actionBusy}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 text-sm text-neutral-700 disabled:opacity-50"
              >
                <Clock className="w-4 h-4" /> {t.maybe}
              </button>
              <button
                onClick={() => void save()}
                disabled={actionBusy}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 text-sm font-medium disabled:opacity-50"
              >
                {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookmarkPlus className="w-4 h-4" />}
                {t.save}
              </button>
            </div>
          </div>
        )}

        {/* Summary when done */}
        {!loading && items.length > 0 && idx >= items.length && (
          <div className="p-4 space-y-3">
            <div className="text-sm font-medium text-neutral-900">
              {language === 'es' ? '¡Listo!' : 'All done!'}
            </div>
            {skipped && (
              <div className="rounded bg-neutral-50 border border-neutral-200 p-3 text-xs text-neutral-700">
                <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">{t.summary}</div>
                {skipped}
              </div>
            )}
            <button
              onClick={() => void load(pickedCauses, pickedBorough)}
              className="w-full py-2 text-sm font-medium rounded border border-neutral-300 bg-white hover:bg-neutral-50"
            >
              {t.rerun}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CardView({ item, language, onOpen }: { item: CuratedItem; language: 'en' | 'es'; onOpen?: () => void }) {
  const ev = item.event;
  const meta = EVENT_TYPE_DISPLAY[ev.event_type] ?? EVENT_TYPE_DISPLAY.other;
  const Icon = getEventIcon(ev.event_type);
  return (
    <article className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      {/* Top label + score */}
      <div className="flex items-baseline justify-between px-4 pt-3">
        <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-neutral-500">
          <Icon className="w-3.5 h-3.5" />
          {language === 'es' ? meta.label_es : meta.label_en}
        </div>
        <div className="text-[11px] text-amber-700 inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {Math.round(item.score * 100)}%
        </div>
      </div>

      {/* Title */}
      <h3 className="px-4 mt-1 text-xl font-semibold text-neutral-900 leading-snug">
        <button onClick={onOpen} className="text-left hover:underline">{ev.title}</button>
      </h3>

      {/* Why */}
      <div className="mx-4 mt-3 rounded bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 italic">
        {item.why}
      </div>

      {/* Metadata */}
      <dl className="px-4 mt-3 mb-4 grid grid-cols-1 gap-2 text-sm text-neutral-700">
        {ev.datetime_text_raw && (
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 mt-0.5 text-neutral-500 shrink-0" />
            <span>{ev.datetime_text_raw}</span>
          </div>
        )}
        {ev.location_text && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-neutral-500 shrink-0" />
            <span>{ev.location_text}</span>
          </div>
        )}
        {ev.organizer && (
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 mt-0.5 text-neutral-500 shrink-0" />
            <span>{ev.organizer}</span>
          </div>
        )}
      </dl>

      <div className="px-4 pb-3 flex items-center justify-end">
        <button
          onClick={onOpen}
          className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" /> {language === 'es' ? 'Ver detalles' : 'View details'}
        </button>
      </div>
    </article>
  );
}
