'use client';

import { useMemo, useRef, useState } from 'react';
import {
  MapPin, ExternalLink, Users, Search, SlidersHorizontal, X,
  ChevronDown, Calendar,
} from 'lucide-react';
import { EVENT_TYPE_DISPLAY, CAUSE_DISPLAY } from '@/lib/constants';
import { getEventIcon } from '@/lib/icons';
import type { CanonicalEvent } from '@/lib/types';

interface Props {
  events: CanonicalEvent[];
  language: 'en' | 'es';
  highlightedIds?: Set<string>;
  onEventClick: (ev: CanonicalEvent) => void;
  totalCount?: number;
  onOpenFilters?: () => void;
  hasActiveFilters?: boolean;
}

type QuickDate = '' | 'today' | 'tomorrow' | 'weekend' | 'week';
type SortBy = 'date' | 'recent';

const QD_LABELS: Record<QuickDate, { en: string; es: string }> = {
  '':        { en: 'All',       es: 'Todo' },
  today:     { en: 'Today',     es: 'Hoy' },
  tomorrow:  { en: 'Tomorrow',  es: 'Mañana' },
  weekend:   { en: 'Weekend',   es: 'Fin de semana' },
  week:      { en: 'This week', es: 'Esta semana' },
};
const QD_ORDER: QuickDate[] = ['', 'today', 'tomorrow', 'weekend', 'week'];

function quickDateRange(preset: QuickDate): [Date, Date] | null {
  if (!preset) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'today') return [today, new Date(today.getTime() + 86_400_000 - 1)];
  if (preset === 'tomorrow') {
    const tom = new Date(today.getTime() + 86_400_000);
    return [tom, new Date(tom.getTime() + 86_400_000 - 1)];
  }
  if (preset === 'weekend') {
    const dow = today.getDay();
    const daysToSat = (6 - dow + 7) % 7 || 7;
    const sat = new Date(today.getTime() + daysToSat * 86_400_000);
    return [sat, new Date(sat.getTime() + 2 * 86_400_000 - 1)];
  }
  if (preset === 'week') return [today, new Date(today.getTime() + 7 * 86_400_000 - 1)];
  return null;
}

type DateBucket = 'today' | 'tomorrow' | 'weekend' | 'this_week' | 'later' | 'no_date';
const BUCKET_LABEL: Record<DateBucket, { en: string; es: string }> = {
  today:     { en: 'Today',          es: 'Hoy' },
  tomorrow:  { en: 'Tomorrow',       es: 'Mañana' },
  weekend:   { en: 'This weekend',   es: 'Este fin de semana' },
  this_week: { en: 'This week',      es: 'Esta semana' },
  later:     { en: 'Coming up',      es: 'Próximamente' },
  no_date:   { en: 'Date TBD',       es: 'Fecha por confirmar' },
};
const BUCKET_ORDER: DateBucket[] = ['today', 'tomorrow', 'weekend', 'this_week', 'later', 'no_date'];

function getBucket(iso: string | null): DateBucket {
  if (!iso) return 'no_date';
  const now = new Date();
  const d = new Date(iso);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((d.getTime() - todayStart.getTime()) / 86_400_000);
  if (diffDays < 0) return 'later';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return 'weekend';
  if (diffDays < 7) return 'this_week';
  return 'later';
}

function fmtTime(iso: string | null, raw: string): string {
  if (iso) {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }
  // Strip raw ISO ranges
  const rangeMatch = raw.match(/^from\s+(\S+)\s+to\s+(\S+)/i);
  if (rangeMatch) {
    const fmt = (s: string) => {
      try { return new Date(s).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }
      catch { return s; }
    };
    return `${fmt(rangeMatch[1])} – ${fmt(rangeMatch[2])}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    try { return new Date(raw).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }
    catch { return raw; }
  }
  return raw;
}

export function EventListView({ events, language, highlightedIds, onEventClick, totalCount, onOpenFilters, hasActiveFilters }: Props) {
  const lang = language;
  const [search, setSearch] = useState('');
  const [quickDate, setQuickDate] = useState<QuickDate>('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [showSort, setShowSort] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const displayed = useMemo(() => {
    let list = events;

    // Local text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(ev =>
        ev.title.toLowerCase().includes(q) ||
        (ev.organizer ?? '').toLowerCase().includes(q) ||
        (ev.location_text ?? '').toLowerCase().includes(q) ||
        ev.cause_tags.some(t => t.replace(/_/g, ' ').includes(q))
      );
    }

    // Quick date filter
    const range = quickDateRange(quickDate);
    if (range) {
      list = list.filter(ev => {
        if (!ev.datetime_iso) return false;
        const d = new Date(ev.datetime_iso);
        return d >= range[0] && d <= range[1];
      });
    }

    // Sort
    if (sortBy === 'date') {
      list = [...list].sort((a, b) => {
        if (!a.datetime_iso && !b.datetime_iso) return 0;
        if (!a.datetime_iso) return 1;
        if (!b.datetime_iso) return -1;
        return new Date(a.datetime_iso).getTime() - new Date(b.datetime_iso).getTime();
      });
    } else {
      list = [...list].sort((a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );
    }

    return list;
  }, [events, search, quickDate, sortBy]);

  const grouped = useMemo(() => {
    const map = new Map<DateBucket, CanonicalEvent[]>();
    BUCKET_ORDER.forEach(b => map.set(b, []));
    for (const ev of displayed) {
      const b = getBucket(ev.datetime_iso);
      map.get(b)!.push(ev);
    }
    return BUCKET_ORDER
      .map(b => ({ key: b, label: BUCKET_LABEL[b][lang], events: map.get(b)! }))
      .filter(g => g.events.length > 0);
  }, [displayed, lang]);

  const filterBtnClasses = `inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
    hasActiveFilters
      ? 'border-neutral-900 bg-neutral-900 text-white'
      : 'border-neutral-300 text-neutral-600 hover:border-neutral-400 bg-white'
  }`;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 border-b border-neutral-200 bg-white">
        {/* Row 1: search + sort + filter */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'es' ? 'Buscar eventos…' : 'Search events…'}
              className="w-full pl-8 pr-7 py-1.5 text-sm border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300 placeholder:text-neutral-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSort(v => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-neutral-200 rounded-lg text-neutral-600 hover:border-neutral-400 bg-white"
              title={lang === 'es' ? 'Ordenar' : 'Sort'}
            >
              <ChevronDown className="w-3.5 h-3.5" />
              {sortBy === 'date' ? (lang === 'es' ? 'Fecha' : 'Date') : (lang === 'es' ? 'Recientes' : 'Recent')}
            </button>
            {showSort && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-neutral-200 z-20 overflow-hidden">
                {(['date', 'recent'] as SortBy[]).map(s => (
                  <button
                    key={s}
                    onClick={() => { setSortBy(s); setShowSort(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 flex items-center gap-2 ${sortBy === s ? 'font-semibold text-neutral-900' : 'text-neutral-600'}`}
                  >
                    {s === 'date'
                      ? (lang === 'es' ? '↑ Por fecha' : '↑ By date')
                      : (lang === 'es' ? '★ Más recientes' : '★ Most recent')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {onOpenFilters && (
            <button onClick={onOpenFilters} className={`hidden md:inline-flex ${filterBtnClasses}`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {lang === 'es' ? 'Filtros' : 'Filter'}
              {hasActiveFilters && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white text-neutral-900 text-[10px] font-bold">✓</span>
              )}
            </button>
          )}
        </div>

        {/* Row 2: quick date pills + count */}
        <div className="flex items-center gap-1.5 px-3 pb-2.5 overflow-x-auto">
          {QD_ORDER.map(qd => (
            <button
              key={qd}
              onClick={() => setQuickDate(qd === quickDate ? '' : qd)}
              className={`flex-shrink-0 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                quickDate === qd
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-400 bg-white'
              }`}
            >
              {QD_LABELS[qd][lang]}
            </button>
          ))}
          <span className="ml-auto flex-shrink-0 text-[11px] text-neutral-400 whitespace-nowrap">
            {displayed.length}
            {(totalCount !== undefined && totalCount !== events.length) && (
              <span className="text-neutral-300"> / {totalCount}</span>
            )}
            {' '}{lang === 'es' ? 'eventos' : 'events'}
          </span>
        </div>
      </div>

      {/* ── List ── */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-neutral-400 gap-3 p-10 text-center">
          <Calendar className="w-8 h-8 opacity-50" />
          <p className="text-sm">
            {lang === 'es' ? 'No hay eventos con estos filtros.' : 'No events match these filters.'}
          </p>
          {(search || quickDate) && (
            <button
              onClick={() => { setSearch(''); setQuickDate(''); }}
              className="text-xs text-blue-600 hover:underline"
            >
              {lang === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {showSort && (
            <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
          )}
          {grouped.map(group => (
            <div key={group.key}>
              <div className="sticky top-0 z-10 bg-neutral-50 border-b border-neutral-100 px-4 py-1.5 flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{group.label}</span>
                <span className="text-[11px] text-neutral-400 bg-neutral-200 rounded-full px-1.5 py-0.5 font-medium">{group.events.length}</span>
              </div>
              {group.events.map(ev => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  lang={lang}
                  highlighted={highlightedIds?.has(ev.id) ?? false}
                  onClick={() => onEventClick(ev)}
                />
              ))}
            </div>
          ))}
          <div className="h-20" />
        </div>
      )}
    </div>
  );
}

function EventRow({ event: ev, lang, highlighted, onClick }: {
  event: CanonicalEvent; lang: 'en' | 'es'; highlighted: boolean; onClick: () => void;
}) {
  const meta = EVENT_TYPE_DISPLAY[ev.event_type] ?? EVENT_TYPE_DISPLAY.other;
  const Icon = getEventIcon(ev.event_type);
  const timeStr = fmtTime(ev.datetime_iso, ev.datetime_text_raw);

  const actionLabel: Record<string, { en: string; es: string }> = {
    attend:        { en: 'Attend',    es: 'Asistir' },
    rsvp:          { en: 'RSVP',      es: 'Registrarse' },
    register:      { en: 'Register',  es: 'Registrarse' },
    bring_supplies:{ en: 'Bring supplies', es: 'Llevar insumos' },
    donate:        { en: 'Donate',    es: 'Donar' },
    amplify:       { en: 'Share',     es: 'Compartir' },
  };
  const action = actionLabel[ev.action_type] ?? actionLabel.attend;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-neutral-100 text-left transition-colors hover:bg-neutral-50 group ${
        highlighted ? 'bg-amber-50 border-l-[3px] border-l-amber-400' : ''
      }`}
    >
      {/* Type icon badge */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: meta.color + '18', color: meta.color }}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-neutral-900 text-sm leading-snug line-clamp-2 group-hover:text-neutral-700">
          {ev.title}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
          {timeStr && (
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
              <Calendar className="w-3 h-3" />{timeStr}
            </span>
          )}
          {ev.location_text && (
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400 truncate max-w-[180px]">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{ev.location_text}</span>
            </span>
          )}
          {ev.organizer && (
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400 truncate max-w-[160px]">
              <Users className="w-3 h-3 shrink-0" />
              <span className="truncate">{ev.organizer}</span>
            </span>
          )}
        </div>

        {/* Tags row */}
        {ev.cause_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: meta.color + '18', color: meta.color }}
            >
              {lang === 'es' ? meta.label_es : meta.label_en}
            </span>
            {ev.cause_tags.slice(0, 3).map(tag => {
              const c = CAUSE_DISPLAY[tag];
              return (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded-full">
                  {c ? (lang === 'es' ? c.label_es : c.label_en) : tag.replace(/_/g, ' ')}
                </span>
              );
            })}
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full">
              {lang === 'es' ? action.es : action.en}
            </span>
          </div>
        )}
      </div>

      {/* RSVP button */}
      {ev.signup_url && (
        <a
          href={ev.signup_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0 mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          RSVP <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </button>
  );
}
