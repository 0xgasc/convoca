import Link from 'next/link';

export const metadata = {
  title: 'About — Convoca',
  description: 'Community-fed, agent-amplified. What Convoca ingests, what it never will, and why.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <article className="max-w-2xl mx-auto px-4 py-8 prose-sm">
        <Link href="/" className="text-sm text-blue-700 hover:underline">← Back to map</Link>

        <h1 className="mt-4 text-3xl font-semibold text-neutral-900">How Convoca works</h1>
        <p className="mt-1 text-sm text-neutral-500 italic">Community-fed, agent-amplified.</p>

        <section className="mt-6 space-y-4 text-neutral-800 text-[15px] leading-relaxed">
          <p>
            Civic and community life in cities like New York and Guatemala City generates a huge amount of organized
            IRL activity — protests, mutual aid distributions, town halls, volunteer cleanups, free public concerts,
            library readings, community board meetings, tenant union actions, food fridges, skill shares, vigils,
            block parties, teach-ins. The information about all of this exists. It&apos;s published by the people doing
            the work.
          </p>
          <p>
            But it lives in dozens of disconnected places: Instagram stories, Telegram groups, Eventbrite, Mobilize,
            Action Network, neighborhood listservs, RSS feeds, government calendars, physical flyers, the WhatsApp
            group your friend&apos;s cousin runs. People who actively care regularly miss things they would have shown
            up for. Convoca puts reasoning agents underneath that work.
          </p>
        </section>

        <h2 className="mt-10 text-xl font-semibold text-neutral-900">Three principles</h2>

        <Principle
          n={1}
          title="Consent-first ingestion"
          body={
            <>
              <p>Convoca pulls events only from sources that have already chosen to publish openly:</p>
              <ul className="mt-2 ml-5 list-disc space-y-1">
                <li><b>Public APIs</b> — Mobilize, Action Network, Eventbrite, NYC Open Data, NYC Council Legistar</li>
                <li><b>Open feeds</b> — RSS, ICS, Atom feeds published by orgs and city agencies</li>
                <li><b>Public Telegram channels</b> — explicitly designed to be public broadcasts</li>
                <li><b>Community submissions</b> — anything anyone hands us via <Link href="/submit" className="text-blue-700 hover:underline">/submit</Link></li>
              </ul>
              <p className="mt-3">
                We do not scrape Instagram, Facebook, or any logged-in platform. The path for IG-only content is a
                community member tapping &quot;Submit&quot; and handing us the URL or screenshot.
              </p>
            </>
          }
        />

        <Principle
          n={2}
          title="Agents do labor, not surveillance"
          body={
            <>
              <p>The agents in Convoca read flyers, dedupe events across sources, classify causes, and rank events. They will never:</p>
              <ol className="mt-2 ml-5 list-decimal space-y-1">
                <li>Profile users — no demographic inference, no political scoring, no advertising graph.</li>
                <li>Build attendance lists — we don&apos;t know who showed up to what.</li>
                <li>Derive social graphs — who organizes with whom isn&apos;t computed or stored.</li>
                <li>Store location history — your real-time position renders the map; it isn&apos;t retained.</li>
                <li>Link sessions to identities — the platform is session-based by design.</li>
              </ol>
            </>
          }
        />

        <Principle
          n={3}
          title="The community is the source"
          body={
            <p>
              The most powerful ingest channel in Convoca is one tap from a community member. Drag a flyer, paste a
              URL, type an announcement — the vision and parsing agents extract structured event data within seconds,
              dedupe against existing entries, and add it to the map. This puts agency in the right place: organizers
              and the people who care about their work are the source of truth, not a centralized scraper.
            </p>
          }
        />

        <h2 className="mt-10 text-xl font-semibold text-neutral-900">Open source</h2>
        <p className="mt-2 text-neutral-800 text-[15px] leading-relaxed">
          Convoca is open source. License: MIT, with AGPL on the safety/community-flagging modules under consideration.
          Anyone can run their own instance for their own city, add source adapters, translate the interface, or
          contribute to the agent prompts (which live in a single file, intentionally).
        </p>

        <p className="mt-8 text-xs text-neutral-500">
          The full ingestion philosophy is in the <code className="bg-neutral-200 px-1 rounded">INGESTION.md</code> file in the repo.
        </p>
      </article>
    </main>
  );
}

function Principle({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <section className="mt-6 border-l-2 border-neutral-300 pl-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">Principle {n}</div>
      <h3 className="text-lg font-semibold text-neutral-900 mt-1">{title}</h3>
      <div className="mt-2 text-neutral-800 text-[15px] leading-relaxed">{body}</div>
    </section>
  );
}
