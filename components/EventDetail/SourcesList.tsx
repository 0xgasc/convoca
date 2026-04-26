'use client';

interface SourceJoin {
  raw_post_id: string;
  raw_posts: {
    id: string;
    url: string | null;
    posted_at: string | null;
    text_content: string | null;
    image_urls: string[];
    source_id: string;
    sources: {
      id: string;
      display_name: string;
      ingest_method: string;
      source_url: string | null;
    };
  };
}

interface SourcesListProps {
  sources: SourceJoin[];
  language?: 'en' | 'es';
}

const METHOD_LABEL: Record<string, string> = {
  rss: 'RSS feed',
  ics: 'Calendar',
  mobilize_api: 'Mobilize',
  action_network_rss: 'Action Network',
  telegram_public: 'Telegram',
  eventbrite_api: 'Eventbrite',
  nyc_open_data: 'NYC Open Data',
  legistar_api: 'NYC Council',
  website_scrape: 'Website',
  submission: 'Community submission',
};

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function SourcesList({ sources, language = 'en' }: SourcesListProps) {
  const headline = language === 'es' ? 'Encontrado en' : 'Found across';
  const sourcesWord = language === 'es' ? 'fuente' : 'source';

  if (sources.length === 0) {
    return (
      <div className="text-sm text-neutral-500 italic">
        {language === 'es' ? 'Sin fuentes registradas.' : 'No source records yet.'}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-xs uppercase tracking-wide text-neutral-500">{headline}</span>
        <span className="text-sm text-neutral-900 font-medium">
          {sources.length} {sourcesWord}{sources.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="space-y-2">
        {sources.map(s => {
          const methodLabel = METHOD_LABEL[s.raw_posts.sources.ingest_method] ?? s.raw_posts.sources.ingest_method;
          const cleanText = s.raw_posts.text_content ? stripHtml(s.raw_posts.text_content) : null;
          return (
            <li key={s.raw_post_id} className="border-l-2 border-neutral-200 pl-3 py-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-neutral-900">{s.raw_posts.sources.display_name}</span>
                <span className="text-[10px] text-neutral-400 flex-shrink-0">{methodLabel}</span>
              </div>
              {cleanText && cleanText.length > 10 && (
                <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">{cleanText}</p>
              )}
              <div className="flex gap-3 mt-1 text-[11px] text-neutral-400">
                {s.raw_posts.posted_at && (
                  <span>{new Date(s.raw_posts.posted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                )}
                {s.raw_posts.url && (
                  <a href={s.raw_posts.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {language === 'es' ? 'Ver original' : 'View original'}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
