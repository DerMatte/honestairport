import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAirportContent, getAllAirportIatas } from "@/lib/airport-content";

interface AirportPageProps {
  params: Promise<{ iata: string }>;
}

export async function generateStaticParams() {
  const iatas = await getAllAirportIatas();
  return iatas.map((iata) => ({ iata: iata.toLowerCase() }));
}

export async function generateMetadata({ params }: AirportPageProps): Promise<Metadata> {
  const { iata } = await params;
  const data = await getAirportContent(iata);

  if (!data) {
    return {
      title: "Airport not found • TravelGuide",
    };
  }

  const { frontmatter } = data;

  return {
    title: `${frontmatter.name} (${frontmatter.iata}) • TravelGuide`,
    description: `Practical tips, security advice, and traveler tricks for ${frontmatter.name} in ${frontmatter.city}, ${frontmatter.country}.`,
  };
}

export default async function AirportPage({ params }: AirportPageProps) {
  const { iata } = await params;
  const data = await getAirportContent(iata);

  if (!data) {
    notFound();
  }

  const { frontmatter, content } = data;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <a href="/" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">← All airports</a>

        <div className="mt-3 flex items-baseline gap-3">
          <h1 className="text-4xl font-semibold tracking-tighter">{frontmatter.name}</h1>
          <span className="font-mono text-sm rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{frontmatter.iata}</span>
        </div>

        <p className="text-lg text-zinc-600 dark:text-zinc-400 mt-1">
          {frontmatter.city}, {frontmatter.country}
        </p>
        <p className="text-xs text-zinc-500 mt-1">Last updated: {frontmatter.lastUpdated}</p>
      </div>

      {frontmatter.quickFacts && frontmatter.quickFacts.length > 0 && (
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="font-semibold text-sm mb-2 tracking-wide">Quick Facts</div>
          <ul className="text-sm space-y-1 text-zinc-700 dark:text-zinc-300">
            {frontmatter.quickFacts.map((fact, idx) => (
              <li key={idx}>• {fact}</li>
            ))}
          </ul>
        </div>
      )}

      <article className="prose prose-zinc dark:prose-invert max-w-none prose-headings:tracking-tight prose-h2:mt-10 prose-h2:mb-4 prose-p:leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>

      {frontmatter.sources && frontmatter.sources.length > 0 && (
        <div className="mt-12 border-t pt-6 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="font-medium mb-1">Primary Sources</div>
          <ul className="space-y-0.5">
            {frontmatter.sources.map((src, i) => (
              <li key={i}>
                <a href={src} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
                  {src}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3">Always verify the latest rules directly with official sources before travel. Rules and procedures change.</p>
        </div>
      )}
    </div>
  );
}
