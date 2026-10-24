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
import { graph } from "./graph.ts";
import type { TableSpec } from "./graphSpec.ts";
import type { TableName } from "./tables.ts";

type Entries = Record<string, v.GenericSchema>;

/** `{ en: "…" }`, which is how most of the data carries a single language. */
const en = v.strictObject({ en: v.string() });

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
const tabletReading = v.strictObject({
  /** A row a string, a square a letter, or "." for an empty square. */
  rows: v.array(v.pipe(v.string(), v.regex(/^[A-Za-z.]+$/))),
  /** The squares that hold more than their letter, each at most once. */
  marks: v.optional(
    v.array(
      v.strictObject({
        row: tabletIndex,
        column: tabletIndex,
        beside: v.optional(v.array(tabletLetter)),
        below: v.optional(v.array(tabletLetter)),
        reversed: v.optional(v.boolean()),
        dictated: v.optional(v.array(tabletLetter)),
        misprint: v.optional(tabletLetter),
        alt: v.optional(v.array(tabletLetter)),
        // Not a picklist, which a declaration would state per row and most
        // readings never use: Tablets.ts types it.
        doubt: v.optional(
          v.pipe(
            v.string(),
            v.check((doubt) => ["low", "medium", "high"].includes(doubt)),
          ),
        ),
      }),
    ),
  ),
});

const byHouse = (value: v.GenericSchema): Entries =>
  Object.fromEntries(HOUSE_NUMBERS.map((no) => [no, value]));

/**
 * A table's id-shaped fields, as the graph declares them: an id, or a list of
 * ids where the field name is plural. `absent` names the ones some rows leave
 * out, and `nulled` the ones some rows spell `null`. A dotted field belongs
 * to the block it is in, which the table declares for itself.
 */
function ids(
  table: TableName,
  absent: readonly string[] = [],
  nulled: readonly string[] = [],
): Entries {
  const spec = graph[table] as TableSpec;
  const entries: Entries = {};

  const add = (field: string, schema: v.GenericSchema) => {
    if (field.includes(".")) return;
    const value = nulled.includes(field) ? v.nullable(schema) : schema;
    entries[field] = absent.includes(field) ? v.optional(value) : value;
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

/** One schema per table, in the order [tables.ts](./tables.ts) names them. */
export const schemas = {
  planet: v.strictObject({
    id: v.string(),
    /** Which of the two things this table holds the row is: required of both. */
    kind: v.picklist(["planet", "sphere"]),
    name: v.strictObject({
      en,
      he: v.optional(
        v.strictObject({
          he: v.string(),
          roman: v.string(),
          en: v.optional(v.string()),
        }),
      ),
    }),
    // The three spheres of the Tree in this table have a name and nothing else.
    symbol: v.optional(v.string()),
    magickTypes: v.optional(en),
    /**
     * The Key of Solomon's operations for a planet's days and hours, after
     * Mathers (1888), Book I, chapter II: the seven planets only.
     */
    keyOfSolomon: v.optional(en),
    ...ids("planet", [
      "hebrewLetterId",
      "godNameId",
      "archangelId",
      "intelligenceId",
      "spiritId",
    ]),
  }),
  zodiac: v.strictObject({
    id: v.string(),
    no: v.number(),
    symbol: v.string(),
    emoji: v.string(),
    name: en,
    meaning: en,
    /** The dates it rules from and to, as `[month, day]`. */
    rulesFrom: v.tuple([
      v.tuple([v.number(), v.number()]),
      v.tuple([v.number(), v.number()]),
    ]),
    quadruplicity: v.picklist(["cardinal", "kerubic", "mutable"]),
    tetragrammatonPermutation: v.string(),
    ...ids("zodiac"),
  }),
  astrologicalHouse: v.strictObject({
    index: v.number(),
    motto: v.strictObject({ la: v.string(), en: v.string() }),
    name: en,
    interpretation: en,
    ...ids("astrologicalHouse"),
  }),

  hebrewLetter: v.strictObject({
    id: v.string(),
    letter: v.strictObject({
      he: v.string(),
      name: v.string(),
      latin: v.string(),
    }),
    index: v.number(),
    value: v.number(),
    meaning: en,
    ...ids("hebrewLetter"),
  }),

  enochianLetter: v.strictObject({
    id: v.string(),
    enochian: v.string(),
    title: v.string(),
    english: v.string(),
    pronounciation: v.string(),
    gematria: v.number(),
    ...ids("enochianLetter"),
  }),
  enochianTablet: v.pipe(
    v.strictObject({
      id: v.string(),
      /**
       * A Watchtower, one of the four elemental tablets, or the Tablet of
       * Union, which joins them: required of every row.
       */
      kind: v.picklist(["watchtower", "union"]),
      /**
       * Each source's letters, by source. A version of the tablet is a
       * rule over these (`tabletVersion` in `Tablets.ts`).
       */
      readings: v.strictObject(
        Object.fromEntries(
          TABLET_SOURCES.map((source) => [source, v.optional(tabletReading)]),
        ) as Record<
          (typeof TABLET_SOURCES)[number],
          v.OptionalSchema<typeof tabletReading, undefined>
        >,
      ),
      /**
       * Where a version departs from its base reading, square by square:
       * `gd`, the Golden Dawn's, takes another source's letter where
       * Regardie's higher letter is not the Order's.
       */
      choices: v.optional(
        v.strictObject({
          gd: v.array(
            v.strictObject({
              row: tabletIndex,
              column: tabletIndex,
              from: v.picklist(TABLET_SOURCES),
            }),
          ),
        }),
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
  ),

  tetragram: v.strictObject({
    id: v.string(),
    /** Four lines of one or two points, head first. */
    rows: v.array(v.picklist([1, 2])),
    title: en,
    translation: en,
    meaning: en,
    meanings: v.strictObject(byHouse(en)),
    ...ids("tetragram", [], ["zodiacId"]),
  }),
  geomanticHouse: v.strictObject({
    id: v.number(),
    meaning: en,
    ...ids("geomanticHouse"),
  }),

  gdGrade: v.strictObject({
    id: v.string(),
    name: v.string(),
    // Portal belongs to no order and has no degree; the first grade has
    // nothing before it and the last nothing after.
    ...ids("gdGrade", [
      "elementId",
      "planetId",
      "sephirahId",
      "degreeId",
      "nextId",
      "prevId",
      "orderId",
    ]),
  }),
  gdDegree: v.strictObject({
    id: v.string(),
    ...ids("gdDegree"),
  }),

  archangel: v.strictObject({
    id: v.string(),
    name: v.strictObject({
      he: v.string(),
      roman: v.string(),
      en: v.optional(v.string()),
    }),
    ...ids("archangel", ["planetId", "sephirahId"]),
  }),
  angelicOrder: v.strictObject({
    name: v.strictObject({
      he: v.string(),
      en: v.string(),
      roman: v.string(),
    }),
    ...ids("angelicOrder"),
  }),
  christianChoir: v.strictObject({
    id: v.string(),
    name: v.strictObject({ en: v.string(), fr: v.string() }),
    ...ids("christianChoir"),
  }),
  fourWorlds: v.strictObject({
    id: v.string(),
    name: v.strictObject({
      en: v.string(),
      roman: v.string(),
      he: v.string(),
    }),
    desc: en,
    residentsTitle: en,
    ...ids("fourWorlds"),
  }),
  godName: v.strictObject({
    name: v.strictObject({
      he: v.string(),
      roman: v.string(),
      en: v.string(),
    }),
    ...ids("godName"),
  }),
  kerub: v.strictObject({
    id: v.string(),
    title: en,
    face: v.strictObject({
      en: v.string(),
      he: v.string(),
      roman: v.string(),
    }),
    ...ids("kerub"),
  }),
  sephirah: v.strictObject({
    index: v.number(),
    id: v.string(),
    name: v.strictObject({
      he: v.string(),
      roman: v.string(),
      en: v.string(),
    }),
    /** Da'at is drawn dashed and has no King scale. */
    color: v.strictObject({
      king: v.optional(v.string()),
      kingWeb: v.optional(v.string()),
      kingWebText: v.optional(v.string()),
      queen: v.string(),
      queenWeb: v.string(),
      queenWebText: v.optional(v.string()),
      strokeColor: v.optional(v.string()),
      strokeDasharray: v.optional(v.number()),
    }),
    bodyPos: v.string(),
    // Da'at is not a sephirah of the Tree and has almost none of these; four
    // of the lower spheres share no part of the soul. Da'at has no stone or
    // scent, and Malchut no scent.
    ...ids(
      "sephirah",
      [
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
      ["soulId"],
    ),
  }),
  treeOfLifePath: v.strictObject({
    id: v.string(),
    /** Two paths of the Hebrew tree are not on the Hermetic one. */
    hermetic: v.optional(
      v.strictObject({
        hebrewLetterId: v.string(),
        pathNo: v.number(),
        tarotId: v.string(),
        /**
         * The trump's common title, with the Golden Dawn's "The Universe"
         * for XXI.
         */
        tarotTitle: v.string(),
      }),
    ),
    hebrew: v.optional(v.strictObject({ hebrewLetterId: v.string() })),
    ...ids("treeOfLifePath", ["nextId", "prevId"]),
  }),
  soul: v.strictObject({
    id: v.string(),
    name: v.strictObject({
      en: v.string(),
      he: v.string(),
      roman: v.string(),
    }),
    ...ids("soul"),
  }),
  tribeOfIsrael: v.strictObject({
    id: v.string(),
    name: v.strictObject({ en: v.string(), he: v.string() }),
    ...ids("tribeOfIsrael"),
  }),
  seventyTwoAngel: v.strictObject({
    no: v.number(),
    /**
     * Every genius has a Hebrew name: forty-seven where two readings of the
     * scan agree, twenty-five read by a person because they never would. The
     * letters and Lenain's marks are kept apart — `he` identifies the name,
     * `hePointed` is what he printed — and `heSource` says which reading it
     * came from, so a machine pass cannot quietly displace a human one.
     */
    name: v.strictObject({
      en: v.string(),
      he: v.optional(v.string()),
      hePointed: v.optional(v.string()),
      heSource: v.optional(v.picklist(["hand", "corroborated"])),
    }),
    printedPages: v.array(v.number()),
    attribute: v.strictObject({ en: v.string(), fr: v.string() }),
    people: v.strictObject({ en: v.string(), fr: v.string() }),
    /** That nation's name for God, not a row of the god names. */
    godName: v.string(),
    /** `psalm` is 0 where the entry cites something else, or nothing. */
    psalm: v.strictObject({
      psalm: v.number(),
      verse: v.number(),
      la: v.string(),
    }),
    invokedFor: en,
    governs: en,
    bornUnder: en,
    contrary: en,
    ...ids("seventyTwoAngel"),
  }),

  chakra: v.strictObject({
    id: v.string(),
    name: v.strictObject({
      en: v.string(),
      sa: v.string(),
      roman: v.string(),
    }),
    meaning: en,
    location: v.string(),
    petals: v.number(),
    color: v.string(),
    /** The two highest have no seed syllable. */
    seed: v.optional(v.string()),
    seedMeaning: v.optional(en),
    ...ids("chakra"),
  }),

  bodyPart: v.strictObject({
    id: v.string(),
    name: en,
    ...ids("bodyPart"),
  }),

  stone: v.strictObject({
    id: v.string(),
    name: en,
    ...ids("stone"),
  }),
  scent: v.strictObject({
    id: v.string(),
    name: en,
    ...ids("scent"),
  }),

  alchemySymbol: v.strictObject({
    id: v.string(),
    symbol: v.string(),
    altSymbol: v.string(),
    name: en,
    category: v.picklist(["principles", "planets"]),
    /** The grade that teaches it, as a number; not a link to the grades. */
    gdGrade: v.number(),
    ...ids("alchemySymbol", ["planetId"]),
  }),
  alchemyTerm: v.strictObject({
    id: v.string(),
    name: en,
    terms: v.strictObject({ en: v.array(v.string()) }),
    gdGrade: v.number(),
    ...ids("alchemyTerm"),
  }),
  element: v.strictObject({
    id: v.string(),
    symbol: v.string(),
    name: en,
    /** Spirit has no elemental. */
    ...ids("element", ["elementalId"]),
  }),
  elemental: v.strictObject({
    id: v.string(),
    name: en,
    namePlural: en,
    title: en,
    ...ids("elemental"),
  }),
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
