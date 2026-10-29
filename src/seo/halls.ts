import {
  describeHall,
  type HallDescription,
} from "@magick-components/gd/hall/describe";
import {
  HALL_SOURCE_WORKS,
  type HallPreset,
  hallPreset,
  hallSourceUrl,
} from "@magick-components/gd/hall/presets";
import type { Metadata } from "next";
import {
  GD_HALL_LICENCE,
  GD_HALLS,
  type GdHallEntry,
  type GdHallSize,
  gdHall,
  gdHallFileBase,
  gdHallPagePath,
  gdHallPixels,
  gdHallShortName,
  gdHallTitle,
} from "@/render/contracts/gdHall";
import { socialCardImage } from "./cards";
import type { EntityPage } from "./entities";
import { seoMetadata } from "./metadata";
import { PUBLIC_PAGES } from "./pages";
import { SITE_ORGANIZATION, SITE_URL } from "./site";

/**
 * The temple halls' search pages (plan 062): their paths, titles,
 * descriptions and alt text, generated from each preset in our own words.
 * The slugs, titles and file names are the image contract's
 * (`src/render/contracts/gdHall.ts`), the one place a slug is written.
 */

/** Where a hall's page is. */
export const hallPath = (hall: GdHallEntry) => gdHallPagePath(hall.slug);

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

/** One hall in a grade's group, with its card's label in two parts. */
export interface HallCard {
  hall: GdHallEntry;
  /** "Part 1", or "The hall" for a grade with one hall. */
  part: string;
  /** The path or place the hall stands for ("31st path", "In Hod"), if any. */
  place: string;
}

/** A grade's halls, in the presets' order. */
export interface HallGroup {
  /** "Practicus". */
  grade: string;
  /** "3=8"; empty for the Portal. */
  number: string;
  halls: HallCard[];
}

/**
 * The halls grouped by grade, with their cards' labels: what the index,
 * the hall pages' rail and their "Jump to hall" select all show (plan
 * 062's amendment), so the three read alike. A grade with one hall
 * labels it "The hall"; otherwise each is "Part N", with the path or
 * place its title names ("Part 1 · 31st path", "Part 2 · In Yesod").
 */
export function hallGroups(): HallGroup[] {
  const groups: HallGroup[] = [];
  for (const hall of GD_HALLS) {
    const group = groups.at(-1);
    if (group?.grade === hall.grade)
      group.halls.push({ hall, part: "", place: "" });
    else
      groups.push({
        grade: hall.grade,
        number: hall.number,
        halls: [{ hall, part: "", place: "" }],
      });
  }
  for (const group of groups)
    group.halls.forEach((card, i) => {
      card.part = group.halls.length === 1 ? "The hall" : `Part ${i + 1}`;
      // ", 32nd path" or " in Yesod" name a place; ", part 1" does not.
      const place = card.hall.part.replace(/^,? /, "");
      card.place = /^part \d+$/.test(place)
        ? ""
        : place.charAt(0).toUpperCase() + place.slice(1);
    });
  return groups;
}

/** "Part 1 · 31st path", "Part 1", "The hall": a card's label on one line. */
export const hallCardLabel = (card: HallCard) =>
  card.place ? `${card.part} · ${card.place}` : card.part;

/** "Practicus 3=8", "Portal": a group's heading as text. */
export const hallGroupName = (group: HallGroup) =>
  group.number ? `${group.grade} ${group.number}` : group.grade;

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

/** One of a hall's static image files. */
export interface HallFile {
  /** The file's name in the URL: `golden-dawn-zelator-1-temple-small.png`. */
  name: string;
  /** Its path on the site. */
  path: string;
  format: "png" | "svg";
  /** A PNG's smaller size; the full image when absent. */
  size?: GdHallSize;
  width: number;
  height: number;
  /** Whether search engines may index it: the full PNG and the SVG. */
  indexed: boolean;
}

/**
 * A hall's four static files under its page (plan 062, decision 3): the
 * full PNG, the medium and small PNGs, and the SVG.
 */
export function hallFiles(hall: GdHallEntry) {
  const base = gdHallFileBase(hall);
  const file = (
    name: string,
    format: "png" | "svg",
    size?: GdHallSize,
  ): HallFile => ({
    name,
    path: `${hallPath(hall)}/${name}`,
    format,
    ...(size && { size }),
    ...gdHallPixels({ hall: hall.slug as never, ...(size && { size }) }),
    indexed: !size,
  });
  return {
    png: file(`${base}.png`, "png"),
    medium: file(`${base}-medium.png`, "png", "medium"),
    small: file(`${base}-small.png`, "png", "small"),
    svg: file(`${base}.svg`, "svg"),
  };
}

/** Every hall's files, as the route prerenders them. */
export function allHallFiles(): { slug: string; file: HallFile }[] {
  return GD_HALLS.flatMap((hall) =>
    Object.values(hallFiles(hall)).map((file) => ({ slug: hall.slug, file })),
  );
}

/**
 * A hall page's structured data (plan 062, decision 10): the trail the app
 * bar shows, and an `ImageObject` for each indexable file, the PNG first,
 * each `contentUrl` exactly the URL the page shows it at.
 */
export function hallJsonLd(hall: GdHallEntry) {
  const { preset } = partsOf(hall);
  const files = hallFiles(hall);
  const page = `${SITE_URL}${hallPath(hall)}`;
  const L = GD_HALL_LICENCE;
  // Each cited page as its book, the page and leaf in its description.
  const books = preset.sources.flatMap((source) => {
    const work = HALL_SOURCE_WORKS[source.work];
    return [
      {
        "@type": "Book",
        name: `${work.book}, ${work.volume}`,
        author: { "@type": "Person", name: work.author },
        publisher: { "@type": "Organization", name: work.publisher },
        datePublished: String(work.year),
        description: `p.${source.page}, archive.org leaf n${source.leaf}${source.note ? ` (${source.note})` : ""}`,
        url: hallSourceUrl(source),
      },
    ];
  });
  const image = (file: HallFile, id: string) => ({
    "@type": "ImageObject",
    "@id": `${page}#${id}`,
    contentUrl: `${SITE_URL}${file.path}`,
    url: page,
    name: gdHallTitle(hall),
    caption: hallAlt(hall),
    encodingFormat: file.format === "png" ? "image/png" : "image/svg+xml",
    width: file.width,
    height: file.height,
    license: L.url,
    acquireLicensePage: L.acquireLicensePage,
    creator: SITE_ORGANIZATION,
    creditText: L.creditText,
    copyrightNotice: L.copyrightNotice,
    isBasedOn: books,
  });
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          ["Golden Dawn", `${SITE_URL}/gd`],
          ["Temple Halls", `${SITE_URL}/gd/halls`],
          [gdHallShortName(hall), page],
        ].map(([name, item], index) => ({
          "@type": "ListItem",
          position: index + 1,
          name,
          item,
        })),
      },
      {
        ...image(files.png, "png"),
        associatedMedia: { "@id": `${page}#svg` },
      },
      image(files.svg, "svg"),
    ],
  };
}

/**
 * A hall page's metadata: the canonical and snippet as every entity page
 * has them, and two Open Graph images, the site's card with the hall drawn
 * in it first, then the hall's own PNG (Gadi, 26 October 2026). No
 * `twitter` object, so the layout's large card stands and X takes the
 * first image.
 */
export function hallMetadata(slug: string): Metadata | null {
  const page = hallPage(slug);
  const hall = gdHall(slug);
  if (!page || !hall) return null;
  const metadata = seoMetadata(page.path, page);
  const { png } = hallFiles(hall);
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: [
        socialCardImage(page.path, page.title),
        {
          url: png.path,
          width: png.width,
          height: png.height,
          alt: hallAlt(hall),
        },
      ],
    },
  };
}

/**
 * The hall editor as a `WebApplication` (Gadi, 29 October 2026): its
 * name, description and URL are the page's own metadata. Free, so the
 * offer is a price of 0, in US dollars, as in Google's own examples (the
 * app is free in any currency; Gadi, 29 October 2026). No `license`: CC BY
 * 4.0 covers the hall art, not the app. No rating either, so Google
 * shows no software-app rich result for it; the node describes the page
 * all the same.
 */
export function hallEditorJsonLd() {
  const path = "/gd/halls/editor";
  const page = PUBLIC_PAGES[path];
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: page.title,
    description: page.description,
    url: `${SITE_URL}${path}`,
    applicationCategory: "DesignApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: SITE_ORGANIZATION,
    creator: SITE_ORGANIZATION,
  };
}
