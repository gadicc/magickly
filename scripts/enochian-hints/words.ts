/**
 * Which English words need a hint (plan 081, S11): those the lookup
 * shows as a gap. A word it gives a form for, or reads as an inflection
 * of one ("kings" as KING's, "came" as "come"), already has its answer;
 * so has a grammar word, which takes a rule chip or is a gap no meaning
 * fills ("could", "her").
 */
import {
  isContent,
  type Translator,
} from "../../src/app/enochian/translate/lookup.ts";

/**
 * Whether the lookup reads `word`, alone, as one content-word gap, and
 * as the same word (not one it modernises, such as "shew", whose gap the
 * page shows under "show").
 */
export function needsHint(translator: Translator, word: string): boolean {
  const { tokens } = translator.toEnochian(word);
  if (tokens.length !== 1) return false;
  const [token] = tokens;
  return (
    token.kind === "gap" &&
    token.words.length === 1 &&
    token.words[0] === word &&
    isContent(word)
  );
}

/** The words of `words` that need a hint, in their order. */
export function hintWords(
  translator: Translator,
  words: readonly string[],
): string[] {
  return words.filter((word) => needsHint(translator, word));
}
