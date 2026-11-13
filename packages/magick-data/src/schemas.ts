/**
 * What a row of each table must look like, as a valibot schema; and, at the
 * end, what an entry of the Enochian dictionary must, which is no table.
 *
 * `strictObject` throughout, deliberately: plain `object()` silently strips a
 * key it was not told about, which is the class of silence this whole layer
 * removes. A field nobody declared is a failure, not a shrug.
 *
 * The id-shaped fields come from [the graph](./graph.ts), so their arity
 * cannot drift from what the links say. Everything else is declared here by
 * hand, read off the JSON5 sources, `optional` where a row leaves the key out
 * and `nullable` where one spells it `null` — the graph never says that,
 * because optionality belongs to the data (plan 032, decision 5).
 */
import * as v from "valibot";
import { type Graph, graph } from "./graph.ts";
import type { TableSpec } from "./graphSpec.ts";
import type { TableName } from "./tables.ts";

type Entries = Record<string, v.GenericSchema>;

/**
 * `{ en: "…" }`, which is how most of the data carries a single language.
 * Each field that holds one says what it is; the text inside is described
 * once, here.
 */
const en = v.strictObject({
  en: v.pipe(v.string(), v.description("The text in English.")),
});

/** The twelve houses of a reading, as both geomancy tables key them. */
const HOUSE_NUMBERS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;

/** One letter on an Enochian tablet. */
const tabletLetter = v.pipe(v.string(), v.regex(/^[A-Za-z]$/));

/** A row or column of an Enochian tablet, from 0. */
const tabletIndex = v.pipe(v.number(), v.integer(), v.minValue(0));

/** How many rows and columns of letters each kind of Enochian tablet has. */
const TABLET_SHAPES = {
  watchtower: { rows: 13, columns: 12 },
  union: { rows: 4, columns: 5 },
} as const;

/**
 * The sources whose readings the tablets hold, as `readings` keys them
 * (the data file names each work). `Tablets.ts` lists them too, and its
 * test holds the two equal.
 */
const TABLET_SOURCES = [
  "regardie1940",
  "equinox1912",
  "greer",
  "dee1584",
  "raphael1587",
] as const;

/** One source's reading of a tablet: see the data file's comment. */
const tabletReading = v.pipe(
  v.strictObject({
    rows: v.pipe(
      v.array(v.pipe(v.string(), v.regex(/^[A-Za-z.]+$/))),
      v.description(
        'The tablet\'s letters from the top, a row a string and a square a character: the Latin transliteration, a capital where the source prints one, and "." for a square it leaves empty. Where a square holds more than one letter, this is the higher, first one, and `marks` has the rest.',
      ),
    ),
    marks: v.optional(
      v.pipe(
        v.array(
          v.strictObject({
            row: v.pipe(
              tabletIndex,
              v.description("The square's row, from 0 at the top."),
            ),
            column: v.pipe(
              tabletIndex,
              v.description("The square's column, from 0 at the left."),
            ),
            beside: v.optional(
              v.pipe(
                v.array(tabletLetter),
                v.description(
                  "Letters printed on the same line after the first, as Regardie prints y and l side by side in Water's fifth row, twelfth square.",
                ),
              ),
            ),
            below: v.optional(
              v.pipe(
                v.array(tabletLetter),
                v.description(
                  "The smaller letters printed below the first: Regardie's second letters.",
                ),
              ),
            ),
            reversed: v.optional(
              v.pipe(
                v.boolean(),
                v.description(
                  "Set where the square's letter is printed reversed, as the Equinox writes some in Enochian and Greer mirrors them.",
                ),
              ),
            ),
            dictated: v.optional(
              v.pipe(
                v.array(tabletLetter),
                v.description(
                  "The letters first written down in the 1584 session, where Dee later corrected the square and `rows` has his correction.",
                ),
              ),
            ),
            misprint: v.optional(
              v.pipe(
                tabletLetter,
                v.description(
                  "What Casaubon's 1659 print has, where every other copy of Dee's tables agrees on the letter in `rows`.",
                ),
              ),
            ),
            alt: v.optional(
              v.pipe(
                v.array(tabletLetter),
                v.description(
                  "Other readings of the square in the version's witnesses, such as the 1587 letters for two Fire squares the 1584 record leaves empty.",
                ),
              ),
            ),
            // Not a picklist, which a declaration would state per row and most
            // readings never use: Tablets.ts types it.
            doubt: v.optional(
              v.pipe(
                v.string(),
                v.check(
                  (doubt) => ["low", "medium", "high"].includes(doubt),
                  'one of "low", "medium" or "high"',
                ),
                v.description(
                  "How doubtful the reading of the square is: `low`, `medium` or `high`.",
                ),
              ),
            ),
          }),
        ),
        v.description(
          "The squares that hold more than their letter, each named once by row and column. Readings with nothing more to say leave it out.",
        ),
      ),
    ),
  }),
  v.description("One source's reading of the tablet."),
);

const byHouse = (value: v.GenericSchema): Entries =>
  Object.fromEntries(HOUSE_NUMBERS.map((no) => [no, value]));

/** The keys of one part of a table's graph entry, if it has that part. */
type SpecKeys<S, K extends string> = S extends { readonly [P in K]: infer R }
  ? keyof R & string
  : never;

/**
 * A table's id-shaped fields that `ids()` makes: every one the graph
 * declares, bar the dotted ones, which belong to the block they are in.
 */
type IdField<T extends TableName> = Exclude<
  | SpecKeys<Graph[T], "links">
  | SpecKeys<Graph[T], "pending">
  | SpecKeys<Graph[T], "external">
  | SpecKeys<Graph[T], "enum">,
  `${string}.${string}`
>;

/** What `ids()` is told about a table's id-shaped fields. */
interface IdOptions<T extends TableName> {
  /** The fields some rows leave out. */
  absent?: readonly IdField<T>[];
  /** The fields some rows spell `null`. */
  nulled?: readonly IdField<T>[];
  /**
   * Each field's description, for the field manifest. It is given here,
   * not in the graph, so that the text stays out of `graph.js`, which
   * ships.
   */
  about?: Partial<Record<IdField<T>, string>>;
}

/**
 * A table's id-shaped fields, as the graph declares them: an id, or a list of
 * ids where the field name is plural, each with its description. `absent`
 * names the ones some rows leave out, and `nulled` the ones some rows spell
 * `null`. A dotted field belongs to the block it is in, which the table
 * declares for itself.
 */
function ids<T extends TableName>(
  table: T,
  { absent = [], nulled = [], about = {} }: IdOptions<T> = {},
): Entries {
  const spec = graph[table] as TableSpec;
  const entries: Entries = {};
  const described = about as Partial<Record<string, string>>;

  const add = (field: string, schema: v.GenericSchema) => {
    if (field.includes(".")) return;
    const description = described[field];
    let value: v.GenericSchema = description
      ? v.pipe(schema, v.description(description))
      : schema;
    if ((nulled as readonly string[]).includes(field))
      value = v.nullable(value);
    entries[field] = (absent as readonly string[]).includes(field)
      ? v.optional(value)
      : value;
  };
  const list = (field: string) =>
    field.endsWith("Ids") ? v.array(v.string()) : v.string();

  for (const [field, link] of Object.entries(spec.links ?? {}))
    add(field, link.many ? v.array(v.string()) : v.string());
  for (const field of Object.keys(spec.pending ?? {})) add(field, list(field));
  for (const field of Object.keys(spec.external ?? {})) add(field, list(field));
  for (const [field, options] of Object.entries(spec.enum ?? {}))
    add(field, v.picklist(options));

  return entries;
}

/**
 * One schema per table, in the order [tables.ts](./tables.ts) names them.
 *
 * Every table and every field carries a description, written as
 * `v.optional(v.pipe(x, v.description("…")))`, the wrapper outermost; an
 * id-shaped field's is in `ids()`'s `about`. They are the field manifest's
 * (plan 080, decision 6), which the data pages show, and
 * [fieldManifest.test.ts](./fieldManifest.test.ts) fails on one that is
 * missing. Each says what the field holds and, where it is not plain, where
 * it comes from and which rows leave it out.
 */
export const schemas = {
  planet: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The row's id: the planet's name in lower case (`sol`, `luna`, `earth`), `rahu` and `ketu` for the north and south nodes, and a slug for each of the three spheres (`primum-mobile`).",
        ),
      ),
      kind: v.pipe(
        v.picklist(["planet", "sphere"]),
        v.description(
          "Whether the row is a planet (the seven classical ones, the Earth, Uranus, Neptune and the Moon's two nodes) or one of the three heavens of the Tree that are not planets: the Primum Mobile, the Zodiac and the sphere of the elements.",
        ),
      ),
      commonName: v.optional(
        v.pipe(
          v.string(),
          v.description(
            "The everyday English name, where readers would search by one other than `name.en.en`: Sun for Sol, North Node for Caput Draconis. Only four rows have one.",
          ),
        ),
      ),
      name: v.pipe(
        v.strictObject({
          en: v.pipe(
            en,
            v.description(
              "The name English books on magic use, which for the Sun and the Moon is the Latin: Sol, Luna, Mercury.",
            ),
          ),
          he: v.optional(
            v.pipe(
              v.strictObject({
                he: v.pipe(v.string(), v.description("The name in Hebrew.")),
                roman: v.pipe(
                  v.string(),
                  v.description(
                    "The Hebrew name romanised: Shemesh, Roshit HaGilgulim.",
                  ),
                ),
                en: v.optional(
                  v.pipe(
                    v.string(),
                    v.description(
                      "What the Hebrew name means: First Swirlings, Sun, White for Levanah, the Moon. Four of the ten leave it out.",
                    ),
                  ),
                ),
              }),
              v.description(
                "The Hebrew name of the seven classical planets and the three spheres. The Earth, Uranus, Neptune and the nodes have none.",
              ),
            ),
          ),
        }),
        v.description("The row's names, in English and in Hebrew."),
      ),
      // The three spheres of the Tree in this table have a name and a text,
      // and no correspondences.
      symbol: v.optional(
        v.pipe(
          v.string(),
          v.description(
            "The astronomical symbol, as a Unicode character: ☉, ☿, ♀. The three spheres have none.",
          ),
        ),
      ),
      keyOfSolomon: v.optional(
        v.pipe(
          en,
          v.description(
            "What the planet's days and hours serve for, in the Key of Solomon as Mathers translated it (1888), Book I, chapter II: the seven classical planets only.",
          ),
        ),
      ),
      about: v.optional(
        v.pipe(
          en,
          v.description(
            "A few sentences in our own words on a row the correspondences say little of: the three spheres, the Earth, Uranus, Neptune and the nodes. It is the lede of the row's page; the sources are in the data file's header (plan 078).",
          ),
        ),
      ),
      description: v.optional(
        v.pipe(
          en,
          v.description(
            "A one-sentence summary for search results and shared links, on the rows that have `about`, where the correspondences would make a poor one.",
          ),
        ),
      ),
      intelligenceOfIntelligences: v.optional(
        v.pipe(
          v.strictObject({
            he: v.pipe(
              v.string(),
              v.description(
                "The name in Hebrew, as Agrippa prints it. Its letters add up to 3321, the sum of the Moon's square, with final mem counted as 600.",
              ),
            ),
            roman: v.pipe(
              v.strictObject({
                agrippa1533: v.pipe(
                  v.string(),
                  v.description(
                    "Agrippa's romanisation (1533): Malcha betharsisim hed beruah schehakim.",
                  ),
                ),
                crowley777: v.pipe(
                  v.string(),
                  v.description(
                    "Crowley's, in 777 Revised (1955), Table III, column CXCIV: a variant of the name, in 777's own spelling, not a romanisation of `he`.",
                  ),
                ),
                regardie1940: v.pipe(
                  v.string(),
                  v.description(
                    "The Golden Dawn's, in Regardie's The Golden Dawn, vol. 4 (1940), p. 86, which prints it in capitals: a related form of the name, in that source's own spelling, not a romanisation of `he`.",
                  ),
                ),
              }),
              v.description(
                "The name romanised as each source spells it, keyed by source; the data file's header cites each. Only Agrippa's spells `he`; 777's and Regardie's follow those sources' own spellings of the name.",
              ),
            ),
          }),
          v.description(
            "The Moon's intelligence of intelligences: the name Agrippa gives the Moon in place of a single intelligence (De occulta philosophia, 1533, Book II, chapter 22), of which 777 and the Golden Dawn give variant forms. The Moon only; its `intelligenceId` is Shelachel, a name found in present-day sources.",
          ),
        ),
      ),
      ...ids("planet", {
        absent: [
          "hebrewLetterId",
          "godNameId",
          "archangelId",
          "intelligenceId",
          "spiritId",
        ],
        about: {
          hebrewLetterId:
            "The double letter of the Hebrew alphabet the Golden Dawn gives the planet: one for each of the seven classical planets, and no two the same.",
          godNameId:
            "The divine name of the sephirah whose heaven the planet is, in the world of Atzilut: YHVH Eloah VeDa'at for the Sun, as for Tiferet. The seven classical planets only.",
          archangelId:
            "The planet's archangel, whose row names the planet back. The seven classical planets only.",
          intelligenceId:
            "The planet's intelligence: Nakhiel for the Sun. Six are the names Agrippa gives with the planets' magic squares (De occulta philosophia, Book II, chapter 22). The Moon's, Shelachel, is a name found in present-day sources; we have not found it in Agrippa, in 777 (the revised edition of 1955) or in Heydon's Theomagia (1663/4); the name Agrippa gives the Moon is `intelligenceOfIntelligences`. There is no table of intelligences yet. The seven classical planets only.",
          spiritId:
            "The planet's spirit, as Agrippa names it beside the intelligence: Sorath for the Sun. There is no table of spirits yet; a geomantic figure's `rulerIds` name the same ones. The seven classical planets only.",
        },
      }),
    }),
    v.description(
      "The planets of astrology and of the Tree of Life: the seven classical planets, the Earth, Uranus, Neptune, the Moon's two nodes, and the three heavens of the Tree that are not planets.",
    ),
  ),
  zodiac: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description("The sign's English name in lower case: `aries`."),
      ),
      no: v.pipe(
        v.number(),
        v.description(
          "The sign's place in the zodiac, from 1 for Aries to 12 for Pisces.",
        ),
      ),
      symbol: v.pipe(
        v.string(),
        v.description(
          "The sign's symbol, as a Unicode character followed by the variation selector that asks for text rather than emoji presentation: ♈︎.",
        ),
      ),
      emoji: v.pipe(
        v.string(),
        v.description(
          "The same symbol, as an emoji where the platform draws one: ♈️.",
        ),
      ),
      name: v.pipe(en, v.description("The sign's name: Aries.")),
      meaning: v.pipe(
        en,
        v.description(
          "What the name means, or the creature it names: Ram, Twins.",
        ),
      ),
      rulesFrom: v.pipe(
        v.tuple([
          v.tuple([v.number(), v.number()]),
          v.tuple([v.number(), v.number()]),
        ]),
        v.description(
          "The dates of the year the Sun is in the sign, from and to, each as `[month, day]` with both counted from 1: Aries is `[[3, 21], [4, 19]]`. The boundaries move by a day from year to year; these are the usual ones.",
        ),
      ),
      quadruplicity: v.pipe(
        v.picklist(["cardinal", "kerubic", "mutable"]),
        v.description(
          "The sign's quality: cardinal, kerubic (the Golden Dawn's word for fixed, after the four Kerubim) or mutable.",
        ),
      ),
      tetragrammatonPermutation: v.pipe(
        v.string(),
        v.description(
          "The order of the four letters of the Tetragrammaton, YHVH, that the Golden Dawn gives the sign, written y, h, v and H for Yod, He, Vav and the final He: Aries is yhvH. Two signs may share one.",
        ),
      ),
      ...ids("zodiac", {
        about: {
          planetId:
            "The planet that rules the sign, in the classical rulerships.",
          elementId: "The sign's element: fire, earth, air or water.",
          tribeOfIsraelId:
            "The tribe of Israel the Golden Dawn gives the sign. Ephraim and Manasseh, Joseph's sons, each have a sign, and Levi and Joseph none.",
        },
      }),
    }),
    v.description("The twelve signs of the zodiac."),
  ),
  astrologicalHouse: v.pipe(
    v.strictObject({
      index: v.pipe(
        v.number(),
        v.description(
          "The house's number, from 1 to 12, which names the row: the table is an array with no `id`.",
        ),
      ),
      motto: v.pipe(
        v.strictObject({
          la: v.pipe(
            v.string(),
            v.description(
              "The house's word in the Latin mnemonic verse, as it is usually quoted: Vita, Lucrum, Fratres.",
            ),
          ),
          en: v.pipe(
            v.string(),
            v.description(
              "Our English for the Latin word: Life, Gain, Brothers.",
            ),
          ),
        }),
        v.description(
          "The house's one-word motto from the traditional Latin verse that lists the twelve.",
        ),
      ),
      interpretation: v.pipe(
        en,
        v.description(
          "What the house signifies in a horoscope or a question, in our own words after William Lilly, Christian Astrology (1647), Book I, chapter vii.",
        ),
      ),
      ...ids("astrologicalHouse", {
        about: {
          zodiacId:
            "The sign that corresponds to the house in the natural zodiac, where Aries is the first house.",
        },
      }),
    }),
    v.description(
      "The twelve houses of the horoscope, each with its traditional motto and what it signifies.",
    ),
  ),

  hebrewLetter: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The letter's name in lower case (`alef`, `bet`); a final form adds `-sofit` (`kaf-sofit`).",
        ),
      ),
      letter: v.pipe(
        v.strictObject({
          he: v.pipe(v.string(), v.description("The letter itself: א.")),
          name: v.pipe(
            v.string(),
            v.description(
              "The letter's name in English spelling: Aleph, Bet; a final form adds -Sofit.",
            ),
          ),
          latin: v.pipe(
            v.string(),
            v.description(
              "The Latin letters that transliterate it: A, B, Ch, Th; a final form adds (f), as in K(f).",
            ),
          ),
        }),
        v.description("The letter, its name and its transliteration."),
      ),
      index: v.pipe(
        v.number(),
        v.description(
          "The letter's place in the alphabet, from 1 to 22. A final form has its letter's.",
        ),
      ),
      value: v.pipe(
        v.number(),
        v.description(
          "The letter's numerical value in gematria, from 1 to 400; the five final forms count from 500 to 900.",
        ),
      ),
      meaning: v.pipe(
        en,
        v.description(
          "What the letter's name means as a word, such as ox for Aleph and house for Bet; a final form has its letter's.",
        ),
      ),
      ...ids("hebrewLetter"),
    }),
    v.description(
      "The twenty-two letters of the Hebrew alphabet and the five final forms.",
    ),
  ),

  enochianLetter: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The Latin letter the Enochian letter is written for, in capitals, which also keys the row: `A`, `C`.",
        ),
      ),
      enochian: v.pipe(
        v.string(),
        v.description(
          "The character an Enochian font draws as this letter, the same as `id` in every row: a font maps the Latin letters to the Enochian forms.",
        ),
      ),
      english: v.pipe(
        v.string(),
        v.description(
          "The Latin letters it stands for, comma-separated, as the Golden Dawn's table in Regardie, The Golden Dawn, vol. 4 (1940), p. 299, gives them: C,K for C, and U,V,W for V.",
        ),
      ),
      names: v.pipe(
        v.strictObject({
          gd: v.pipe(
            v.string(),
            v.description(
              "The name in the Golden Dawn's table (Regardie, vol. 4, p. 299): Pe for B.",
            ),
          ),
          dee: v.pipe(
            v.string(),
            v.description(
              "The name given to Dee and Kelley on 26 March 1583 (Sloane MS 3188): Pa for B.",
            ),
          ),
        }),
        v.description(
          "The letter's name in each tradition. The two differ for B, F, H, N, T and V.",
        ),
      ),
      sounds: v.pipe(
        v.strictObject({
          gd: v.pipe(
            v.string(),
            v.description(
              "The syllable the Golden Dawn gives the letter said on its own: beh, em, zod.",
            ),
          ),
          dee: v.pipe(
            v.string(),
            v.description(
              "The sound or sounds the letter stands for in Dee's spellings, read as the English of his day: b, or k, s, ch for C.",
            ),
          ),
        }),
        v.description(
          "How the letter is said in each tradition, as short respellings in ordinary English letters, alternatives separated by a comma and a space, the usual first. The sources are in the data file's header.",
        ),
      ),
      ...ids("enochianLetter", {
        absent: ["tetragramId"],
        about: {
          tetragramId:
            "The geomantic figure the Golden Dawn gives the letter (Regardie, vol. 4, p. 77), one figure to a letter. Sixteen letters have one; C, D, H, Q and X have none.",
        },
      }),
    }),
    v.description(
      "The twenty-one letters of the Enochian alphabet, with their names and sounds in the Golden Dawn's tradition and in Dee's.",
    ),
  ),
  enochianTablet: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The tablet's element, `earth`, `air`, `water` or `fire`, for a Watchtower; `union` for the Tablet of Union.",
        ),
      ),
      kind: v.pipe(
        v.picklist(["watchtower", "union"]),
        v.description(
          "A Watchtower, one of the four elemental tablets of thirteen rows by twelve squares, or the Tablet of Union, four rows by five, which joins them.",
        ),
      ),
      readings: v.pipe(
        v.strictObject(
          Object.fromEntries(
            TABLET_SOURCES.map((source) => [source, v.optional(tabletReading)]),
          ) as Record<
            (typeof TABLET_SOURCES)[number],
            v.OptionalSchema<typeof tabletReading, undefined>
          >,
        ),
        v.description(
          "Each source's letters for the tablet, keyed by source: `regardie1940` (Regardie, The Golden Dawn, vol. 4), `equinox1912` (The Equinox I(7)), `greer` (the redrawn plates of Greer's edition), `dee1584` (Dee's tables of June 1584, as Casaubon prints them) and `raphael1587` (the table reformed on 20 April 1587). A version of the tablet is a rule over these, applied by `tabletVersion()`. Dee and Raphael have no Tablet of Union.",
        ),
      ),
      choices: v.optional(
        v.pipe(
          v.strictObject({
            gd: v.pipe(
              v.array(
                v.strictObject({
                  row: v.pipe(
                    tabletIndex,
                    v.description("The square's row, from 0 at the top."),
                  ),
                  column: v.pipe(
                    tabletIndex,
                    v.description("The square's column, from 0 at the left."),
                  ),
                  from: v.pipe(
                    v.picklist(TABLET_SOURCES),
                    v.description(
                      "The source whose letter the version takes there.",
                    ),
                  ),
                }),
              ),
              v.description(
                "The squares where the Golden Dawn's version takes another source's letter than Regardie's higher one, because both other sources and the names the Order reads through the square have it.",
              ),
            ),
          }),
          v.description(
            "Where a version departs from the reading it starts from, square by square, by version. Only `gd` has any; the four Watchtowers have choices and the Tablet of Union none.",
          ),
        ),
      ),
      ...ids("enochianTablet"),
    }),
    v.check(
      ({ readings }) => Object.values(readings).some(Boolean),
      "a tablet has at least one reading",
    ),
    v.check(
      ({ kind, readings }) =>
        Object.values(readings).every(
          (reading) =>
            reading === undefined ||
            (reading.rows.length === TABLET_SHAPES[kind].rows &&
              reading.rows.every(
                (row) => row.length === TABLET_SHAPES[kind].columns,
              )),
        ),
      "a Watchtower's reading is 13 rows of 12 squares, the Tablet of Union's 4 rows of 5",
    ),
    v.check(
      ({ kind, readings }) =>
        Object.values(readings).every(({ marks = [] } = { rows: [] }) => {
          const inside = marks.every(
            ({ row, column }) =>
              row < TABLET_SHAPES[kind].rows &&
              column < TABLET_SHAPES[kind].columns,
          );
          const keys = new Set(
            marks.map(({ row, column }) => `${row},${column}`),
          );
          // `reversed: false` and an empty list say nothing.
          const more = marks.every(({ row, column, ...rest }) =>
            Object.values(rest).some((value) =>
              Array.isArray(value) ? value.length > 0 : value !== false,
            ),
          );
          return inside && more && keys.size === marks.length;
        }),
      "a mark names a square of the grid once, and says something of it",
    ),
    v.check(
      ({ readings, choices }) =>
        (choices?.gd ?? []).every(({ row, column, from }) => {
          const letter = readings[from]?.rows[row]?.[column];
          // The Golden Dawn's version starts from Regardie's reading; a
          // choice of his own letter, or of an empty square, changes
          // nothing it should.
          return (
            letter !== undefined &&
            letter !== "." &&
            letter !== readings.regardie1940?.rows[row]?.[column]
          );
        }),
      "a choice names a letter of a reading the tablet has, other than Regardie's",
    ),
    v.description(
      "The five Enochian tablets, the four Watchtowers and the Tablet of Union, as each of five sources prints their letters.",
    ),
  ),

  tetragram: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The figure's Latin name in lower case, with an underscore for a space: `acquisitio`, `caput_draconis`.",
        ),
      ),
      rows: v.pipe(
        v.array(v.picklist([1, 2])),
        v.description(
          "The figure itself: its four lines from the head down, each of one point or two.",
        ),
      ),
      title: v.pipe(en, v.description("The figure's Latin name: Acquisitio.")),
      translation: v.pipe(
        en,
        v.description("The Latin name in plain English: gain."),
      ),
      meaning: v.pipe(
        en,
        v.description(
          'What the figure means in general, from the Golden Dawn\'s table as Crowley printed it in "A Handbook of Geomancy", The Equinox I(2) (1909), with editorial changes only: abbreviations spelled out, "evil" and "ill" read as "unfavourable" (or "bad" in the paired formulas of five figures), and a full stop at the end of each entry.',
        ),
      ),
      meanings: v.pipe(
        v.strictObject(
          byHouse(
            v.pipe(
              en,
              v.description(
                "What the figure means in that house, from the same table, with the same changes.",
              ),
            ),
          ),
        ),
        v.description(
          "What the figure means in each of the twelve houses of a reading, keyed by the house's number from 1 to 12.",
        ),
      ),
      ...ids("tetragram", {
        nulled: ["zodiacId"],
        about: {
          zodiacId:
            "The sign the Golden Dawn gives the figure; `null` for Caput and Cauda Draconis, which have none.",
          elementId: "The figure's element.",
          planetIds:
            "The planets that rule the figure: one, or two for Caput Draconis (Venus and Jupiter) and Cauda Draconis (Saturn and Mars).",
          rulerIds:
            "The planetary spirits that rule the figure, as the planets' `spiritId` names them: Hismael for Jupiter's figures. Not yet a table of their own.",
        },
      }),
    }),
    v.description(
      "The sixteen figures of geomancy, with what each means in general and in each house.",
    ),
  ),
  geomanticHouse: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.number(),
        v.description("The house's number, from 1 to 12."),
      ),
      meaning: v.pipe(
        en,
        v.description(
          "What the house governs in a geomantic reading, in our own words after Agrippa's list in the Fourth Book of Occult Philosophy (tr. Turner, 1655), with matters Crowley ties to a house in The Equinox I(2). The 5th and 7th follow Agrippa rather than modern astrology.",
        ),
      ),
      ...ids("geomanticHouse"),
    }),
    v.description("The twelve houses of a geomantic reading."),
  ),

  gdGrade: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The grade's number as the Golden Dawn writes it, the grade and its sephirah counted from the top of the Tree joined by `=`: `0=0` for the Neophyte, `1=10` for the Zelator; `portal` for the Portal, which has none.",
        ),
      ),
      name: v.pipe(v.string(), v.description("The grade's name: Zelator.")),
      // Portal belongs to no order and has no degree; the first grade has
      // nothing before it and the last nothing after.
      ...ids("gdGrade", {
        absent: [
          "elementId",
          "planetId",
          "sephirahId",
          "degreeId",
          "nextId",
          "prevId",
          "orderId",
        ],
        about: {
          elementId:
            "The element of the grade: earth for the Zelator to fire for the Philosophus, and spirit for the Portal. The other grades have none.",
          planetId:
            "The planet attributed to the grade, from the Earth for the Zelator to Saturn for the Magister Templi. The Neophyte, the Portal and the two highest grades have none.",
          sephirahId:
            "The sephirah of the grade, the second number in its id: Malchut for 1=10. The Neophyte and the Portal have none.",
          degreeId:
            "The degree the grade belongs to, which groups the grades: the first for the Neophyte to the Philosophus, the second for the Portal, the third for the Second Order. The Third Order's grades have none.",
          nextId: "The grade after this one. The last, Ipsissimus, has none.",
          prevId: "The grade before this one. The first, Neophyte, has none.",
          orderId:
            "Which of the three orders the grade belongs to, `1st`, `2nd` or `3rd`: a value, not a link. The Portal, between the first two, belongs to neither.",
        },
      }),
    }),
    v.description(
      "The grades of the Golden Dawn and its inner orders, from Neophyte to Ipsissimus, with the Portal.",
    ),
  ),
  gdDegree: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description("The degree: `1st`, `2nd` or `3rd`."),
      ),
      ...ids("gdDegree", {
        about: {
          pillarId:
            "The pillar of the Tree the degree is given, `severity`, `mercy` or `middle`. There is no table of pillars yet.",
        },
      }),
    }),
    v.description(
      "The three degrees that group the Golden Dawn's grades, each with a pillar of the Tree.",
    ),
  ),

  archangel: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description("The archangel's name in lower case: `michael`."),
      ),
      name: v.pipe(
        v.strictObject({
          he: v.pipe(v.string(), v.description("The name in Hebrew.")),
          roman: v.pipe(
            v.string(),
            v.description("The Hebrew name romanised: Kassiel, Gavriel."),
          ),
          en: v.optional(
            v.pipe(
              v.string(),
              v.description(
                "The usual English spelling, where it differs from the romanised Hebrew: Gabriel for Gavriel. Only Gabriel has one.",
              ),
            ),
          ),
        }),
        v.description("The archangel's name."),
      ),
      ...ids("archangel", {
        absent: ["planetId", "sephirahId"],
        about: {
          planetId:
            "The planet the archangel rules, which names the archangel back. Seven archangels have one.",
          sephirahId:
            "The sephirah the archangel rules in the world of Briah, which names the archangel back. Michael is Hod's and Raphael Tiferet's, as the Golden Dawn has them. Uriel has neither a planet nor a sephirah.",
        },
      }),
    }),
    v.description("The archangels of the planets and of the sephirot."),
  ),
  angelicOrder: v.pipe(
    v.strictObject({
      name: v.pipe(
        v.strictObject({
          he: v.pipe(v.string(), v.description("The order's name in Hebrew.")),
          en: v.pipe(
            v.string(),
            v.description(
              "What the name means: Holy Living Creatures, Wheels.",
            ),
          ),
          roman: v.pipe(
            v.string(),
            v.description("The Hebrew name romanised: Chayot HaKodesh."),
          ),
        }),
        v.description(
          "The order's name. The table has no `id`: each row is keyed by a slug of its romanised name (`chayot-hakodesh`), which is what a sephirah's `angelicOrderId` names.",
        ),
      ),
      ...ids("angelicOrder"),
    }),
    v.description(
      "The ten orders of angels of the sephirot, in the world of Yetzirah.",
    ),
  ),
  christianChoir: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description("The choir's English name in lower case: `seraphim`."),
      ),
      name: v.pipe(
        v.strictObject({
          en: v.pipe(v.string(), v.description("The choir's name in English.")),
          fr: v.pipe(
            v.string(),
            v.description("The choir's name in Lenain's French: Séraphins."),
          ),
        }),
        v.description("The choir's name in English and in French."),
      ),
      ...ids("christianChoir"),
    }),
    v.description(
      "The nine choirs of angels of Pseudo-Dionysius, in the order Lenain gives them through the seventy-two genii. They are not the Kabbalistic orders of the angelicOrder table.",
    ),
  ),
  fourWorlds: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description("The world's romanised name in lower case: `atzilut`."),
      ),
      name: v.pipe(
        v.strictObject({
          en: v.pipe(
            v.string(),
            v.description("What the name means: Nobility, Creation."),
          ),
          roman: v.pipe(
            v.string(),
            v.description("The Hebrew name romanised: Atzilut."),
          ),
          he: v.pipe(v.string(), v.description("The name in Hebrew.")),
        }),
        v.description("The world's name."),
      ),
      desc: v.pipe(
        en,
        v.description(
          "The world in one word, as English books on the Kabbalah describe it: Archetypal, Creative, Formative, Action.",
        ),
      ),
      residentsTitle: v.pipe(
        en,
        v.description(
          "Who or what belongs to the world: Pure Deity in Atzilut, down to Man, Matter, Shells and Demons in Assiah.",
        ),
      ),
      ...ids("fourWorlds"),
    }),
    v.description("The four worlds of the Kabbalah, from Atzilut to Assiah."),
  ),
  godName: v.pipe(
    v.strictObject({
      name: v.pipe(
        v.strictObject({
          he: v.pipe(v.string(), v.description("The name in Hebrew.")),
          roman: v.pipe(
            v.string(),
            v.description("The name romanised: Ehiyeh, YHVH Eloah VeDa'at."),
          ),
          en: v.pipe(
            v.string(),
            v.description("What the name means: I am, Lord God of Knowledge."),
          ),
        }),
        v.description(
          "The divine name. The table has no `id`: each row is keyed by a slug of its romanised name (`ehiyeh`), which is what a sephirah's or a planet's `godNameId` names.",
        ),
      ),
      ...ids("godName"),
    }),
    v.description(
      "The ten divine names of the sephirot, in the world of Atzilut.",
    ),
  ),
  kerub: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The Kerub's element: `earth`, `air`, `water` or `fire`.",
        ),
      ),
      title: v.pipe(en, v.description("The Kerub's title: Kerub of Earth.")),
      face: v.pipe(
        v.strictObject({
          en: v.pipe(v.string(), v.description("The face in English: Bull.")),
          he: v.pipe(v.string(), v.description("The face in Hebrew.")),
          roman: v.pipe(
            v.string(),
            v.description("The Hebrew romanised: Shor."),
          ),
        }),
        v.description(
          "The Kerub's face, of the four in Ezekiel's vision: bull, man, eagle and lion.",
        ),
      ),
      ...ids("kerub", {
        about: {
          zodiacId:
            "The kerubic sign of the Kerub's element: Taurus, Aquarius, Scorpio or Leo.",
          elementId: "The Kerub's element, the same as its id.",
        },
      }),
    }),
    v.description("The four Kerubim, one for each element."),
  ),
  sephirah: v.pipe(
    v.strictObject({
      index: v.pipe(
        v.number(),
        v.description(
          "The sephirah's number, from 1 for Keter to 10 for Malchut. Da'at, which the Tree does not count, is 11: its place in the file, not a number the tradition gives it.",
        ),
      ),
      id: v.pipe(
        v.string(),
        v.description("The romanised name in lower case: `keter`, `daat`."),
      ),
      name: v.pipe(
        v.strictObject({
          he: v.pipe(v.string(), v.description("The name in Hebrew.")),
          roman: v.pipe(
            v.string(),
            v.description("The Hebrew name romanised: Keter, Chesed."),
          ),
          en: v.pipe(
            v.string(),
            v.description("What the name means: Crown, Mercy."),
          ),
        }),
        v.description("The sephirah's name."),
      ),
      color: v.pipe(
        v.strictObject({
          king: v.optional(
            v.pipe(
              v.string(),
              v.description(
                "The colour in the King scale, the world of Atzilut, as the Golden Dawn names it: brilliance, soft-blue. Da'at has none.",
              ),
            ),
          ),
          kingWeb: v.optional(
            v.pipe(
              v.string(),
              v.description(
                "The King-scale colour as a CSS colour, for drawing: white, #c0448f.",
              ),
            ),
          ),
          kingWebText: v.optional(
            v.pipe(
              v.string(),
              v.description(
                "A CSS colour for text drawn on the King-scale colour, where the usual one would not read.",
              ),
            ),
          ),
          queen: v.pipe(
            v.string(),
            v.description(
              "The colour in the Queen scale, the world of Briah: white, gray, scarlet. Malchut's is four colours, comma-separated, one for each quarter: russet, citrine, olive and black.",
            ),
          ),
          queenWeb: v.pipe(
            v.string(),
            v.description(
              "The Queen-scale colour as a CSS colour, or four for Malchut, comma-separated in the same order.",
            ),
          ),
          queenWebText: v.optional(
            v.pipe(
              v.string(),
              v.description(
                "A CSS colour for text drawn on the Queen-scale colour, where the usual one would not read.",
              ),
            ),
          ),
          strokeColor: v.optional(
            v.pipe(
              v.string(),
              v.description(
                "A CSS colour for the sphere's outline, where it is not the usual one. Only Da'at has one.",
              ),
            ),
          ),
          strokeDasharray: v.optional(
            v.pipe(
              v.number(),
              v.description(
                "The dash length of the sphere's outline: Da'at is drawn dashed, because it is not counted among the ten.",
              ),
            ),
          ),
        }),
        v.metadata({ columns: ["queen", "king"] }),
        v.description(
          "The sephirah's colours in the Golden Dawn's King and Queen scales, with the CSS colours the app draws them in. Da'at has no King scale.",
        ),
      ),
      bodyPos: v.pipe(
        v.string(),
        v.description(
          "Where the sephirah falls on the body when the Tree is laid on it, as a slug: above the head for Keter, the left and right temples for Chochmah and Binah, down to the feet for Malchut, and the throat for Da'at.",
        ),
      ),
      // Da'at is not a sephirah of the Tree and has almost none of these; four
      // of the lower spheres share no part of the soul. Da'at has no stone or
      // scent, and Malchut no scent.
      ...ids("sephirah", {
        absent: [
          "chakraId",
          "planetId",
          "archangelId",
          "soulId",
          "angelicOrderId",
          "gdGradeId",
          "nextId",
          "prevId",
          "stoneIds",
          "scentIds",
        ],
        nulled: ["soulId"],
        about: {
          chakraId:
            "The chakra that corresponds to the sephirah when the Tree is laid on the body. Several sephirot share one; Da'at has none.",
          godNameId:
            "The divine name of the sephirah, in the world of Atzilut.",
          planetId:
            "The sephirah's heaven, in the world of Assiah: the Primum Mobile for Keter, the Zodiac for Chochmah, then Saturn down to the Moon, and the sphere of the elements for Malchut. Da'at has none.",
          archangelId:
            "The sephirah's archangel, in the world of Briah, which names the sephirah back. Da'at has none.",
          soulId:
            "The part of the soul the sephirah is the seat of: Yechidah in Keter down to Guph in Malchut. `null` for Chesed, Gevurah, Netzach and Hod, which carry none of their own; Da'at leaves it out.",
          angelicOrderId:
            "The sephirah's order of angels, in the world of Yetzirah. Da'at has none.",
          gdGradeId:
            "The Golden Dawn grade of the sephirah, which names it back: 1=10 for Malchut. Da'at has none.",
          nextId:
            "The sephirah after this one, down the Tree from Keter to Malchut. Malchut and Da'at have none.",
          prevId:
            "The sephirah before this one, up the Tree. Keter and Da'at have none.",
          bodyPartIds:
            "The parts of the body the sephirah corresponds to: the cranium for Keter, the loins and hips for Netzach.",
          stoneIds:
            "The precious stones of the sephirah, one or two. Da'at has none.",
          scentIds:
            "The perfumes of the sephirah, one or two. Malchut and Da'at have none.",
        },
      }),
    }),
    v.description(
      "The ten sephirot of the Tree of Life, and Da'at, with their names, colours and correspondences in the four worlds.",
    ),
  ),
  treeOfLifePath: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The numbers of the two sephirot the path joins, the smaller first, joined by an underscore: `1_2` joins Keter and Chochmah.",
        ),
      ),
      /** Two paths of the Hebrew tree are not on the Hermetic one. */
      hermetic: v.optional(
        v.pipe(
          v.strictObject({
            hebrewLetterId: v.pipe(
              v.string(),
              v.description(
                "The Hebrew letter on the path in the Hermetic attribution, which the letter's row names back as `hermeticPath`.",
              ),
            ),
            pathNo: v.pipe(
              v.number(),
              v.description(
                "The path's number, from 11 to 32: the ten sephirot are paths 1 to 10.",
              ),
            ),
            tarotId: v.pipe(
              v.string(),
              v.description(
                "The tarot trump on the path, by its number as a string, from `0` for the Fool to `21`; the deck itself is outside this package.",
              ),
            ),
            tarotTitle: v.pipe(
              v.string(),
              v.description(
                "The trump's common English title (Strength on Teth as VIII, Justice on Lamed as XI), except XXI, which takes the Golden Dawn's The Universe for The World.",
              ),
            ),
          }),
          v.description(
            "The path in the Hermetic attribution of the Golden Dawn: its letter, number and tarot trump. The two paths of the Hebrew tree alone, 2_5 and 3_4, have none.",
          ),
        ),
      ),
      hebrew: v.optional(
        v.pipe(
          v.strictObject({
            hebrewLetterId: v.pipe(
              v.string(),
              v.description(
                "The Hebrew letter on the path in the Hebrew attribution, which the letter's row names back as `hebrewPath`.",
              ),
            ),
          }),
          v.description(
            "The path in the Hebrew attribution, whose tree differs from the Hermetic one: its letter. The two paths of the Hermetic tree alone, 7_10 and 8_10, have none.",
          ),
        ),
      ),
      ...ids("treeOfLifePath", {
        absent: ["nextId", "prevId"],
        about: {
          fromId:
            "The first of the two sephirot the path joins, the one its id names first.",
          toId: "The second of the two sephirot the path joins.",
          nextId:
            "The path after this one: by number from 11 to 32, then the two paths of the Hebrew tree alone. The last has none.",
          prevId: "The path before this one. The first, 1_2, has none.",
        },
      }),
    }),
    v.description(
      "The paths of the Tree of Life between the sephirot, in both the Hermetic and the Hebrew attributions of the letters.",
    ),
  ),
  soul: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description("The part's romanised name in lower case: `yechidah`."),
      ),
      name: v.pipe(
        v.strictObject({
          en: v.pipe(
            v.string(),
            v.description("An English word for it: unity, spirit."),
          ),
          he: v.pipe(v.string(), v.description("The name in Hebrew.")),
          roman: v.pipe(
            v.string(),
            v.description("The Hebrew name romanised, in lower case: yechida."),
          ),
        }),
        v.description("The part's name."),
      ),
      ...ids("soul"),
    }),
    v.description(
      "The parts of the soul in the Kabbalah, from Yechidah to Guph, the body.",
    ),
  ),
  tribeOfIsrael: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description("The tribe's English name in lower case: `reuben`."),
      ),
      name: v.pipe(
        v.strictObject({
          en: v.pipe(v.string(), v.description("The name in English.")),
          he: v.pipe(v.string(), v.description("The name in Hebrew.")),
        }),
        v.description("The tribe's name."),
      ),
      ...ids("tribeOfIsrael"),
    }),
    v.description(
      "The tribes of Israel: Jacob's twelve sons, and Ephraim and Manasseh, the sons of Joseph.",
    ),
  ),
  seventyTwoAngel: v.pipe(
    v.strictObject({
      no: v.pipe(
        v.number(),
        v.description(
          "The genius's number, from 1 to 72, which names the row: the table is an array with no `id`.",
        ),
      ),
      name: v.pipe(
        v.strictObject({
          en: v.pipe(
            v.string(),
            v.description(
              "The name in Latin letters, as Lenain prints it: Vehuiah, Sitaël.",
            ),
          ),
          he: v.optional(
            v.pipe(
              v.string(),
              v.description(
                "The name's Hebrew letters, without Lenain's marks: what identifies the name.",
              ),
            ),
          ),
          hePointed: v.optional(
            v.pipe(
              v.string(),
              v.description(
                "The Hebrew as Lenain printed it, with his marks, on the twenty-five names a person read.",
              ),
            ),
          ),
          heSource: v.optional(
            v.pipe(
              v.picklist(["hand", "corroborated"]),
              v.description(
                "Where the Hebrew came from: `corroborated` where two machine readings of the scan agree (forty-seven names), `hand` where a person read it because they never would (twenty-five).",
              ),
            ),
          ),
        }),
        v.description(
          "The genius's name, in Latin letters and in Hebrew. Every genius has a Hebrew name.",
        ),
      ),
      printedPages: v.pipe(
        v.array(v.number()),
        v.description(
          "The pages of Lenain's La Science Cabalistique (Amiens, 1823) that print the entry.",
        ),
      ),
      attribute: v.pipe(
        v.strictObject({
          en: v.pipe(
            v.string(),
            v.description("In English, translated from the French."),
          ),
          fr: v.pipe(v.string(), v.description("In Lenain's French.")),
        }),
        v.description(
          "The attribute of God that the genius's name expresses: God elevated and exalted above all things.",
        ),
      ),
      people: v.pipe(
        v.strictObject({
          en: v.pipe(v.string(), v.description("In English.")),
          fr: v.pipe(v.string(), v.description("In Lenain's French.")),
        }),
        v.description(
          "The people whose name for God the entry gives (the Hebrews, the Turks); empty where it names none.",
        ),
      ),
      godName: v.pipe(
        v.string(),
        v.description(
          "That people's name for God, as Lenain spells it: Jehovah, Allah. A name, not a link to the god names table; empty where the entry gives none.",
        ),
      ),
      psalm: v.pipe(
        v.strictObject({
          psalm: v.pipe(
            v.number(),
            v.description(
              "The psalm's number, as Lenain cites it; 0 where the entry cites something else, or nothing.",
            ),
          ),
          verse: v.pipe(v.number(), v.description("The verse's number.")),
          la: v.pipe(
            v.string(),
            v.description("The verse in Latin, as Lenain prints it."),
          ),
        }),
        v.description("The verse of the psalms said with the genius's name."),
      ),
      invokedFor: v.pipe(
        en,
        v.description(
          "What the genius is invoked for, in English translated from Lenain's French.",
        ),
      ),
      governs: v.pipe(
        en,
        v.description("What the genius governs or influences, likewise."),
      ),
      bornUnder: v.pipe(
        en,
        v.description(
          "What those born under the genius's influence are like, likewise.",
        ),
      ),
      contrary: v.pipe(
        en,
        v.description(
          "What the genius's contrary, the evil genius set against it, governs, likewise.",
        ),
      ),
      ...ids("seventyTwoAngel"),
    }),
    v.description(
      "The seventy-two genii of the Shem HaMephorash, from Lenain's La Science Cabalistique (1823), in his French and in English.",
    ),
  ),

  chakra: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The chakra's English name, in lower case with hyphens: `solar-plexus`.",
        ),
      ),
      name: v.pipe(
        v.strictObject({
          en: v.pipe(
            v.string(),
            v.description("The English name: Root, Solar Plexus."),
          ),
          sa: v.pipe(
            v.string(),
            v.description("The Sanskrit name, in Devanagari."),
          ),
          roman: v.pipe(
            v.string(),
            v.description("The Sanskrit name romanised: Muladhara."),
          ),
        }),
        v.description("The chakra's name."),
      ),
      meaning: v.pipe(
        en,
        v.description(
          "What the Sanskrit name means, in a few words: Jewel city for Manipura.",
        ),
      ),
      location: v.pipe(
        v.string(),
        v.description(
          "Where on the body the chakra is, as a slug: `base-of-spine`, `navel`, `crown`.",
        ),
      ),
      petals: v.pipe(
        v.number(),
        v.description(
          "How many petals the chakra's lotus has: 4 for the root, 1000 for the crown.",
        ),
      ),
      color: v.pipe(
        v.string(),
        v.description(
          "The colour the seven-chakra system gives it, from red at the root to violet at the crown.",
        ),
      ),
      seed: v.optional(
        v.pipe(
          v.string(),
          v.description(
            "The seed syllable (bija mantra): Lam for the root. The two highest have none.",
          ),
        ),
      ),
      seedMeaning: v.optional(
        v.pipe(
          en,
          v.description(
            "The element the seed syllable belongs to: earth, water, fire, air, space.",
          ),
        ),
      ),
      ...ids("chakra"),
    }),
    v.description(
      "The seven chakras of the modern seven-chakra system, from the root to the crown.",
    ),
  ),

  bodyPart: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The part's name, in lower case with hyphens: `left-face`.",
        ),
      ),
      name: v.pipe(en, v.description("The part's name: left face.")),
      ...ids("bodyPart"),
    }),
    v.description("The parts of the body that the sephirot correspond to."),
  ),

  stone: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The stone's name, in lower case with hyphens: `star-ruby`.",
        ),
      ),
      name: v.pipe(en, v.description("The stone's name: star ruby.")),
      ...ids("stone"),
    }),
    v.description("The precious stones of the sephirot."),
  ),
  scent: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The perfume's name, in lower case with hyphens: `red-sandal`.",
        ),
      ),
      name: v.pipe(en, v.description("The perfume's name: red sandal.")),
      ...ids("scent"),
    }),
    v.description("The perfumes of the sephirot."),
  ),

  alchemySymbol: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description(
          "The principle's or metal's name in lower case: `sulphur`, `lead`.",
        ),
      ),
      symbol: v.pipe(
        v.string(),
        v.description("The alchemical symbol, as a Unicode character: 🜍, 🜪."),
      ),
      altSymbol: v.pipe(
        v.string(),
        v.description(
          "Another symbol for it, which for a metal is its planet's (♄ for lead) and for a principle the same as `symbol`.",
        ),
      ),
      name: v.pipe(en, v.description("The name: Sulphur, Lead.")),
      category: v.pipe(
        v.picklist(["principles", "planets"]),
        v.description(
          "`principles` for the three principles, sulphur, mercury and salt; `planets` for the seven metals of the planets.",
        ),
      ),
      gdGrade: v.pipe(
        v.number(),
        v.description(
          "The number of the Golden Dawn grade whose knowledge lecture teaches the symbol: 1, the Zelator. A number, not a link to the grades table, whose ids are written 1=10.",
        ),
      ),
      ...ids("alchemySymbol", {
        absent: ["planetId"],
        about: {
          planetId:
            "The planet of the metal, which the planet's row names back as `alchemySymbol`. The three principles have none.",
        },
      }),
    }),
    v.description(
      "The alchemical symbols the Golden Dawn teaches at the Zelator grade: the three principles and the seven metals.",
    ),
  ),
  alchemyTerm: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description("The term in lower case with hyphens: `green-lion`."),
      ),
      name: v.pipe(en, v.description("The term: Green Lion, The King.")),
      terms: v.pipe(
        v.strictObject({
          en: v.pipe(
            v.array(v.string()),
            v.description("The phrases, in English."),
          ),
        }),
        v.description(
          "The Golden Dawn's short phrases for the term, from its Second Knowledge Lecture (Regardie, The Golden Dawn, vol. 1, 1937, pp. 119–120). They are the Order's wording, and the package's CC BY grant does not cover them.",
        ),
      ),
      gdGrade: v.pipe(
        v.number(),
        v.description(
          "The number of the grade whose knowledge lecture teaches the term: 1, the Zelator. A number, not a link to the grades table.",
        ),
      ),
      ...ids("alchemyTerm"),
    }),
    v.description(
      "The alchemical terms the Golden Dawn teaches at the Zelator grade, with its phrases for each.",
    ),
  ),
  element: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description("The element's name in lower case: `earth`, `spirit`."),
      ),
      symbol: v.pipe(
        v.string(),
        v.description(
          "The element's symbol, as a Unicode character: 🜃 for earth, ☸ for spirit.",
        ),
      ),
      name: v.pipe(en, v.description("The element's name: Earth.")),
      ...ids("element", {
        absent: ["elementalId"],
        about: {
          elementalId:
            "The elemental of the element, which names the element back. Spirit has none.",
        },
      }),
    }),
    v.description("The four elements and spirit."),
  ),
  elemental: v.pipe(
    v.strictObject({
      id: v.pipe(
        v.string(),
        v.description("The elemental's name in lower case: `gnome`."),
      ),
      name: v.pipe(en, v.description("The name: Gnome.")),
      namePlural: v.pipe(en, v.description("The name in the plural: Gnomes.")),
      title: v.pipe(en, v.description("What they are: Spirits of Earth.")),
      ...ids("elemental", {
        about: {
          elementId: "The elemental's element, which names the elemental back.",
        },
      }),
    }),
    v.description(
      "The four kinds of elementals, the spirits of the elements: gnomes, sylphs, undines and salamanders.",
    ),
  ),
} satisfies Record<TableName, v.GenericSchema>;

/**
 * One entry of the Enochian dictionary, which is no table: what
 * [dictionaryEntry.ts](./enochian/dictionaryEntry.ts) declares by hand, as a
 * schema, so that [the integrity check](./integrity.ts) can hold the shipped
 * entries to it — twenty-two numerals sat there as numbers until it did.
 * `source2` is a citation within the source and `note` a transcriber's
 * remark; a pronunciation may carry both, as a meaning may.
 */
const attested = {
  source: v.string(),
  source2: v.optional(v.string()),
  note: v.optional(v.string()),
};
export const enochianEntry = v.strictObject({
  gematria: v.array(v.number()),
  meanings: v.array(v.strictObject({ meaning: v.string(), ...attested })),
  pronounciations: v.array(
    v.strictObject({ pronounciation: v.string(), ...attested }),
  ),
});
