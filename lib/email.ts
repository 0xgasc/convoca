// lib/email.ts — Resend email sending helpers for Convoca notifications.

import { Resend } from 'resend';

const FROM = process.env.RESEND_FROM ?? 'Convoca <notifications@convoca.app>';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://convoca.app';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

export interface EventSummary {
  id: string;
  title: string;
  datetime_iso: string | null;
  datetime_text_raw: string | null;
  location_text: string | null;
  organizer: string | null;
  signup_url: string | null;
  event_type: string;
  cause_tags: string[];
}

function formatDate(iso: string | null, raw: string | null): string {
  if (iso) {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }
  return raw ?? 'Date TBD';
}

function eventUrl(id: string): string {
  return `${BASE_URL}/?event=${id}`;
}

// ─── Event reminder (24h before) ──────────────────────────────────────────────

export async function sendEventReminder(opts: {
  to: string;
  displayName: string | null;
  event: EventSummary;
  language?: 'en' | 'es';
}) {
  const { to, displayName, event, language = 'en' } = opts;
  const name = displayName ?? 'there';
  const es = language === 'es';
  const dateStr = formatDate(event.datetime_iso, event.datetime_text_raw);

  const subject = es
    ? `Mañana: ${event.title}`
    : `Tomorrow: ${event.title}`;

  const text = es
    ? [
        `Hola ${name},`,
        '',
        `Solo un recordatorio de que mañana tienes guardado:`,
        '',
        `📌 ${event.title}`,
        event.location_text ? `📍 ${event.location_text}` : '',
        `🗓 ${dateStr}`,
        event.organizer ? `👥 ${event.organizer}` : '',
        '',
        event.signup_url ? `Regístrate: ${event.signup_url}` : '',
        `Ver en Convoca: ${eventUrl(event.id)}`,
        '',
        '—',
        'Convoca · descubriendo lo cívico para ti',
        `Para no recibir recordatorios: ${BASE_URL}/unsubscribe`,
      ].filter(l => l !== undefined && !(l === '' && !event.organizer && !event.signup_url)).join('\n')
    : [
        `Hi ${name},`,
        '',
        `Just a heads-up — you saved this event and it's happening tomorrow:`,
        '',
        `📌 ${event.title}`,
        event.location_text ? `📍 ${event.location_text}` : '',
        `🗓 ${dateStr}`,
        event.organizer ? `👥 Organized by ${event.organizer}` : '',
        '',
        event.signup_url ? `RSVP / sign up: ${event.signup_url}` : '',
        `View on Convoca: ${eventUrl(event.id)}`,
        '',
        '—',
        'Convoca · AI-powered civic discovery',
        `Stop reminders: ${BASE_URL}/unsubscribe`,
      ].filter(Boolean).join('\n');

  await getResend().emails.send({ from: FROM, to, subject, text });
}

// ─── Weekly digest ─────────────────────────────────────────────────────────────

export async function sendWeeklyDigest(opts: {
  to: string;
  displayName: string | null;
  events: EventSummary[];
  causeLabels: string[];
  city: string;
  language?: 'en' | 'es';
}) {
  const { to, displayName, events, causeLabels, city, language = 'en' } = opts;
  const name = displayName ?? 'there';
  const es = language === 'es';
  const cityLabel = city === 'guatemala_city' ? 'Guatemala City' : 'NYC';

  const subject = es
    ? `${events.length} eventos esta semana en ${cityLabel}`
    : `${events.length} civic events this week in ${cityLabel}`;

  const eventLines = events.slice(0, 8).map(ev => {
    const dateStr = formatDate(ev.datetime_iso, ev.datetime_text_raw);
    const lines = [
      `▸ ${ev.title}`,
      `  ${dateStr}`,
      ev.location_text ? `  ${ev.location_text}` : '',
      `  ${eventUrl(ev.id)}`,
    ].filter(Boolean);
    return lines.join('\n');
  }).join('\n\n');

  const causeLine = causeLabels.length > 0
    ? (es ? `Basado en tus intereses: ${causeLabels.join(', ')}`
           : `Based on your interests: ${causeLabels.join(', ')}`)
    : '';

  const text = es
    ? [
        `Hola ${name},`,
        '',
        `El agente de Convoca encontró ${events.length} eventos esta semana en ${cityLabel}${causeLine ? ' relacionados con tus causas' : ''}:`,
        causeLine,
        '',
        eventLines,
        '',
        `Ver todos: ${BASE_URL}`,
        '',
        '—',
        'Convoca · descubriendo lo cívico para ti',
        `Cancelar suscripción: ${BASE_URL}/unsubscribe`,
      ].filter(l => l !== null).join('\n')
    : [
        `Hi ${name},`,
        '',
        `Convoca's agent found ${events.length} civic events this week in ${cityLabel}${causeLine ? ' matching your interests' : ''}:`,
        causeLine,
        '',
        eventLines,
        '',
        `See all events: ${BASE_URL}`,
        '',
        '—',
        'Convoca · AI-powered civic discovery',
        `Unsubscribe: ${BASE_URL}/unsubscribe`,
      ].filter(Boolean).join('\n');

  await getResend().emails.send({ from: FROM, to, subject, text });
}

// ─── Election alert ─────────────────────────────────────────────────────────────

export async function sendElectionAlert(opts: {
  to: string;
  displayName: string | null;
  electionEvent: EventSummary;
  relatedEvents: EventSummary[];
  daysUntil: number;
  city: string;
  language?: 'en' | 'es';
}) {
  const { to, displayName, electionEvent, relatedEvents, daysUntil, city, language = 'en' } = opts;
  const name = displayName ?? 'there';
  const es = language === 'es';
  const cityLabel = city === 'guatemala_city' ? 'Guatemala City' : 'NYC';

  const subject = es
    ? `Elecciones en ${daysUntil === 1 ? 'mañana' : `${daysUntil} días`} — ${cityLabel}`
    : `Election ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`} — ${cityLabel}`;

  const relatedLines = relatedEvents.slice(0, 4).map(ev => {
    const dateStr = formatDate(ev.datetime_iso, ev.datetime_text_raw);
    return [`▸ ${ev.title}`, `  ${dateStr}`, `  ${eventUrl(ev.id)}`].join('\n');
  }).join('\n\n');

  const text = es
    ? [
        `Hola ${name},`,
        '',
        `Recordatorio: ${electionEvent.title} es en ${daysUntil === 1 ? 'mañana' : `${daysUntil} días`}.`,
        formatDate(electionEvent.datetime_iso, electionEvent.datetime_text_raw),
        '',
        relatedEvents.length > 0 ? 'Eventos relacionados que encontró el agente:' : '',
        relatedEvents.length > 0 ? relatedLines : '',
        '',
        `Ver en Convoca: ${BASE_URL}`,
        '',
        '—',
        'Convoca',
        `Cancelar: ${BASE_URL}/unsubscribe`,
      ].filter(Boolean).join('\n')
    : [
        `Hi ${name},`,
        '',
        `Reminder: ${electionEvent.title} is ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}.`,
        formatDate(electionEvent.datetime_iso, electionEvent.datetime_text_raw),
        '',
        relatedEvents.length > 0 ? 'Related events the agent found nearby:' : '',
        relatedEvents.length > 0 ? relatedLines : '',
        '',
        `See everything on Convoca: ${BASE_URL}`,
        '',
        '—',
        'Convoca · AI-powered civic discovery',
        `Unsubscribe: ${BASE_URL}/unsubscribe`,
      ].filter(Boolean).join('\n');

  await getResend().emails.send({ from: FROM, to, subject, text });
}
