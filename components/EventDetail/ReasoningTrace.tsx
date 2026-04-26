'use client';

import { useState } from 'react';
import { GitMerge, ChevronDown, ChevronUp } from 'lucide-react';

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
  eventTitle?: string;
  language?: 'en' | 'es';
}

function parseSameEvent(output: string | null): boolean | null {
  if (!output) return null;
  if (output.includes('same_event=true')) return true;
  if (output.includes('same_event=false')) return false;
  return null;
}

function parseConfidence(output: string | null): number | null {
  if (!output) return null;
  const m = output.match(/\(([\d.]+)\)/);
  if (!m) return null;
  return parseFloat(m[1]);
}

export function ReasoningTrace({ runs, language = 'en' }: ReasoningTraceProps) {
  const [expanded, setExpanded] = useState(false);

  // Only show dedup traces where agent confirmed a merge (same_event=true)
  const merges = runs.filter(r => parseSameEvent(r.output_summary) === true);
  const checks = runs.length;

  // Nothing to show if there was never a merge comparison
  if (checks === 0) return null;

  const lang = language;

  const mergeCount = merges.length;
  const summaryLine = mergeCount > 0
    ? (lang === 'es'
        ? `El agente cruzó ${checks} post${checks === 1 ? '' : 's'} y confirmó que ${mergeCount > 1 ? 'todos hablan' : 'habla'} del mismo evento.`
        : `The agent cross-checked ${checks} post${checks === 1 ? '' : 's'} and confirmed ${mergeCount > 1 ? 'they all describe' : 'it describes'} this event.`)
    : (lang === 'es'
        ? `El agente revisó ${checks} post${checks === 1 ? '' : 's'} de distintas fuentes para detectar duplicados.`
        : `The agent reviewed ${checks} post${checks === 1 ? '' : 's'} across sources to check for duplicates.`);

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <GitMerge className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-neutral-700">
              {lang === 'es' ? 'Verificación de fuentes' : 'Source verification'}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{summaryLine}</p>
          </div>
        </div>
        {merges.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex-shrink-0 flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-700 mt-0.5"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded
              ? (lang === 'es' ? 'Ocultar' : 'Hide')
              : (lang === 'es' ? 'Cómo lo decidió' : 'How it decided')}
          </button>
        )}
      </div>

      {expanded && merges.length > 0 && (
        <div className="mt-3 space-y-2 pl-6">
          {merges.map(run => {
            const conf = parseConfidence(run.output_summary);
            const confPct = conf != null ? Math.round(conf * 100) : null;
            return (
              <div key={run.id} className="text-xs text-neutral-600 bg-white rounded border border-neutral-200 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-neutral-700">
                    {lang === 'es' ? 'Mismo evento confirmado' : 'Same event confirmed'}
                  </span>
                  {confPct != null && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {confPct}% {lang === 'es' ? 'confianza' : 'confidence'}
                    </span>
                  )}
                </div>
                <p className="text-neutral-500 leading-relaxed">
                  {lang === 'es'
                    ? 'El agente comparó fechas, lugares y organizadores entre fuentes y determinó que apuntan al mismo evento.'
                    : 'The agent compared dates, locations, and organizers across sources and determined they point to the same event.'}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
