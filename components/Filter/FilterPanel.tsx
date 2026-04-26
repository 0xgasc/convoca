'use client';

import { useEffect, useState } from 'react';
import { X, Filter as FilterIcon, RotateCcw } from 'lucide-react';
import { CAUSE_VOCABULARY, CAUSE_DISPLAY, EVENT_TYPES, EVENT_TYPE_DISPLAY, ACTION_TYPES, NYC_BOROUGHS } from '@/lib/constants';
import { getEventIcon } from '@/lib/icons';
import type { CitySlug } from '@/lib/types';

export interface EventFilters {
  causes: string[];
  event_types: string[];
  action_types: string[];
  boroughs: string[];   // only meaningful for nyc
}

export const EMPTY_FILTERS: EventFilters = { causes: [], event_types: [], action_types: [], boroughs: [] };

export function filtersAreEmpty(f: EventFilters): boolean {
  return f.causes.length === 0 && f.event_types.length === 0 && f.action_types.length === 0 && f.boroughs.length === 0;
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
  initial: EventFilters;
  language?: 'en' | 'es';
  onApply: (f: EventFilters) => void;
  onClose: () => void;
}

const LABELS = {
  en: { title: 'Filter events', cause: 'Causes', type: 'Type', action: 'How you participate', borough: 'Borough', apply: 'Apply', clear: 'Clear all', close: 'Close' },
  es: { title: 'Filtrar eventos', cause: 'Causas', type: 'Tipo', action: 'Cómo participás', borough: 'Borough', apply: 'Aplicar', clear: 'Limpiar', close: 'Cerrar' },
};

export function FilterPanel({ city, initial, language = 'en', onApply, onClose }: FilterPanelProps) {
  const t = LABELS[language];
  const [f, setF] = useState<EventFilters>(initial);

  useEffect(() => setF(initial), [initial]);

  const toggle = (group: keyof EventFilters, value: string) => {
    setF(prev => {
      const next = new Set(prev[group]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [group]: Array.from(next) };
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-t-xl md:rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <FilterIcon className="w-5 h-5 text-neutral-700" />
            <h2 className="text-lg font-semibold text-neutral-900">{t.title}</h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-5">
          {city === 'nyc' && (
            <Section label={t.borough}>
              <div className="flex flex-wrap gap-1.5">
                {NYC_BOROUGHS.map(b => (
                  <Chip key={b.slug} active={f.boroughs.includes(b.slug)} onClick={() => toggle('boroughs', b.slug)}>
                    {b.name}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          <Section label={t.cause}>
            <div className="flex flex-wrap gap-1.5">
              {CAUSE_VOCABULARY.map(c => {
                const meta = CAUSE_DISPLAY[c];
                return (
                  <Chip key={c} active={f.causes.includes(c)} onClick={() => toggle('causes', c)}>
                    {meta ? (language === 'es' ? meta.label_es : meta.label_en) : c}
                  </Chip>
                );
              })}
            </div>
          </Section>

          <Section label={t.type}>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_TYPES.map(et => {
                const meta = EVENT_TYPE_DISPLAY[et] ?? EVENT_TYPE_DISPLAY.other;
                const Icon = getEventIcon(et);
                return (
                  <Chip key={et} active={f.event_types.includes(et)} onClick={() => toggle('event_types', et)}>
                    <Icon className="w-3 h-3 inline mr-1 -mt-0.5" />
                    {language === 'es' ? meta.label_es : meta.label_en}
                  </Chip>
                );
              })}
            </div>
          </Section>

          <Section label={t.action}>
            <div className="flex flex-wrap gap-1.5">
              {ACTION_TYPES.map(at => (
                <Chip key={at} active={f.action_types.includes(at)} onClick={() => toggle('action_types', at)}>
                  {at.replace(/_/g, ' ')}
                </Chip>
              ))}
            </div>
          </Section>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 py-3 flex items-center justify-between gap-2">
          <button
            onClick={() => setF(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-700 hover:text-neutral-900"
          >
            <RotateCcw className="w-4 h-4" /> {t.clear}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm rounded text-neutral-700 hover:bg-neutral-100"
            >
              {t.close}
            </button>
            <button
              onClick={() => { onApply(f); onClose(); }}
              className="px-4 py-2 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {t.apply}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">{label}</div>
      {children}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      {children}
    </button>
  );
}
