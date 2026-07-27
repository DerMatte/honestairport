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

  const style =
    delay > 0
      ? ({ "--flap-delay": `${delay}ms` } as CSSProperties)
      : undefined;

  return (
    <span
      className={cn("split-flap-text", className)}
      data-tone={tone}
      aria-label={label || undefined}
      style={style}
    >
      {characters.map((character, index) => {
        const isBlank = character === " ";

        return (
          <span
            key={index}
            aria-hidden="true"
            className="split-flap-char"
            data-char={character}
            {...(isBlank
              ? {}
              : { "data-prev": previousFlapCharacter(character) })}
          >
            {isBlank ? null : character}
          </span>
        );
      })}
    </span>
  );
});
