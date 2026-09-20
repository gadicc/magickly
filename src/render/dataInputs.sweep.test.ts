import { setProperty } from "dot-prop";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DRAWING_QUERIES,
  loadWithTables,
  readTable,
  TABLE_FILES,
  type TableFileName,
  type TableRenderer,
} from "../../tests/renderWithTables";
import { COMPONENT_IMAGE_SLUGS, type ComponentImageSlug } from "./contracts";

/**
 * The whole-data sweep behind `RENDER_INPUT_SWEEP=1`: every field of every row
 * of every table is changed in turn, every component is drawn at every query
 * that draws anything different, and a component whose drawing moved must have
 * moved its inputs hash too. It is the other direction from
 * [dataInputs.test.ts](./dataInputs.test.ts), which proves that every field a
 * spec lists is read; this proves that a spec lists every field that is drawn.
 *
 * It takes minutes, so the normal suite skips it. Run it whenever a registered
 * component starts reading something new.
 */
const sweeping = process.env.RENDER_INPUT_SWEEP === "1";

/** Every dotted path to a value, `grid.0.3` and `rows.2` included. */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>);
  return entries.flatMap(([key, item]) =>
    leafPaths(item, prefix ? `${prefix}.${key}` : key),
  );
}

/** The value at one of those paths. */
function leafValue(row: unknown, field: string): unknown {
  let value = row;
  for (const key of field.split("."))
    value = (value as Record<string, unknown>)[key];
  return value;
}

/** A value of the same kind and a different content. */
function sweptValue(value: unknown): unknown {
  if (typeof value === "string") return `${value}·swept`;
  if (typeof value === "number") return value + 1;
  if (typeof value === "boolean") return !value;
  return "swept";
}

async function drawings(renderer: TableRenderer) {
  const out = new Map<ComponentImageSlug, string>();
  for (const slug of COMPONENT_IMAGE_SLUGS) {
    const parts: string[] = [];
    for (const query of DRAWING_QUERIES[slug]) {
      try {
        parts.push(await renderer.source(slug, query));
      } catch (error) {
        // A change can leave a component unable to draw at all, which is as
        // much a change of its output as different bytes would be.
        parts.push(`threw ${String(error)}`);
      }
    }
    out.set(slug, parts.join("\n<!-- next query -->\n"));
  }
  return out;
}

describe.skipIf(!sweeping)("the whole-data render sweep", () => {
  it("moves an image's inputs hash whenever it moves its drawing", async () => {
    const base = await loadWithTables();
    const baseDrawings = await drawings(base);
    const baseHashes = new Map(
      COMPONENT_IMAGE_SLUGS.map((slug) => [slug, base.inputsHash(slug)]),
    );
    const started = performance.now();
    let mutations = 0;
    let moved = 0;
    const movedBy: Record<string, number> = {};
    for (const table of Object.keys(TABLE_FILES) as TableFileName[]) {
      const rows = readTable(table);
      for (const id of Object.keys(rows)) {
        for (const field of leafPaths(rows[id])) {
          const changed = structuredClone(rows);
          setProperty(
            changed[id] as Record<string, unknown>,
            field,
            sweptValue(leafValue(rows[id], field)),
          );
          mutations++;
          const renderer = await loadWithTables({ [table]: changed });
          const after = await drawings(renderer);
          for (const slug of COMPONENT_IMAGE_SLUGS) {
            if (after.get(slug) === baseDrawings.get(slug)) continue;
            moved++;
            movedBy[slug] = (movedBy[slug] ?? 0) + 1;
            expect(
              `${slug} drawn differently by ${table}.${id}.${field}: hash ${renderer.inputsHash(
                slug,
              )}`,
            ).not.toBe(
              `${slug} drawn differently by ${table}.${id}.${field}: hash ${baseHashes.get(
                slug,
              )}`,
            );
          }
        }
      }
    }
    console.log(
      `\nRENDER_INPUT_SWEEP: ${mutations} changes, ${moved} redrawn images, ` +
        `${JSON.stringify(movedBy)}, ${((performance.now() - started) / 1000).toFixed(0)}s\n`,
    );
    expect(mutations).toBeGreaterThan(2000);
    expect(moved).toBeGreaterThan(0);
  }, 3_600_000);
});
