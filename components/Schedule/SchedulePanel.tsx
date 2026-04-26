'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Calendar, MapPin, Sparkles, Loader2, Trash2, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { getEventIcon } from '@/lib/icons';
import { EVENT_TYPE_DISPLAY } from '@/lib/constants';
import type { CanonicalEvent } from '@/lib/types';

interface Save {
  session_id: string;
  event_id: string;
  status: string;
  note: string | null;
  created_at: string;
  event: CanonicalEvent;
}

interface ScheduleItem {
  event_id: string;
  order: number;
  arrival_time_local: string;
  leave_time_local: string;
  travel_to_next_min?: number | null;
  reasoning: string;
}

interface Conflict { event_ids: string[]; reason: string; }
interface Skipped { event_id: string; reason: string; }

interface ScheduleResult {
  summary: string;
  itinerary: ScheduleItem[];
  conflicts: Conflict[];
  skipped: Skipped[];
}

interface SchedulePanelProps {
  sessionId: string;
  language?: 'en' | 'es';
  onClose: () => void;
  onOpenEvent: (eventId: string) => void;
}

export function SchedulePanel({ sessionId, language = 'en', onClose, onOpenEvent }: SchedulePanelProps) {
  const lang = language;
  const [saves, setSaves] = useState<Save[]>([]);
  const [loadingSaves, setLoadingSaves] = useState(true);
  const [query, setQuery] = useState(lang === 'es' ? 'planeá mi sábado' : 'plan my Saturday');
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<ScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadingSaves(true);
    try {
      const res = await fetch(`/api/saves?sessionId=${encodeURIComponent(sessionId)}`);
      const json = await res.json();
      setSaves(json.saves ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSaves(false);
    }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  const removeSave = async (eventId: string) => {
    await fetch(`/api/saves/${eventId}?sessionId=${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    setSaves(prev => prev.filter(s => s.event_id !== eventId));
    if (plan) setPlan({
      ...plan,
      itinerary: plan.itinerary.filter(i => i.event_id !== eventId),
    });
  };

  const buildPlan = async () => {
    setPlanning(true);
    setError(null);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, query, language: lang }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setPlan(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlanning(false);
    }
  };

  const eventById = useMemo(() => {
    const m = new Map<string, CanonicalEvent>();
    saves.forEach(s => m.set(s.event_id, s.event));
    return m;
  }, [saves]);

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-start md:items-center justify-center p-0 md:p-6 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white rounded-none md:rounded-xl shadow-xl w-full max-w-2xl my-0 md:my-4 max-h-screen md:max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-neutral-700" />
            <h2 className="text-lg font-semibold text-neutral-900">
              {lang === 'es' ? 'Mi agenda' : 'My schedule'}
            </h2>
            <span className="text-xs text-neutral-500">{saves.length}</span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 p-1" aria-label="close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Plan-builder */}
          <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-neutral-900">
              <Sparkles className="w-4 h-4 text-amber-600" />
              {lang === 'es' ? 'Construir mi día con un agente' : 'Build my day with an agent'}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder={lang === 'es' ? '"planeá mi sábado", "este finde, solo en Brooklyn"' : '"plan my Saturday", "this weekend in Brooklyn only"'}
              />
              <button
                onClick={() => void buildPlan()}
                disabled={planning || saves.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300"
              >
                {planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {lang === 'es' ? 'Planear' : 'Plan'}
              </button>
            </div>
            {saves.length === 0 && !loadingSaves && (
              <p className="mt-2 text-xs text-neutral-500">
                {lang === 'es'
                  ? 'Guardá eventos primero (botón Guardar dentro de cada evento).'
                  : 'Save some events first (Save button inside each event).'}
              </p>
            )}
          </section>

          {error && (
            <div className="rounded bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* Plan output */}
          {plan && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
              <div className="text-sm text-neutral-900">{plan.summary}</div>
              {plan.itinerary.length > 0 && (
                <ol className="space-y-2">
                  {plan.itinerary.map(item => {
                    const ev = eventById.get(item.event_id);
                    if (!ev) return null;
                    const Icon = getEventIcon(ev.event_type);
                    return (
                      <li key={item.event_id} className="bg-white rounded border border-amber-200 p-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="text-xs font-mono text-amber-800 shrink-0">{item.arrival_time_local} → {item.leave_time_local}</span>
                            <Icon className="w-3.5 h-3.5 text-neutral-700 shrink-0 self-center" />
                            <button
                              onClick={() => onOpenEvent(item.event_id)}
                              className="text-sm font-medium text-neutral-900 hover:underline truncate text-left"
                            >
                              {ev.title}
                            </button>
                          </div>
                          {item.travel_to_next_min != null && item.travel_to_next_min > 0 && (
                            <span className="text-[11px] text-neutral-500 shrink-0">{item.travel_to_next_min}m {lang === 'es' ? 'a próx.' : 'to next'}</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-neutral-600 italic">{item.reasoning}</div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {plan.conflicts.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-amber-800 mb-1">
                    {lang === 'es' ? 'Conflictos' : 'Conflicts'}
                  </div>
                  <ul className="text-xs text-amber-900 space-y-0.5">
                    {plan.conflicts.map((c, i) => (
                      <li key={i}>{c.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.skipped.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                    {lang === 'es' ? 'Omitidos' : 'Skipped'}
                  </div>
                  <ul className="text-xs text-neutral-700 space-y-0.5">
                    {plan.skipped.map((s, i) => {
                      const ev = eventById.get(s.event_id);
                      return <li key={i}>{ev?.title ?? s.event_id}: {s.reason}</li>;
                    })}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Saved events list */}
          <section>
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
              {lang === 'es' ? 'Guardados' : 'Saved events'}
            </div>
            {loadingSaves ? (
              <div className="flex items-center justify-center text-neutral-500 py-6">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : saves.length === 0 ? (
              <div className="text-sm text-neutral-500 italic py-4">
                {lang === 'es'
                  ? 'Aún no guardaste eventos. Abrí un evento y tocá Guardar.'
                  : 'No saved events yet. Open one and tap Save.'}
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100 rounded border border-neutral-200">
                {saves.map(s => {
                  const meta = EVENT_TYPE_DISPLAY[s.event.event_type] ?? EVENT_TYPE_DISPLAY.other;
                  const Icon = getEventIcon(s.event.event_type);
                  return (
                    <li key={s.event_id} className="px-3 py-2 flex items-baseline justify-between gap-2">
                      <button
                        onClick={() => onOpenEvent(s.event_id)}
                        className="flex items-baseline gap-2 min-w-0 text-left flex-1"
                      >
                        <Icon className="w-3.5 h-3.5 text-neutral-700 self-center shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-neutral-900 truncate">{s.event.title}</div>
                          <div className="text-[11px] text-neutral-500 flex flex-wrap gap-x-2">
                            <span className="uppercase tracking-wide">{lang === 'es' ? meta.label_es : meta.label_en}</span>
                            {s.event.datetime_iso && <span>{new Date(s.event.datetime_iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
                            {s.event.location_text && <span><MapPin className="w-2.5 h-2.5 inline mr-0.5" />{s.event.location_text}</span>}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`/events/${s.event_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neutral-400 hover:text-neutral-700 p-1"
                          title={lang === 'es' ? 'Pestaña nueva' : 'Open in new tab'}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => void removeSave(s.event_id)}
                          className="text-neutral-400 hover:text-red-600 p-1"
                          title={lang === 'es' ? 'Quitar de guardados' : 'Remove from saved'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
