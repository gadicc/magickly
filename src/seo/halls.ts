import {
  describeHall,
  type HallDescription,
} from "@magick-components/gd/hall/describe";
import {
  type HallPreset,
  hallPreset,
} from "@magick-components/gd/hall/presets";
import {
  GD_HALLS,
  type GdHallEntry,
  gdHall,
  gdHallShortName,
  gdHallTitle,
} from "@/render/contracts/gdHall";
import type { EntityPage } from "./entities";

/**
 * The temple halls' search pages (plan 062): their paths, titles,
 * descriptions and alt text, generated from each preset in our own words.
 * The slugs, titles and file names are the image contract's
 * (`src/render/contracts/gdHall.ts`), the one place a slug is written.
 */

/** Where a hall's page is. */
export const hallPath = (hall: GdHallEntry) => `/gd/hall/${hall.slug}`;

const NUMBERS = ["", "", "two", "three", "four", "five", "six", "seven"];

const plural = (name: string) =>
  /(?:s|x|ch|sh)$/.test(name) ? `${name}es` : `${name}s`;

/**
 * Names in order with repeats counted: "red lamp", "red lamp", "cup" →
 * "two red lamps", "cup".
 */
export function counted(names: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) =>
    count === 1 ? name : `${NUMBERS[count] ?? count} ${plural(name)}`,
  );
}

/** "a, b and c". */
export function listed(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** A hall's preset and its description in parts. */
function partsOf(hall: GdHallEntry): {
  preset: HallPreset;
  description: HallDescription;
} {
  const preset = hallPreset(hall.preset) as HallPreset;
  return { preset, description: describeHall(preset.hall) };
}

/** The black altar's items, counted, or none. */
function altarItems(description: HallDescription): string[] {
  const altar = description.altars.find((entry) => entry.name === "altar");
  return counted(altar?.items ?? []);
}

/**
 * A name with its article where it takes one: "the cross", "the Devil",
 * "the Garden of Eden"; a trump's title ("the Universe (XXI)"), a count
 * ("three red lamps") and a proper name (Pan, Death, Typhon) as they are.
 */
export function withArticle(name: string): string {
  // A trump's title keeps its own words, "the" in lower case mid-sentence:
  // "the Tower (XVI)", "Judgement (XX)".
  if (/\([IVXL]+\)$/.test(name))
    return name.startsWith("The ") ? `the ${name.slice(4)}` : name;
  if (/^(?:two|three|four|five|six|seven|\d)\b/.test(name)) return name;
  if (/^(?:Pan|Death|Typhon)$/.test(name)) return name;
  if (name.startsWith("The ")) return `the ${name.slice(4)}`;
  return `the ${name}`;
}

/** The Enochian tablets a hall shows, in words. */
function tabletPhrase(description: HallDescription): string[] {
  const shown = description.furniture
    .map((entry) => entry.name)
    .filter((name) => /tablet|Tablet of Union/.test(name));
  if (shown.length <= 1) return shown.map(withArticle);
  return [`the ${NUMBERS[shown.length] ?? shown.length} Enochian tablets`];
}

/** What stands in a hall that few halls have, in words. */
function features(description: HallDescription): string[] {
  const names = description.furniture.map((entry) => entry.name);
  const cards = ["Pan", "The Devil", "Death", "Typhon"].filter((card) =>
    names.includes(card),
  );
  return [
    ...names
      .filter((name) =>
        /^(?:Table of Shewbread|Seven-Branched Candlestick|The Garden of Eden|The Fall|The Flaming Sword|Minutum Mundum|kamea of )/.test(
          name,
        ),
      )
      .map(withArticle),
    ...(cards.length === 4
      ? ["the four emblem cards"]
      : cards.map(withArticle)),
  ];
}

const MAX_ALT = 250;

/**
 * The image's alt text: the hall, its orientation, the officers by name
 * and what is on the altar, at most 250 characters (the stations are in
 * the page's text, which the figure points at). Lists shorten to fit.
 */
export function hallAlt(
  hall: GdHallEntry,
  description: HallDescription = partsOf(hall).description,
): string {
  const head = `Floor plan of the Golden Dawn ${gdHallShortName(hall)}, East at the top`;
  // The three Chiefs by their title, which the dais's long names would
  // otherwise crowd out of the text.
  const names = description.officers.map((entry) => entry.name);
  const chiefs = ["Imperator", "Cancellarius", "Praemonstrator"];
  const officers = chiefs.every((chief) => names.includes(chief))
    ? [...names.filter((name) => !chiefs.includes(name)), "the three Chiefs"]
    : names;
  const items = altarItems(description);
  const versions = [
    [officers, items],
    [officers, items.slice(0, 3)],
    [officers, []],
  ] as const;
  for (const [who, what] of versions) {
    const text =
      head +
      (who.length ? `, with the ${listed(who)}` : "") +
      (what.length ? `; on the altar ${listed(what.map(withArticle))}` : "") +
      ".";
    if (text.length <= MAX_ALT) return text;
  }
  return `${head}, with ${NUMBERS[officers.length] ?? officers.length} officers.`;
}

const MAX_DESCRIPTION = 160;

/**
 * The search description, at most 160 characters and unique: what the
 * plan shows, what tells this hall from its neighbours (the altar's trump,
 * the tablets) where it fits, the source and the licence.
 */
export function hallDescription(
  hall: GdHallEntry,
  description: HallDescription = partsOf(hall).description,
): string {
  const number = hall.number ? ` (${hall.number})` : "";
  const head = `Floor plan of the Golden Dawn ${gdHallShortName(hall)}${number}: the officers' stations`;
  const trump = altarItems(description).find((item) =>
    /\([IVXL]+\)$/.test(item),
  );
  const tail = ", after Regardie (1938). CC BY 4.0.";
  // The altar (with its trump), then what this hall has that few others
  // do, as many as fit; then, for a hall with neither, the altar's first
  // two items, which alone read without a second "and".
  const fits = (parts: string[]) =>
    `${head}, ${listed(parts)}${tail}`.length <= MAX_DESCRIPTION;
  let parts = [trump ? `the altar with ${withArticle(trump)}` : "the altar"];
  for (const extra of [
    ...features(description),
    ...tabletPhrase(description),
  ]) {
    const tried = [...parts, extra];
    if (fits(tried)) parts = tried;
  }
  const items = altarItems(description);
  if (parts.length === 1 && !trump && items.length) {
    const fuller = [
      `the altar with ${listed(items.slice(0, 2).map(withArticle))}`,
    ];
    if (fits(fuller)) parts = fuller;
  }
  const text = `${head}, ${listed(parts)}${tail}`;
  return text.length <= MAX_DESCRIPTION ? text : `${head}${tail}`;
}

/** A hall's page as the sitemap and metadata see it. */
export function hallPage(slug: string): EntityPage | null {
  const hall = gdHall(slug);
  if (!hall) return null;
  return {
    path: hallPath(hall),
    title: gdHallTitle(hall),
    description: hallDescription(hall),
  };
}

/** Every hall's page, in the presets' order. */
export function hallPages(): EntityPage[] {
  return GD_HALLS.map((hall) => hallPage(hall.slug) as EntityPage);
}

/** The halls of a grade, by its `gdGrade` id: the grade page's links. */
export function gradeHalls(gradeId: string): GdHallEntry[] {
  return GD_HALLS.filter((hall) => hall.gradeId === gradeId);
}

/**
 * A hall's description for its page, worded: each officer's station, each
 * altar's items, and the rest of the hall.
 */
export function hallStations(hall: GdHallEntry) {
  const { description } = partsOf(hall);
  return {
    officers: description.officers,
    altars: description.altars.map((altar) => ({
      ...altar,
      items: counted(altar.items),
    })),
    furniture: description.furniture,
  };
}
