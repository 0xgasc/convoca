'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Antenna, Sparkles, GitMerge, MessageSquare, Shield, Zap, MapPin, RefreshCw } from 'lucide-react';
import type { ActivityItem } from '@/app/api/activity/route';

const REFRESH_MS = 20_000;

const KIND_META: Record<ActivityItem['kind'], {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  label_en: string;
  label_es: string;
}> = {
  harvest:   { icon: Antenna,       color: 'text-blue-600',   bg: 'bg-blue-50',   label_en: 'Sweeping sources', label_es: 'Barriendo fuentes' },
  extract:   { icon: Sparkles,      color: 'text-violet-600', bg: 'bg-violet-50', label_en: 'Reading flyer',    label_es: 'Leyendo flyer' },
  dedup:     { icon: GitMerge,      color: 'text-amber-600',  bg: 'bg-amber-50',  label_en: 'Dedup check',      label_es: 'Verificando duplicados' },
  ask:       { icon: MessageSquare, color: 'text-emerald-600',bg: 'bg-emerald-50',label_en: 'Query answered',   label_es: 'Consulta' },
  new_event: { icon: MapPin,        color: 'text-rose-600',   bg: 'bg-rose-50',   label_en: 'New event',        label_es: 'Nuevo evento' },
  recommend: { icon: Zap,           color: 'text-orange-500', bg: 'bg-orange-50', label_en: 'Ranked',           label_es: 'Rankeado' },
  safety:    { icon: Shield,        color: 'text-red-600',    bg: 'bg-red-50',    label_en: 'Safety check',     label_es: 'Revisión de seguridad' },
  agent:     { icon: Zap,           color: 'text-neutral-500',bg: 'bg-neutral-100',label_en: 'Agent',           label_es: 'Agente' },
};

interface Props {
  city: string;
  language: 'en' | 'es';
  onClose: () => void;
  onOpenEvent?: (id: string) => void;
}

export function ActivityFeed({ city, language, onClose, onOpenEvent }: Props) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { if (firstLoad.current) { setLoading(true); } else { setRefreshing(true); } }
    try {
      const res = await fetch(`/api/activity?city=${city}&limit=60`);
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
      firstLoad.current = false;
    }
  }, [city]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const lang = language;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold text-neutral-900">
              {lang === 'es' ? 'Agente en vivo' : 'Agent activity'}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {lang === 'es'
              ? 'El agente busca, filtra y descubre eventos para ti'
              : 'Discovering, screening & surfacing events for you'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => void load()}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded"
            disabled={refreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-neutral-50 overflow-x-auto flex-shrink-0">
        {(['harvest', 'extract', 'dedup', 'new_event', 'ask'] as ActivityItem['kind'][]).map(k => {
          const m = KIND_META[k];
          const Icon = m.icon;
          return (
            <span key={k} className={`inline-flex items-center gap-1 text-[10px] font-medium ${m.color} flex-shrink-0`}>
              <Icon className="w-2.5 h-2.5" />
              {lang === 'es' ? m.label_es : m.label_en}
            </span>
          );
        })}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32 text-neutral-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            {lang === 'es' ? 'Cargando...' : 'Loading...'}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-neutral-400 text-sm gap-2">
            <Antenna className="w-6 h-6" />
            <span>{lang === 'es' ? 'El agente está iniciando...' : 'Agent is starting up...'}</span>
          </div>
        )}
        {!loading && items.length > 0 && (
          <div className="divide-y divide-neutral-50">
            {items.map((item, i) => {
              const meta = KIND_META[item.kind];
              const Icon = meta.icon;
              const isEvent = item.kind === 'new_event' && item.event_id;
              return (
                <div
                  key={item.id}
                  className={`flex gap-3 px-4 py-3 transition-colors ${isEvent && onOpenEvent ? 'cursor-pointer hover:bg-neutral-50' : ''}`}
                  onClick={isEvent && onOpenEvent ? () => onOpenEvent(item.event_id!) : undefined}
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  {/* Icon dot */}
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full ${meta.bg} flex items-center justify-center mt-0.5`}>
                    <Icon className={`w-3 h-3 ${meta.color}`} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${meta.color}`}>
                        {lang === 'es' ? meta.label_es : meta.label_en}
                      </span>
                      <span className="text-[10px] text-neutral-400 flex-shrink-0">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-800 mt-0.5 leading-snug font-medium">
                      {item.headline}
                    </p>
                    {item.detail && (
                      <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                        {item.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer context */}
        {!loading && (
          <div className="px-4 py-4 border-t border-neutral-50">
            <p className="text-[10px] text-neutral-400 leading-relaxed">
              {lang === 'es'
                ? 'Convoca usa agentes de IA para descubrir, extraer y filtrar eventos cívicos de fuentes públicas. Nada de scraping de perfiles privados.'
                : 'Convoca uses AI agents to discover, extract, and screen civic events from public sources. No private profile scraping.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}
