'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DropZone } from '@/components/Submit/DropZone';
import { CITIES } from '@/lib/constants';
import type { CitySlug } from '@/lib/types';

interface SubmissionStatus {
  id: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'duplicate';
  submission_type: 'image_upload' | 'url' | 'text';
  result_event_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  processed_at: string | null;
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  const KEY = 'convoca_session_id';
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

const POLL_MS = 1500;

export default function SubmitPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [city, setCity] = useState<CitySlug>('nyc');
  const [tracked, setTracked] = useState<SubmissionStatus[]>([]);
  const [appealId, setAppealId] = useState<string | null>(null);
  const [appealText, setAppealText] = useState('');
  const [appealing, setAppealing] = useState(false);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('convoca_city') : null;
    if (stored === 'nyc' || stored === 'guatemala_city') setCity(stored);
  }, []);

  const lang: 'en' | 'es' = city === 'guatemala_city' ? 'es' : 'en';

  // Poll any pending submissions
  useEffect(() => {
    const pending = tracked.filter(s => s.status === 'pending' || s.status === 'processing');
    if (pending.length === 0) return;
    const t = setInterval(async () => {
      const updated = await Promise.all(
        tracked.map(async s => {
          if (s.status !== 'pending' && s.status !== 'processing') return s;
          try {
            const res = await fetch(`/api/submissions/${s.id}`);
            const json = await res.json();
            return json.submission as SubmissionStatus ?? s;
          } catch {
            return s;
          }
        }),
      );
      setTracked(updated);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [tracked]);

  const handleAppeal = useCallback(async (id: string) => {
    if (!appealText.trim()) return;
    setAppealing(true);
    try {
      const res = await fetch(`/api/submissions/${id}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, context: appealText }),
      });
      const json = await res.json();
      if (json.status === 'approved') {
        setTracked(prev => prev.map(s => s.id === id ? {
          ...s, status: 'approved' as const, result_event_id: json.event_id, rejection_reason: null,
        } : s));
      } else {
        setTracked(prev => prev.map(s => s.id === id ? {
          ...s, rejection_reason: json.message ?? 'Still not confirmed as a civic event.',
        } : s));
      }
      setAppealId(null);
      setAppealText('');
    } catch { /* best-effort */ }
    finally { setAppealing(false); }
  }, [sessionId, appealText]);

  const handleSubmitted = useCallback((submissionId: string) => {
    setTracked(prev => [
      {
        id: submissionId,
        status: 'pending',
        submission_type: 'image_upload',
        result_event_id: null,
        rejection_reason: null,
        created_at: new Date().toISOString(),
        processed_at: null,
      },
      ...prev,
    ]);
  }, []);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-baseline justify-between mb-4">
          <Link href="/" className="text-sm text-blue-700 hover:underline">← {lang === 'es' ? 'Volver al mapa' : 'Back to map'}</Link>
          <select
            value={city}
            onChange={e => {
              const next = e.target.value as CitySlug;
              setCity(next);
              window.localStorage.setItem('convoca_city', next);
            }}
            className="text-sm border border-neutral-300 rounded px-2 py-1 bg-white"
          >
            <option value="nyc">{CITIES.nyc.display_name}</option>
            <option value="guatemala_city">{CITIES.guatemala_city.display_name}</option>
          </select>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900">
            {lang === 'es' ? 'Enviá un flyer' : 'Submit a flyer'}
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            {lang === 'es'
              ? 'Cualquiera puede enviar. El agente extrae los datos del evento en segundos.'
              : 'Anyone can submit. The agent extracts event data within seconds.'}
          </p>
        </header>

        {sessionId && (
          <DropZone
            sessionId={sessionId}
            city={city}
            language={lang}
            onSubmitted={handleSubmitted}
          />
        )}

        {tracked.length > 0 && (
          <section className="mt-8 space-y-3">
            <h2 className="text-sm uppercase tracking-wide text-neutral-500">
              {lang === 'es' ? 'Tus envíos' : 'Your submissions'}
            </h2>
            <ul className="space-y-2">
              {tracked.map(s => (
                <li key={s.id} className={`rounded border p-3 text-sm ${badgeStyle(s.status)}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{statusLabel(s.status, lang)}</span>
                    <span className="text-xs text-neutral-500">{new Date(s.created_at).toLocaleTimeString()}</span>
                  </div>
                  {s.status === 'approved' && s.result_event_id && (
                    <Link
                      href={`/events/${s.result_event_id}`}
                      className="inline-block mt-1 text-blue-700 hover:underline"
                    >
                      {lang === 'es' ? 'Ver evento creado →' : 'View created event →'}
                    </Link>
                  )}
                  {s.status === 'rejected' && s.rejection_reason && (
                    <div className="mt-1 text-xs text-neutral-600 italic">{s.rejection_reason}</div>
                  )}
                  {s.status === 'rejected' && (
                    appealId === s.id ? (
                      <div className="mt-2 space-y-1.5">
                        <textarea
                          value={appealText}
                          onChange={e => setAppealText(e.target.value)}
                          placeholder={lang === 'es'
                            ? 'Explicá por qué es un evento cívico (organizador, acción, lugar)…'
                            : 'Explain why this is a civic event — organizer, what attendees will do, location…'}
                          rows={2}
                          className="w-full text-xs rounded border border-violet-300 px-2 py-1.5 text-neutral-900 placeholder:text-neutral-400 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-violet-400"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleAppeal(s.id)}
                            disabled={appealing || !appealText.trim()}
                            className="text-xs px-3 py-1 bg-violet-600 text-white rounded font-medium hover:bg-violet-700 disabled:opacity-50"
                          >
                            {appealing ? (lang === 'es' ? 'Re-evaluando…' : 'Re-reviewing…') : (lang === 'es' ? 'Enviar al agente →' : 'Send to agent →')}
                          </button>
                          <button
                            onClick={() => { setAppealId(null); setAppealText(''); }}
                            className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200"
                          >
                            {lang === 'es' ? 'Cancelar' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAppealId(s.id)}
                        className="mt-1.5 text-xs text-violet-700 hover:text-violet-900 font-medium"
                      >
                        ✦ {lang === 'es' ? 'Agregar contexto y re-evaluar' : 'Add context & re-review'}
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function statusLabel(status: SubmissionStatus['status'], lang: 'en' | 'es'): string {
  const labels: Record<SubmissionStatus['status'], { en: string; es: string }> = {
    pending: { en: 'Queued', es: 'En cola' },
    processing: { en: 'Agent extracting…', es: 'El agente está extrayendo…' },
    approved: { en: 'Added to map ✓', es: 'Agregado al mapa ✓' },
    rejected: { en: 'Not added', es: 'No agregado' },
    duplicate: { en: 'Already on the map', es: 'Ya estaba en el mapa' },
  };
  return labels[status][lang];
}

function badgeStyle(status: SubmissionStatus['status']): string {
  switch (status) {
    case 'approved': return 'bg-green-50 border-green-200 text-green-900';
    case 'rejected': return 'bg-red-50 border-red-200 text-red-900';
    case 'duplicate': return 'bg-blue-50 border-blue-200 text-blue-900';
    default: return 'bg-white border-neutral-200 text-neutral-900';
  }
}
