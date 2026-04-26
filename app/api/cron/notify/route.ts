// /api/cron/notify — daily notification runner.
// Called from instrumentation.ts at ~8 AM local time.
// Secured with CRON_SECRET header to prevent external triggers.
//
// Runs two jobs:
//  1. Event reminders — users who saved events happening tomorrow
//  2. Weekly digest  — every Monday, new events matching cause_prefs

import { prisma } from '@/lib/db';
import { sendEventReminder, sendWeeklyDigest, sendElectionAlert } from '@/lib/email';
import { CAUSE_DISPLAY } from '@/lib/constants';
import type { EventSummary } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET ?? 'dev-cron-secret';

function toEventSummary(e: {
  id: string; title: string; event_type: string;
  datetime_iso: Date | null; datetime_text_raw: string | null;
  location_text: string | null; organizer: string | null;
  signup_url: string | null; cause_tags: string[];
}): EventSummary {
  return {
    id: e.id, title: e.title, event_type: e.event_type,
    datetime_iso: e.datetime_iso?.toISOString() ?? null,
    datetime_text_raw: e.datetime_text_raw,
    location_text: e.location_text, organizer: e.organizer,
    signup_url: e.signup_url, cause_tags: e.cause_tags,
  };
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== CRON_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const isMonday = now.getDay() === 1;
  const results = { reminders: 0, digests: 0, election_alerts: 0, errors: 0 };

  // ── 1. Event reminders ────────────────────────────────────────────────────
  // Find events happening in the next 20-28 hours (tomorrow window)
  const reminderStart = new Date(now.getTime() + 20 * 60 * 60 * 1000);
  const reminderEnd   = new Date(now.getTime() + 28 * 60 * 60 * 1000);

  const tomorrowSaves = await prisma.eventSave.findMany({
    where: {
      event: { datetime_iso: { gte: reminderStart, lte: reminderEnd }, status: 'upcoming' },
      session: { email: { not: null }, verified_at: { not: null }, notify_reminders: true },
    },
    include: {
      event: {
        select: {
          id: true, title: true, event_type: true, cause_tags: true,
          datetime_iso: true, datetime_text_raw: true,
          location_text: true, organizer: true, signup_url: true,
        },
      },
      session: { select: { email: true, display_name: true, language: true } },
    },
  });

  for (const save of tomorrowSaves) {
    if (!save.session.email) continue;
    try {
      await sendEventReminder({
        to: save.session.email,
        displayName: save.session.display_name,
        event: toEventSummary(save.event),
        language: (save.session.language as 'en' | 'es') ?? 'en',
      });
      results.reminders++;
    } catch (err) {
      console.error('[notify] reminder failed', save.session.email, err);
      results.errors++;
    }
  }

  // ── 2. Weekly digest (Mondays only) ──────────────────────────────────────
  if (isMonday) {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const digestUsers = await prisma.userSession.findMany({
      where: {
        email: { not: null },
        verified_at: { not: null },
        notify_digest: true,
        OR: [
          { last_digest_sent_at: null },
          { last_digest_sent_at: { lt: sevenDaysAgo } },
        ],
      },
      select: {
        id: true, email: true, display_name: true, language: true,
        city_slug: true, cause_prefs: true, last_digest_sent_at: true,
      },
    });

    for (const user of digestUsers) {
      if (!user.email) continue;
      const city = user.city_slug ?? 'nyc';
      const causes = user.cause_prefs ?? [];

      // Find events created in the last 7 days matching their causes
      const newEvents = await prisma.event.findMany({
        where: {
          city_slug: city,
          created_at: { gte: sevenDaysAgo },
          status: 'upcoming',
          datetime_iso: { gte: now },
          ...(causes.length > 0 ? { cause_tags: { hasSome: causes } } : {}),
        },
        orderBy: { datetime_iso: 'asc' },
        take: 8,
        select: {
          id: true, title: true, event_type: true, cause_tags: true,
          datetime_iso: true, datetime_text_raw: true,
          location_text: true, organizer: true, signup_url: true,
        },
      });

      if (newEvents.length === 0) continue;

      const causeLabels = causes
        .map(c => CAUSE_DISPLAY[c])
        .filter(Boolean)
        .map(m => (user.language === 'es' ? m.label_es : m.label_en));

      try {
        await sendWeeklyDigest({
          to: user.email,
          displayName: user.display_name,
          events: newEvents.map(toEventSummary),
          causeLabels,
          city,
          language: (user.language as 'en' | 'es') ?? 'en',
        });
        await prisma.userSession.update({
          where: { id: user.id },
          data: { last_digest_sent_at: now },
        });
        results.digests++;
      } catch (err) {
        console.error('[notify] digest failed', user.email, err);
        results.errors++;
      }
    }
  }

  // ── 3. Election alerts (7 days out + 1 day out) ───────────────────────────
  const electionWindows = [
    { daysOut: 7, start: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 - 2 * 3600 * 1000), end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 2 * 3600 * 1000) },
    { daysOut: 1, start: new Date(now.getTime() + 20 * 3600 * 1000),                            end: new Date(now.getTime() + 28 * 3600 * 1000) },
  ];

  for (const win of electionWindows) {
    const electionEvents = await prisma.event.findMany({
      where: {
        cause_tags: { has: 'voting_rights' },
        event_type: { in: ['town_hall', 'community_meeting', 'other'] },
        datetime_iso: { gte: win.start, lte: win.end },
        status: 'upcoming',
      },
      select: {
        id: true, title: true, event_type: true, cause_tags: true,
        datetime_iso: true, datetime_text_raw: true,
        location_text: true, organizer: true, signup_url: true,
        city_slug: true,
      },
    });

    for (const elEv of electionEvents) {
      const city = elEv.city_slug ?? 'nyc';

      // Related events: voting_rights in the same city within 3 days either side
      const related = await prisma.event.findMany({
        where: {
          city_slug: city,
          cause_tags: { has: 'voting_rights' },
          id: { not: elEv.id },
          datetime_iso: { gte: now },
          status: 'upcoming',
        },
        orderBy: { datetime_iso: 'asc' },
        take: 4,
        select: {
          id: true, title: true, event_type: true, cause_tags: true,
          datetime_iso: true, datetime_text_raw: true,
          location_text: true, organizer: true, signup_url: true,
        },
      });

      const alertUsers = await prisma.userSession.findMany({
        where: {
          email: { not: null },
          verified_at: { not: null },
          notify_digest: true,
          city_slug: city,
        },
        select: { email: true, display_name: true, language: true },
      });

      for (const user of alertUsers) {
        if (!user.email) continue;
        try {
          await sendElectionAlert({
            to: user.email,
            displayName: user.display_name,
            electionEvent: toEventSummary(elEv),
            relatedEvents: related.map(toEventSummary),
            daysUntil: win.daysOut,
            city,
            language: (user.language as 'en' | 'es') ?? 'en',
          });
          results.election_alerts++;
        } catch (err) {
          console.error('[notify] election alert failed', user.email, err);
          results.errors++;
        }
      }
    }
  }

  console.log('[notify] done', results);
  return Response.json({ ok: true, ...results });
}
