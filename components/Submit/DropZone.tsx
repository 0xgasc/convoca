'use client';

import { useCallback, useRef, useState } from 'react';
import type { CitySlug } from '@/lib/types';

interface DropZoneProps {
  sessionId: string;
  city: CitySlug;
  onSubmitted: (submissionId: string) => void;
  language?: 'en' | 'es';
}

const COPY = {
  en: {
    drop: 'Drop a flyer image here, or click to choose',
    or: 'or',
    pasteUrl: 'Paste an Instagram / Eventbrite / org URL',
    pasteText: 'Or paste announcement text',
    submit: 'Send to agent',
    sending: 'Sending…',
    error: 'Submission failed',
  },
  es: {
    drop: 'Arrastrá una imagen del flyer aquí, o hacé clic para elegir',
    or: 'o',
    pasteUrl: 'Pegá un enlace de Instagram / Eventbrite / organización',
    pasteText: 'O pegá el texto del anuncio',
    submit: 'Enviar al agente',
    sending: 'Enviando…',
    error: 'No se pudo enviar',
  },
};

export function DropZone({ sessionId, city, onSubmitted, language = 'en' }: DropZoneProps) {
  const t = COPY[language];
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendImage = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('sessionId', sessionId);
      fd.append('city', city);
      const res = await fetch('/api/submit', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
      onSubmitted(json.submissionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [sessionId, city, onSubmitted]);

  const sendUrlOrText = useCallback(async () => {
    if (!url.trim() && !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const body = url.trim()
        ? { url: url.trim(), sessionId, city }
        : { text: text.trim(), sessionId, city };
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
      setUrl('');
      setText('');
      onSubmitted(json.submissionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [url, text, sessionId, city, onSubmitted]);

  return (
    <div className="space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith('image/')) void sendImage(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-neutral-300 bg-white hover:bg-neutral-50'
        }`}
      >
        <div className="text-4xl mb-2">📸</div>
        <div className="text-sm text-neutral-700">{t.drop}</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void sendImage(file);
          }}
        />
      </div>

      <div className="text-center text-xs text-neutral-400 uppercase tracking-wide">{t.or}</div>

      <div className="space-y-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder={t.pasteUrl}
          className="w-full px-3 py-2 text-sm rounded border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t.pasteText}
          rows={3}
          className="w-full px-3 py-2 text-sm rounded border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
        <button
          type="button"
          onClick={() => void sendUrlOrText()}
          disabled={busy || (!url.trim() && !text.trim())}
          className="w-full px-4 py-2 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed"
        >
          {busy ? t.sending : t.submit}
        </button>
      </div>

      {error && (
        <div className="rounded bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">
          {t.error}: {error}
        </div>
      )}
    </div>
  );
}
