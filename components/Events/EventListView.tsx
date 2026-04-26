'use client';

import { useMemo } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { EVENT_TYPE_DISPLAY } from '@/lib/constants';
import type { CanonicalEvent } from '@/lib/types';

interface Props {
  events: CanonicalEvent[];
  language: 'en' | 'es';
  highlightedIds?: Set<string>;
  onEventClick: (ev: CanonicalEvent) => void;
}

type DateGroup = 'today' | 'tomorrow' | 'weekend' | 'this_week' | 'later' | 'no_date';
const GROUP_LABEL: Record<DateGroup, { en: string; es: string }> = {
  today:     { en: 'Today',      es: 'Hoy' },
  tomorrow:  { en: 'Tomorrow',   es: 'Mañana' },
  weekend:   { en: 'This weekend', es: 'Este fin de semana' },
  this_week: { en: 'This week',  es: 'Esta semana' },
  later:     { en: 'Coming up',  es: 'Próximamente' },
  no_date:   { en: 'Date TBD',   es: 'Fecha por confirmar' },
};

function getGroup(isoDate: string | null): DateGroup {
  if (!isoDate) return 'no_date';
  const now = new Date();
  const d = new Date(isoDate);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((d.getTime() - todayStart.getTime()) / 86_400_000);
  const dow = d.getDay(); // 0=Sun, 6=Sat
  if (diffDays < 0) return 'later';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (dow === 0 || dow === 6) return 'weekend';
  if (diffDays < 7) return 'this_week';
  return 'later';
}

const GROUP_ORDER: DateGroup[] = ['today', 'tomorrow', 'weekend', 'this_week', 'later', 'no_date'];

function formatTime(iso: string | null, textRaw: string): string {
  if (iso) {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }
  return textRaw;
}

export function EventListView({ events, language, highlightedIds, onEventClick }: Props) {
  const lang = language;

  const grouped = useMemo(() => {
    const map = new Map<DateGroup, CanonicalEvent[]>();
    GROUP_ORDER.forEach(g => map.set(g, []));
    for (const ev of events) {
      const g = getGroup(ev.datetime_iso);
      map.get(g)!.push(ev);
    }
    return GROUP_ORDER
      .map(g => ({ key: g, label: GROUP_LABEL[g][lang], events: map.get(g)! }))
      .filter(g => g.events.length > 0);
  }, [events, lang]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400 gap-2 p-8 text-center">
        <MapPin className="w-8 h-8" />
        <p className="text-sm">{lang === 'es' ? 'No hay eventos con estos filtros.' : 'No events match these filters.'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {grouped.map(group => (
          <div key={group.key}>
            <div className="sticky top-0 z-10 bg-neutral-50 border-b border-neutral-200 px-4 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{group.label}</span>
              <span className="ml-2 text-[11px] text-neutral-400">{group.events.length}</span>
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
        <div className="h-20" /> {/* bottom padding for mobile bar */}
      </div>
    </div>
  );
}

function EventRow({ event: ev, highlighted, onClick }: {
  event: CanonicalEvent;
  lang: 'en' | 'es';
  highlighted: boolean;
  onClick: () => void;
}) {
  const meta = EVENT_TYPE_DISPLAY[ev.event_type] ?? EVENT_TYPE_DISPLAY.other;
  const timeStr = formatTime(ev.datetime_iso, ev.datetime_text_raw);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 border-b border-neutral-100 text-left transition-colors hover:bg-neutral-50 ${highlighted ? 'bg-amber-50 border-l-2 border-l-amber-400' : ''}`}
    >
      {/* Type badge */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold"
        style={{ background: meta.color + '18', color: meta.color }}
      >
        {meta.icon}
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-neutral-900 text-sm leading-snug line-clamp-2">{ev.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
          {timeStr && (
            <span className="text-[11px] text-neutral-500">{timeStr}</span>
          )}
          {ev.location_text && (
            <span className="text-[11px] text-neutral-400 flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />{ev.location_text}
            </span>
          )}
        </div>
        {ev.cause_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {ev.cause_tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded-full">
                {tag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: RSVP link */}
      {ev.signup_url && (
        <a
          href={ev.signup_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0 mt-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
        >
          RSVP <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </button>
  );
}
