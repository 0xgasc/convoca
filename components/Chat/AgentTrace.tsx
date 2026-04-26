'use client';

import { useEffect, useRef, useState } from 'react';
import { Link2, Star, AlertTriangle, Calendar, Loader2, ArrowRight } from 'lucide-react';
import type { AgentEvent } from '@/lib/agents/orchestrator';
import type { ScheduleResult } from '@/lib/agents/scheduler';

interface EventSummary {
  id: string;
  title: string;
  location_text: string | null;
  datetime_iso: string | null;
}

interface AgentTraceProps {
  prompt: string | null;
  sessionId: string;
  city: 'nyc' | 'guatemala_city';
  onComplete?: (eventIds: string[]) => void;
  events?: EventSummary[];
  onEventClick?: (id: string) => void;
}

export function AgentTrace({ prompt, sessionId, city, onComplete, events, onEventClick }: AgentTraceProps) {
  const [running, setRunning] = useState(false);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const traceContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!prompt) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setTraces([]);

    const run = async () => {
      try {
        const res = await fetch('/api/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, sessionId, city }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6)) as AgentEvent;
              handleEvent(event);
            } catch { /* skip malformed */ }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setTraces(prev => [...prev, { kind: 'error', message: 'Something went wrong. Try again.', time: Date.now() }]);
      } finally {
        setRunning(false);
      }
    };

    void run();
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, sessionId, city]);

  function handleEvent(event: AgentEvent) {
    switch (event.type) {
      case 'intent':
        setTraces(prev => [...prev, { kind: 'intent', reasoning: event.intent.reasoning, tags: event.intent.cause_tags, time: Date.now() }]);
        break;
      case 'extracted':
        setTraces(prev => [...prev, { kind: 'extracted', title: event.event.title, time: Date.now() }]);
        break;
      case 'merged':
        setTraces(prev => [...prev, { kind: 'merged', title: event.canonical.title, mergedFromCount: event.mergedFromCount, steps: event.trace, time: Date.now() }]);
        break;
      case 'recommendation':
        setTraces(prev => [...prev, { kind: 'recommendation', eventId: event.eventId, reasoning: event.reasoning, time: Date.now() }]);
        break;
      case 'scheduled':
        setTraces(prev => [...prev, { kind: 'scheduled', schedule: event.schedule, time: Date.now() }]);
        break;
      case 'final_result':
        onComplete?.(event.eventIds);
        if (event.eventIds.length > 0) {
          setTraces(prev => [...prev, { kind: 'done', count: event.eventIds.length, eventIds: event.eventIds, time: Date.now() }]);
        }
        break;
      case 'error':
        setTraces(prev => [...prev, { kind: 'error', message: event.message, time: Date.now() }]);
        break;
    }
  }

  useEffect(() => {
    traceContainerRef.current?.scrollTo({ top: traceContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [traces.length]);

  return (
    <div ref={traceContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
      {running && traces.length === 0 && (
        <div className="flex items-center gap-2 text-neutral-400 text-sm">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Working on it…</span>
        </div>
      )}
      {running && traces.length > 0 && (
        <div className="flex items-center gap-1.5 text-neutral-400 text-xs">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Searching…</span>
        </div>
      )}
      {traces.map((t, i) => <TraceItem key={i} trace={t} events={events} onEventClick={onEventClick} />)}
    </div>
  );
}

type TraceEntry =
  | { kind: 'intent'; reasoning: string; tags: string[]; time: number }
  | { kind: 'extracted'; title: string; time: number }
  | { kind: 'merged'; title: string; mergedFromCount: number; steps: string[]; time: number }
  | { kind: 'recommendation'; eventId: string; reasoning: string; time: number }
  | { kind: 'scheduled'; schedule: ScheduleResult; time: number }
  | { kind: 'done'; count: number; eventIds: string[]; time: number }
  | { kind: 'error'; message: string; time: number };

function humanizeReasoning(raw: string): string {
  return raw
    .replace(/^user is searching for\s*/i, '')
    .replace(/^the user is (searching|looking) for\s*/i, '')
    .replace(/^searching for\s*/i, '')
    .replace(/\bnyc\b/gi, 'NYC')
    .trim();
}

function TraceItem({ trace, events, onEventClick }: { trace: TraceEntry; events?: EventSummary[]; onEventClick?: (id: string) => void }) {
  switch (trace.kind) {
    case 'intent': {
      const clean = humanizeReasoning(trace.reasoning);
      return (
        <div className="bg-neutral-50 rounded-lg px-3 py-2.5">
          <p className="text-neutral-900 text-sm leading-snug capitalize-first">{clean.charAt(0).toUpperCase() + clean.slice(1)}</p>
          {trace.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {trace.tags.map(t => (
                <span key={t} className="text-[11px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">{t}</span>
              ))}
            </div>
          )}
        </div>
      );
    }
    case 'extracted':
      return (
        <div className="text-sm text-neutral-700 pl-2 border-l-2 border-blue-200">
          Found: <span className="font-medium text-neutral-900">{trace.title}</span>
        </div>
      );
    case 'merged':
      return (
        <div className="bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
          <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-medium mb-1">
            <Link2 className="w-3 h-3" />
            Same event, {trace.mergedFromCount} sources merged
          </div>
          <div className="text-sm font-medium text-neutral-900">{trace.title}</div>
        </div>
      );
    case 'recommendation': {
      const ev = events?.find(e => e.id === trace.eventId);
      return (
        <button
          onClick={() => ev && onEventClick?.(ev.id)}
          disabled={!ev || !onEventClick}
          className={`w-full text-left flex gap-2 pl-2 border-l-2 border-amber-200 rounded-r ${ev && onEventClick ? 'hover:bg-amber-50 cursor-pointer' : ''}`}
        >
          <Star className="w-3.5 h-3.5 text-amber-500 mt-1 shrink-0" />
          <div className="min-w-0">
            {ev && <p className="text-sm font-medium text-neutral-900 leading-snug truncate">{ev.title}</p>}
            <p className="text-sm text-neutral-600 leading-snug">{trace.reasoning}</p>
            {ev && onEventClick && (
              <span className="text-xs text-amber-700 font-medium inline-flex items-center gap-0.5 mt-0.5">
                View event <ArrowRight className="w-3 h-3" />
              </span>
            )}
          </div>
        </button>
      );
    }
    case 'scheduled':
      return (
        <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
          <div className="flex items-center gap-1.5 text-amber-900 font-medium text-sm mb-1">
            <Calendar className="w-3.5 h-3.5" />
            Your schedule
          </div>
          <p className="text-sm text-neutral-800 mb-2">{trace.schedule.summary}</p>
          {trace.schedule.itinerary.length > 0 && (
            <ol className="space-y-1">
              {trace.schedule.itinerary.map(it => (
                <li key={it.event_id} className="flex items-baseline gap-2 text-xs text-neutral-700">
                  <span className="font-mono text-amber-800 shrink-0">{it.arrival_time_local}</span>
                  <span className="truncate">{it.reasoning}</span>
                </li>
              ))}
            </ol>
          )}
          {trace.schedule.conflicts.length > 0 && (
            <p className="text-[11px] text-amber-700 mt-1">
              <AlertTriangle className="w-3 h-3 inline mr-0.5" />{trace.schedule.conflicts.length} time conflict{trace.schedule.conflicts.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      );
    case 'done': {
      const matched = events?.filter(e => trace.eventIds.includes(e.id)) ?? [];
      return (
        <div className="pt-1 space-y-1.5">
          <p className="text-xs text-neutral-400">
            {trace.count === 1 ? '1 result' : `${trace.count} results`}
            {' · tap to open'}
          </p>
          {matched.slice(0, 5).map(ev => (
            <button
              key={ev.id}
              onClick={() => onEventClick?.(ev.id)}
              className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-colors group"
            >
              <span className="text-sm font-medium text-neutral-900 truncate">{ev.title}</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 shrink-0" />
            </button>
          ))}
          {matched.length === 0 && trace.count > 0 && (
            <p className="text-xs text-neutral-400">Switch to list view to see all results</p>
          )}
        </div>
      );
    }
    case 'error':
      return (
        <div className="text-red-700 text-sm bg-red-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {trace.message}
        </div>
      );
  }
}

