'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getAgentIcon } from '@/lib/icons';
import { Cog, RefreshCw, Antenna, Loader2, Eye, MapPin, Settings2, ChevronDown, ChevronUp, CheckCircle2, Clock, Circle, Zap } from 'lucide-react';

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
    latest_run_at?: Record<string, string>;
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

interface AgentSetting {
  agent_name: string;
  context_prompt: string;
  enabled: boolean;
  poll_interval_minutes: number;
  updated_at: string;
}

const AGENT_NAMES = [
  'intent_parse', 'discovery', 'harvester', 'vision_extractor',
  'dedup', 'recommender', 'safety_review', 'orchestrator',
];

// Agent topology for orchestration viz
const AGENT_TOPOLOGY = [
  { name: 'orchestrator', x: 200, y: 20, label: 'Orchestrator', isHub: true },
  { name: 'intent_parse', x: 20, y: 130, label: 'Intent Parse' },
  { name: 'discovery', x: 120, y: 130, label: 'Discovery' },
  { name: 'dedup', x: 220, y: 130, label: 'Dedup' },
  { name: 'recommender', x: 320, y: 130, label: 'Recommender' },
  { name: 'safety_review', x: 360, y: 20, label: 'Safety' },
  { name: 'harvester', x: 20, y: 230, label: 'Harvester', isCron: true },
  { name: 'vision_extractor', x: 200, y: 230, label: 'Vision', isCron: true },
];

// Edges from orchestrator to children (by array index pairs [from, to] using names)
const EDGES: Array<[string, string]> = [
  ['orchestrator', 'intent_parse'],
  ['orchestrator', 'discovery'],
  ['orchestrator', 'dedup'],
  ['orchestrator', 'recommender'],
  ['orchestrator', 'safety_review'],
  ['harvester', 'vision_extractor'],
  ['vision_extractor', 'dedup'],
];

const REFRESH_MS = 8000;

export default function AdminPage() {
  const [key, setKey] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [settings, setSettings] = useState<AgentSetting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [harvesting, setHarvesting] = useState(false);
  const [harvestResult, setHarvestResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);
  const [queueDepth, setQueueDepth] = useState<number | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [regeocing, setRegeocing] = useState(false);
  const [regeoResult, setRegeoResult] = useState<string | null>(null);
  const [warming, setWarming] = useState(false);
  const [warmResult, setWarmResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'runs' | 'orchestration' | 'settings'>('orchestration');
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [showActions, setShowActions] = useState(false);

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

  const loadSettings = useCallback(async (k: string) => {
    try {
      const res = await fetch(`/api/admin/settings?key=${encodeURIComponent(k)}`);
      if (res.ok) {
        const j = await res.json();
        setSettings(j.settings ?? []);
      }
    } catch { /* best-effort */ }
  }, []);

  const load = useCallback(async (k: string) => {
    setError(null);
    try {
      const [sRes, rRes, qRes] = await Promise.all([
        fetch(`/api/admin/stats?key=${encodeURIComponent(k)}`),
        fetch(`/api/admin/runs?key=${encodeURIComponent(k)}&limit=80${filterAgent ? `&agent=${filterAgent}` : ''}`),
        fetch(`/api/process-queue?key=${encodeURIComponent(k)}`),
      ]);
      if (sRes.status === 403 || rRes.status === 403) { setError('Bad key'); return; }
      if (!sRes.ok || !rRes.ok) { setError(`HTTP ${sRes.status}/${rRes.status}`); return; }
      const s = await sRes.json();
      const r = await rRes.json();
      setStats(s);
      setRuns(r.runs ?? []);
      if (qRes.ok) {
        const q = await qRes.json();
        setQueueDepth(q.pending_processable ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [filterAgent]);

  useEffect(() => {
    if (!key) return;
    void load(key);
    void loadSettings(key);
    const t = setInterval(() => void load(key), REFRESH_MS);
    return () => clearInterval(t);
  }, [key, load, loadSettings]);

  if (!key) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <form
          onSubmit={e => {
            e.preventDefault();
            const k = (e.currentTarget.elements.namedItem('key') as HTMLInputElement).value.trim();
            if (k) { window.localStorage.setItem('convoca_admin_key', k); setKey(k); }
          }}
          className="w-full max-w-sm space-y-3"
        >
          <h1 className="text-xl font-semibold">Convoca admin</h1>
          <p className="text-sm text-neutral-400">Enter ADMIN_KEY.</p>
          <input type="password" name="key" autoFocus className="w-full px-3 py-2 rounded bg-neutral-800 border border-neutral-700 focus:outline-none focus:border-neutral-500" />
          <button className="w-full py-2 rounded bg-white text-neutral-900 font-medium hover:bg-neutral-200">Open</button>
        </form>
      </main>
    );
  }

  const agentStatus = (name: string): 'healthy' | 'stale' | 'idle' => {
    const latest = stats?.agents.latest_run_at?.[name];
    if (!latest) return 'idle';
    const ms = Date.now() - new Date(latest).getTime();
    return ms < 3_600_000 ? 'healthy' : 'stale';
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-neutral-800 px-6 py-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-sm text-neutral-400 hover:text-white">← Site</Link>
          <h1 className="text-lg font-semibold">Convoca admin</h1>
          {stats && <span className="text-xs text-neutral-500">refreshed {timeAgo(stats.generated_at)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load(key)} className="text-xs px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-800 inline-flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3" />
          </button>
          {/* Actions dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowActions(v => !v)}
              className="text-xs px-2.5 py-1 rounded border border-neutral-700 hover:bg-neutral-800 inline-flex items-center gap-1.5"
            >
              Actions {showActions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded border border-neutral-700 bg-neutral-900 shadow-xl divide-y divide-neutral-800">
                <ActionBtn
                  icon={<Antenna className="w-3.5 h-3.5" />}
                  label="Run harvester"
                  loading={harvesting}
                  onClick={async () => {
                    setHarvesting(true); setHarvestResult(null); setShowActions(false);
                    try {
                      const res = await fetch(`/api/harvest?key=${encodeURIComponent(key)}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ city: 'nyc', sessionId: 'admin' }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
                      setHarvestResult(`Harvested ${json.totalPosts} posts, ${json.eventCandidates} candidates in ${(json.duration_ms / 1000).toFixed(1)}s`);
                      void load(key);
                    } catch (err) { setHarvestResult(`Failed: ${err instanceof Error ? err.message : String(err)}`); }
                    finally { setHarvesting(false); }
                  }}
                />
                <ActionBtn
                  icon={<Eye className="w-3.5 h-3.5" />}
                  label={`Process queue${queueDepth != null ? ` (${queueDepth})` : ''}`}
                  loading={processing}
                  disabled={queueDepth === 0}
                  onClick={async () => {
                    setProcessing(true); setProcessResult(null); setShowActions(false);
                    try {
                      const res = await fetch(`/api/process-queue?key=${encodeURIComponent(key)}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ city: 'nyc', limit: 50 }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
                      setProcessResult(`Processed ${json.processed} → ${json.created_events} events in ${(json.duration_ms / 1000).toFixed(1)}s`);
                      void load(key);
                    } catch (err) { setProcessResult(`Failed: ${err instanceof Error ? err.message : String(err)}`); }
                    finally { setProcessing(false); }
                  }}
                />
                <ActionBtn
                  icon={<MapPin className="w-3.5 h-3.5" />}
                  label="Backfill boroughs"
                  loading={backfilling}
                  onClick={async () => {
                    setBackfilling(true); setBackfillResult(null); setShowActions(false);
                    try {
                      const res = await fetch(`/api/admin/backfill-borough?key=${encodeURIComponent(key)}`, { method: 'POST' });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
                      setBackfillResult(`Backfill: ${json.tagged}/${json.total_processed} tagged (${json.via_latlng ?? 0} via coords, ${json.with_neighborhood} with hood)`);
                    } catch (err) { setBackfillResult(`Failed: ${err instanceof Error ? err.message : String(err)}`); }
                    finally { setBackfilling(false); }
                  }}
                />
                <ActionBtn
                  icon={<MapPin className="w-3.5 h-3.5 text-blue-400" />}
                  label="Fix pins (re-geocode)"
                  loading={regeocing}
                  onClick={async () => {
                    setRegeocing(true); setRegeoResult(null); setShowActions(false);
                    try {
                      const res = await fetch(`/api/admin/regeocode?key=${encodeURIComponent(key)}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ city: 'nyc', limit: 300 }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
                      setRegeoResult(`Re-geocoded: ${json.fixed} fixed, ${json.skipped ?? 0} skipped, ${json.failed} failed in ${(json.duration_ms / 1000).toFixed(1)}s`);
                    } catch (err) { setRegeoResult(`Failed: ${err instanceof Error ? err.message : String(err)}`); }
                    finally { setRegeocing(false); }
                  }}
                />
                <ActionBtn
                  icon={<Zap className="w-3.5 h-3.5" />}
                  label="Warm all agents"
                  loading={warming}
                  onClick={async () => {
                    setWarming(true); setWarmResult(null); setShowActions(false);
                    try {
                      const res = await fetch(`/api/admin/warm-agents?key=${encodeURIComponent(key)}`, { method: 'POST' });
                      const json = await res.json() as { ok: boolean; results: Record<string, string> };
                      if (!res.ok) throw new Error(JSON.stringify(json));
                      const lines = Object.entries(json.results).map(([k, v]) => `${k}: ${v}`).join(' · ');
                      setWarmResult(lines);
                      void load(key);
                    } catch (err) { setWarmResult(`Failed: ${err instanceof Error ? err.message : String(err)}`); }
                    finally { setWarming(false); }
                  }}
                />
                <div className="px-3 py-2">
                  <button onClick={() => { window.localStorage.removeItem('convoca_admin_key'); setKey(''); setStats(null); setRuns([]); }} className="text-xs text-neutral-400 hover:text-white w-full text-left">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {harvestResult && <div className="mx-6 mt-4 px-3 py-2 rounded bg-blue-950/40 border border-blue-900 text-blue-200 text-sm">{harvestResult}</div>}
      {processResult && <div className="mx-6 mt-2 px-3 py-2 rounded bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-sm">{processResult}</div>}
      {backfillResult && <div className="mx-6 mt-2 px-3 py-2 rounded bg-violet-950/40 border border-violet-900 text-violet-200 text-sm">{backfillResult}</div>}
      {regeoResult && <div className="mx-6 mt-2 px-3 py-2 rounded bg-blue-950/40 border border-blue-900 text-blue-200 text-sm">{regeoResult}</div>}
      {warmResult && <div className="mx-6 mt-2 px-3 py-2 rounded bg-amber-950/40 border border-amber-800 text-amber-200 text-sm">{warmResult}</div>}
      {error && <div className="mx-6 mt-4 px-3 py-2 rounded bg-red-950/60 border border-red-900 text-red-200 text-sm">{error}</div>}

      {stats && (
        <>
          {/* Stats cards */}
          <section className="grid grid-cols-2 md:grid-cols-6 gap-3 px-6 mt-4">
            <Card label="Events" value={stats.events.total} sub={`+${stats.events.created_last_24h} last 24h`} />
            <Card label="Sources" value={stats.sources.total} />
            <Card label="Live flags" value={stats.flags.live} sub={summarize(stats.flags.by_status)} />
            <Card label="Sessions" value={stats.sessions.total} sub={`+${stats.sessions.new_last_24h} last 24h`} />
            <Card label="Agent runs 24h" value={stats.agents.runs_last_24h} />
            <Card label="Pending submits" value={stats.submissions.pending_or_processing} sub={summarize(stats.submissions.by_status)} />
          </section>

          {/* Tabs */}
          <section className="px-6 mt-6">
            <div className="flex gap-1 border-b border-neutral-800 mb-4">
              {(['orchestration', 'runs', 'settings'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize rounded-t transition-colors ${activeTab === tab ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  {tab === 'orchestration' ? 'Pipeline' : tab === 'runs' ? 'Recent runs' : 'Agent settings'}
                </button>
              ))}
            </div>

            {/* ── Orchestration viz ── */}
            {activeTab === 'orchestration' && (
              <div>
                <div className="text-xs text-neutral-500 mb-3">Live agent topology — color shows last run status. Click to filter runs.</div>
                <OrchestrationViz
                  stats={stats}
                  agentStatus={agentStatus}
                  filterAgent={filterAgent}
                  onSelectAgent={name => { setFilterAgent(filterAgent === name ? '' : name); setActiveTab('runs'); }}
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  {AGENT_NAMES.map(name => {
                    const Icon = getAgentIcon(name);
                    const count = stats.agents.runs_by_agent_7d[name] ?? 0;
                    const ms = stats.agents.avg_latency_ms_7d[name] ?? 0;
                    const status = agentStatus(name);
                    return (
                      <button
                        key={name}
                        onClick={() => { setFilterAgent(filterAgent === name ? '' : name); setActiveTab('runs'); }}
                        className={`flex items-center gap-2 rounded border px-3 py-2 text-left hover:bg-neutral-900 transition-colors text-xs ${filterAgent === name ? 'border-white bg-neutral-900' : 'border-neutral-800'}`}
                      >
                        <StatusDot status={status} />
                        <Icon className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                        <span className="text-neutral-200">{name}</span>
                        <span className="text-neutral-500">{count} runs</span>
                        {ms > 0 && <span className="text-neutral-600">{(ms / 1000).toFixed(1)}s</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-4 text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Active (&lt;1h)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Stale (&gt;1h)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-600 inline-block" />Never run</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Cron (auto-harvest every 30 min)</span>
                </div>
              </div>
            )}

            {/* ── Recent runs ── */}
            {activeTab === 'runs' && (
              <div className="mb-10">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs text-neutral-500">
                    Recent runs {filterAgent ? `· ${filterAgent}` : ''}
                  </span>
                  {filterAgent && <button onClick={() => setFilterAgent('')} className="text-xs text-neutral-400 hover:text-white">clear filter</button>}
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
                            {expanded === r.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
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
              </div>
            )}

            {/* ── Agent settings ── */}
            {activeTab === 'settings' && (
              <div className="space-y-3 mb-10">
                <p className="text-xs text-neutral-500">
                  Add a context prompt to any agent. It will be appended to the system prompt on each run, letting you inject domain knowledge, style constraints, or current events.
                </p>
                {AGENT_NAMES.map(name => {
                  const setting = settings.find(s => s.agent_name === name);
                  const Icon = getAgentIcon(name);
                  const isEditing = editingAgent === name;
                  const status = agentStatus(name);

                  return (
                    <div key={name} className="rounded border border-neutral-800 bg-neutral-900/30">
                      <button
                        onClick={() => {
                          if (isEditing) { setEditingAgent(null); return; }
                          setEditingAgent(name);
                          setEditPrompt(setting?.context_prompt ?? '');
                        }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <StatusDot status={status} />
                          <Icon className="w-4 h-4 text-neutral-300" />
                          <span className="text-sm font-medium text-neutral-200">{name}</span>
                          {setting?.context_prompt && (
                            <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">has prompt</span>
                          )}
                          {!setting?.enabled && (
                            <span className="text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded">disabled</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-neutral-600">
                            {stats?.agents.latest_run_at?.[name]
                              ? timeAgo(stats.agents.latest_run_at[name])
                              : 'never'}
                          </span>
                          <Settings2 className="w-3.5 h-3.5 text-neutral-500" />
                        </div>
                      </button>

                      {isEditing && (
                        <div className="border-t border-neutral-800 px-4 py-3 space-y-3">
                          <div>
                            <label className="block text-[11px] text-neutral-500 mb-1 uppercase tracking-wide">Context prompt</label>
                            <textarea
                              value={editPrompt}
                              onChange={e => setEditPrompt(e.target.value)}
                              placeholder={`Extra context injected into the ${name} system prompt on every run. E.g. "Focus on Bronx and Upper Manhattan neighborhoods."  Leave blank for default behavior.`}
                              rows={4}
                              className="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500 resize-none"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm text-neutral-300">
                              <input
                                type="checkbox"
                                checked={setting?.enabled ?? true}
                                onChange={async e => {
                                  await saveAgentSetting(key, name, editPrompt, e.target.checked, setting?.poll_interval_minutes ?? 30);
                                  await loadSettings(key);
                                }}
                                className="w-4 h-4 rounded"
                              />
                              Enabled
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingAgent(null)}
                                className="text-xs text-neutral-500 hover:text-neutral-300 px-3 py-1.5"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  setSavingPrompt(true);
                                  try {
                                    await saveAgentSetting(key, name, editPrompt, setting?.enabled ?? true, setting?.poll_interval_minutes ?? 30);
                                    await loadSettings(key);
                                    setEditingAgent(null);
                                  } finally { setSavingPrompt(false); }
                                }}
                                disabled={savingPrompt}
                                className="text-xs px-3 py-1.5 rounded bg-white text-neutral-900 font-medium hover:bg-neutral-200 disabled:opacity-50 inline-flex items-center gap-1"
                              >
                                {savingPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

async function saveAgentSetting(key: string, agentName: string, contextPrompt: string, enabled: boolean, pollIntervalMinutes: number) {
  await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_name: agentName, context_prompt: contextPrompt, enabled, poll_interval_minutes: pollIntervalMinutes }),
  });
}

function OrchestrationViz({
  stats,
  agentStatus,
  filterAgent,
  onSelectAgent,
}: {
  stats: AdminStats;
  agentStatus: (name: string) => 'healthy' | 'stale' | 'idle';
  filterAgent: string;
  onSelectAgent: (name: string) => void;
}) {
  const W = 460;
  const H = 300;
  const nodeW = 88;
  const nodeH = 36;

  const nodePos: Record<string, { x: number; y: number }> = {};
  for (const n of AGENT_TOPOLOGY) {
    nodePos[n.name] = { x: n.x, y: n.y };
  }

  const statusColor = (name: string) => {
    const s = agentStatus(name);
    if (s === 'healthy') return '#10b981';
    if (s === 'stale') return '#f59e0b';
    return '#525252';
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" style={{ minWidth: 320 }}>
        {/* Edges */}
        {EDGES.map(([from, to]) => {
          const f = nodePos[from];
          const t = nodePos[to];
          if (!f || !t) return null;
          const fx = f.x + nodeW / 2;
          const fy = f.y + nodeH;
          const tx = t.x + nodeW / 2;
          const ty = t.y;
          const my = (fy + ty) / 2;
          return (
            <path
              key={`${from}-${to}`}
              d={`M ${fx} ${fy} C ${fx} ${my}, ${tx} ${my}, ${tx} ${ty}`}
              fill="none"
              stroke="#404040"
              strokeWidth="1.5"
              markerEnd="url(#arr)"
            />
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#404040" />
          </marker>
        </defs>

        {/* Nodes */}
        {AGENT_TOPOLOGY.map(n => {
          const isSelected = filterAgent === n.name;
          const color = statusColor(n.name);
          const isCron = n.isCron;
          const runs = stats.agents.runs_by_agent_7d[n.name] ?? 0;
          const latest = stats.agents.latest_run_at?.[n.name];

          return (
            <g
              key={n.name}
              transform={`translate(${n.x}, ${n.y})`}
              onClick={() => onSelectAgent(n.name)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                width={nodeW}
                height={nodeH}
                rx={6}
                fill={isSelected ? '#1f2937' : '#111827'}
                stroke={isSelected ? '#fff' : (n.isHub ? '#6366f1' : '#374151')}
                strokeWidth={isSelected ? 1.5 : 1}
              />
              {/* Status dot */}
              <circle cx={nodeW - 8} cy={8} r={4} fill={color} />
              {/* Label */}
              <text x={8} y={15} fontSize={9} fill="#d1d5db" fontWeight="600">{n.label}</text>
              {/* Subtext */}
              <text x={8} y={27} fontSize={8} fill="#6b7280">
                {latest ? timeAgo(latest) : 'never'} · {runs}r
              </text>
              {/* Cron badge */}
              {isCron && (
                <text x={8} y={34} fontSize={7} fill="#3b82f6">⏱ cron</text>
              )}
            </g>
          );
        })}

        {/* Cron hint */}
        <text x={20} y={286} fontSize={8} fill="#374151">
          ↻ harvester auto-runs every 30 min via instrumentation.ts
        </text>
      </svg>
    </div>
  );
}

function StatusDot({ status }: { status: 'healthy' | 'stale' | 'idle' }) {
  if (status === 'healthy') return <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />;
  if (status === 'stale') return <Clock className="w-3 h-3 text-amber-500 shrink-0" />;
  return <Circle className="w-3 h-3 text-neutral-600 shrink-0" />;
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

function ActionBtn({
  icon, label, loading, disabled, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 transition-colors text-left"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <span className="shrink-0">{icon}</span>}
      {label}
    </button>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}
