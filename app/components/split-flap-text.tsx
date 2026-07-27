import { memo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

const FLAP_ALPHABET =
  " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-/+&'():";

interface SplitFlapTextProps {
  className?: string;
  delay?: number;
  length: number;
  text: string;
  tone?: "ivory" | "amber" | "blue" | "muted";
}

function previousFlapCharacter(character: string): string {
  const index = FLAP_ALPHABET.indexOf(character);
  if (index < 0) {
    return " ";
  }

  return FLAP_ALPHABET[(index - 1 + FLAP_ALPHABET.length) % FLAP_ALPHABET.length];
}

export const SplitFlapText = memo(function SplitFlapText({
  className,
  delay = 0,
  length,
  text,
  tone = "ivory",
}: SplitFlapTextProps) {
  const label = text.trim();
  const characters = text
    .toUpperCase()
    .slice(0, length)
    .padEnd(length, " ")
    .split("");

  return (
    <span
      className={cn("split-flap-text", className)}
      data-tone={tone}
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      {characters.map((character, index) => {
        const style = {
          "--flap-delay": `${delay + index * 22}ms`,
        } as CSSProperties;

        return (
          <span
            key={`${character}-${index}`}
            aria-hidden="true"
            className="split-flap-char"
            data-char={character}
            data-prev={previousFlapCharacter(character)}
            style={style}
          >
            <span className="split-flap-char__glyph">{character}</span>
          </span>
        );
      })}
    </span>
  );
});
