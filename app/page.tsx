'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Upload, Info, Languages, MapPinned, Check, Calendar, Sparkles } from 'lucide-react';
import { AgentTrace } from '@/components/Chat/AgentTrace';
import { ChatInput } from '@/components/Chat/ChatInput';
import { RefreshSources } from '@/components/Chat/RefreshSources';
import { MapView, type FlagRow } from '@/components/Map/MapView';
import { FlagModal } from '@/components/Map/FlagModal';
import { OnboardingModal } from '@/components/Onboarding/OnboardingModal';
import { SignInModal } from '@/components/Auth/SignInModal';
import { EventModal } from '@/components/EventDetail/EventModal';
import { SchedulePanel } from '@/components/Schedule/SchedulePanel';
import { CurateCardStack } from '@/components/Curate/CurateCardStack';
import { FilterPanel, type EventFilters, EMPTY_FILTERS, filtersAreEmpty, filtersToQueryString } from '@/components/Filter/FilterPanel';
import { CAUSE_DISPLAY, EVENT_TYPE_DISPLAY, NYC_BOROUGHS } from '@/lib/constants';
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
  const [flagAt, setFlagAt] = useState<{ lng: number; lat: number } | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showCurate, setShowCurate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<EventFilters>(EMPTY_FILTERS);
  const [toast, setToast] = useState<string | null>(null);

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
      });
    } catch { /* best-effort */ }
  }, []);
  useEffect(() => {
    if (!sessionId) return;
    void refreshSession(sessionId);
    const t = setInterval(() => void refreshSession(sessionId), SESSION_REFRESH_MS);
    return () => clearInterval(t);
  }, [sessionId, refreshSession]);

  const loadEvents = useCallback(async (activeFilters?: EventFilters) => {
    setEventsError(null);
    const f = activeFilters ?? filters;
    const qs = filtersToQueryString(f, city);
    try {
      const res = await fetch(`/api/events?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setEvents(json.events ?? []);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : String(err));
      setEvents([]);
    }
  }, [city, filters]);

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

  const handleMapClick = useCallback((lngLat: { lng: number; lat: number }) => {
    if (!session?.verified) {
      setSignInReason(language === 'es' ? 'Iniciá sesión para reportar avisos.' : 'Sign in to drop a community flag.');
      setShowSignIn(true);
      return;
    }
    setFlagAt(lngLat);
  }, [session, language]);

  const requestSignIn = useCallback((reason?: string) => {
    setSignInReason(reason);
    setShowSignIn(true);
  }, []);

  const handleFlagSubmitted = useCallback((review: { decision: string; reasoning: string }) => {
    setToast(
      review.decision === 'approve'
        ? (language === 'es' ? 'Aviso publicado.' : 'Flag published.')
        : review.decision === 'review'
          ? (language === 'es' ? 'En revisión humana.' : 'Sent to human review.')
          : (language === 'es' ? 'Bloqueado por la revisión.' : 'Blocked by Safety Review.'),
    );
    void loadFlags();
    setTimeout(() => setToast(null), 4500);
  }, [language, loadFlags]);

  const cityMeta = useMemo(() => CITIES[city], [city]);

  return (
    <main className="h-screen w-screen flex flex-col bg-neutral-50">
      <header className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-white">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold text-neutral-900">Convoca</span>
          <span className="hidden sm:inline text-xs text-neutral-500">civic + community discovery</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-neutral-600">
            <MapPinned className="w-4 h-4" />
            <select
              value={city}
              onChange={e => {
                const next = e.target.value as CitySlug;
                setCity(next);
                window.localStorage.setItem(CITY_KEY, next);
              }}
              className="text-sm border border-neutral-300 rounded px-2 py-1 bg-white"
            >
              <option value="nyc">{CITIES.nyc.display_name}</option>
              <option value="guatemala_city">{CITIES.guatemala_city.display_name}</option>
            </select>
          </div>
          <button
            onClick={() => {
              const next = language === 'en' ? 'es' : 'en';
              setLanguage(next);
              window.localStorage.setItem(LANG_KEY, next);
            }}
            className="inline-flex items-center gap-1 text-xs text-neutral-700 hover:text-neutral-900 px-2 py-1 border border-neutral-200 rounded"
          >
            <Languages className="w-3.5 h-3.5" />
            {language === 'en' ? 'es' : 'en'}
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 border rounded ${filtersAreEmpty(filters) ? 'border-neutral-200 text-neutral-700 hover:text-neutral-900' : 'border-neutral-900 bg-neutral-900 text-white'}`}
          >
            <FilterIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === 'es' ? 'Filtros' : 'Filters'}</span>
            {!filtersAreEmpty(filters) && (
              <span className="ml-0.5 text-[10px] bg-white text-neutral-900 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {filters.causes.length + filters.event_types.length + filters.action_types.length + filters.boroughs.length}
              </span>
            )}
          </button>
          <span className="hidden md:inline text-xs text-neutral-500">
            {events.length} {language === 'es' ? 'eventos' : 'events'} · {flags.length} {language === 'es' ? 'avisos' : 'flags'}
          </span>
          <button
            onClick={() => setShowCurate(true)}
            className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium"
            title={language === 'es' ? 'Curar para mí' : 'Curate for me'}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === 'es' ? 'Curar' : 'Curate'}</span>
          </button>
          <button
            onClick={() => setShowSchedule(true)}
            className="inline-flex items-center gap-1 text-sm text-neutral-700 hover:text-neutral-900"
            title={language === 'es' ? 'Mi agenda' : 'My schedule'}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === 'es' ? 'Agenda' : 'Schedule'}</span>
          </button>
          <Link
            href="/submit"
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === 'es' ? 'Enviar flyer' : 'Submit flyer'}</span>
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:underline"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === 'es' ? 'Acerca' : 'About'}</span>
          </Link>
          {session?.verified ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 px-2 py-1 rounded bg-green-50 border border-green-200" title={session.email ?? ''}>
              <Check className="w-3 h-3" />
              <span className="hidden md:inline">{session.display_name ?? session.email}</span>
            </span>
          ) : (
            <button
              onClick={() => requestSignIn()}
              className="text-sm text-neutral-700 hover:text-neutral-900 px-2 py-1 border border-neutral-200 rounded"
            >
              {language === 'es' ? 'Iniciar sesión' : 'Sign in'}
            </button>
          )}
        </div>
      </header>

      {/* Active filter chip strip */}
      {!filtersAreEmpty(filters) && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-neutral-200 bg-neutral-50 overflow-x-auto flex-shrink-0">
          <span className="text-xs text-neutral-500 flex-shrink-0">{language === 'es' ? 'Filtros:' : 'Filters:'}</span>
          {filters.boroughs.map(b => {
            const meta = NYC_BOROUGHS.find(x => x.slug === b);
            return (
              <ActiveChip key={b} label={meta?.name ?? b} onRemove={() => {
                const next = { ...filters, boroughs: filters.boroughs.filter(x => x !== b) };
                setFilters(next);
                void loadEvents(next);
              }} />
            );
          })}
          {filters.causes.map(c => {
            const meta = CAUSE_DISPLAY[c];
            return (
              <ActiveChip key={c} label={meta ? (language === 'es' ? meta.label_es : meta.label_en) : c} onRemove={() => {
                const next = { ...filters, causes: filters.causes.filter(x => x !== c) };
                setFilters(next);
                void loadEvents(next);
              }} />
            );
          })}
          {filters.event_types.map(t => {
            const meta = EVENT_TYPE_DISPLAY[t] ?? EVENT_TYPE_DISPLAY.other;
            return (
              <ActiveChip key={t} label={language === 'es' ? meta.label_es : meta.label_en} onRemove={() => {
                const next = { ...filters, event_types: filters.event_types.filter(x => x !== t) };
                setFilters(next);
                void loadEvents(next);
              }} />
            );
          })}
          {filters.action_types.map(a => (
            <ActiveChip key={a} label={a.replace(/_/g, ' ')} onRemove={() => {
              const next = { ...filters, action_types: filters.action_types.filter(x => x !== a) };
              setFilters(next);
              void loadEvents(next);
            }} />
          ))}
          <button
            onClick={() => { setFilters(EMPTY_FILTERS); void loadEvents(EMPTY_FILTERS); }}
            className="text-xs text-neutral-500 hover:text-neutral-800 ml-1 flex-shrink-0"
          >
            {language === 'es' ? 'Limpiar' : 'Clear all'}
          </button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_420px] overflow-hidden">
        <section className="relative border-r border-neutral-200 min-h-0">
          <MapView
            city={city}
            events={events}
            flags={flags}
            highlightedIds={highlightedIds}
            onEventClick={handleEventClick}
            onMapClick={handleMapClick}
          />
          {eventsError && (
            <div className="absolute bottom-3 left-3 right-3 rounded bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-2">
              Events failed to load: {eventsError}
            </div>
          )}
          <div className="absolute bottom-3 left-3 text-[11px] text-neutral-500 bg-white/80 backdrop-blur px-2 py-1 rounded">
            {language === 'es' ? 'Tocá el mapa para agregar un aviso comunitario.' : 'Click the map to add a community flag.'}
          </div>
        </section>

        <aside className="flex flex-col min-h-0 bg-white">
          <div className="px-3 py-2 border-b border-neutral-200">
            <div className="text-xs uppercase tracking-wide text-neutral-500">{language === 'es' ? 'Agente' : 'Agent'}</div>
            <div className="text-sm text-neutral-900">
              {language === 'es'
                ? 'Preguntá en español — la orquestación corre los siete agentes en cada solicitud.'
                : 'Ask in English — the orchestrator runs all seven agents on each prompt.'}
            </div>
          </div>
          <RefreshSources city={city} language={language} onDone={loadEvents} />
          <div className="flex-1 min-h-0">
            {sessionId && (
              <AgentTrace
                prompt={prompt}
                sessionId={sessionId}
                city={city}
                onComplete={handleComplete}
              />
            )}
          </div>
          <ChatInput
            onSubmit={handleAsk}
            disabled={running || !sessionId}
            placeholder={
              cityMeta.default_language === 'es' || language === 'es'
                ? 'Ej: "acciones de vivienda este sábado"'
                : 'Try: "housing actions this weekend"'
            }
          />
        </aside>
      </div>

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

      {flagAt && sessionId && (
        <FlagModal
          city={city}
          sessionId={sessionId}
          lngLat={flagAt}
          language={language}
          onClose={() => setFlagAt(null)}
          onSubmitted={handleFlagSubmitted}
          onRequestSignIn={() => { setFlagAt(null); requestSignIn(language === 'es' ? 'Iniciá sesión para reportar avisos.' : 'Sign in to drop a community flag.'); }}
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

      {showFilters && (
        <FilterPanel
          city={city}
          initial={filters}
          language={language}
          onApply={f => { setFilters(f); void loadEvents(f); }}
          onClose={() => setShowFilters(false)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-neutral-900 text-white text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
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
