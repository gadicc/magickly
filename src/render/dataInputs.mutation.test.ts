import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  changeTable,
  DRAWING_QUERIES,
  loadWithTables,
  type TableFileName,
  type TableRenderer,
} from "../../tests/renderWithTables";
import { COMPONENT_IMAGE_SLUGS } from "./contracts";
// Bound before the first `vi.resetModules()`, so this stays the real pipeline
// over the emitted tables however many mocked ones are loaded beside it.
import { componentInputsHash } from "./registry";

type Drawing = Record<string, string>;

/** Every component, at every query that draws something different. */
async function drawings(renderer: TableRenderer): Promise<Drawing> {
  const out: Drawing = {};
  for (const slug of COMPONENT_IMAGE_SLUGS)
    for (const query of DRAWING_QUERIES[slug])
      out[`${slug}?${query}`] = `${await renderer.source(
        slug,
        query,
      )}\n${renderer.inputsHash(slug)}`;
  return out;
}

function changedSlugs(before: Drawing, after: Drawing): Set<string> {
  const moved = new Set<string>();
  for (const key of Object.keys(before))
    if (before[key] !== after[key]) moved.add(key.split("?")[0]);
  return moved;
}

async function withChange(
  table: TableFileName,
  change: (rows: Record<string, unknown>) => void,
) {
  return drawings(await loadWithTables(changeTable(table, change)));
}

let base: Drawing;
let baseHashes: Record<string, string>;

beforeAll(async () => {
  const renderer = await loadWithTables();
  base = await drawings(renderer);
  baseHashes = Object.fromEntries(
    COMPONENT_IMAGE_SLUGS.map((slug) => [slug, renderer.inputsHash(slug)]),
  );
}, 120_000);

describe("a data change and the images it can reach", () => {
  it("moves one image's bytes and only that image's inputs hash", async () => {
    // Manasseh's Hebrew name, the fix step 3b was waiting for. The Table of
    // Shewbread prints it in the Gemini branch and nothing else reads it.
    const after = await withChange("tribeOfIsrael", (rows) => {
      (rows.manasseh as { name: { he: string } }).name.he = "מנשה";
    });
    expect([...changedSlugs(base, after)]).toEqual(["table-of-shewbread"]);
    const renderer = await loadWithTables(
      changeTable("tribeOfIsrael", (rows) => {
        (rows.manasseh as { name: { he: string } }).name.he = "מנשה";
      }),
    );
    for (const slug of COMPONENT_IMAGE_SLUGS)
      if (slug === "table-of-shewbread")
        expect(renderer.inputsHash(slug)).not.toBe(baseHashes[slug]);
      else expect(renderer.inputsHash(slug)).toBe(baseHashes[slug]);
  }, 120_000);

  it("reaches through a link: an archangel's name is a Tree label", async () => {
    // The Tree names no archangel table; it prints `archangel.name.he` off a
    // sephirah, which is exactly what hashing resolved values covers.
    const after = await withChange("archangel", (rows) => {
      (rows.metatron as { name: { he: string } }).name.he = "מיטטרון";
    });
    expect([...changedSlugs(base, after)]).toEqual(["tree-of-life"]);
  }, 120_000);

  it("follows a repointed link without the id itself being listed", async () => {
    const after = await withChange("sephirah", (rows) => {
      (rows.keter as { godNameId: string }).godNameId = "elohim";
    });
    expect([...changedSlugs(base, after)]).toEqual(["tree-of-life"]);
  }, 120_000);

  it("leaves both bytes and hash alone for a field no component draws", async () => {
    // `tenHeavens` is on every sephirah and is in no image's inputs; `emoji`
    // sits beside the sign symbol the shewbread and the chart do draw; a
    // tribe's English name is beside the Hebrew one.
    const untouched: [
      TableFileName,
      (rows: Record<string, unknown>) => void,
    ][] = [
      [
        "sephirah",
        (rows) => {
          (rows.keter as { tenHeavens: unknown }).tenHeavens = "swept";
        },
      ],
      [
        "zodiac",
        (rows) => {
          (rows.gemini as { emoji: string }).emoji = "🧪";
        },
      ],
      [
        "tribeOfIsrael",
        (rows) => {
          (rows.manasseh as { name: { en: string } }).name.en = "Manasseh";
        },
      ],
      [
        "planet",
        (rows) => {
          (rows.sol as { scent?: unknown }).scent = "swept";
        },
      ],
    ];
    for (const [table, change] of untouched) {
      const after = await withChange(table, change);
      expect([table, ...changedSlugs(base, after)]).toEqual([table]);
    }
  }, 180_000);

  it("never moves the rose sigil, which reads no table at all", async () => {
    const renderer = await loadWithTables(
      changeTable("hebrewLetter", (rows) => {
        for (const id of Object.keys(rows))
          (rows[id] as { letter?: { he?: string } }).letter = { he: "ת" };
      }),
    );
    expect(renderer.inputsHash("rose-sigil")).toBe(baseHashes["rose-sigil"]);
    expect(await renderer.source("rose-sigil", "text=א&rose=false")).toBe(
      base["rose-sigil?text=א&rose=false"].split("\n").slice(0, -1).join("\n"),
    );
    // The Tree draws the path letters, so the same change does move it.
    expect(renderer.inputsHash("tree-of-life")).not.toBe(
      baseHashes["tree-of-life"],
    );
  }, 120_000);

  it("agrees with the unmocked pipeline on every hash", () => {
    for (const slug of COMPONENT_IMAGE_SLUGS)
      expect(`${slug} ${componentInputsHash(slug)}`).toBe(
        `${slug} ${baseHashes[slug]}`,
      );
  });
});
