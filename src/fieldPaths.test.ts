import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TREE_IMAGE_FIELDS } from "@/render/contracts/treeOfLife";
import { sets } from "@/study/sets";
import data from "../data/data";
import { pathTarget } from "../data/pathTarget";
import type { TableName } from "../data/tables";

/**
 * Every dotted field path the app treats as public, checked against the
 * graph and the data without rendering anything
 * ([pathTarget](../data/pathTarget.ts)).
 *
 * These paths are read with dot-prop at runtime, which answers `undefined`
 * for a path that no longer resolves, so until now a renamed field or a
 * removed link showed up as a blank label — in a ritual a reader had already
 * published, in the worst case. They arrive from four places, and all four
 * are read here from the file that holds them rather than copied, so that
 * adding a path adds it to this test too.
 */

/** `?field=a,b,c`: the tree's queries carry several paths in one value. */
const paths = (value: string) => value.split(",").filter(Boolean);

const resolves = (table: TableName, path: string) =>
  `${table}.${path} → ${JSON.stringify(pathTarget(table, path))}`;

/** Each path with what it resolves to, so a failure names the broken one. */
const targets = (table: TableName, list: readonly string[]) =>
  list.map((path) => resolves(table, path));

const unresolved = (table: TableName, list: readonly string[]) =>
  list.filter((path) => pathTarget(table, path) === undefined);

describe("public field paths", () => {
  it("resolves every field the Tree of Life image exposes", () => {
    expect(TREE_IMAGE_FIELDS.length).toBe(30);
    expect(unresolved("sephirah", TREE_IMAGE_FIELDS)).toEqual([]);
  });

  it("resolves the fields the grade tree asks the Tree for", () => {
    // Read from the component, so that editing it edits this list.
    const source = readFileSync("src/components/gd/GradeTree.tsx", "utf8");
    const asked = [
      ...source.matchAll(/(?:field|topText|bottomText)="([^"]*)"/g),
    ]
      .flatMap((match) => paths(match[1]))
      .sort();
    expect(asked).toEqual([
      "gdGrade.element.symbol",
      "gdGrade.id",
      "gdGrade.name",
      "gdGrade.orderId",
      "gdGrade.planet.symbol",
    ]);
    expect(unresolved("sephirah", asked)).toEqual([]);
  });

  it("resolves every field the built-in ritual documents draw", () => {
    const dir = "src/doc";
    const sources = readdirSync(dir).filter((name) => name.endsWith(".jade"));
    expect(sources).toContain("2=9.jade");

    const asked: string[] = [];
    const letters: string[] = [];
    for (const name of sources) {
      const text = readFileSync(join(dir, name), "utf8");
      for (const [, query] of text.matchAll(/\/api\/[^"'\s]*\?([^"'\s)]+)/g)) {
        const params = new URLSearchParams(query);
        for (const key of ["field", "topText", "bottomText"])
          asked.push(...paths(params.get(key) ?? ""));
        // `letterAttr` names the block a path's letter is read from, which is
        // how the Tree reaches `path[letterAttr].hebrewLetter.letter.he`.
        const letterAttr = params.get("letterAttr");
        if (letterAttr) letters.push(letterAttr);
      }
    }

    expect(asked.toSorted()).toEqual([
      "angelicOrder.name.he",
      "archangel.name.he",
      "godName.name.he",
      "index",
      "name.roman",
    ]);
    expect(unresolved("sephirah", asked)).toEqual([]);
    // No document names one today; both values the contract allows resolve.
    expect(letters).toEqual([]);
    expect(
      unresolved("tolPath", [
        "hermetic.hebrewLetter.letter.he",
        "hebrew.hebrewLetter.letter.he",
      ]),
    ).toEqual([]);
  });

  it("resolves every study set's question and answer", () => {
    // The sets hold the rows themselves, so the table each set is over is the
    // table those rows came from; a set that builds its own cards is named.
    const tableOfRow = new Map<unknown, TableName>();
    for (const [name, table] of Object.entries(data))
      for (const row of Object.values(table))
        tableOfRow.set(row, name as TableName);

    const built = ["alchemy-basic-terms", "kerubim-face", "kerubim-zodiac"];
    const checked: string[] = [];

    for (const [id, set] of Object.entries(sets)) {
      const rows = Object.values(set.data as Record<string, unknown>);
      expect(rows.length, id).toBeGreaterThan(0);
      const tablesOf = new Set(rows.map((row) => tableOfRow.get(row)));
      const table = tablesOf.size === 1 ? [...tablesOf][0] : undefined;
      const asked = [set.question, set.answer].filter(
        (value) => typeof value === "string",
      );

      if (!table) {
        // Cards built in the set itself: the fields are on those objects.
        expect(built, id).toContain(id);
        for (const path of asked)
          for (const row of rows)
            expect(Object.hasOwn(row as object, path), `${id}.${path}`).toBe(
              true,
            );
        continue;
      }

      expect(built, id).not.toContain(id);
      expect(unresolved(table, asked), id).toEqual([]);
      checked.push(...asked.map((path) => `${table}.${path}`));
    }

    // Every set is either over a table or named above, and the sets that are
    // over a table ask 45 paths between them.
    expect(checked).toHaveLength(45);
  });

  it("names the table and field a path ends on", () => {
    expect(resolves("sephirah", "gdGrade.planet.symbol")).toBe(
      'sephirah.gdGrade.planet.symbol → {"table":"planet","field":"symbol","many":false}',
    );
    expect(targets("sephirah", ["index"])).toEqual([
      'sephirah.index → {"table":"sephirah","field":"index","many":false}',
    ]);
  });
});
