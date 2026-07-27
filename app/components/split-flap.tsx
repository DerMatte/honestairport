import { cn } from "@/lib/utils";

const FLAP_BLANK = "█";

interface SplitFlapProps {
  /** The real, final string — always rendered as-is, so SEO/no-JS see plain text. */
  value: string;
  className?: string;
  /** Applied to every character tile (e.g. sizing, weight). */
  charClassName?: string;
  /** Milliseconds between each tile's flap, for the left-to-right ripple. */
  stagger?: number;
}

/**
 * A split-flap (Solari) board character readout. Each tile's own text node
 * IS the accessible/crawlable content — the flap-down reveal is a purely
 * decorative `::before` layer (see .split-flap-char in globals.css) driven
 * by CSS alone, so it plays with zero JS, degrades to plain text with zero
 * layout shift, and needs no client component or mount effect.
 *
 * Reserved for short, code-like values — IATA codes, scores, status words,
 * board rows — never body copy or guide prose.
 */
export function SplitFlap({
  value,
  className,
  charClassName,
  stagger = 45,
}: SplitFlapProps) {
  const characters = Array.from(value);

  return (
    <span
      role="text"
      aria-label={value}
      className={cn("board-flap-group inline-flex", className)}
    >
      {characters.map((char, index) => {
        if (char === " ") {
          return (
            <span key={index} aria-hidden="true" className="inline-block w-[0.55ch]" />
          );
        }

        return (
          <span
            key={index}
            aria-hidden="true"
            data-flap-prev={FLAP_BLANK}
            className={cn(
              "split-flap-char mx-px w-[1ch] tabular-nums",
              charClassName,
            )}
            style={{ "--flap-delay": `${index * stagger}ms` } as React.CSSProperties}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}
