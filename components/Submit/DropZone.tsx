'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Upload, Loader2 } from 'lucide-react';
import Script from 'next/script';
import type { CitySlug } from '@/lib/types';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      getResponse: (id?: string) => string | undefined;
    };
  }
}

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
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);

  // Render Turnstile widget once script is ready
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const tryRender = () => {
      if (!window.turnstile || !turnstileContainerRef.current || turnstileWidgetIdRef.current) return;
      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
        size: 'normal',
      });
    };
    if (window.turnstile) tryRender();
    else {
      const t = setInterval(() => { if (window.turnstile) { tryRender(); clearInterval(t); } }, 200);
      return () => clearInterval(t);
    }
  }, []);

  const getTurnstileToken = (): string | null => {
    if (!TURNSTILE_SITE_KEY) return null;
    if (!window.turnstile || !turnstileWidgetIdRef.current) return null;
    return window.turnstile.getResponse(turnstileWidgetIdRef.current) ?? null;
  };

  const resetTurnstile = () => {
    if (window.turnstile && turnstileWidgetIdRef.current) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
  };

  const sendImage = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('sessionId', sessionId);
      fd.append('city', city);
      const tt = getTurnstileToken();
      if (tt) fd.append('turnstile_token', tt);
      const res = await fetch('/api/submit', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.message ?? `HTTP ${res.status}`);
      onSubmitted(json.submissionId);
      resetTurnstile();
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
      const turnstile_token = getTurnstileToken();
      const body = url.trim()
        ? { url: url.trim(), sessionId, city, turnstile_token }
        : { text: text.trim(), sessionId, city, turnstile_token };
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.message ?? `HTTP ${res.status}`);
      setUrl('');
      setText('');
      onSubmitted(json.submissionId);
      resetTurnstile();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [url, text, sessionId, city, onSubmitted]);

  return (
    <div className="space-y-4">
      {TURNSTILE_SITE_KEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
      )}
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
        <Camera className="w-10 h-10 mx-auto mb-2 text-neutral-500" />
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
          className="w-full px-4 py-2 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {busy ? t.sending : t.submit}
        </button>
      </div>

      {TURNSTILE_SITE_KEY && (
        <div ref={turnstileContainerRef} className="flex justify-center" />
      )}

      {error && (
        <div className="rounded bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">
          {t.error}: {error}
        </div>
      )}
    </div>
  );
}
