/**
 * The dictionary's related words (plan 081, S11, step 2G): for an entry,
 * up to three of our other glosses close in meaning to its own, each with
 * the forms that open their entries. Built once, offline, by
 * `scripts/enochian-hints` (`related build`) from the gap hints' glosses
 * and their cached embeddings (`README.md` beside this file); the page
 * only reads it, so a related word costs no model call.
 */

/** The table's format; a change to the layout below bumps it. */
export const RELATED_TABLE_FORMAT = 1;

/**
 * A form a related gloss names, and the dictionary entry it opens: the
 * entry's key alone where the form is written as the key is.
 */
export type RelatedForm = string | readonly [form: string, entry: string];

/** A related gloss: its wording as a reader sees it, and its forms. */
export type RelatedGloss = readonly [
  gloss: string,
  forms: readonly RelatedForm[],
];

/** The committed table (`table.json`). */
export interface RelatedTable {
  format: number;
  /** The embedding model and recipe, as the cache keys them. */
  recipe: string;
  /** The z-score cut-off asked for. */
  asked: number;
  /** The cut-off the table was built at: `asked`, or higher for the budget. */
  cutoff: number | null;
  /**
   * SHA-256 of the glosses, their forms and the entries each belongs to,
   * and the recipe: a test fails when the dictionary or the Keys change
   * them.
   */
  glossHash: string;
  /** How many entries have related words. */
  entries: number;
  /** How many related words there are, over all entries. */
  items: number;
  /** Each gloss some entry shows, once, sorted by its wording. */
  glosses: readonly RelatedGloss[];
  /** Each entry's key to its related glosses (indices into `glosses`), best first. */
  related: Readonly<Record<string, readonly number[]>>;
}

/** A related word as the entry shows it. */
export interface RelatedItem {
  gloss: string;
  forms: readonly { form: string; entry: string }[];
}

/** Each entry's related words, by its key. */
export function relatedIndex(
  table: Pick<RelatedTable, "glosses" | "related">,
): Map<string, RelatedItem[]> {
  const items = table.glosses.map(
    ([gloss, forms]): RelatedItem => ({
      gloss,
      forms: forms.map((one) =>
        typeof one === "string"
          ? { form: one, entry: one }
          : { form: one[0], entry: one[1] },
      ),
    }),
  );
  const index = new Map<string, RelatedItem[]>();
  for (const [entry, list] of Object.entries(table.related))
    index.set(
      entry,
      list.flatMap((at) => (items[at] ? [items[at]] : [])),
    );
  return index;
}

/**
 * The table as committed: JSON with one gloss and one entry per line, so
 * a rebuild's diff shows which changed (the file is outside Biome's
 * formatter for that reason). The route serves it compact.
 */
export function relatedTableText(table: RelatedTable): string {
  const { glosses, related, ...head } = table;
  const fields = Object.entries(head)
    .map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`)
    .join(",");
  const lines = (list: readonly string[]) =>
    list.length ? `\n${list.join(",\n")}\n` : "";
  return `{${fields},"glosses":[${lines(glosses.map((one) => JSON.stringify(one)))}],"related":{${lines(
    Object.entries(related).map(
      ([entry, list]) => `${JSON.stringify(entry)}:${JSON.stringify(list)}`,
    ),
  )}}}\n`;
}
