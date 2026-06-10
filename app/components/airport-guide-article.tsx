import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AirportGuideArticleProps {
  /** Markdown body of the guide (without frontmatter). */
  content: string;
}

/** Drop the leading H1 — the page renders its own heading. */
function stripLeadingHeading(content: string): string {
  return content.replace(/^#\s+.+\n/, "").trim();
}

export function AirportGuideArticle({ content }: AirportGuideArticleProps) {
  return (
    <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:tracking-tight prose-a:text-primary">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {stripLeadingHeading(content)}
      </ReactMarkdown>
    </article>
  );
}
