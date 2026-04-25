'use client';

import { useState } from 'react';
import { CITIES, CAUSE_VOCABULARY, CAUSE_DISPLAY } from '@/lib/constants';
import type { CauseTag, CitySlug } from '@/lib/types';

interface OnboardingModalProps {
  sessionId: string;
  initialCity?: CitySlug;
  onComplete: (prefs: {
    city: CitySlug;
    causes: CauseTag[];
    actions: string[];
    language: 'en' | 'es';
  }) => void;
  onSkip: () => void;
}

const ACTION_OPTIONS = [
  { id: 'attend', label_en: 'Attend', label_es: 'Asistir' },
  { id: 'volunteer', label_en: 'Volunteer', label_es: 'Voluntariado' },
  { id: 'bring_supplies', label_en: 'Bring supplies', label_es: 'Llevar suministros' },
  { id: 'donate', label_en: 'Donate', label_es: 'Donar' },
  { id: 'amplify', label_en: 'Amplify', label_es: 'Amplificar' },
];

export function OnboardingModal({ sessionId, initialCity = 'nyc', onComplete, onSkip }: OnboardingModalProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [city, setCity] = useState<CitySlug>(initialCity);
  const [language, setLanguage] = useState<'en' | 'es'>(initialCity === 'guatemala_city' ? 'es' : 'en');
  const [causes, setCauses] = useState<Set<CauseTag>>(new Set());
  const [actions, setActions] = useState<Set<string>>(new Set(['attend']));
  const [busy, setBusy] = useState(false);

  const t = language;

  const finish = async () => {
    setBusy(true);
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionId,
          city_slug: city,
          cause_prefs: Array.from(causes),
          action_prefs: Array.from(actions),
          language,
        }),
      });
      onComplete({ city, causes: Array.from(causes), actions: Array.from(actions), language });
    } catch {
      // best-effort — onboarding shouldn't block usage
      onComplete({ city, causes: Array.from(causes), actions: Array.from(actions), language });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <div className="flex items-baseline justify-between mb-4">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(s => (
              <div
                key={s}
                className={`h-1.5 w-8 rounded-full ${s <= step ? 'bg-neutral-900' : 'bg-neutral-200'}`}
              />
            ))}
          </div>
          <button onClick={onSkip} className="text-xs text-neutral-500 hover:text-neutral-800">
            {t === 'es' ? 'Saltar' : 'Skip'}
          </button>
        </div>

        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">
              {t === 'es' ? 'Bienvenidx a Convoca' : 'Welcome to Convoca'}
            </h2>
            <p className="text-sm text-neutral-600 mb-4">
              {t === 'es' ? '¿En qué ciudad?' : 'Which city?'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['nyc', 'guatemala_city'] as CitySlug[]).map(c => (
                <button
                  key={c}
                  onClick={() => {
                    setCity(c);
                    setLanguage(c === 'guatemala_city' ? 'es' : 'en');
                  }}
                  className={`p-3 rounded border text-sm ${
                    city === c ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                  }`}
                >
                  {CITIES[c].display_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">
              {t === 'es' ? 'Idioma' : 'Language'}
            </h2>
            <p className="text-sm text-neutral-600 mb-4">
              {t === 'es' ? 'Para la interfaz y el agente.' : 'For the interface and the agent.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['en', 'es'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={`p-3 rounded border text-sm ${
                    language === l ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                  }`}
                >
                  {l === 'en' ? 'English' : 'Español'}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">
              {t === 'es' ? '¿Qué te interesa?' : 'What do you care about?'}
            </h2>
            <p className="text-sm text-neutral-600 mb-3">
              {t === 'es' ? 'Elegí cualquier cantidad. Podés cambiar después.' : 'Pick any number. You can change later.'}
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
              {CAUSE_VOCABULARY.map(c => {
                const selected = causes.has(c);
                const meta = CAUSE_DISPLAY[c];
                return (
                  <button
                    key={c}
                    onClick={() => {
                      const next = new Set(causes);
                      if (selected) next.delete(c); else next.add(c);
                      setCauses(next);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      selected ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {meta ? (t === 'es' ? meta.label_es : meta.label_en) : c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">
              {t === 'es' ? '¿Cómo te gusta participar?' : 'How do you like to show up?'}
            </h2>
            <p className="text-sm text-neutral-600 mb-3">
              {t === 'es' ? 'El agente prioriza eventos que coincidan.' : 'The agent prioritizes events that match.'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ACTION_OPTIONS.map(a => {
                const selected = actions.has(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      const next = new Set(actions);
                      if (selected) next.delete(a.id); else next.add(a.id);
                      setActions(next);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      selected ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {t === 'es' ? a.label_es : a.label_en}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mt-6">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1) as 0 | 1 | 2 | 3)}
            disabled={step === 0 || busy}
            className="text-sm text-neutral-600 hover:text-neutral-900 disabled:opacity-30"
          >
            ← {t === 'es' ? 'Atrás' : 'Back'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(s => Math.min(3, s + 1) as 0 | 1 | 2 | 3)}
              className="px-4 py-2 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {t === 'es' ? 'Siguiente' : 'Next'} →
            </button>
          ) : (
            <button
              onClick={() => void finish()}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300"
            >
              {busy ? '…' : (t === 'es' ? 'Listo' : 'Done')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
