import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRuleNotes, type RuleNotes } from "./ruleNotes.ts";

/**
 * `grammar.md`, from the repository's root. The package doesn't export
 * it; the page is prerendered, so it is read once, at build time, and
 * only the page (a server component) imports this.
 */
export const GRAMMAR_FILE = "packages/magick-data/src/enochian/grammar.md";

/** The notes the lookup names, read from `grammar.md` (see `ruleNotes.ts`). */
export function lookupRuleNotes(): RuleNotes {
  return parseRuleNotes(
    readFileSync(join(process.cwd(), GRAMMAR_FILE), "utf8"),
  );
}
