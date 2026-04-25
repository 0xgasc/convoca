'use client';

import { useState } from 'react';
import { Mail, X, Loader2 } from 'lucide-react';

interface SignInModalProps {
  sessionId: string;
  initialEmail?: string;
  initialName?: string;
  language?: 'en' | 'es';
  reason?: string;
  onClose: () => void;
  onVerified: (info: { email: string; mode: 'auto' | 'magic_link' }) => void;
}

const COPY = {
  en: {
    title: 'Sign in to continue',
    blurb: 'Required so flags and comments are tied to a real person, not a bot.',
    email: 'Email',
    name: 'Display name (shown publicly, optional)',
    button: 'Continue',
    sending: 'Sending…',
    sentTitle: 'Check your inbox',
    sentBody: (e: string) => `We sent a sign-in link to ${e}. Click it and come back to this tab.`,
    autoTitle: 'Signed in',
    autoBody: (e: string) => `You can flag and comment as ${e}. (Add RESEND_API_KEY in Railway to upgrade to a real magic link.)`,
    error: 'Something went wrong',
    close: 'Close',
  },
  es: {
    title: 'Iniciá sesión para continuar',
    blurb: 'Requerido para que los avisos y comentarios queden ligados a una persona real, no a un bot.',
    email: 'Correo',
    name: 'Nombre para mostrar (público, opcional)',
    button: 'Continuar',
    sending: 'Enviando…',
    sentTitle: 'Revisá tu bandeja',
    sentBody: (e: string) => `Mandamos un enlace de inicio de sesión a ${e}. Tocalo y volvé a esta pestaña.`,
    autoTitle: 'Sesión iniciada',
    autoBody: (e: string) => `Podés reportar y comentar como ${e}. (Agregá RESEND_API_KEY en Railway para activar el enlace mágico real.)`,
    error: 'Algo salió mal',
    close: 'Cerrar',
  },
};

export function SignInModal({ sessionId, initialEmail, initialName, language = 'en', reason, onClose, onVerified }: SignInModalProps) {
  const t = COPY[language];
  const [email, setEmail] = useState(initialEmail ?? '');
  const [name, setName] = useState(initialName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; mode: 'auto' | 'magic_link' } | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, email, display_name: name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDone({ email, mode: json.mode });
      if (json.mode === 'auto') {
        // immediate
        onVerified({ email, mode: 'auto' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-neutral-700" />
            <h2 className="text-lg font-semibold text-neutral-900">{t.title}</h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {reason && <p className="text-xs text-neutral-500 mb-2">{reason}</p>}
        <p className="text-sm text-neutral-600 mb-3">{t.blurb}</p>

        {done ? (
          <div className="rounded bg-green-50 border border-green-200 p-3 text-sm text-green-900">
            <div className="font-medium mb-1">
              {done.mode === 'auto' ? t.autoTitle : t.sentTitle}
            </div>
            <div className="text-green-800">
              {done.mode === 'auto' ? t.autoBody(done.email) : t.sentBody(done.email)}
            </div>
            <button
              onClick={onClose}
              className="mt-3 text-xs font-medium text-green-900 underline"
            >
              {t.close}
            </button>
          </div>
        ) : (
          <form
            onSubmit={e => { e.preventDefault(); void submit(); }}
            className="space-y-3"
          >
            <label className="block">
              <span className="text-xs text-neutral-600 uppercase tracking-wide">{t.email}</span>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.org"
                className="mt-1 w-full px-3 py-2 text-sm rounded border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-600 uppercase tracking-wide">{t.name}</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={60}
                className="mt-1 w-full px-3 py-2 text-sm rounded border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
            {error && <div className="rounded bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">{t.error}: {error}</div>}
            <button
              type="submit"
              disabled={busy || !email}
              className="w-full px-4 py-2 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy ? t.sending : t.button}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
