'use client';

import { useState } from 'react';
import { Globe2, ArrowRight, Check, Bell, BellOff } from 'lucide-react';
import { CITIES } from '@/lib/constants';
import type { CitySlug } from '@/lib/types';

interface OnboardingModalProps {
  sessionId: string;
  initialCity?: CitySlug;
  onComplete: (prefs: {
    city: CitySlug;
    causes: string[];
    actions: string[];
    language: 'en' | 'es';
  }) => void;
  onSkip: () => void;
}

const CITY_ORDER: CitySlug[] = [
  'nyc', 'los_angeles', 'san_francisco', 'chicago',
  'washington_dc', 'boston', 'seattle', 'philadelphia', 'miami',
  'guatemala_city',
] as CitySlug[];

type Step = 'city' | 'notify';

export function OnboardingModal({ sessionId, initialCity = 'nyc', onComplete, onSkip }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>('city');
  const [city, setCity] = useState<CitySlug>(initialCity);
  const [language, setLanguage] = useState<'en' | 'es'>(CITIES[initialCity]?.default_language ?? 'en');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState('');

  const es = language === 'es';
  const cityMeta = CITIES[city];
  const isLive = cityMeta?.status === 'live';

  const saveSession = async () => {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sessionId, city_slug: city, language }),
    });
  };

  const handleCityNext = async () => {
    setBusy(true);
    try { await saveSession(); } catch { /* best-effort */ }
    setBusy(false);
    setStep('notify');
  };

  const handleNotifySubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(es ? 'Email inválido' : 'Enter a valid email');
      return;
    }
    setEmailError('');
    setBusy(true);
    try {
      await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, email: trimmed }),
      });
    } catch { /* best-effort */ }
    setBusy(false);
    onComplete({ city, causes: [], actions: ['attend'], language });
  };

  const handleSkipNotify = () => {
    onComplete({ city, causes: [], actions: ['attend'], language });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-xl md:rounded-xl shadow-xl w-full max-w-md p-5">

        {step === 'city' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Globe2 className="w-5 h-5 text-neutral-700" />
              <h2 className="text-lg font-semibold text-neutral-900">
                {es ? 'Bienvenidx a Convoca' : 'Welcome to Convoca'}
              </h2>
              <button onClick={onSkip} className="ml-auto text-xs text-neutral-400 hover:text-neutral-700">
                {es ? 'Saltar' : 'Skip'}
              </button>
            </div>
            <p className="text-sm text-neutral-600 mb-4">
              {es ? 'Elegí una ciudad para empezar.' : 'Pick a city to start.'}
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
              {CITY_ORDER.map(slug => {
                const meta = CITIES[slug];
                if (!meta) return null;
                const selected = city === slug;
                const live = meta.status === 'live';
                return (
                  <button
                    key={slug}
                    onClick={() => {
                      setCity(slug as CitySlug);
                      setLanguage(meta.default_language === 'es' ? 'es' : 'en');
                    }}
                    className={`text-left p-3 rounded border transition-colors ${
                      selected
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800'
                    }`}
                  >
                    <div className="text-sm font-medium leading-tight">{meta.display_name}</div>
                    <div className={`mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide ${
                      selected ? 'text-neutral-300' : live ? 'text-green-700' : 'text-neutral-500'
                    }`}>
                      {live ? <><Check className="w-2.5 h-2.5" />{es ? 'En vivo' : 'Live'}</> : (es ? 'Próximamente' : 'Coming soon')}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-neutral-500">{es ? 'Idioma' : 'Language'}</span>
              <div className="inline-flex rounded border border-neutral-200 overflow-hidden">
                {(['en', 'es'] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    className={`px-3 py-1 text-xs ${language === l ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-700 hover:bg-neutral-50'}`}
                  >
                    {l === 'en' ? 'English' : 'Español'}
                  </button>
                ))}
              </div>
            </div>

            {!isLive && (
              <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                {es
                  ? 'Esta ciudad aún no tiene fuentes. Podés entrar y enviar flyers para empezar a llenarla.'
                  : 'This city has no seeded sources yet. Enter and submit flyers to start filling it in.'}
              </div>
            )}

            <button
              onClick={() => void handleCityNext()}
              disabled={busy}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300"
            >
              {es ? 'Continuar' : 'Continue'} <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        {step === 'notify' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-5 h-5 text-violet-600" />
              <h2 className="text-lg font-semibold text-neutral-900">
                {es ? 'No te pierdas nada' : "Don't miss what matters"}
              </h2>
            </div>
            <p className="text-sm text-neutral-600 mb-1">
              {es
                ? 'El agente descubre eventos nuevos todo el tiempo. Dejá tu email y te avisamos antes de que ocurran.'
                : 'The agent discovers new events constantly. Leave your email and we\'ll alert you before they happen.'}
            </p>
            <ul className="text-xs text-neutral-500 space-y-1 mb-4 mt-2">
              <li className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                {es ? 'Recordatorio 24h antes de eventos guardados' : '24h reminder before events you save'}
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                {es ? 'Resumen semanal de nuevos eventos' : 'Weekly digest of new events matching your causes'}
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                {es ? 'Alertas de elecciones cercanas' : 'Election alerts 7 days and 1 day out'}
              </li>
            </ul>

            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                placeholder={es ? 'tu@email.com' : 'you@email.com'}
                className="flex-1 text-sm border border-neutral-300 rounded px-3 py-2 text-neutral-900 placeholder:text-neutral-400 bg-white focus:outline-none focus:border-violet-500"
                onKeyDown={e => { if (e.key === 'Enter') void handleNotifySubmit(); }}
                autoFocus
              />
              <button
                onClick={() => void handleNotifySubmit()}
                disabled={busy}
                className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-300"
              >
                {es ? 'Notificarme' : 'Notify me'}
              </button>
            </div>
            {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}

            <button
              onClick={handleSkipNotify}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 py-1"
            >
              <BellOff className="w-3.5 h-3.5" />
              {es ? 'No por ahora, entrar sin notificaciones' : 'Not now, enter without notifications'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
