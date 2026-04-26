'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';

interface SaveButtonProps {
  sessionId: string;
  eventId: string;
  language?: 'en' | 'es';
  onChange?: (saved: boolean) => void;
}

export function SaveButton({ sessionId, eventId, language = 'en', onChange }: SaveButtonProps) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/saves?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const json = await res.json();
      const found = (json.saves ?? []).some((s: { event_id: string }) => s.event_id === eventId);
      setSaved(found);
    } catch { /* ignore */ }
  }, [sessionId, eventId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggle = async () => {
    setBusy(true);
    try {
      if (saved) {
        await fetch(`/api/saves/${eventId}?sessionId=${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
        setSaved(false);
        onChange?.(false);
      } else {
        await fetch('/api/saves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, eventId, status: 'saved' }),
        });
        setSaved(true);
        onChange?.(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const Icon = saved ? BookmarkCheck : Bookmark;
  const label = saved
    ? (language === 'es' ? 'Guardado' : 'Saved')
    : (language === 'es' ? 'Guardar' : 'Save');

  return (
    <button
      onClick={() => void toggle()}
      disabled={busy || saved === null}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors ${
        saved
          ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
          : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
      }`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      <span>{label}</span>
    </button>
  );
}
