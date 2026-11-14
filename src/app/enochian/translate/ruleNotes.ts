import type { RuleId } from "./toEnochian.ts";

/**
 * The grammar notes a rule chip opens (plan 081, decision 18): each
 * note's title, text and sources from `grammar.md` in `magick-data`, our
 * own words. Only the notes the lookup can name are sent to the page.
 */

/**
 * Every grammar note the lookup names: the chips of English into
 * Enochian (G4, G5, G16; G13, G14, G33, G34 for "to be" and negation; G21
 * and G22 for pronouns and possessives) and the join rule's splits (G26,
 * G27, G30, G22). `ruleNotes.test.ts` checks this against the lookup's
 * source.
 */
export const LOOKUP_RULES = [
  "G4",
  "G5",
  "G13",
  "G14",
  "G16",
  "G21",
  "G22",
  "G26",
  "G27",
  "G30",
  "G33",
  "G34",
] as const satisfies readonly RuleId[];

/** One grammar note, as a chip's popover shows it. */
export interface RuleNote {
  id: RuleId;
  /** The heading after its number ("There are no articles"). */
  title: string;
  /** Its paragraph, as plain text. */
  text: string;
  /** Each source the note cites, as written. */
  sources: readonly string[];
}

/** The notes by number. */
export type RuleNotes = Readonly<Partial<Record<RuleId, RuleNote>>>;

/**
 * Markdown's emphasis and code marks taken out, so the text shows as
 * written; it is rendered as plain text, never as HTML.
 */
const plain = (text: string) => text.replace(/[*_`]+/g, "").trim();

/**
 * Parses `grammar.md`'s notes: each a `### Gn. Title` heading, its
 * paragraph, then `- Sources:`, `- Evidence:`, `- Expert:` and
 * `- Example:` lines, of which only the sources are kept. Returns the
 * notes asked for, in that order; a note the file lacks is left out.
 */
export function parseRuleNotes(
  markdown: string,
  ids: readonly RuleId[] = LOOKUP_RULES,
): RuleNotes {
  const all = new Map<string, RuleNote>();
  let note: { id: RuleId; title: string; lines: string[] } | undefined;
  const finish = () => {
    if (!note) return;
    const text = note.lines.filter((line) => !line.startsWith("- ")).join(" ");
    const sources = note.lines
      .filter((line) => line.startsWith("- Sources:"))
      .flatMap((line) => line.slice("- Sources:".length).split(";"))
      .map(plain)
      .filter(Boolean);
    all.set(note.id, {
      id: note.id,
      title: plain(note.title),
      text: plain(text),
      sources,
    });
    note = undefined;
  };
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^### (G\d+)\. (.+)$/);
    if (heading) {
      finish();
      note = { id: heading[1] as RuleId, title: heading[2], lines: [] };
    } else if (line.startsWith("#")) finish();
    else if (note && line.trim()) note.lines.push(line.trim());
  }
  finish();
  const out: Partial<Record<RuleId, RuleNote>> = {};
  for (const id of ids) {
    const found = all.get(id);
    if (found) out[id] = found;
  }
  return out;
}
