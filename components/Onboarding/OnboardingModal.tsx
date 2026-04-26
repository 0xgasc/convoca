'use client';

import { useState } from 'react';
import { Globe2, ArrowRight, Check } from 'lucide-react';
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

const COPY = {
  en: { welcome: 'Welcome to Convoca', sub: 'Pick a city to start. You can change anything later.', live: 'Live', soon: 'Coming soon', enter: 'Enter', skip: 'Skip', es: 'Español' },
  es: { welcome: 'Bienvenidx a Convoca', sub: 'Elegí una ciudad para empezar. Cambiás todo después si querés.', live: 'En vivo', soon: 'Próximamente', enter: 'Entrar', skip: 'Saltar', es: 'Español' },
};

const CITY_ORDER: CitySlug[] = [
  'nyc', 'los_angeles', 'san_francisco', 'chicago',
  'washington_dc', 'boston', 'seattle', 'philadelphia', 'miami',
  'guatemala_city',
] as CitySlug[];

export function OnboardingModal({ sessionId, initialCity = 'nyc', onComplete, onSkip }: OnboardingModalProps) {
  const [city, setCity] = useState<CitySlug>(initialCity);
  const [language, setLanguage] = useState<'en' | 'es'>(CITIES[initialCity]?.default_language ?? 'en');
  const [busy, setBusy] = useState(false);
  const t = COPY[language];

  const cityMeta = CITIES[city];
  const isLive = cityMeta?.status === 'live';

  const finish = async () => {
    setBusy(true);
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, city_slug: city, language }),
      });
      onComplete({ city, causes: [], actions: ['attend'], language });
    } catch {
      onComplete({ city, causes: [], actions: ['attend'], language });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-xl md:rounded-xl shadow-xl w-full max-w-md p-5">
        <div className="flex items-center gap-2 mb-1">
          <Globe2 className="w-5 h-5 text-neutral-700" />
          <h2 className="text-lg font-semibold text-neutral-900">{t.welcome}</h2>
          <button onClick={onSkip} className="ml-auto text-xs text-neutral-400 hover:text-neutral-700">{t.skip}</button>
        </div>
        <p className="text-sm text-neutral-600 mb-4">{t.sub}</p>

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
                  {live ? <><Check className="w-2.5 h-2.5" /> {t.live}</> : t.soon}
                </div>
              </button>
            );
          })}
        </div>

        {/* Language toggle (only matters for the UI) */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-neutral-500">UI language</span>
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
            {language === 'es'
              ? 'Esta ciudad aún no tiene fuentes seedeadas. Ya podés entrar y enviar flyers; los eventos se llenan a medida que la comunidad los aporta.'
              : 'This city has no seeded sources yet. You can still enter and submit flyers; events fill in as the community contributes.'}
          </div>
        )}

        <button
          onClick={() => void finish()}
          disabled={busy}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300"
        >
          {t.enter} <ArrowRight className="w-4 h-4" />
        </button>
        <p className="mt-2 text-[11px] text-neutral-500 text-center">
          {language === 'es'
            ? 'Sin cuenta — sesión local. Pedimos email solo si querés reportar avisos o comentar.'
            : 'No account — anonymous local session. Email only requested if you want to flag or comment.'}
        </p>
      </div>
    </div>
  );
}
