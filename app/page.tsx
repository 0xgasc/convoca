'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Upload, Info, Languages, MapPinned, Check, Calendar, Sparkles, Menu, X as XClose, MessageSquare, Radio, Map, List } from 'lucide-react';
import { AgentTrace } from '@/components/Chat/AgentTrace';
import { ChatInput } from '@/components/Chat/ChatInput';
import { MapView, type FlagRow } from '@/components/Map/MapView';
import { EventListView } from '@/components/Events/EventListView';
import { OnboardingModal } from '@/components/Onboarding/OnboardingModal';
import { SignInModal } from '@/components/Auth/SignInModal';
import { EventModal } from '@/components/EventDetail/EventModal';
import { SchedulePanel } from '@/components/Schedule/SchedulePanel';
import { CurateCardStack } from '@/components/Curate/CurateCardStack';
import { FilterPanel, type EventFilters, EMPTY_FILTERS, filtersAreEmpty, datePresetRange } from '@/components/Filter/FilterPanel';
import { ActivityFeed } from '@/components/Activity/ActivityFeed';
import { CAUSE_DISPLAY, EVENT_TYPE_DISPLAY, NYC_BOROUGHS, NYC_NEIGHBORHOODS, BOROUGH_KEYWORDS } from '@/lib/constants';
import { Filter as FilterIcon, X as XIcon } from 'lucide-react';
import { CITIES } from '@/lib/constants';
import type { CanonicalEvent, CitySlug } from '@/lib/types';

const SESSION_KEY = 'convoca_session_id';
const ONBOARDED_KEY = 'convoca_onboarded';
const CITY_KEY = 'convoca_city';
const LANG_KEY = 'convoca_language';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const FLAG_REFRESH_MS = 30_000;
const SESSION_REFRESH_MS = 15_000;

interface SessionInfo {
  id: string;
  email: string | null;
  display_name: string | null;
  verified: boolean;
  cause_prefs: string[];
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string>('');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [city, setCity] = useState<CitySlug>('nyc');
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInReason, setSignInReason] = useState<string | undefined>();
  const [prompt, setPrompt] = useState<string | null>(null);
  const [events, setEvents] = useState<CanonicalEvent[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showCurate, setShowCurate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<EventFilters>(EMPTY_FILTERS);
  const [toast, setToast] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');

  // Bootstrap session
  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);
    const storedCity = window.localStorage.getItem(CITY_KEY);
    if (storedCity === 'nyc' || storedCity === 'guatemala_city') setCity(storedCity);
    const storedLang = window.localStorage.getItem(LANG_KEY);
    if (storedLang === 'en' || storedLang === 'es') setLanguage(storedLang);
    if (!window.localStorage.getItem(ONBOARDED_KEY)) setShowOnboarding(true);

    // If returning from magic link redirect, show toast
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed_in') === '1') {
      setToast('You are signed in.');
      setTimeout(() => setToast(null), 4000);
      // Strip the param
      window.history.replaceState({}, '', window.location.pathname);
    }
    // If URL has ?event=ID, open the modal
    const evParam = params.get('event');
    if (evParam) setOpenEventId(evParam);
  }, []);

  // Pull session info (verified state) periodically
  const refreshSession = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/sessions?id=${id}`);
      if (!res.ok) return;
      const json = await res.json();
      const s = json.session;
      if (!s) return;
      setSession({
        id: s.id,
        email: s.email ?? null,
        display_name: s.display_name ?? null,
        verified: !!s.verified_at,
        cause_prefs: s.cause_prefs ?? [],
      });
    } catch { /* best-effort */ }
  }, []);
  useEffect(() => {
    if (!sessionId) return;
    void refreshSession(sessionId);
    const t = setInterval(() => void refreshSession(sessionId), SESSION_REFRESH_MS);
    return () => clearInterval(t);
  }, [sessionId, refreshSession]);

  const loadEvents = useCallback(async () => {
    setEventsError(null);
    try {
      const res = await fetch(`/api/events?city=${city}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setEvents(json.events ?? []);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : String(err));
      setEvents([]);
    }
  }, [city]);

  const loadFlags = useCallback(async () => {
    try {
      const res = await fetch(`/api/flags?city=${city}`);
      if (!res.ok) return;
      const json = await res.json();
      setFlags(json.flags ?? []);
    } catch { /* best-effort */ }
  }, [city]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);
  useEffect(() => {
    void loadFlags();
    const t = setInterval(() => void loadFlags(), FLAG_REFRESH_MS);
    return () => clearInterval(t);
  }, [loadFlags]);

  const handleAsk = (next: string) => {
    setHighlightedIds(new Set());
    setRunning(true);
    setPrompt(next);
  };

  const handleComplete = useCallback((eventIds: string[]) => {
    setHighlightedIds(new Set(eventIds));
    setRunning(false);
    void loadEvents();
  }, [loadEvents]);


  const handleEventClick = useCallback((ev: CanonicalEvent) => {
    setOpenEventId(ev.id);
    const u = new URL(window.location.href);
    u.searchParams.set('event', ev.id);
    window.history.replaceState({}, '', u.toString());
  }, []);

  const closeEventModal = useCallback(() => {
    setOpenEventId(null);
    const u = new URL(window.location.href);
    u.searchParams.delete('event');
    window.history.replaceState({}, '', u.toString());
  }, []);

  const requestSignIn = useCallback((reason?: string) => {
    setSignInReason(reason);
    setShowSignIn(true);
  }, []);

  const cityMeta = useMemo(() => CITIES[city], [city]);

  const filteredEvents = useMemo(() => {
    if (filtersAreEmpty(filters)) return events;
    return events.filter(ev => {
      const loc = (ev.location_text ?? '').toLowerCase();

      const wantsLocation = filters.boroughs.length > 0 || filters.neighborhoods.length > 0;
      if (wantsLocation) {
        // Build target borough set + neighborhood name list
        const targetBoroughs = new Set<string>(filters.boroughs);
        const hoodNames: string[] = [];
        for (const n of filters.neighborhoods) {
          for (const [boroughSlug, hoods] of Object.entries(NYC_NEIGHBORHOODS)) {
            const found = hoods.find(h => h.slug === n);
            if (found) {
              targetBoroughs.add(boroughSlug);
              hoodNames.push(found.name.toLowerCase());
              break;
            }
          }
        }

        let matchesLocation = false;

        if (filters.neighborhoods.length > 0) {
          // Neighborhood filter — must match the neighborhood name specifically
          const hoodStructured = hoodNames.some(name => ev.neighborhood?.toLowerCase().includes(name));
          const hoodKeyword = hoodNames.some(name => loc.includes(name));
          matchesLocation = hoodStructured || hoodKeyword;
        } else {
          // Borough-only — match by structured field or keyword in location_text
          const boroughField = ev.borough ? targetBoroughs.has(ev.borough) : false;
          const boroughKw = Array.from(targetBoroughs).some(b =>
            (BOROUGH_KEYWORDS[b] ?? []).some(kw => loc.includes(kw))
          );
          matchesLocation = boroughField || boroughKw;
        }

        if (!matchesLocation) return false;
      }

      // Date preset filter
      const dateRange = datePresetRange(filters.datePreset);
      if (dateRange && ev.datetime_iso) {
        const dt = new Date(ev.datetime_iso);
        if (dt < dateRange[0] || dt > dateRange[1]) return false;
      }

      if (filters.causes.length > 0) {
        if (!ev.cause_tags?.some((tag: string) => filters.causes.includes(tag))) return false;
      }
      if (filters.event_types.length > 0) {
        if (!filters.event_types.includes(ev.event_type)) return false;
      }
      if (filters.action_types.length > 0) {
        if (!filters.action_types.includes(ev.action_type)) return false;
      }

      return true;
    });
  }, [events, filters]);

  return (
    <main className="h-screen w-screen flex flex-col bg-neutral-50 overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 bg-white flex-shrink-0">
        {/* Left: logo + city */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-semibold text-neutral-900 flex-shrink-0">Convoca</span>
          <div className="flex items-center gap-1 text-neutral-600">
            <MapPinned className="w-3.5 h-3.5 flex-shrink-0" />
            <select
              value={city}
              onChange={e => {
                const next = e.target.value as CitySlug;
                setCity(next);
                window.localStorage.setItem(CITY_KEY, next);
              }}
              className="text-xs border border-neutral-300 rounded px-1.5 py-1 bg-white max-w-[130px] text-neutral-800"
            >
              <option value="nyc">NYC</option>
              <option value="guatemala_city">Guatemala City</option>
            </select>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          {/* Language — always visible */}
          <button
            onClick={() => { const next = language === 'en' ? 'es' : 'en'; setLanguage(next); window.localStorage.setItem(LANG_KEY, next); }}
            className="inline-flex items-center gap-1 text-xs text-neutral-700 px-2 py-1 border border-neutral-200 rounded"
          >
            <Languages className="w-3.5 h-3.5" />
            {language === 'en' ? 'ES' : 'EN'}
          </button>

          {/* Desktop: filter, view toggle, live, ask, extras */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`hidden md:inline-flex items-center gap-1 text-xs px-2 py-1 border rounded ${(showFilters || !filtersAreEmpty(filters)) ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-700'}`}
          >
            <FilterIcon className="w-3.5 h-3.5" />
            {!filtersAreEmpty(filters) && (
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${showFilters ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white'}`}>
                {filteredEvents.length} events
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode(v => v === 'map' ? 'list' : 'map')}
            className="hidden md:inline-flex items-center gap-1 text-xs px-2 py-1 border border-neutral-200 rounded text-neutral-700 hover:border-neutral-400"
            title={viewMode === 'map' ? 'Switch to list' : 'Switch to map'}
          >
            {viewMode === 'map' ? <List className="w-3.5 h-3.5" /> : <Map className="w-3.5 h-3.5" />}
            <span>{viewMode === 'map' ? (language === 'es' ? 'Lista' : 'List') : (language === 'es' ? 'Mapa' : 'Map')}</span>
          </button>
          <button
            onClick={() => { setShowActivity(v => !v); setShowChat(false); }}
            className={`hidden md:inline-flex items-center gap-1 text-xs px-2.5 py-1 border rounded font-medium ${showActivity ? 'border-violet-600 bg-violet-600 text-white' : 'border-neutral-300 text-neutral-700 hover:border-neutral-400'}`}
          >
            <Radio className="w-3.5 h-3.5" />
            {language === 'es' ? 'En vivo' : 'Live'}
          </button>
          <button
            onClick={() => { setShowChat(v => !v); setShowActivity(false); }}
            className={`hidden md:inline-flex items-center gap-1 text-xs px-2.5 py-1 border rounded font-medium ${showChat ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-700 hover:border-neutral-400'}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {language === 'es' ? 'Preguntar' : 'Ask'}
          </button>
          <button onClick={() => setShowCurate(true)} className="hidden md:inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium px-2 py-1">
            <Sparkles className="w-3.5 h-3.5" /><span>Curate</span>
          </button>
          <button onClick={() => setShowSchedule(true)} className="hidden md:inline-flex items-center gap-1 text-sm text-neutral-700 px-2 py-1">
            <Calendar className="w-3.5 h-3.5" /><span>{language === 'es' ? 'Agenda' : 'Schedule'}</span>
          </button>
          <Link href="/submit" className="hidden md:inline-flex items-center gap-1 text-sm text-blue-700 px-2 py-1">
            <Upload className="w-3.5 h-3.5" /><span>{language === 'es' ? 'Enviar flyer' : 'Submit'}</span>
          </Link>
          {session?.verified ? (
            <span className="hidden md:inline-flex items-center gap-1 text-xs text-green-700 px-2 py-1 rounded bg-green-50 border border-green-200">
              <Check className="w-3 h-3" /><span>{session.display_name ?? session.email}</span>
            </span>
          ) : (
            <button onClick={() => requestSignIn()} className="hidden md:inline text-xs text-neutral-700 px-2 py-1 border border-neutral-200 rounded">
              {language === 'es' ? 'Iniciar sesión' : 'Sign in'}
            </button>
          )}
        </div>
      </header>

      {/* ── Mobile menu dropdown ── */}
      {/* Mobile "More" overlay */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowMobileMenu(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-2xl px-5 py-5 flex flex-col gap-4">
            <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-neutral-200" />
            <div className="text-xs text-neutral-400 font-medium uppercase tracking-wide mt-2">
              {filteredEvents.length}{!filtersAreEmpty(filters) ? ` of ${events.length}` : ''} {language === 'es' ? 'eventos' : 'events'}
              {session?.cause_prefs && session.cause_prefs.length > 0 && (
                <span className="ml-2 text-violet-500">· {language === 'es' ? 'Personalizado' : 'Personalized'}</span>
              )}
            </div>
            <button onClick={() => { setShowCurate(true); setShowMobileMenu(false); }} className="flex items-center gap-3 text-sm text-amber-700 font-medium py-1">
              <Sparkles className="w-5 h-5" />{language === 'es' ? 'Curar para mí' : 'Curate for me'}
            </button>
            <button onClick={() => { setShowSchedule(true); setShowMobileMenu(false); }} className="flex items-center gap-3 text-sm text-neutral-800 py-1">
              <Calendar className="w-5 h-5" />{language === 'es' ? 'Mi agenda' : 'My schedule'}
            </button>
            <Link href="/submit" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-3 text-sm text-blue-700 py-1">
              <Upload className="w-5 h-5" />{language === 'es' ? 'Enviar flyer' : 'Submit a flyer'}
            </Link>
            <Link href="/about" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-3 text-sm text-neutral-600 py-1">
              <Info className="w-5 h-5" />{language === 'es' ? 'Acerca' : 'About'}
            </Link>
            {session?.verified ? (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                <Check className="w-4 h-4" />{session.display_name ?? session.email}
              </div>
            ) : (
              <button onClick={() => { requestSignIn(); setShowMobileMenu(false); }} className="flex items-center gap-3 text-sm text-neutral-700 py-1">
                {language === 'es' ? 'Iniciar sesión' : 'Sign in'}
              </button>
            )}
            <div className="h-4" />
          </div>
        </div>
      )}

      {/* Active filter chip strip */}
      {!filtersAreEmpty(filters) && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-neutral-200 bg-neutral-50 overflow-x-auto flex-shrink-0">
          <span className="text-xs text-neutral-500 flex-shrink-0">{language === 'es' ? 'Filtros:' : 'Filters:'}</span>
          {filters.boroughs.map(b => {
            const meta = NYC_BOROUGHS.find(x => x.slug === b);
            return (
              <ActiveChip key={b} label={meta?.name ?? b} onRemove={() =>
                setFilters(prev => ({ ...prev, boroughs: prev.boroughs.filter(x => x !== b) }))
              } />
            );
          })}
          {filters.neighborhoods.map(n => {
            let label = n.replace(/_/g, ' ');
            for (const hoods of Object.values(NYC_NEIGHBORHOODS)) {
              const found = hoods.find(h => h.slug === n);
              if (found) { label = found.name; break; }
            }
            return (
              <ActiveChip key={n} label={label} onRemove={() =>
                setFilters(prev => ({ ...prev, neighborhoods: prev.neighborhoods.filter(x => x !== n) }))
              } />
            );
          })}
          {filters.causes.map(c => {
            const meta = CAUSE_DISPLAY[c];
            return (
              <ActiveChip key={c} label={meta ? (language === 'es' ? meta.label_es : meta.label_en) : c} onRemove={() =>
                setFilters(prev => ({ ...prev, causes: prev.causes.filter(x => x !== c) }))
              } />
            );
          })}
          {filters.event_types.map(t => {
            const meta = EVENT_TYPE_DISPLAY[t] ?? EVENT_TYPE_DISPLAY.other;
            return (
              <ActiveChip key={t} label={language === 'es' ? meta.label_es : meta.label_en} onRemove={() =>
                setFilters(prev => ({ ...prev, event_types: prev.event_types.filter(x => x !== t) }))
              } />
            );
          })}
          {filters.action_types.map(a => (
            <ActiveChip key={a} label={a.replace(/_/g, ' ')} onRemove={() =>
              setFilters(prev => ({ ...prev, action_types: prev.action_types.filter(x => x !== a) }))
            } />
          ))}
          {filters.datePreset && (
            <ActiveChip
              label={{ today: 'Today', weekend: 'Weekend', week: 'This week', next_week: 'Next week' }[filters.datePreset] ?? filters.datePreset}
              onRemove={() => setFilters(prev => ({ ...prev, datePreset: '' }))}
            />
          )}
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-xs text-neutral-500 hover:text-neutral-800 ml-1 flex-shrink-0"
          >
            {language === 'es' ? 'Limpiar' : 'Clear all'}
          </button>
        </div>
      )}

      {/* ── Main content + optional right panel ── */}
      <div className="flex-1 overflow-hidden min-h-0 relative">

        {/* Content area — map or list */}
        <div className={`absolute inset-0 transition-[right] duration-300 ${(showChat || showActivity) ? 'md:right-[380px]' : 'md:right-0'} pb-14 md:pb-0`}>
          <FilterPanel
            city={city}
            filters={filters}
            isOpen={showFilters}
            language={language}
            onToggle={() => setShowFilters(v => !v)}
            onChange={setFilters}
          />

          {viewMode === 'list' ? (
            <EventListView
              events={filteredEvents}
              language={language}
              highlightedIds={highlightedIds}
              onEventClick={handleEventClick}
              totalCount={events.length}
              onOpenFilters={() => setShowFilters(v => !v)}
              hasActiveFilters={!filtersAreEmpty(filters)}
            />
          ) : (
            <>
              <MapView
                city={city}
                events={filteredEvents}
                flags={flags}
                highlightedIds={highlightedIds}
                onEventClick={handleEventClick}
              />
              {eventsError && (
                <div className="absolute bottom-20 left-3 right-3 md:bottom-12 rounded bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-2">
                  Events failed to load: {eventsError}
                </div>
              )}
              {/* Event count + AI badge — map overlay */}
              <div className="absolute bottom-16 left-3 flex items-center gap-2 md:bottom-3">
                <div className="text-[10px] text-neutral-500 bg-white/80 backdrop-blur px-2 py-0.5 rounded">
                  {filteredEvents.length}{!filtersAreEmpty(filters) ? ` of ${events.length}` : ''} events
                </div>
                <div className="text-[10px] bg-violet-600/90 text-white backdrop-blur px-2 py-0.5 rounded font-medium tracking-wide flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  {language === 'es' ? 'Agente IA · bien público' : 'AI agent · for good'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Desktop right panel — chat or activity feed */}
        <aside className={`hidden md:flex absolute top-0 right-0 bottom-0 w-[380px] flex-col bg-white border-l border-neutral-200 shadow-xl transition-transform duration-300 ${(showChat || showActivity) ? 'translate-x-0' : 'translate-x-full'}`}>
          {showActivity ? (
            <ActivityFeed
              city={city}
              language={language}
              onClose={() => setShowActivity(false)}
              onOpenEvent={id => { setShowActivity(false); handleEventClick({ id } as CanonicalEvent); }}
            />
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 flex-shrink-0">
                <span className="text-xs font-medium text-neutral-700 uppercase tracking-wide">{language === 'es' ? 'Agente' : 'Agent'}</span>
                <button onClick={() => setShowChat(false)} className="text-neutral-400 hover:text-neutral-700">
                  <XClose className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {sessionId && (
                  <AgentTrace prompt={prompt} sessionId={sessionId} city={city} onComplete={handleComplete} />
                )}
              </div>
              <ChatInput
                onSubmit={handleAsk}
                disabled={running || !sessionId}
                placeholder={cityMeta.default_language === 'es' || language === 'es' ? 'Ej: "acciones de vivienda este sábado"' : 'Try: "housing actions this weekend"'}
              />
            </>
          )}
        </aside>
      </div>

      {/* Mobile chat bottom sheet */}
      {showChat && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowChat(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ height: '68vh' }}>
            {/* Handle + header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-3 border-b border-neutral-100 flex-shrink-0">
              <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-neutral-200" />
              <span className="text-sm font-medium text-neutral-800 mt-1">{language === 'es' ? 'Preguntar' : 'Ask'}</span>
              <button onClick={() => setShowChat(false)} className="text-neutral-400 mt-1">
                <XClose className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {sessionId && (
                <AgentTrace prompt={prompt} sessionId={sessionId} city={city} onComplete={handleComplete} />
              )}
            </div>
            <ChatInput
              onSubmit={handleAsk}
              disabled={running || !sessionId}
              placeholder={cityMeta.default_language === 'es' || language === 'es' ? 'Ej: "acciones de vivienda este sábado"' : 'Try: "housing actions this weekend"'}
            />
          </div>
        </div>
      )}

      {/* Mobile activity bottom sheet */}
      {showActivity && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowActivity(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ height: '75vh' }}>
            <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-neutral-200" />
            <ActivityFeed
              city={city}
              language={language}
              onClose={() => setShowActivity(false)}
              onOpenEvent={id => { setShowActivity(false); handleEventClick({ id } as CanonicalEvent); }}
            />
          </div>
        </div>
      )}

      {showOnboarding && sessionId && (
        <OnboardingModal
          sessionId={sessionId}
          initialCity={city}
          onComplete={prefs => {
            setCity(prefs.city);
            setLanguage(prefs.language);
            window.localStorage.setItem(CITY_KEY, prefs.city);
            window.localStorage.setItem(LANG_KEY, prefs.language);
            window.localStorage.setItem(ONBOARDED_KEY, '1');
            setShowOnboarding(false);
          }}
          onSkip={() => {
            window.localStorage.setItem(ONBOARDED_KEY, '1');
            setShowOnboarding(false);
          }}
        />
      )}

      {showSignIn && sessionId && (
        <SignInModal
          sessionId={sessionId}
          initialEmail={session?.email ?? ''}
          initialName={session?.display_name ?? ''}
          language={language}
          reason={signInReason}
          onClose={() => setShowSignIn(false)}
          onVerified={() => {
            setShowSignIn(false);
            void refreshSession(sessionId);
          }}
        />
      )}

      {openEventId && sessionId && (
        <EventModal
          eventId={openEventId}
          sessionId={sessionId}
          isVerified={!!session?.verified}
          language={language}
          onClose={closeEventModal}
          onRequestSignIn={() => requestSignIn(language === 'es' ? 'Iniciá sesión para reportar o comentar.' : 'Sign in to flag or comment.')}
        />
      )}

      {showSchedule && sessionId && (
        <SchedulePanel
          sessionId={sessionId}
          language={language}
          onClose={() => setShowSchedule(false)}
          onOpenEvent={id => {
            setShowSchedule(false);
            setOpenEventId(id);
            const u = new URL(window.location.href);
            u.searchParams.set('event', id);
            window.history.replaceState({}, '', u.toString());
          }}
        />
      )}

      {showCurate && sessionId && (
        <CurateCardStack
          sessionId={sessionId}
          city={city}
          language={language}
          initialCauses={filters.causes}
          initialBorough={filters.boroughs[0]}
          onClose={() => setShowCurate(false)}
          onSaved={() => setToast(language === 'es' ? 'Guardado en tu agenda' : 'Saved to your schedule')}
          onOpenEvent={id => {
            setShowCurate(false);
            setOpenEventId(id);
            const u = new URL(window.location.href);
            u.searchParams.set('event', id);
            window.history.replaceState({}, '', u.toString());
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-neutral-900 text-white text-sm shadow-lg z-50 md:bottom-6">
          {toast}
        </div>
      )}

      {/* ── Mobile bottom bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 flex items-stretch h-14 safe-area-pb">
        <MobileBarBtn
          icon={viewMode === 'map' ? <List className="w-5 h-5" /> : <Map className="w-5 h-5" />}
          label={viewMode === 'map' ? (language === 'es' ? 'Lista' : 'List') : (language === 'es' ? 'Mapa' : 'Map')}
          active={viewMode === 'list'}
          onClick={() => setViewMode(v => v === 'map' ? 'list' : 'map')}
        />
        <MobileBarBtn
          icon={<FilterIcon className="w-5 h-5" />}
          label={!filtersAreEmpty(filters) ? `${filteredEvents.length}` : (language === 'es' ? 'Filtrar' : 'Filter')}
          active={showFilters || !filtersAreEmpty(filters)}
          onClick={() => setShowFilters(v => !v)}
        />
        <MobileBarBtn
          icon={<MessageSquare className="w-5 h-5" />}
          label={language === 'es' ? 'Preguntar' : 'Ask'}
          active={showChat}
          onClick={() => { setShowChat(v => !v); setShowActivity(false); setShowMobileMenu(false); }}
        />
        <MobileBarBtn
          icon={<Radio className="w-5 h-5" />}
          label={language === 'es' ? 'En vivo' : 'Live'}
          active={showActivity}
          onClick={() => { setShowActivity(v => !v); setShowChat(false); setShowMobileMenu(false); }}
          accent="violet"
        />
        <MobileBarBtn
          icon={<Menu className="w-5 h-5" />}
          label={language === 'es' ? 'Más' : 'More'}
          active={showMobileMenu}
          onClick={() => { setShowMobileMenu(v => !v); setShowChat(false); setShowActivity(false); }}
        />
      </nav>
    </main>
  );
}

function MobileBarBtn({ icon, label, active, onClick, accent }: {
  icon: React.ReactNode; label: string; active: boolean;
  onClick: () => void; accent?: 'violet';
}) {
  const activeColor = accent === 'violet' ? 'text-violet-600' : 'text-neutral-900';
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${active ? activeColor : 'text-neutral-400'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-neutral-900 text-white px-2 py-0.5 rounded-full flex-shrink-0">
      {label}
      <button onClick={onRemove} className="hover:opacity-70">
        <XIcon className="w-3 h-3" />
      </button>
    </span>
  );
}
