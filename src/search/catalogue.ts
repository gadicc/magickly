import { describeHall } from "magick-components/gd/hall/describe";
import { hallPreset } from "magick-components/gd/hall/presets";
import Data from "magick-data";
import planets from "magick-data/astrology/planets";
import zodiacs from "magick-data/astrology/zodiac";
import dictionary from "magick-data/enochian/dictionary";
import keys, { aethyrs, keyTitle, keyVersion } from "magick-data/enochian/keys";
import grades from "magick-data/gd/grades";
import figures from "magick-data/geomancy/tetragrams";
import { divisions, leavesOf } from "magick-data/kabbalah/lenain/volume";
import paths from "magick-data/kabbalah/paths";
import sephirot from "magick-data/kabbalah/sephirot";
import angels from "magick-data/kabbalah/seventyTwoAngels";
import { loadAngelTexts } from "magick-data/kabbalah/seventyTwoAngels/text";
import { COMPONENT_EXAMPLES, EXPLORER_COMPONENTS } from "@/explorer/components";
import { PROPS } from "@/explorer/props";
import { angelSlug } from "@/lib/angelSlugs";
import { GD_HALLS, gdHallTitle } from "@/render/contracts/gdHall";
import { componentPages } from "@/seo/components";
import { entityPages } from "@/seo/entities";
import { hallDescription, hallPath } from "@/seo/halls";
import { BOOK_PATH, lenainPages } from "@/seo/lenain";
import { PUBLIC_PAGES } from "@/seo/pages";
import prose from "./generated/prose.json";
import type { SearchCatalogue, SearchDocument, SearchSection } from "./types";

/** Only values from explicit public data sources; never serializes linked rows. */
function words(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(words).join(" ");
  if (value && typeof value === "object")
    return Object.values(value).map(words).join(" ");
  return "";
}

/** Names the entity pages display through explicit public relationships. */
function referenceNames(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  const name = (entry: unknown): string => {
    if (Array.isArray(entry)) return entry.map(name).join(" ");
    if (!entry || typeof entry !== "object") return "";
    const object = entry as Record<string, unknown>;
    return words(
      object.name ??
        object.title ??
        (object.letter as { name?: unknown } | undefined)?.name,
    );
  };
  // Do not recursively serialize the assembled graph: it has cycles and
  // backlinks to content the page does not display.
  const fields = [
    "planet",
    "archangel",
    "godName",
    "angelicOrder",
    "hebrewLetter",
    "element",
    "sephirah",
    "sephirot",
    "zodiacs",
    "tetragrams",
    "gdGrade",
    "alchemySymbol",
    "soul",
    "chakra",
    "bodyParts",
    "stones",
    "scents",
    "from",
    "to",
  ];
  return fields
    .map((field) => name(row[field]))
    .concat(
      ["hermetic", "hebrew"].map((field) => {
        const attribution = row[field] as Record<string, unknown> | undefined;
        return attribution ? name(attribution.hebrewLetter) : "";
      }),
    )
    .join(" ");
}

/** Word-bounded passages with overlap, shared by lexical and semantic indexing. */
export function searchSections(
  id: string,
  title: string,
  text: string,
  href?: string,
): SearchSection[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const sections: SearchSection[] = [];
  for (let offset = 0; offset < tokens.length; offset += 156) {
    sections.push({
      id: `${id}:${offset}`,
      title,
      text: tokens.slice(offset, offset + 180).join(" "),
      ...(href ? { href } : {}),
    });
    if (offset + 180 >= tokens.length) break;
  }
  return sections;
}

const ALIASES: Record<string, string[]> = {
  "/": ["Home"],
  "/chat": ["MagickGPT", "Ask a question"],
  "/kabbalah": ["Qabalah", "Cabala"],
  "/kabbalah/tree": ["Tree of Life", "Etz Chaim", "עץ חיים"],
  "/astrology/planetary-hours": [
    "Planetary hours",
    "Planetary hour calculator",
  ],
  "/gd/sigils": ["Rose Cross sigils", "Sigil generator"],
  "/geomancy/reading": ["Cast geomancy", "Geomancy chart"],
  "/enochian/keys": ["Enochian calls", "The nineteen keys"],
  "/gd/halls": ["Temple floor plans"],
};

/**
 * Public navigation plus authoritative content adapters. No database, auth,
 * PDF corpus, private rituals, browser state or clock-dependent results.
 */
export async function buildSearchCatalogue(): Promise<SearchCatalogue> {
  const documents = new Map<string, SearchDocument>();
  for (const page of [
    ...Object.entries(PUBLIC_PAGES).map(([path, page]) => ({ path, ...page })),
    ...entityPages(),
    ...lenainPages(),
    ...componentPages(),
    ...GD_HALLS.map((hall) => ({
      path: hallPath(hall),
      title: gdHallTitle(hall),
      description: hallDescription(hall),
    })),
  ]) {
    documents.set(page.path, {
      path: page.path,
      title: page.title,
      description: page.description,
      aliases: ALIASES[page.path] ?? [],
      sections: [],
    });
  }
  function add(
    path: string,
    id: string,
    title: string,
    text: string,
    href?: string,
  ) {
    const document = documents.get(path);
    if (!document) throw new Error(`Search source has no public page: ${path}`);
    document.sections.push(...searchSections(id, title, text, href));
  }
  for (const [path, text] of Object.entries(prose))
    add(path, "prose", "", text);

  for (const [kind, rows, prefix] of [
    ["planet", planets, "/astrology/planet/"],
    ["gdGrade", grades, "/gd/grade/"],
    ["sephirah", sephirot, "/kabbalah/sephirah/"],
    ["treeOfLifePath", paths, "/kabbalah/path/"],
  ] as const) {
    for (const [id, row] of Object.entries(rows)) {
      add(
        prefix + id,
        kind,
        "Correspondences",
        [words(row), referenceNames(Data[kind][id])].join(" "),
      );
      const document = documents.get(prefix + id)!;
      const name = (row as { name?: unknown }).name;
      if (name) document.aliases.push(words(name));
    }
  }
  for (const [id, planet] of Object.entries(planets)) {
    const text = words("keyOfSolomon" in planet ? planet.keyOfSolomon : "");
    if (text) add("/astrology/planetary-hours", id, words(planet.name), text);
  }
  for (const [id, zodiac] of Object.entries(zodiacs))
    add("/astrology/zodiac", id, words(zodiac.name), words(zodiac));
  for (const [id, figure] of Object.entries(figures))
    add("/geomancy/reference", id, words(figure.title), words(figure));
  // Each Key's English, its words in Dee's version and in the Golden
  // Dawn's where it has one, and the Aethyrs' names (plan 073, decision 10).
  for (const key of keys) {
    const title = keyTitle(key);
    const dee = keyVersion(key, "dee") ?? [];
    const gd = keyVersion(key, "gd");
    const joined = (version: typeof dee) =>
      version.flatMap((word) => (word.word ? [word.word] : [])).join(" ");
    add(
      "/enochian/keys",
      `key-${key.key}-en`,
      title,
      dee.map((word) => word.english).join(" "),
    );
    add(
      "/enochian/keys",
      `key-${key.key}-eo`,
      `${title} · Enochian`,
      joined(dee),
    );
    if (gd)
      add(
        "/enochian/keys",
        `key-${key.key}-gd`,
        `${title} · Golden Dawn`,
        joined(gd),
      );
  }
  if (aethyrs.length)
    add(
      "/enochian/keys",
      "aethyrs",
      "The thirty Aethyrs",
      aethyrs
        .map((aethyr) =>
          // Each name once, whatever its case ("Lil", "LIL").
          [
            String(aethyr.n),
            ...new Map(
              Object.values(aethyr.readings)
                .filter(Boolean)
                .map((name) => [name.toUpperCase(), name]),
            ).values(),
          ].join(" "),
        )
        .join(", "),
    );
  for (const [word, entry] of Object.entries(dictionary))
    add("/enochian/dictionary", word, word, words(entry.meanings));

  const [english, french] = await Promise.all([
    loadAngelTexts("en"),
    loadAngelTexts("fr"),
  ]);
  for (const angel of angels) {
    const path = `/kabbalah/angel/${angelSlug(angel.no)}`;
    documents.get(path)!.aliases.push(angel.name.en, angel.name.he);
    add(path, "attributes", "Attributes", words(angel));
    add(path, "en", "Lenain · English", english[angel.no - 1]);
    add(path, "fr", "Lenain · Français", french[angel.no - 1]);
  }
  for (const division of divisions) {
    const path = `${BOOK_PATH}/${division.slug}`;
    for (const leaf of leavesOf(division)) {
      const text = leaf.blocks
        .filter((block) => block.kind !== "furniture")
        .map((block) =>
          [block.text, ...block.rows.map((row) => row.join(" · "))].join(" "),
        )
        .join(" ");
      add(
        path,
        `leaf-${leaf.pdfPage}`,
        `Page ${leaf.page.label || leaf.pdfPage} · Français`,
        text,
        `${path}#${leaf.page.anchor}`,
      );
    }
  }
  for (const hall of GD_HALLS) {
    const preset = hallPreset(hall.preset)!;
    add(
      hallPath(hall),
      "stations",
      "Officers and furnishings",
      words(describeHall(preset.hall)),
      `${hallPath(hall)}#hall-stations`,
    );
  }
  // Each component's page: its name, its JSDoc and its examples' titles,
  // as the page shows them (plan 080, stage F).
  for (const component of EXPLORER_COMPONENTS) {
    documents.get(component.path)!.aliases.push(component.name);
    add(
      component.path,
      "component",
      "Component",
      [
        PROPS[component.name].description,
        ...COMPONENT_EXAMPLES[component.name].examples.map(
          (example) => example.title,
        ),
      ].join(" "),
    );
  }
  return { version: 1, documents: [...documents.values()] };
}
