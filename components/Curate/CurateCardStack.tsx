'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  X, Sparkles, BookmarkPlus, Clock, ThumbsDown, Loader2, MapPin, Calendar, Users,
  ExternalLink, RefreshCw,
} from 'lucide-react';
import { getEventIcon } from '@/lib/icons';
import { EVENT_TYPE_DISPLAY } from '@/lib/constants';
import type { CitySlug, CanonicalEvent } from '@/lib/types';

interface CuratedItem {
  event_id: string;
  score: number;
  why: string;
  event: CanonicalEvent;
}

interface CurateCardStackProps {
  sessionId: string;
  city: CitySlug;
  language?: 'en' | 'es';
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

export function CurateCardStack({ sessionId, city, language = 'en', onClose, onSaved, onOpenEvent }: CurateCardStackProps) {
  const t = COPY[language];
  const [items, setItems] = useState<CuratedItem[]>([]);
  const [skipped, setSkipped] = useState<string>('');
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, city, language, maxResults: 12 }),
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

  useEffect(() => { void load(); }, [load]);

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
              onClick={() => void load()}
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

        <p className="px-4 pt-3 text-xs text-neutral-500">{t.blurb}</p>

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
              onClick={() => void load()}
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
