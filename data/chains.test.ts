import { describe, expect, it } from "vitest";
import grades from "./gd/Grades";
import paths from "./kabbalah/Paths";
import sephirot from "./kabbalah/Sephirot";

type Chained = Record<string, { nextId?: string; prevId?: string }>;

/**
 * Three tables order themselves with `nextId` and `prevId`, stored in both
 * directions so the JSON stays self-contained (plan 032, decision 4). One
 * walk proves the pair is symmetric, that the chain has exactly one head and
 * one tail, and that it reaches every row it should, once each.
 */
function walk(table: Chained, outside: string[]) {
  const rows = Object.entries(table);
  const loose = rows.filter(([, row]) => !row.nextId && !row.prevId);
  expect(loose.map(([id]) => id)).toEqual(outside);

  const chained = rows.filter(([, row]) => row.nextId || row.prevId);
  const heads = chained.filter(([, row]) => !row.prevId);
  expect(heads.map(([id]) => id)).toHaveLength(1);
  expect(chained.filter(([, row]) => !row.nextId)).toHaveLength(1);

  const visited: string[] = [];
  let id: string | undefined = heads[0][0];
  while (id && !visited.includes(id)) {
    visited.push(id);
    const nextId: string | undefined = table[id].nextId;
    if (nextId) expect(table[nextId]?.prevId, nextId).toBe(id);
    id = nextId;
  }
  expect([...visited].sort()).toEqual(chained.map(([rowId]) => rowId).sort());
}

describe("chained tables", () => {
  it("runs the sephirot from Keter to Malkut, without Da'at", () => {
    // Da'at is not a sephirah of the Tree, so it is outside the chain.
    walk(sephirot, ["daat"]);
  });

  it("runs the grades from Neophyte to Ipsissimus", () => {
    walk(grades, []);
  });

  it("runs the paths in hermetic order, then the two with no number", () => {
    walk(paths, []);
  });
});
