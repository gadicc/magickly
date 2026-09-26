import { describe, expect, it } from "vitest";
import { assemble } from "@/../data/assemble";
import { tables } from "@/../data/tables";
import type { EntityFields } from "./fields";

/**
 * Every entity page accounts for the whole of its row (plan 036, decision
 * 12).
 *
 * Each page declares, in a `fields.ts` beside it, the keys it shows and the
 * keys it leaves out, and this holds the two lists to the table: disjoint,
 * neither repeating a key, and together exactly its keys one level deep over
 * every row. A field, link or back-link added to the data then fails here,
 * by name, until a page decides about it — the inventory-both-ways rule the
 * graph check keeps for ids.
 *
 * The rows are the full registry's, assembled, so a table the barrel does
 * not hold (`seventyTwoAngel`) is walked with its accessors like any other.
 * One level deep is what [integrity.ts](../../../data/integrity.ts)'s
 * `idFields` walks: a field the JSON gives as an object contributes its keys,
 * `color.king`, and the accessors a nested link puts beside them,
 * `hermetic.hebrewLetter`; a link's accessor and an inverse are keys in
 * their own right and are not walked into, since what they hold is another
 * table's row.
 */
const declarations = import.meta.glob("../../app/**/fields.ts", {
  eager: true,
}) as Record<string, { fields?: EntityFields }>;

type Row = Record<string, unknown>;

const plain = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assembled = assemble(tables) as unknown as Record<string, unknown>;

/** Each row as authored beside the same row assembled, by key or by index. */
function rowPairs(table: string): Array<[Row, Row]> {
  const raw = tables[table as keyof typeof tables] as unknown;
  const joined = assembled[table];
  if (Array.isArray(raw))
    return raw.map((row, i) => [row as Row, (joined as Row[])[i]]);
  return Object.keys(raw as Row).map((id) => [
    (raw as Record<string, Row>)[id],
    (joined as Record<string, Row>)[id],
  ]);
}

/** A table's keys one level deep, over every row. */
function keysOf(table: string) {
  const keys = new Set<string>();
  for (const [raw, row] of rowPairs(table))
    for (const key of Object.keys(row)) {
      // Walk only what the JSON gives as an object, not what a link put there.
      if (Object.hasOwn(raw, key) && plain(raw[key]))
        for (const nested of Object.keys(row[key] as Row))
          keys.add(`${key}.${nested}`);
      else keys.add(key);
    }
  return keys;
}

const repeated = (list: readonly string[]) =>
  list.filter((key, i) => list.indexOf(key) !== i);

describe("the key walk", () => {
  it("steps into a block, onto its nested accessors, and not into a link", () => {
    const paths = keysOf("tolPath");
    expect(paths).toContain("hermetic.tarotId");
    expect(paths).toContain("hermetic.hebrewLetter");
    expect(paths).toContain("next");
    expect(paths).not.toContain("hermetic");
    expect(paths).not.toContain("next.id");
    expect(keysOf("sephirah")).toContain("godName");
    expect(keysOf("sephirah")).not.toContain("godName.name");
  });

  it("takes the union over every row, not the first row's keys", () => {
    // Only some of the seventy-two carry Lenain's pointing; Vehuiah does not.
    expect(Object.hasOwn(tables.seventyTwoAngel[0].name, "hePointed")).toBe(
      false,
    );
    expect(keysOf("seventyTwoAngel")).toContain("name.hePointed");
  });
});

/**
 * Every entity page that declares its row. The glob would pass a page whose
 * `fields.ts` was renamed or deleted by no longer finding it, so each page's
 * declaration is named here as well, and must be found.
 */
const DECLARED = [
  "../../app/kabbalah/angel/[slug]/fields.ts",
  "../../app/kabbalah/sephirah/[id]/fields.ts",
  "../../app/kabbalah/path/[id]/fields.ts",
  "../../app/astrology/planet/[id]/fields.ts",
  "../../app/gd/grade/[id]/fields.ts",
];

describe("each entity page's declaration", () => {
  it("is found, every one of them", () => {
    expect(Object.keys(declarations).sort()).toEqual([...DECLARED].sort());
  });

  for (const [file, module] of Object.entries(declarations))
    it(`accounts for its table's whole row: ${file}`, () => {
      const fields = module.fields;
      expect(fields, `${file} exports no fields`).toBeDefined();
      if (!fields) return;
      const { table, shown, omitted } = fields;

      expect(Object.keys(tables), `${file}'s table`).toContain(table);
      expect(repeated(shown), `${file}: shown twice`).toEqual([]);
      expect(repeated(omitted), `${file}: omitted twice`).toEqual([]);
      expect(
        shown.filter((key) => omitted.includes(key)),
        `${file}: both shown and omitted`,
      ).toEqual([]);

      const keys = keysOf(table);
      const declared = new Set([...shown, ...omitted]);
      expect(
        [...keys].filter((key) => !declared.has(key)),
        `${file}: keys of ${table} it neither shows nor omits`,
      ).toEqual([]);
      expect(
        [...declared].filter((key) => !keys.has(key)),
        `${file}: keys it declares that ${table} does not have`,
      ).toEqual([]);
    });
});
