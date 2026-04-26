'use client';

import { useState } from 'react';
import { Filter as FilterIcon, ChevronRight, ChevronDown, RotateCcw } from 'lucide-react';
import {
  CAUSE_VOCABULARY, CAUSE_DISPLAY, EVENT_TYPES, EVENT_TYPE_DISPLAY,
  ACTION_TYPES, NYC_BOROUGHS, NYC_NEIGHBORHOODS,
} from '@/lib/constants';
import { getEventIcon } from '@/lib/icons';
import type { CitySlug } from '@/lib/types';

export type DatePreset = '' | 'today' | 'weekend' | 'week' | 'next_week';

export interface EventFilters {
  causes: string[];
  event_types: string[];
  action_types: string[];
  boroughs: string[];
  neighborhoods: string[];
  datePreset: DatePreset;
}

export const EMPTY_FILTERS: EventFilters = {
  causes: [], event_types: [], action_types: [], boroughs: [], neighborhoods: [], datePreset: '',
};

export function filtersAreEmpty(f: EventFilters): boolean {
  return (
    f.causes.length === 0 && f.event_types.length === 0 &&
    f.action_types.length === 0 && f.boroughs.length === 0 &&
    f.neighborhoods.length === 0 && f.datePreset === ''
  );
}

// Returns the [start, end] Date range for a preset, in local time
export function datePresetRange(preset: DatePreset): [Date, Date] | null {
  if (!preset) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = today.getDay(); // 0=Sun

  if (preset === 'today') {
    return [today, new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)];
  }
  if (preset === 'weekend') {
    // Next Sat–Sun (or this Sat if today is Sat, this Sun if today is Sun)
    const daysToSat = dow === 6 ? 0 : (6 - dow);
    const sat = new Date(today); sat.setDate(today.getDate() + daysToSat);
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    return [sat, new Date(sun.getFullYear(), sun.getMonth(), sun.getDate(), 23, 59, 59)];
  }
  if (preset === 'week') {
    const end = new Date(today); end.setDate(today.getDate() + 6);
    return [today, new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)];
  }
  if (preset === 'next_week') {
    const daysToMon = dow === 0 ? 1 : (8 - dow);
    const mon = new Date(today); mon.setDate(today.getDate() + daysToMon);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return [mon, new Date(sun.getFullYear(), sun.getMonth(), sun.getDate(), 23, 59, 59)];
  }
  return null;
}

export function filtersToQueryString(f: EventFilters, city: CitySlug): string {
  const p = new URLSearchParams();
  p.set('city', city);
  for (const c of f.causes) p.append('cause', c);
  for (const t of f.event_types) p.append('type', t);
  for (const a of f.action_types) p.append('action', a);
  for (const b of f.boroughs) p.append('borough', b);
  return p.toString();
}

interface FilterPanelProps {
  city: CitySlug;
  filters: EventFilters;
  isOpen: boolean;
  language?: 'en' | 'es';
  onToggle: () => void;
  onChange: (f: EventFilters) => void;
}

export function FilterPanel({ city, filters, isOpen, language = 'en', onToggle, onChange }: FilterPanelProps) {
  const [expandedBoroughs, setExpandedBoroughs] = useState<Set<string>>(new Set());

  const toggle = (group: keyof EventFilters, value: string) => {
    const prev = filters[group] as string[];
    const next = new Set(prev);
    if (next.has(value)) next.delete(value); else next.add(value);
    onChange({ ...filters, [group]: Array.from(next) });
  };

  const toggleBoroughExpand = (slug: string) => {
    setExpandedBoroughs(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  const activeCount = filtersAreEmpty(filters) ? 0 :
    filters.causes.length + filters.event_types.length +
    filters.action_types.length + filters.boroughs.length + filters.neighborhoods.length +
    (filters.datePreset ? 1 : 0);

  const DATE_PRESETS: { value: DatePreset; label_en: string; label_es: string }[] = [
    { value: 'today',     label_en: 'Today',     label_es: 'Hoy' },
    { value: 'weekend',   label_en: 'Weekend',   label_es: 'Fin de semana' },
    { value: 'week',      label_en: 'This week', label_es: 'Esta semana' },
    { value: 'next_week', label_en: 'Next week', label_es: 'Próxima semana' },
  ];

  return (
    <div className="absolute top-3 left-3 z-10 flex items-start">
      {/* Toggle button — desktop only; mobile uses the bottom bar */}
      <button
        onClick={onToggle}
        className={`hidden md:flex items-center gap-1.5 px-2.5 py-2 shadow-md text-sm font-medium transition-colors ${
          isOpen
            ? 'bg-neutral-900 text-white rounded-l-lg'
            : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200 rounded-lg'
        }`}
        title={isOpen ? 'Close filters' : 'Open filters'}
      >
        <FilterIcon className="w-4 h-4" />
        {activeCount > 0 && (
          <span className={`text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold ${
            isOpen ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white'
          }`}>
            {activeCount}
          </span>
        )}
      </button>

      {/* Side panel — full-width on mobile, fixed-width sidebar on desktop */}
      {isOpen && (
        <div className="w-[calc(100vw-24px)] md:w-52 max-h-[calc(100vh-140px)] bg-white shadow-xl rounded-lg md:rounded-tl-none md:rounded-bl-none border border-neutral-200 md:border-l-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 flex-shrink-0">
            <span className="text-[10px] uppercase tracking-wide text-neutral-500 font-medium">
              {language === 'es' ? 'Filtros' : 'Filters'}
            </span>
            {activeCount > 0 && (
              <button
                onClick={() => onChange(EMPTY_FILTERS)}
                className="text-[11px] text-neutral-400 hover:text-neutral-700 inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                {language === 'es' ? 'Limpiar' : 'Clear'}
              </button>
            )}
          </div>

          {/* Scrollable sections */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">

            {/* Date */}
            <div>
              <div className="text-[9px] uppercase tracking-widest text-neutral-400 px-1 mb-1.5">
                {language === 'es' ? 'Cuándo' : 'When'}
              </div>
              <div className="flex flex-wrap gap-1">
                {DATE_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => onChange({ ...filters, datePreset: filters.datePreset === p.value ? '' : p.value })}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                      filters.datePreset === p.value
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    {language === 'es' ? p.label_es : p.label_en}
                  </button>
                ))}
              </div>
            </div>

            {/* Borough / Neighborhood */}
            {city === 'nyc' && (
              <div>
                <div className="text-[9px] uppercase tracking-widest text-neutral-400 px-1 mb-1.5">
                  {language === 'es' ? 'Barrio / Vecindario' : 'Borough / Neighborhood'}
                </div>
                <div className="space-y-0.5">
                  {NYC_BOROUGHS.map(b => {
                    const isActive = filters.boroughs.includes(b.slug);
                    const hoods = NYC_NEIGHBORHOODS[b.slug] ?? [];
                    const isExpanded = expandedBoroughs.has(b.slug);
                    const activeHoods = filters.neighborhoods.filter(n =>
                      hoods.some(h => h.slug === n)
                    );

                    return (
                      <div key={b.slug}>
                        <div className="flex items-center">
                          <button
                            onClick={() => toggle('boroughs', b.slug)}
                            className={`flex-1 text-left text-xs px-2 py-1 rounded-l transition-colors ${
                              isActive
                                ? 'bg-neutral-900 text-white'
                                : 'text-neutral-700 hover:bg-neutral-100'
                            }`}
                          >
                            <span className="flex items-center justify-between">
                              {b.name}
                              {activeHoods.length > 0 && (
                                <span className={`text-[9px] rounded px-1 ml-1 ${
                                  isActive ? 'bg-white/20' : 'bg-neutral-200 text-neutral-600'
                                }`}>
                                  +{activeHoods.length}
                                </span>
                              )}
                            </span>
                          </button>
                          {hoods.length > 0 && (
                            <button
                              onClick={() => toggleBoroughExpand(b.slug)}
                              className={`px-1.5 py-1 rounded-r transition-colors ${
                                isActive
                                  ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                                  : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700'
                              }`}
                            >
                              {isExpanded
                                ? <ChevronDown className="w-3 h-3" />
                                : <ChevronRight className="w-3 h-3" />
                              }
                            </button>
                          )}
                        </div>

                        {isExpanded && hoods.length > 0 && (
                          <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-neutral-100 pl-2">
                            {hoods.map(hood => (
                              <button
                                key={hood.slug}
                                onClick={() => toggle('neighborhoods', hood.slug)}
                                className={`w-full text-left text-[11px] px-2 py-0.5 rounded transition-colors ${
                                  filters.neighborhoods.includes(hood.slug)
                                    ? 'bg-neutral-800 text-white'
                                    : 'text-neutral-600 hover:bg-neutral-50'
                                }`}
                              >
                                {hood.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Causes */}
            <div>
              <div className="text-[9px] uppercase tracking-widest text-neutral-400 px-1 mb-1.5">
                {language === 'es' ? 'Causas' : 'Causes'}
              </div>
              <div className="flex flex-wrap gap-1">
                {CAUSE_VOCABULARY.map(c => {
                  const meta = CAUSE_DISPLAY[c];
                  const label = meta ? (language === 'es' ? meta.label_es : meta.label_en) : c;
                  return (
                    <button
                      key={c}
                      onClick={() => toggle('causes', c)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        filters.causes.includes(c)
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Event type */}
            <div>
              <div className="text-[9px] uppercase tracking-widest text-neutral-400 px-1 mb-1.5">
                {language === 'es' ? 'Tipo de evento' : 'Event type'}
              </div>
              <div className="flex flex-wrap gap-1">
                {EVENT_TYPES.map(et => {
                  const meta = EVENT_TYPE_DISPLAY[et] ?? EVENT_TYPE_DISPLAY.other;
                  const Icon = getEventIcon(et);
                  const label = language === 'es' ? meta.label_es : meta.label_en;
                  return (
                    <button
                      key={et}
                      onClick={() => toggle('event_types', et)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors inline-flex items-center gap-1 ${
                        filters.event_types.includes(et)
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action type */}
            <div>
              <div className="text-[9px] uppercase tracking-widest text-neutral-400 px-1 mb-1.5">
                {language === 'es' ? 'Cómo participás' : 'How you participate'}
              </div>
              <div className="flex flex-wrap gap-1">
                {ACTION_TYPES.map(at => (
                  <button
                    key={at}
                    onClick={() => toggle('action_types', at)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                      filters.action_types.includes(at)
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    {at.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
