'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Send, Loader2, ShieldAlert } from 'lucide-react';

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author: string;
}

interface EventCommentsProps {
  eventId: string;
  sessionId: string;
  isVerified: boolean;
  onRequestSignIn: () => void;
  language?: 'en' | 'es';
}

const COPY = {
  en: {
    title: 'Comments',
    sign_in_to_post: 'Sign in to post a comment.',
    placeholder: 'Add a comment...',
    post: 'Post',
    posting: 'Posting…',
    none: 'No comments yet. Be the first.',
    blocked: 'Comment blocked by Safety Review.',
    review: 'Comment sent for human review.',
  },
  es: {
    title: 'Comentarios',
    sign_in_to_post: 'Iniciá sesión para comentar.',
    placeholder: 'Agregá un comentario...',
    post: 'Enviar',
    posting: 'Enviando…',
    none: 'Aún no hay comentarios. Sé el primero.',
    blocked: 'Comentario bloqueado por la revisión.',
    review: 'Comentario enviado a revisión humana.',
  },
};

export function EventComments({ eventId, sessionId, isVerified, onRequestSignIn, language = 'en' }: EventCommentsProps) {
  const t = COPY[language];
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/comments`);
      if (!res.ok) return;
      const json = await res.json();
      setComments(json.comments ?? []);
    } catch { /* ignore */ }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!body.trim()) return;
    if (!isVerified) { onRequestSignIn(); return; }
    setBusy(true);
    setInfo(null);
    try {
      const res = await fetch(`/api/events/${eventId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify({ body: body.trim() }),
      });
      const json = await res.json();
      if (res.status === 401) { onRequestSignIn(); return; }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const decision = json.review?.decision;
      if (decision === 'approve') {
        setComments(prev => [json.comment, ...prev]);
      } else if (decision === 'block') {
        setInfo(t.blocked);
      } else {
        setInfo(t.review);
      }
      setBody('');
    } catch (err) {
      setInfo(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200">
        <MessageSquare className="w-4 h-4 text-neutral-700" />
        <h3 className="text-sm font-semibold text-neutral-900">{t.title}</h3>
        <span className="text-xs text-neutral-500">{comments.length}</span>
      </header>
      <div className="px-4 py-3 border-b border-neutral-200">
        {!isVerified && (
          <button
            type="button"
            onClick={onRequestSignIn}
            className="text-sm text-blue-700 hover:underline mb-2"
          >
            {t.sign_in_to_post}
          </button>
        )}
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={2}
          placeholder={t.placeholder}
          className="w-full px-3 py-2 text-sm rounded border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          maxLength={1000}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-neutral-500">{body.length}/1000</span>
          <button
            onClick={() => void submit()}
            disabled={busy || !body.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? t.posting : t.post}
          </button>
        </div>
        {info && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-800">
            <ShieldAlert className="w-3.5 h-3.5" /> {info}
          </div>
        )}
      </div>
      <ul className="divide-y divide-neutral-100">
        {comments.length === 0 && (
          <li className="px-4 py-6 text-sm text-neutral-500 italic">{t.none}</li>
        )}
        {comments.map(c => (
          <li key={c.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between text-xs text-neutral-500 mb-0.5">
              <span className="font-medium text-neutral-700">{c.author}</span>
              <span>{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <div className="text-sm text-neutral-900 whitespace-pre-wrap">{c.body}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
