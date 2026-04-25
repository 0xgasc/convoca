'use client';

import type { ActionType, CanonicalEvent } from '@/lib/types';

interface SignupCTAProps {
  event: CanonicalEvent;
  language?: 'en' | 'es';
}

const COPY: Record<ActionType, { en: string; es: string; verb_en: string; verb_es: string }> = {
  attend:         { en: 'Show up',          es: 'Asistir',                verb_en: 'Add to calendar', verb_es: 'Agregar al calendario' },
  rsvp:           { en: 'RSVP',             es: 'Confirmar asistencia',   verb_en: 'RSVP via organizer', verb_es: 'Confirmar con la organización' },
  register:       { en: 'Register',         es: 'Registrarse',            verb_en: 'Register with organizer', verb_es: 'Registrarse con la organización' },
  bring_supplies: { en: 'Bring supplies',   es: 'Llevar suministros',     verb_en: 'See what to bring', verb_es: 'Ver qué llevar' },
  donate:         { en: 'Donate',           es: 'Donar',                  verb_en: 'Donate via organizer', verb_es: 'Donar con la organización' },
  amplify:        { en: 'Amplify',          es: 'Amplificar',             verb_en: 'Share', verb_es: 'Compartir' },
};

export function SignupCTA({ event, language = 'en' }: SignupCTAProps) {
  const copy = COPY[event.action_type] ?? COPY.attend;
  const lang = language;
  const headline = lang === 'es' ? copy.es : copy.en;
  const verb = lang === 'es' ? copy.verb_es : copy.verb_en;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 flex items-center justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-500">{lang === 'es' ? 'Acción' : 'Action'}</div>
        <div className="text-base font-semibold text-neutral-900">{headline}</div>
        {!event.signup_url && (
          <div className="text-xs text-neutral-500 mt-1">
            {lang === 'es' ? 'No hay enlace de inscripción del organizador.' : 'No organizer signup link available.'}
          </div>
        )}
      </div>
      {event.signup_url ? (
        <a
          href={event.signup_url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800"
        >
          {verb}
        </a>
      ) : (
        <button
          disabled
          className="px-4 py-2 text-sm font-medium rounded bg-neutral-200 text-neutral-500 cursor-not-allowed"
        >
          {verb}
        </button>
      )}
    </div>
  );
}
