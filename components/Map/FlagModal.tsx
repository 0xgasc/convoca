'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { FLAG_TYPES, FLAG_TYPE_DISPLAY } from '@/lib/constants';
import { getFlagIcon } from '@/lib/icons';
import type { CitySlug, FlagSeverity, FlagType } from '@/lib/types';

interface FlagModalProps {
  city: CitySlug;
  sessionId: string;
  lngLat: { lng: number; lat: number };
  eventId?: string | null;
  language?: 'en' | 'es';
  onClose: () => void;
  onSubmitted: (result: { decision: 'approve' | 'block' | 'review'; reasoning: string }) => void;
  onRequestSignIn?: () => void;
}

export function FlagModal({ city, sessionId, lngLat, eventId, language = 'en', onClose, onSubmitted, onRequestSignIn }: FlagModalProps) {
  const t = language;
  const applicable = FLAG_TYPES.filter(ft => FLAG_TYPE_DISPLAY[ft].applicable_cities.includes(city));
  const [flagType, setFlagType] = useState<FlagType>(applicable[0]);
  const [severity, setSeverity] = useState<FlagSeverity>('caution');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify({
          city,
          flag_type: flagType,
          severity,
          lat: lngLat.lat,
          lng: lngLat.lng,
          note: note.trim() || null,
          event_id: eventId ?? null,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        onClose();
        onRequestSignIn?.();
        return;
      }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onSubmitted(json.review);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            {t === 'es' ? 'Agregar aviso' : 'Add a flag'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="close"><X className="w-5 h-5" /></button>
        </div>
        <div className="text-xs text-neutral-500 mb-3">
          {t === 'es' ? 'Posición:' : 'Location:'} {lngLat.lat.toFixed(4)}, {lngLat.lng.toFixed(4)}
        </div>

        <label className="block mb-3">
          <span className="text-xs text-neutral-600 uppercase tracking-wide">{t === 'es' ? 'Tipo' : 'Type'}</span>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {applicable.map(ft => {
              const meta = FLAG_TYPE_DISPLAY[ft];
              const Icon = getFlagIcon(ft);
              return (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setFlagType(ft)}
                  className={`text-xs px-2 py-2 rounded border flex flex-col items-center gap-1 ${
                    flagType === ft ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                  title={meta.label_en}
                >
                  <Icon className="w-4 h-4" />
                  <div>{t === 'es' ? meta.label_es : meta.label_en}</div>
                </button>
              );
            })}
          </div>
        </label>

        <label className="block mb-3">
          <span className="text-xs text-neutral-600 uppercase tracking-wide">{t === 'es' ? 'Severidad' : 'Severity'}</span>
          <div className="mt-1 flex gap-1">
            {(['info', 'caution', 'urgent'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={`flex-1 text-xs py-1.5 rounded border ${
                  severity === s ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </label>

        <label className="block mb-4">
          <span className="text-xs text-neutral-600 uppercase tracking-wide">{t === 'es' ? 'Nota (opcional)' : 'Note (optional)'}</span>
          <textarea
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t === 'es' ? 'p.ej. ICE en la esquina noreste, evitar' : 'e.g. ICE at NE corner, avoid'}
            className="mt-1 w-full px-3 py-2 text-sm rounded border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </label>

        {error && <div className="rounded bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2 mb-3">{error}</div>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded text-neutral-700 hover:bg-neutral-100">
            {t === 'es' ? 'Cancelar' : 'Cancel'}
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300 inline-flex items-center gap-1.5"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? (t === 'es' ? 'Enviando…' : 'Sending…') : (t === 'es' ? 'Enviar' : 'Submit')}
          </button>
        </div>
        <p className="mt-3 text-[11px] text-neutral-500">
          {t === 'es'
            ? 'El agente de revisión filtra spam y doxxing antes de publicar.'
            : 'The Safety Review agent filters spam and doxxing before publishing.'}
        </p>
      </div>
    </div>
  );
}
