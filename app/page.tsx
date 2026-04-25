'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AgentTrace } from '@/components/Chat/AgentTrace';
import { ChatInput } from '@/components/Chat/ChatInput';
import { MapView, type FlagRow } from '@/components/Map/MapView';
import { FlagModal } from '@/components/Map/FlagModal';
import { OnboardingModal } from '@/components/Onboarding/OnboardingModal';
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

export default function Home() {
  const [sessionId, setSessionId] = useState<string>('');
  const [city, setCity] = useState<CitySlug>('nyc');
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [events, setEvents] = useState<CanonicalEvent[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [flagAt, setFlagAt] = useState<{ lng: number; lat: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Initial session + persisted prefs
  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);
    const storedCity = window.localStorage.getItem(CITY_KEY);
    if (storedCity === 'nyc' || storedCity === 'guatemala_city') setCity(storedCity);
    const storedLang = window.localStorage.getItem(LANG_KEY);
    if (storedLang === 'en' || storedLang === 'es') setLanguage(storedLang);
    if (!window.localStorage.getItem(ONBOARDED_KEY)) setShowOnboarding(true);
  }, []);

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
    } catch {
      // best-effort
    }
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
    window.location.href = `/events/${ev.id}`;
  }, []);

  const handleMapClick = useCallback((lngLat: { lng: number; lat: number }) => {
    setFlagAt(lngLat);
  }, []);

  const handleFlagSubmitted = useCallback((review: { decision: string; reasoning: string }) => {
    setToast(
      review.decision === 'approve'
        ? (language === 'es' ? '✓ Aviso publicado' : '✓ Flag published')
        : review.decision === 'review'
          ? (language === 'es' ? 'En revisión humana' : 'Sent to human review')
          : (language === 'es' ? 'Bloqueado por la revisión' : 'Blocked by Safety Review'),
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
          <span className="text-xs text-neutral-500">civic + community discovery</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-neutral-500">{language === 'es' ? 'Ciudad' : 'City'}</label>
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
          <button
            onClick={() => {
              const next = language === 'en' ? 'es' : 'en';
              setLanguage(next);
              window.localStorage.setItem(LANG_KEY, next);
            }}
            className="text-xs text-neutral-700 hover:text-neutral-900 px-2 py-1 border border-neutral-200 rounded"
          >
            {language === 'en' ? 'es' : 'en'}
          </button>
          <span className="text-xs text-neutral-500 hidden sm:inline">
            {events.length} {language === 'es' ? 'eventos' : 'events'} · {flags.length} {language === 'es' ? 'avisos' : 'flags'}
          </span>
          <Link href="/submit" className="text-sm text-blue-700 hover:underline">
            {language === 'es' ? 'Enviar flyer' : 'Submit a flyer'}
          </Link>
          <Link href="/about" className="text-sm text-neutral-600 hover:underline">
            {language === 'es' ? 'Acerca' : 'About'}
          </Link>
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

      {flagAt && sessionId && (
        <FlagModal
          city={city}
          sessionId={sessionId}
          lngLat={flagAt}
          language={language}
          onClose={() => setFlagAt(null)}
          onSubmitted={handleFlagSubmitted}
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
