import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type TableName, tables } from "./tables.ts";

/**
 * The README's table of tables, held to the package (plan 052,
 * decision 11): every table appears once, with its real row count, and its
 * subpath is exported, published, and exports that table. Without this the
 * counts would rot the first time a row was added.
 */

const README = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

interface Row {
  name: string;
  rows: number;
  subpath: string;
}

/** The rows of the Markdown table under "## The tables". */
function readmeTable(): Row[] {
  const section = README.split(/^## /m).find((s) => s.startsWith("The tables"));
  if (!section) throw new Error("README has no “The tables” section");
  const lines = section
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2); // the header and its rule
  return lines.map((line) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const [name, rows, subpath] = cells.map((cell) => cell.replace(/`/g, ""));
    if (cells.length !== 3) throw new Error(`malformed row: ${line}`);
    return { name, rows: Number(rows), subpath };
  });
}

const exportsMap = pkg.exports as Record<string, string>;
const published = pkg.publishConfig.exports as Record<string, unknown>;

function rowCount(name: TableName): number {
  const table = tables[name] as object;
  return Array.isArray(table) ? table.length : Object.keys(table).length;
}

describe("README's table of tables", () => {
  const rows = readmeTable();

  it("names every table exactly once", () => {
    const names = rows.map((row) => row.name);
    expect(names.length).toBe(new Set(names).size);
    expect([...names].sort()).toEqual(Object.keys(tables).sort());
  });

  it.each(rows)(
    "$name: $rows rows at $subpath",
    async ({ name, rows: count, subpath }) => {
      expect(rowCount(name as TableName)).toBe(count);
      expect(exportsMap[subpath]).toBeDefined();
      expect(published[subpath]).toBeDefined();
      // The subpath's default export is that table's rows: the same module
      // instance `tables` imports, not a table that happens to be the same size.
      const module = await import(
        new URL(`../${exportsMap[subpath]}`, import.meta.url).href
      );
      expect(module.default).toBe(tables[name as TableName]);
    },
  );
});
