'use client';

import { useState } from 'react';

interface DedupRun {
  id: string;
  agent_name: string;
  input_summary: string | null;
  output_summary: string | null;
  reasoning_trace: unknown;
  duration_ms: number | null;
  model: string | null;
  created_at: string;
}

interface ReasoningTraceProps {
  runs: DedupRun[];
  eventTitle: string;
  language?: 'en' | 'es';
}

function extractSteps(trace: unknown): string[] {
  if (!trace || typeof trace !== 'object') return [];
  const t = trace as Record<string, unknown>;
  if (Array.isArray(t.reasoning_trace)) return t.reasoning_trace.filter((x): x is string => typeof x === 'string');
  if (Array.isArray(t.steps)) return t.steps.filter((x): x is string => typeof x === 'string');
  return [];
}

export function ReasoningTrace({ runs, eventTitle, language = 'en' }: ReasoningTraceProps) {
  const [expanded, setExpanded] = useState(false);

  const relevant = runs.filter(r => {
    const summary = (r.input_summary ?? '') + ' ' + (r.output_summary ?? '');
    return summary.toLowerCase().includes(eventTitle.toLowerCase().slice(0, 20));
  });

  const display = relevant.length > 0 ? relevant : runs.slice(0, 3);

  if (display.length === 0) {
    return (
      <div className="text-sm text-neutral-500 italic">
        {language === 'es' ? 'Sin trazas de fusión.' : 'No dedup reasoning recorded.'}
      </div>
    );
  }

  const headline = language === 'es' ? 'Razonamiento del agente de fusión' : 'Dedup agent reasoning';
  const toggle = expanded
    ? (language === 'es' ? 'Ocultar' : 'Hide')
    : (language === 'es' ? `Mostrar ${display.length} traza${display.length === 1 ? '' : 's'}` : `Show ${display.length} trace${display.length === 1 ? '' : 's'}`);

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-green-700">{headline}</div>
          <div className="text-sm text-green-900">
            {language === 'es' ? 'Cómo el agente decidió combinar estas fuentes' : 'How the agent decided to merge these sources'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-green-800 hover:underline"
        >
          {toggle}
        </button>
      </div>
      {expanded && (
        <div className="space-y-3 mt-3">
          {display.map(run => {
            const steps = extractSteps(run.reasoning_trace);
            return (
              <div key={run.id} className="bg-white rounded border border-green-200 p-3">
                <div className="flex justify-between text-[11px] text-neutral-500 mb-1">
                  <span>{run.model ?? 'opus'} · {run.duration_ms ?? '?'}ms</span>
                  <span>{new Date(run.created_at).toLocaleString()}</span>
                </div>
                {run.output_summary && (
                  <div className="text-sm text-neutral-900 mb-2">{run.output_summary}</div>
                )}
                {steps.length > 0 && (
                  <ol className="text-sm text-neutral-700 list-decimal list-inside space-y-1">
                    {steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
