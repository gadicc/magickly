import { describe, expect, it } from "vitest";
import data from "./data";

type Row = Record<string, unknown>;

/**
 * The links the barrel cannot make, as `table.row.field = value`. Every one is
 * a data bug that fails silently today: [data.ts](./data.ts) looks the value
 * up in the table its field is named after and, finding nothing, leaves the
 * row without its link. Plan 032's step 1 empties this list; the assertion is
 * exact, so a repair that forgets to shorten it fails here.
 */
const EXPECTED_UNRESOLVED = [
  'element.spirit.elementalId = ""',
  'sephirah.daat.archangelId = ""',
  'sephirah.daat.chakraId = ""',
  'sephirah.daat.soulId = ""',
  'tetragram.caput_draconis.planetId = ["venus","jupiter"]',
  'tetragram.cauda_draconis.planetId = ["saturn","mars"]',
];

/**
 * Id-shaped fields named after no table in the barrel. They are not failures:
 * the spirits, intelligences and rulers have no table yet, the tarot deck is
 * its own module, the tribes are not exported by the barrel, and a grade's
 * order and degree are enumerations rather than links.
 */
const EXPECTED_WITHOUT_TABLE = [
  "degreeId",
  "intelligenceId",
  "orderId",
  "rulerId",
  "spiritId",
  "tarotId",
  "tribeOfIsraelId",
];

/** Tables the barrel never walks, because `insertRefs` skips arrays. */
const EXPECTED_ARRAY_TABLES = ["house", "geomanicHouse"];

interface Audit {
  resolved: string[];
  unresolved: string[];
  withoutTable: string[];
  arrayTables: string[];
}

/**
 * Walks the barrel exactly as `insertRefs` does: every key ending in `Id`
 * names a table, and any other object-valued key whose `<key>Id` is absent is
 * recursed into, which is how the paths' `hermetic` and `hebrew` blocks are
 * reached. `null` and an absent key are how the data says "no link", so
 * neither is reported; an array is reported, because the barrel indexes the
 * table with the whole array and never matches.
 */
function audit(): Audit {
  const tables = data as Record<string, unknown>;
  const result: Audit = {
    resolved: [],
    unresolved: [],
    withoutTable: [],
    arrayTables: [],
  };

  const visit = (row: Row, where: string) => {
    for (const [key, value] of Object.entries(row)) {
      if (key.endsWith("Id")) {
        if (value === null || value === undefined) continue;
        const target = tables[key.slice(0, -2)] as Row | undefined;
        if (!target) {
          if (!result.withoutTable.includes(key)) result.withoutTable.push(key);
          continue;
        }
        const found = typeof value === "string" && Object.hasOwn(target, value);
        const report = `${where}.${key} = ${JSON.stringify(value)}`;
        (found ? result.resolved : result.unresolved).push(report);
      } else if (
        row[`${key}Id`] === undefined &&
        typeof value === "object" &&
        value !== null
      ) {
        visit(value as Row, where);
      }
    }
  };

  for (const [name, table] of Object.entries(tables)) {
    if (Array.isArray(table)) {
      result.arrayTables.push(name);
      continue;
    }
    for (const [id, row] of Object.entries(table as Row))
      visit(row as Row, `${name}.${id}`);
  }

  result.unresolved.sort();
  result.withoutTable.sort();
  return result;
}

describe("data integrity", () => {
  it("fails to link exactly the rows plan 032 lists", () => {
    expect(audit().unresolved).toEqual(EXPECTED_UNRESOLVED);
  });

  it("accounts for every id-shaped field with no table", () => {
    expect(audit().withoutTable).toEqual(EXPECTED_WITHOUT_TABLE);
  });

  it("leaves the array tables unlinked", () => {
    expect(audit().arrayTables).toEqual(EXPECTED_ARRAY_TABLES);
  });

  it("links the rest, so an empty walk cannot pass", () => {
    expect(audit().resolved.length).toBeGreaterThan(100);
  });
});
