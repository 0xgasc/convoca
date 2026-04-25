// components/Chat/AgentTrace.tsx
// Live agent status panel. Consumes the SSE stream from /api/orchestrate
// and renders agent activity in real time.

'use client';

import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Link2, Star, AlertTriangle } from 'lucide-react';
import { getAgentIcon } from '@/lib/icons';
import type { AgentEvent, AgentName } from '@/lib/agents/orchestrator';

interface AgentTraceProps {
  prompt: string | null;
  sessionId: string;
  city: 'nyc' | 'guatemala_city';
  onComplete?: (eventIds: string[]) => void;
}

type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface AgentState {
  name: AgentName;
  label: string;
  status: AgentStatus;
  message?: string;
}

const AGENTS: Array<{ name: AgentName; label: string }> = [
  { name: 'intent_parse', label: 'Intent' },
  { name: 'discovery', label: 'Discovery' },
  { name: 'harvester', label: 'Harvest' },
  { name: 'vision_extractor', label: 'Vision' },
  { name: 'dedup', label: 'Dedup' },
  { name: 'recommender', label: 'Rank' },
];

export function AgentTrace({ prompt, sessionId, city, onComplete }: AgentTraceProps) {
  const [agents, setAgents] = useState<Record<AgentName, AgentState>>(() =>
    Object.fromEntries(AGENTS.map(a => [a.name, { ...a, status: 'idle' as AgentStatus }])) as Record<AgentName, AgentState>,
  );
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const traceContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!prompt) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setAgents(Object.fromEntries(AGENTS.map(a => [a.name, { ...a, status: 'idle' as AgentStatus }])) as Record<AgentName, AgentState>);
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
            } catch { /* skip malformed events */ }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('[AgentTrace] stream error:', err);
        setTraces(prev => [...prev, { kind: 'error', message: String(err), time: Date.now() }]);
      }
    };

    void run();

    return () => ctrl.abort();
  }, [prompt, sessionId, city]);

  function handleEvent(event: AgentEvent) {
    switch (event.type) {
      case 'status':
        setAgents(prev => ({
          ...prev,
          [event.agent]: { ...prev[event.agent], status: 'running', message: event.message },
        }));
        setTraces(prev => [...prev, { kind: 'status', agent: event.agent, message: event.message, time: Date.now() }]);
        break;

      case 'intent':
        setAgents(prev => ({ ...prev, intent_parse: { ...prev.intent_parse, status: 'done', message: event.intent.reasoning } }));
        setTraces(prev => [...prev, { kind: 'intent', reasoning: event.intent.reasoning, tags: event.intent.cause_tags, time: Date.now() }]);
        break;

      case 'discovery_result':
        setAgents(prev => ({ ...prev, discovery: { ...prev.discovery, status: 'done', message: `${event.newSourceCount} new sources` } }));
        break;

      case 'harvest_result':
        setAgents(prev => ({ ...prev, harvester: { ...prev.harvester, status: 'done', message: `${event.eventCandidates} candidates from ${event.postCount} posts` } }));
        break;

      case 'extracted':
        setTraces(prev => [...prev, { kind: 'extracted', title: event.event.title, confidence: event.event.confidence, time: Date.now() }]);
        break;

      case 'merged':
        setTraces(prev => [...prev, { kind: 'merged', title: event.canonical.title, mergedFromCount: event.mergedFromCount, steps: event.trace, time: Date.now() }]);
        break;

      case 'recommendation':
        setTraces(prev => [...prev, { kind: 'recommendation', eventId: event.eventId, score: event.score, reasoning: event.reasoning, time: Date.now() }]);
        break;

      case 'final_result':
        AGENTS.forEach(a => {
          setAgents(prev => prev[a.name].status === 'running' ? { ...prev, [a.name]: { ...prev[a.name], status: 'done' } } : prev);
        });
        onComplete?.(event.eventIds);
        break;

      case 'error':
        setTraces(prev => [...prev, { kind: 'error', message: event.message, time: Date.now() }]);
        break;

      case 'done':
        break;
    }
  }

  useEffect(() => {
    traceContainerRef.current?.scrollTo({ top: traceContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [traces.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap gap-2 p-3 border-b border-neutral-200">
        {AGENTS.map(a => {
          const s = agents[a.name];
          const Icon = getAgentIcon(a.name);
          return (
            <div
              key={a.name}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                s.status === 'idle' ? 'bg-neutral-100 text-neutral-400' :
                s.status === 'running' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                s.status === 'done' ? 'bg-green-100 text-green-700' :
                'bg-red-100 text-red-700'
              }`}
              title={s.message}
            >
              <Icon className="w-3 h-3" />
              {a.label}
            </div>
          );
        })}
      </div>

      <div ref={traceContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
        {traces.length === 0 && prompt && (
          <div className="text-neutral-400 italic">Initializing agents…</div>
        )}
        {traces.map((t, i) => (
          <TraceItem key={i} trace={t} />
        ))}
      </div>
    </div>
  );
}

type TraceEntry =
  | { kind: 'status'; agent: AgentName; message: string; time: number }
  | { kind: 'intent'; reasoning: string; tags: string[]; time: number }
  | { kind: 'extracted'; title: string; confidence: number; time: number }
  | { kind: 'merged'; title: string; mergedFromCount: number; steps: string[]; time: number }
  | { kind: 'recommendation'; eventId: string; score: number; reasoning: string; time: number }
  | { kind: 'error'; message: string; time: number };

function TraceItem({ trace }: { trace: TraceEntry }) {
  switch (trace.kind) {
    case 'status':
      return (
        <div className="flex gap-2 text-neutral-500">
          <span className="text-xs uppercase font-semibold">{trace.agent}</span>
          <span>{trace.message}</span>
        </div>
      );
    case 'intent':
      return (
        <div className="bg-neutral-50 rounded px-3 py-2">
          <div className="text-neutral-600 text-xs uppercase font-semibold mb-1">Understood</div>
          <div className="text-neutral-900">{trace.reasoning}</div>
          {trace.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {trace.tags.map(t => (
                <span key={t} className="text-xs px-1.5 py-0.5 bg-white rounded border border-neutral-200">{t}</span>
              ))}
            </div>
          )}
        </div>
      );
    case 'extracted':
      return (
        <div className="flex justify-between items-baseline border-l-2 border-blue-300 pl-2">
          <span className="text-neutral-900 inline-flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
            {trace.title}
          </span>
          <span className="text-xs text-neutral-500">conf {trace.confidence.toFixed(2)}</span>
        </div>
      );
    case 'merged':
      return (
        <div className="bg-green-50 rounded px-3 py-2">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-green-900 font-medium inline-flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              Merged: {trace.title}
            </span>
            <span className="text-xs text-green-700">{trace.mergedFromCount} sources</span>
          </div>
          <ol className="text-xs text-green-800 space-y-0.5 ml-2 list-decimal list-inside">
            {trace.steps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </div>
      );
    case 'recommendation':
      return (
        <div className="border-l-2 border-amber-300 pl-2">
          <div className="text-xs text-amber-700 inline-flex items-center gap-1">
            <Star className="w-3 h-3" /> {(trace.score * 100).toFixed(0)}%
          </div>
          <div className="text-neutral-700 text-sm">{trace.reasoning}</div>
        </div>
      );
    case 'error':
      return (
        <div className="text-red-700 text-sm bg-red-50 rounded px-2 py-1 inline-flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {trace.message}
        </div>
      );
  }
}
