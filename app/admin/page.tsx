'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAgentIcon } from '@/lib/icons';
import { Cog, RefreshCw, Antenna, Loader2 } from 'lucide-react';

interface AdminStats {
  generated_at: string;
  events: { total: number; by_city: Record<string, number>; created_last_24h: number };
  sources: { total: number };
  flags: { live: number; by_status: Record<string, number> };
  sessions: { total: number; new_last_24h: number };
  submissions: { pending_or_processing: number; by_status: Record<string, number> };
  agents: {
    runs_last_24h: number;
    runs_by_agent_7d: Record<string, number>;
    avg_latency_ms_7d: Record<string, number>;
  };
}

interface AgentRun {
  id: string;
  session_id: string | null;
  agent_name: string;
  input_summary: string | null;
  output_summary: string | null;
  duration_ms: number | null;
  model: string | null;
  created_at: string;
  reasoning_trace: unknown;
}

const AGENT_NAMES = [
  'intent_parse', 'discovery', 'harvester', 'vision_extractor',
  'dedup', 'recommender', 'safety_review', 'orchestrator',
];

const REFRESH_MS = 8000;

export default function AdminPage() {
  const [key, setKey] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [harvesting, setHarvesting] = useState(false);
  const [harvestResult, setHarvestResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);
  const [queueDepth, setQueueDepth] = useState<number | null>(null);

  // Pull key from URL or localStorage on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('key');
    const fromStorage = window.localStorage.getItem('convoca_admin_key');
    const k = fromUrl ?? fromStorage ?? '';
    if (k) {
      setKey(k);
      window.localStorage.setItem('convoca_admin_key', k);
    }
  }, []);

  const load = useCallback(async (k: string) => {
    setError(null);
    try {
      const [sRes, rRes, qRes] = await Promise.all([
        fetch(`/api/admin/stats?key=${encodeURIComponent(k)}`),
        fetch(`/api/admin/runs?key=${encodeURIComponent(k)}&limit=80${filterAgent ? `&agent=${filterAgent}` : ''}`),
        fetch(`/api/process-queue?key=${encodeURIComponent(k)}`),
      ]);
      if (sRes.status === 403 || rRes.status === 403) {
        setError('Bad key (or ADMIN_KEY not set in env)');
        return;
      }
      if (!sRes.ok || !rRes.ok) {
        setError(`HTTP ${sRes.status}/${rRes.status}`);
        return;
      }
      const s = await sRes.json();
      const r = await rRes.json();
      setStats(s);
      setRuns(r.runs ?? []);
      if (qRes.ok) {
        const q = await qRes.json();
        setQueueDepth(q.pending_with_images ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [filterAgent]);

  useEffect(() => {
    if (!key) return;
    void load(key);
    const t = setInterval(() => void load(key), REFRESH_MS);
    return () => clearInterval(t);
  }, [key, load]);

  if (!key) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <form
          onSubmit={e => {
            e.preventDefault();
            const k = (e.currentTarget.elements.namedItem('key') as HTMLInputElement).value.trim();
            if (k) {
              window.localStorage.setItem('convoca_admin_key', k);
              setKey(k);
            }
          }}
          className="w-full max-w-sm space-y-3"
        >
          <h1 className="text-xl font-semibold">Convoca admin</h1>
          <p className="text-sm text-neutral-400">Enter ADMIN_KEY (set as env var on Railway).</p>
          <input
            type="password"
            name="key"
            autoFocus
            className="w-full px-3 py-2 rounded bg-neutral-800 border border-neutral-700 focus:outline-none focus:border-neutral-500"
          />
          <button className="w-full py-2 rounded bg-white text-neutral-900 font-medium hover:bg-neutral-200">
            Open
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-neutral-800 px-6 py-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-sm text-neutral-400 hover:text-white">← Site</Link>
          <h1 className="text-lg font-semibold">Convoca admin</h1>
          {stats && <span className="text-xs text-neutral-500">refreshed {timeAgo(stats.generated_at)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setHarvesting(true);
              setHarvestResult(null);
              try {
                const res = await fetch(`/api/harvest?key=${encodeURIComponent(key)}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ city: 'nyc', sessionId: 'admin' }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
                setHarvestResult(`Harvested ${json.totalPosts} posts, ${json.eventCandidates} candidates in ${(json.duration_ms / 1000).toFixed(1)}s`);
                void load(key);
              } catch (err) {
                setHarvestResult(`Failed: ${err instanceof Error ? err.message : String(err)}`);
              } finally {
                setHarvesting(false);
              }
            }}
            disabled={harvesting}
            className="text-xs px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-800 disabled:opacity-50 inline-flex items-center gap-1.5"
            title="Poll all due RSS / API sources for new posts"
          >
            {harvesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Antenna className="w-3 h-3" />}
            {harvesting ? 'Harvesting...' : 'Run harvester'}
          </button>
          <button
            onClick={async () => {
              setProcessing(true);
              setProcessResult(null);
              try {
                const res = await fetch(`/api/process-queue?key=${encodeURIComponent(key)}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ city: 'nyc', limit: 6 }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
                setProcessResult(`Vision: processed ${json.processed}, created ${json.created_events} events, skipped ${json.skipped} in ${(json.duration_ms / 1000).toFixed(1)}s`);
                void load(key);
              } catch (err) {
                setProcessResult(`Failed: ${err instanceof Error ? err.message : String(err)}`);
              } finally {
                setProcessing(false);
              }
            }}
            disabled={processing || queueDepth === 0}
            className="text-xs px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-800 disabled:opacity-50 inline-flex items-center gap-1.5"
            title={`Run vision extractor on up to 6 pending posts${queueDepth != null ? ` (${queueDepth} in queue)` : ''}`}
          >
            {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>👁</span>}
            {processing ? 'Processing...' : `Process queue${queueDepth != null ? ` (${queueDepth})` : ''}`}
          </button>
          <button
            onClick={() => void load(key)}
            className="text-xs px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-800 inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <button
            onClick={() => {
              window.localStorage.removeItem('convoca_admin_key');
              setKey('');
              setStats(null);
              setRuns([]);
            }}
            className="text-xs px-2 py-1 rounded text-neutral-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      {harvestResult && (
        <div className="mx-6 mt-4 px-3 py-2 rounded bg-blue-950/40 border border-blue-900 text-blue-200 text-sm">
          {harvestResult}
        </div>
      )}
      {processResult && (
        <div className="mx-6 mt-2 px-3 py-2 rounded bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-sm">
          {processResult}
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 px-3 py-2 rounded bg-red-950/60 border border-red-900 text-red-200 text-sm">
          {error}
        </div>
      )}

      {stats && (
        <>
          {/* Top line cards */}
          <section className="grid grid-cols-2 md:grid-cols-6 gap-3 px-6 mt-4">
            <Card label="Events" value={stats.events.total} sub={`+${stats.events.created_last_24h} last 24h`} />
            <Card label="Sources" value={stats.sources.total} />
            <Card label="Live flags" value={stats.flags.live} sub={summarize(stats.flags.by_status)} />
            <Card label="Sessions" value={stats.sessions.total} sub={`+${stats.sessions.new_last_24h} last 24h`} />
            <Card label="Agent runs 24h" value={stats.agents.runs_last_24h} />
            <Card label="Pending submits" value={stats.submissions.pending_or_processing} sub={summarize(stats.submissions.by_status)} />
          </section>

          {/* Agents grid */}
          <section className="px-6 mt-6">
            <h2 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Agents (7d)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {AGENT_NAMES.map(agent => {
                const Icon = getAgentIcon(agent);
                const count = stats.agents.runs_by_agent_7d[agent] ?? 0;
                const ms = stats.agents.avg_latency_ms_7d[agent] ?? 0;
                return (
                  <button
                    key={agent}
                    onClick={() => setFilterAgent(filterAgent === agent ? '' : agent)}
                    className={`text-left rounded border p-3 hover:bg-neutral-900 transition-colors ${
                      filterAgent === agent ? 'border-white bg-neutral-900' : 'border-neutral-800'
                    }`}
                  >
                    <div className="text-sm inline-flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {agent}</div>
                    <div className="text-xl font-semibold mt-1">{count}</div>
                    <div className="text-xs text-neutral-500">{ms ? `~${(ms / 1000).toFixed(1)}s avg` : 'no runs'}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Live agent runs */}
          <section className="px-6 mt-6 mb-10">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-xs uppercase tracking-wide text-neutral-500">
                Recent runs {filterAgent ? `· ${filterAgent}` : ''}
              </h2>
              {filterAgent && (
                <button onClick={() => setFilterAgent('')} className="text-xs text-neutral-400 hover:text-white">clear filter</button>
              )}
            </div>
            <div className="rounded border border-neutral-800 divide-y divide-neutral-800">
              {runs.length === 0 && <div className="px-3 py-6 text-center text-sm text-neutral-500">No runs yet.</div>}
              {runs.map(r => {
                const Icon = getAgentIcon(r.agent_name) ?? Cog;
                return (
                <div key={r.id} className="px-3 py-2 text-sm">
                  <button
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="w-full flex items-baseline justify-between gap-3 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Icon className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                      <span className="font-medium text-neutral-200 truncate">{r.agent_name}</span>
                      <span className="text-neutral-500 truncate">{r.output_summary ?? r.input_summary ?? '—'}</span>
                    </div>
                    <div className="flex items-baseline gap-3 text-xs text-neutral-500 shrink-0">
                      {r.duration_ms != null && <span>{(r.duration_ms / 1000).toFixed(2)}s</span>}
                      {r.model && <span className="hidden md:inline">{r.model}</span>}
                      <span>{timeAgo(r.created_at)}</span>
                    </div>
                  </button>
                  {expanded === r.id && (
                    <pre className="mt-2 text-[11px] text-neutral-400 overflow-x-auto whitespace-pre-wrap break-words bg-neutral-900 rounded p-2 max-h-80">
                      {JSON.stringify(r.reasoning_trace, null, 2)}
                    </pre>
                  )}
                </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Card({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5 truncate" title={sub}>{sub}</div>}
    </div>
  );
}

function summarize(obj: Record<string, number>): string {
  return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(' · ');
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}
