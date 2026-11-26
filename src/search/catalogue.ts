import { setupI18n } from "@lingui/core";
import { describeHall } from "magick-components/gd/hall";
import { hallPreset } from "magick-components/gd/hall/presets";
import Data from "magick-data";
import kameas from "magick-data/astrology/kameas";
import planets from "magick-data/astrology/planets";
import zodiacs from "magick-data/astrology/zodiac";
import dictionary from "magick-data/enochian/dictionary";
import keys, { aethyrs, keyTitle, keyVersion } from "magick-data/enochian/keys";
import {
  TABLET_QUARTERS,
  type TabletName,
  type TabletQuarter,
  tabletNames,
} from "magick-data/enochian/tabletNames";
import tablets, {
  tabletVersion,
  WATCHTOWER_IDS,
} from "magick-data/enochian/tablets";
import grades from "magick-data/gd/grades";
import figures from "magick-data/geomancy/tetragrams";
import { divisions, leavesOf } from "magick-data/kabbalah/lenain/volume";
import paths from "magick-data/kabbalah/paths";
import sephirot from "magick-data/kabbalah/sephirot";
import angels from "magick-data/kabbalah/seventyTwoAngels";
import { loadAngelTexts } from "magick-data/kabbalah/seventyTwoAngels/text";
import {
  AS_PRINTED_MESSAGE,
  CONSTRUCTION_MESSAGES,
  CORRECTED_MESSAGE,
  IN_PRINT_MESSAGES,
  KAMEA_LEDE_MESSAGE,
  MOON_COLUMN_MESSAGE,
  MOON_NAMES_MESSAGE,
  SQUARE_NOTES,
} from "@/app/astrology/kamea/kameaCopy";
import {
  AGRIPPA_SQUARE_LEAVES,
  CORRECTED_PLANETS,
  KAMEA_PLANET_ENGLISH,
  KAMEA_PLANETS,
  kameaConstants,
  kameaConstruction,
  kameaPath,
  REGARDIE_SQUARE_LEAVES,
} from "@/app/astrology/kamea/kameaPlanets";
import {
  characterOf,
  otherSpellings,
  planetaryNamePath,
  planetaryNamesOf,
  planetaryNamesWithPages,
  planetOfName,
  readingOf,
} from "@/app/astrology/kamea/planetaryNames";
import { reduceOnKamea } from "@/app/astrology/kamea/sigils/reduction";
import {
  PLANETARY_NAME_WITNESSES,
  WITNESS_LABELS,
} from "@/app/astrology/kamea/witnesses";
import {
  tabletLedeValues,
  tabletNote,
} from "@/app/enochian/tablets/tabletPageData";
import {
  TABLET_LEDE,
  TABLET_PAGE_LABELS,
  type TabletPageId,
  tabletPath,
  WATCHTOWER_QUARTERS,
} from "@/app/enochian/tablets/tabletPages";
import { COMPONENT_EXAMPLES, EXPLORER_COMPONENTS } from "@/explorer/components";
import { PROPS } from "@/explorer/props";
import { angelSlug } from "@/lib/angelSlugs";
import { messages as englishMessages } from "@/locales/en/messages.js";
import { GD_HALLS, gdHallTitle } from "@/render/contracts/gdHall";
import { componentPages } from "@/seo/components";
import { entityPages } from "@/seo/entities";
import { hallDescription, hallPath } from "@/seo/halls";
import { BOOK_PATH, lenainPages } from "@/seo/lenain";
import { PUBLIC_PAGES } from "@/seo/pages";
import { planetaryNameSigilText } from "@/seo/planetaryNames";
import { UNEXTRACTED_PAGES } from "./adaptedPages";
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

// The English catalog, never activated: an adapter's text reads as the
// English page does.
const englishI18n = setupI18n({
  locale: "en",
  messages: { en: englishMessages },
});

/** A message's English, its values filled in and its markup tags dropped. */
function englishText(
  message: string,
  values?: Record<string, string | number>,
): string {
  return englishI18n._(message, values).replace(/<\/?\d+>/g, "");
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

/** The Watchtowers' and the Golden Dawn's quarters' elements, as named. */
const ELEMENTS: Readonly<Record<string, string>> = {
  earth: "Earth",
  air: "Air",
  water: "Water",
  fire: "Fire",
};

/** The Golden Dawn's element of each quarter of a Watchtower, by place. */
const QUARTER_ELEMENTS = {
  topLeft: "Air",
  topRight: "Water",
  bottomLeft: "Earth",
  bottomRight: "Fire",
} as const;

/**
 * The Golden Dawn's names of each Watchtower and of the Tablet of Union,
 * which the tablets' pages read off the letters in code and site search
 * cannot find in their JSX (plan 090, decision 9; plan 100 moved them
 * from the hub to each tablet's page): "Holy names: Mor Dial
 * Hctga. King: Iczhihal. Seniors: … Air of Earth: …; with the Union's
 * letters: Nboza …", and "Lines: Exarp Hcoma Nanta Bitom. First column:
 * Ehnb.", spelled as the page lists them.
 */
export function tabletNamesText(): [string, string][] {
  const shown = (name: TabletName) =>
    name.spelling.charAt(0).toUpperCase() +
    name.spelling.slice(1).toLowerCase();
  const watchtowers = WATCHTOWER_IDS.flatMap((id): [string, string][] => {
    const view = tabletVersion(tablets[id], "gd");
    if (!view) return [];
    const names = tabletNames(view);
    const of = (kind: TabletName["kind"]) =>
      names.filter((name) => !name.quarter && name.kind === kind).map(shown);
    const quarter = (each: TabletQuarter, union: boolean) =>
      names
        .filter(
          (name) =>
            name.quarter === each && Boolean(name.unionLetter) === union,
        )
        .map(shown)
        .join(" ");
    const lines = [
      `Holy names: ${of("holyName").join(" ")}.`,
      `King: ${of("king").join(" ")}.`,
      `Seniors: ${of("senior").join(" ")}.`,
      ...TABLET_QUARTERS.map(
        (each) =>
          `${QUARTER_ELEMENTS[each]} of ${ELEMENTS[id]}: ${quarter(each, false)}; with the Union's letters: ${quarter(each, true)}.`,
      ),
    ];
    return [[id, lines.join(" ")]];
  });
  const view = tabletVersion(tablets.union, "gd");
  const union = view ? tabletNames(view) : [];
  const of = (kind: TabletName["kind"]) =>
    union
      .filter((name) => name.kind === kind)
      .map(shown)
      .join(" ");
  return [
    ...watchtowers,
    ["union", `Lines: ${of("union")}. First column: ${of("unionColumn")}.`],
  ];
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
  "/astrology/kamea": [
    // The word itself, which the components explorer's Kamea page also
    // answers: the reference outranks the component (plan 093, K4
    // review), so the hub keeps few aliases, each passage short.
    "Kamea",
    "Kameas",
    "Planetary magic squares",
    "Planetary kamea",
  ],

  "/astrology/kamea/sigils": [
    "Kamea sigils",
    "Magic square sigils",
    "Planetary sigil generator",
  ],
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
    if (!UNEXTRACTED_PAGES.has(path)) add(path, "prose", "", text);

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
  // Each kamea's square and names, which its page builds from the data
  // (plan 093, K4): the numbers row by row, then each name as every
  // witness romanises and spells it, with the numbers they print.
  for (const planet of KAMEA_PLANETS) {
    const path = kameaPath(planet);
    const document = documents.get(path)!;
    document.aliases.push(
      `Kamea of ${KAMEA_PLANET_ENGLISH[planet]}`,
      `Magic square of ${KAMEA_PLANET_ENGLISH[planet]}`,
      `${Data.planet[planet].name.en.en} kamea`,
    );
    // The page's own words for this square only: its lede, how it is
    // made, where it is printed and how the printings differ, and on the
    // Moon's the two paragraphs no other square has (`kameaCopy.ts`).
    const constants = kameaConstants(planet);
    const { page } = AGRIPPA_SQUARE_LEAVES[planet];
    add(
      path,
      "square",
      "The square",
      [
        englishText(KAMEA_LEDE_MESSAGE, { ...constants }),
        kameas[planet].map((row) => row.join(" ")).join(", "),
      ].join(" "),
    );
    add(
      path,
      "construction",
      "How the square is made",
      englishText(CONSTRUCTION_MESSAGES[kameaConstruction(planet)], {
        cells: constants.cells,
        complement: constants.cells + 1,
      }),
    );
    add(
      path,
      "in-print",
      "The square in print",
      [
        englishText(IN_PRINT_MESSAGES[planet], {
          page,
          regardiePage: REGARDIE_SQUARE_LEAVES[planet] + 6,
        }),
        englishText(
          CORRECTED_PLANETS.includes(planet)
            ? CORRECTED_MESSAGE
            : AS_PRINTED_MESSAGE,
        ),
        ...SQUARE_NOTES[planet].map((note) => englishText(note.message)),
      ].join(" "),
      `${path}#in-print`,
    );
    if (planet === "luna") {
      add(
        path,
        "moon-names",
        "The names of the square",
        englishText(MOON_NAMES_MESSAGE),
      );
      add(
        path,
        "column",
        "The Moon's column",
        englishText(MOON_COLUMN_MESSAGE),
        `${path}#column`,
      );
    }
    add(
      path,
      "names",
      "The names of the square",
      planetaryNamesOf(planet)
        .map((name) =>
          [
            name.name.roman,
            ...PLANETARY_NAME_WITNESSES.map((witness) => {
              const reading = readingOf(name, witness);
              return words([
                reading?.roman,
                reading?.caption,
                reading?.he,
                reading?.number,
              ]);
            }),
          ].join(" "),
        )
        .join(". "),
    );
  }
  // Each planetary intelligence's and spirit's page (plan 093, K4), which
  // its page builds from the data: the name as every witness romanises
  // and spells it, the readings with their numbers, the sigil's reduction
  // (letter, number, cell) and our verdicts on Agrippa's character and
  // Regardie's redrawing of it.
  for (const name of planetaryNamesWithPages()) {
    const path = planetaryNamePath(name) as string;
    const planet = planetOfName(name);
    const readings = PLANETARY_NAME_WITNESSES.flatMap((witness) => {
      const reading = readingOf(name, witness);
      return reading ? [{ witness, reading }] : [];
    });
    documents
      .get(path)!
      .aliases.push(
        ...new Set(
          [
            name.name.roman,
            `Sigil of ${name.name.roman}`,
            ...readings.flatMap(({ reading }) => [reading.roman, reading.he]),
          ].filter((alias): alias is string => Boolean(alias)),
        ),
      );
    add(
      path,
      "witnesses",
      "The name in each witness",
      readings
        .map(({ witness, reading }) =>
          words([
            WITNESS_LABELS[witness],
            reading.roman,
            reading.caption,
            reading.he,
            reading.number,
            reading.note,
          ]),
        )
        .join(". "),
    );
    add(
      path,
      "sigil",
      "The sigil",
      [planetaryNameSigilText(name), ...otherSpellings(name).map((o) => o.he)]
        .map((text) =>
          reduceOnKamea(planet, text, false)
            .flat()
            .map((letter) => `${letter.letter} ${letter.value} ${letter.cell}`)
            .join(", "),
        )
        .join(". "),
    );
    add(
      path,
      "character",
      "Agrippa's character",
      (["agrippa1533", "regardie1940"] as const)
        .map((witness) => {
          const character = characterOf(name, witness);
          return character
            ? words([
                character.spelling,
                character.departures,
                character.marks,
                character.note,
              ])
            : "";
        })
        .join(" "),
    );
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
  // Each tablet's own page (plan 100), which builds its text from the
  // data, so that a name finds the tablet it is read off: the lede and
  // the tablet's note, then its names in the Golden Dawn's version. The
  // hub keeps the tool's own prose.
  for (const [id, text] of tabletNamesText()) {
    const tablet = id as TabletPageId;
    const path = tabletPath(tablet);
    const element = ELEMENTS[id] ?? "";
    documents
      .get(path)!
      .aliases.push(
        ...(tablet === "union"
          ? ["Tablet of Union", "Enochian Tablet of Union"]
          : [
              `${element} Watchtower`,
              `Watchtower of the ${WATCHTOWER_QUARTERS[tablet]}`,
              `Enochian ${element} tablet`,
            ]),
      );
    add(
      path,
      "tablet",
      englishText(TABLET_PAGE_LABELS[tablet]),
      [
        englishText(
          tablet === "union" ? TABLET_LEDE.union : TABLET_LEDE.watchtower,
          { ...tabletLedeValues(tablet), element },
        ),
        tabletNote(tablet).text,
      ].join(" "),
    );
    add(path, "names", "Names on the tablet", text, `${path}#names`);
  }
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
