'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Upload, Loader2, Check, AlertTriangle, FileText, X } from 'lucide-react';
import Script from 'next/script';
import { uploadToStash } from '@/lib/stash';
import type { CitySlug } from '@/lib/types';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const STASH_SERVER = process.env.NEXT_PUBLIC_STASH_SERVER ?? 'https://stash-production-47fc.up.railway.app';

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
    drop: 'Drop one or more flyer images here, or click to choose',
    or: 'or',
    pasteUrl: 'Paste an Instagram / Eventbrite / org URL',
    pasteText: 'Or paste announcement text',
    submit: 'Send to agent',
    sending: 'Sending…',
    error: 'Submission failed',
    uploading: 'Uploading to permanent storage',
    processing: 'Agent extracting',
    cancel: 'Cancel',
    permanent: 'Stored permanently on Arweave',
  },
  es: {
    drop: 'Arrastrá una o más imágenes aquí, o hacé clic para elegir',
    or: 'o',
    pasteUrl: 'Pegá un enlace de Instagram / Eventbrite / organización',
    pasteText: 'O pegá el texto del anuncio',
    submit: 'Enviar al agente',
    sending: 'Enviando…',
    error: 'No se pudo enviar',
    uploading: 'Subiendo a almacenamiento permanente',
    processing: 'El agente está extrayendo',
    cancel: 'Cancelar',
    permanent: 'Guardado para siempre en Arweave',
  },
};

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  percent: number;
  message?: string;
  permanentUrl?: string;
  submissionId?: string;
}

export function DropZone({ sessionId, city, onSubmitted, language = 'en' }: DropZoneProps) {
  const t = COPY[language];
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const tryRender = () => {
      if (!window.turnstile || !turnstileContainerRef.current || turnstileWidgetIdRef.current) return;
      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY, theme: 'light', size: 'normal',
      });
    };
    if (window.turnstile) tryRender();
    else {
      const t = setInterval(() => { if (window.turnstile) { tryRender(); clearInterval(t); } }, 200);
      return () => clearInterval(t);
    }
  }, []);

  const getTurnstileToken = (): string | null => {
    if (!TURNSTILE_SITE_KEY || !window.turnstile || !turnstileWidgetIdRef.current) return null;
    return window.turnstile.getResponse(turnstileWidgetIdRef.current) ?? null;
  };

  const resetTurnstile = () => {
    if (window.turnstile && turnstileWidgetIdRef.current) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
  };

  const updateUpload = (id: string, patch: Partial<UploadingFile>) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  };

  // 1) Stash upload → 2) /api/submit with the permanent URL
  const sendOneImage = useCallback(async (file: File) => {
    const id = crypto.randomUUID();
    setUploads(prev => [
      { id, name: file.name, size: file.size, status: 'uploading', percent: 0 },
      ...prev,
    ]);

    try {
      // Step 1 — upload to Stash for permanent storage
      const stash = await uploadToStash(file, p => {
        updateUpload(id, { percent: p.percent });
      });

      updateUpload(id, { status: 'processing', percent: 100, permanentUrl: stash.url });

      // Step 2 — submit the URL to the agent pipeline
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: stash.url,
          sessionId, city,
          source_image_url: stash.url,
          turnstile_token: getTurnstileToken(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.message ?? `HTTP ${res.status}`);

      updateUpload(id, { status: 'done', submissionId: json.submissionId, message: t.processing });
      onSubmitted(json.submissionId);
    } catch (err) {
      updateUpload(id, { status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [sessionId, city, onSubmitted, t.processing]);

  const sendImages = useCallback(async (files: File[]) => {
    setBusy(true);
    setError(null);
    try {
      // Parallel: each file uploads + submits independently
      await Promise.all(files.map(f => sendOneImage(f)));
      resetTurnstile();
    } finally {
      setBusy(false);
    }
  }, [sendOneImage]);

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
          const files = Array.from(e.dataTransfer.files ?? []).filter(f => f.type.startsWith('image/'));
          if (files.length > 0) void sendImages(files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-neutral-300 bg-white hover:bg-neutral-50'
        }`}
      >
        <Camera className="w-10 h-10 mx-auto mb-2 text-neutral-500" />
        <div className="text-sm text-neutral-700">{t.drop}</div>
        <div className="mt-1 text-[11px] text-neutral-400">{t.permanent}</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) void sendImages(files);
            e.currentTarget.value = '';
          }}
        />
      </div>

      {/* Per-file progress list */}
      {uploads.length > 0 && (
        <ul className="space-y-1.5">
          {uploads.map(u => (
            <li key={u.id} className="flex items-center gap-2 text-xs px-3 py-2 rounded border border-neutral-200 bg-white">
              <FileText className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="truncate flex-1 text-neutral-800">{u.name}</span>
              {u.status === 'uploading' && (
                <>
                  <div className="w-20 h-1 bg-neutral-200 rounded overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${u.percent}%` }} />
                  </div>
                  <span className="text-neutral-500 w-8 text-right">{u.percent}%</span>
                </>
              )}
              {u.status === 'processing' && (
                <span className="inline-flex items-center gap-1 text-neutral-600">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t.processing}…
                </span>
              )}
              {u.status === 'done' && (
                <span className="inline-flex items-center gap-1 text-green-700">
                  <Check className="w-3 h-3" />
                  ok
                </span>
              )}
              {u.status === 'error' && (
                <span className="inline-flex items-center gap-1 text-red-700" title={u.message}>
                  <AlertTriangle className="w-3 h-3" />
                  err
                </span>
              )}
              <button
                onClick={() => setUploads(prev => prev.filter(x => x.id !== u.id))}
                className="text-neutral-400 hover:text-neutral-700"
                aria-label="dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="text-center text-xs text-neutral-400 uppercase tracking-wide">{t.or}</div>

      <div className="space-y-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder={t.pasteUrl}
          className="w-full px-3 py-2 text-sm rounded border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
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

      {error && (
        <div className="rounded bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">
          {t.error}: {error}
        </div>
      )}

      {TURNSTILE_SITE_KEY && (
        <div ref={turnstileContainerRef} className="flex justify-center" />
      )}

      <div className="text-[11px] text-neutral-500 text-center">
        Stash: <code className="bg-neutral-100 px-1 rounded">{STASH_SERVER.replace(/^https?:\/\//, '')}</code>
      </div>
    </div>
  );
}
