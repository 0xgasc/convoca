'use client';

import { useState } from 'react';
import { Antenna, Loader2 } from 'lucide-react';

interface RefreshSourcesProps {
  city: 'nyc' | 'guatemala_city';
  language?: 'en' | 'es';
  onDone?: () => void;
}

export function RefreshSources({ city, language = 'en', onDone }: RefreshSourcesProps) {
  const t = language;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, sessionId: 'public-refresh' }),
      });
      const json = await res.json();
      if (res.status === 429) {
        setResult(t === 'es'
          ? `Espera ~${json.retry_after_sec ?? 60}s.`
          : `Wait ~${json.retry_after_sec ?? 60}s.`);
        return;
      }
      if (!res.ok) {
        setResult(t === 'es' ? 'Error al traer fuentes' : 'Failed to fetch sources');
        return;
      }
      const dur = json.duration_ms ? ` (${(json.duration_ms / 1000).toFixed(1)}s)` : '';
      setResult(t === 'es'
        ? `${json.totalPosts} posts, ${json.eventCandidates} candidatos${dur}`
        : `${json.totalPosts} posts, ${json.eventCandidates} candidates${dur}`);
      onDone?.();
    } catch (err) {
      setResult(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setTimeout(() => setResult(null), 8000);
    }
  };

  return (
    <div className="px-3 py-2 border-b border-neutral-200 flex items-center gap-2 text-xs">
      <button
        onClick={() => void run()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-50 text-neutral-700"
        title={t === 'es' ? 'Pollear fuentes RSS / Mobilize / NYC Open Data' : 'Poll RSS / Mobilize / NYC Open Data sources'}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Antenna className="w-3 h-3" />}
        {busy
          ? (t === 'es' ? 'Buscando…' : 'Harvesting…')
          : (t === 'es' ? 'Buscar eventos nuevos' : 'Pull fresh events')}
      </button>
      {result && <span className="text-neutral-500 truncate">{result}</span>}
    </div>
  );
}
