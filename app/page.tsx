'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Upload, Info, Languages, MapPinned, Check } from 'lucide-react';
import { AgentTrace } from '@/components/Chat/AgentTrace';
import { ChatInput } from '@/components/Chat/ChatInput';
import { MapView, type FlagRow } from '@/components/Map/MapView';
import { FlagModal } from '@/components/Map/FlagModal';
import { OnboardingModal } from '@/components/Onboarding/OnboardingModal';
import { SignInModal } from '@/components/Auth/SignInModal';
import { EventModal } from '@/components/EventDetail/EventModal';
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
          <span className="hidden md:inline text-xs text-neutral-500">
            {events.length} {language === 'es' ? 'eventos' : 'events'} · {flags.length} {language === 'es' ? 'avisos' : 'flags'}
          </span>
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

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-neutral-900 text-white text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
  );
}
