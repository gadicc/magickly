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
];

/**
 * Fields naming a table whose value is a list of ids. Every id in them
 * resolves, but the barrel matches the `Id` suffix alone, so it makes no link
 * at all here and the rows carry no accessor; step 2's graph gives them one.
 * Listed by field rather than by row, since every row of the table has it.
 */
const EXPECTED_LISTS = ["tetragram.planetIds"];

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
  "rulerIds",
  "spiritId",
  "tarotId",
  "tribeOfIsraelId",
];

/** Tables the barrel never walks, because `insertRefs` skips arrays. */
const EXPECTED_ARRAY_TABLES = ["house", "geomanicHouse"];

interface Audit {
  resolved: string[];
  unresolved: string[];
  lists: string[];
  withoutTable: string[];
  arrayTables: string[];
}

/**
 * Walks the barrel the way `insertRefs` does: a key ending in `Id` names a
 * table, and any other object-valued key whose `<key>Id` is absent is recursed
 * into, which is how the paths' `hermetic` and `hebrew` blocks are reached.
 * `null` and an absent key are how the data says "no link", so neither is
 * reported. It also looks at the `Ids` suffix, which the barrel does not: the
 * plural names a list, and each id in it is checked on its own.
 */
function audit(): Audit {
  const tables = data as Record<string, unknown>;
  const result: Audit = {
    resolved: [],
    unresolved: [],
    lists: [],
    withoutTable: [],
    arrayTables: [],
  };

  const check = (target: Row, value: unknown, where: string) => {
    const found = typeof value === "string" && Object.hasOwn(target, value);
    const report = `${where} = ${JSON.stringify(value)}`;
    (found ? result.resolved : result.unresolved).push(report);
  };

  const visit = (row: Row, table: string, where: string) => {
    for (const [key, value] of Object.entries(row)) {
      const list = key.endsWith("Ids");
      if (list || key.endsWith("Id")) {
        if (value === null || value === undefined) continue;
        const target = tables[key.slice(0, list ? -3 : -2)] as Row | undefined;
        if (!target) {
          if (!result.withoutTable.includes(key)) result.withoutTable.push(key);
          continue;
        }
        if (!list) {
          check(target, value, `${where}.${key}`);
          continue;
        }
        const field = `${table}.${key}`;
        if (!result.lists.includes(field)) result.lists.push(field);
        (value as unknown[]).forEach((id, i) =>
          check(target, id, `${where}.${key}[${i}]`),
        );
      } else if (
        row[`${key}Id`] === undefined &&
        typeof value === "object" &&
        value !== null
      ) {
        visit(value as Row, table, where);
      }
    }
  };

  for (const [name, table] of Object.entries(tables)) {
    if (Array.isArray(table)) {
      result.arrayTables.push(name);
      continue;
    }
    for (const [id, row] of Object.entries(table as Row))
      visit(row as Row, name, `${name}.${id}`);
  }

  result.unresolved.sort();
  result.lists.sort();
  result.withoutTable.sort();
  return result;
}

describe("data integrity", () => {
  it("fails to link exactly the rows plan 032 lists", () => {
    expect(audit().unresolved).toEqual(EXPECTED_UNRESOLVED);
  });

  it("makes no link at all for a list of ids", () => {
    expect(audit().lists).toEqual(EXPECTED_LISTS);
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
