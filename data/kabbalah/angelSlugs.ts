import angels from "./SeventyTwoAngels";

/**
 * A URL for each of the seventy-two genii.
 *
 * The slug is the name, because the name is what anyone searches for: nobody
 * looks up "the 11th genius of the Shem HaMephorash", they look up Vehuiah.
 * Two do share a name — Lauviah is both the 11th and the 17th — and only those
 * two carry their number, on the principle that a URL should disambiguate what
 * is ambiguous and nothing else.
 *
 * These are permalinks, so the uniqueness is a test rather than a hope. See
 * plan 033's follow-ups.
 */

function base(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const counts = new Map<string, number>();
for (const angel of angels)
  counts.set(base(angel.name.en), (counts.get(base(angel.name.en)) ?? 0) + 1);

/** The slug for one genius: its name, and its number only where it must. */
export function angelSlug(no: number): string {
  const angel = angels[no - 1];
  const stem = base(angel.name.en);
  return (counts.get(stem) ?? 0) > 1 ? `${stem}-${no}` : stem;
}

const bySlug = new Map(angels.map((angel) => [angelSlug(angel.no), angel.no]));

/** The genius a slug names, or undefined. */
export function angelBySlug(slug: string) {
  const no = bySlug.get(slug);
  return no === undefined ? undefined : angels[no - 1];
}

export function angelSlugs() {
  return angels.map((angel) => angelSlug(angel.no));
}
