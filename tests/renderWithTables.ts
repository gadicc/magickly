import { readFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";
import type { ComponentImageSlug } from "@/render/contracts";
import { TREE_IMAGE_FIELDS } from "@/render/contracts/treeOfLife";

/**
 * Render a registered component over a changed copy of the data.
 *
 * The tables are JSON modules, so nothing can mutate them once they are
 * loaded: `assemble()` clones and freezes, and the typed modules hand out the
 * import. A changed table therefore has to arrive as a different module, which
 * is what this does — one `vi.doMock` per emitted JSON file, then a fresh
 * import of the registry, the contracts and `dataInputs` on top of them.
 *
 * What is compared is the *source* SVG rather than the outlined bytes. The
 * outliner is a pure function of that string, so identical source means
 * identical bytes, and this also covers the `sourceSha256` the generated-image
 * catalog records; it is a few milliseconds instead of a few hundred.
 */

const DIST = path.join(process.cwd(), "data/dist");

/** Every table, by the name the graph and the barrel use for it. */
export const TABLE_FILES = {
  planet: "astrology/planets.json",
  zodiac: "astrology/zodiac.json",
  house: "astrology/houses.json",
  hebrewLetter: "hebrewLetters.json",
  enochianLetter: "enochian/letters.json",
  enochianTablet: "enochian/tablets.json",
  tetragram: "geomancy/tetragrams.json",
  geomanicHouse: "geomancy/houses.json",
  gdGrade: "gd/grades.json",
  gdDegree: "gd/degrees.json",
  archangel: "kabbalah/archangels.json",
  angelicOrder: "kabbalah/angelicOrders.json",
  christianChoir: "kabbalah/christianChoirs.json",
  fourWorlds: "kabbalah/fourWorlds.json",
  godName: "kabbalah/godNames.json",
  kerub: "kabbalah/kerubim.json",
  sephirah: "kabbalah/sephirot.json",
  tolPath: "kabbalah/paths.json",
  soul: "kabbalah/souls.json",
  tribeOfIsrael: "kabbalah/tribesOfIsrael.json",
  seventyTwoAngel: "kabbalah/seventyTwoAngels.json",
  chakra: "chakras.json",
  alchemySymbol: "alchemy/symbols.json",
  alchemyTerm: "alchemy/terms.json",
  element: "alchemy/elements.json",
  elemental: "alchemy/elementals.json",
} as const;

export type TableFileName = keyof typeof TABLE_FILES;

type Rows = Record<string, unknown>;

const loaded = new Map<string, Rows>();

/** The emitted table, parsed once and shared; callers clone before changing it. */
export function readTable(table: TableFileName): Rows {
  const file = path.join(DIST, TABLE_FILES[table]);
  let rows = loaded.get(file);
  if (!rows) {
    rows = JSON.parse(readFileSync(file, "utf8")) as Rows;
    loaded.set(file, rows);
  }
  return rows;
}

export interface TableRenderer {
  /** The component's JSX as it reaches the outliner, for the given query. */
  source(slug: ComponentImageSlug, query?: string): Promise<string>;
  /** The `inputs.sha256` each slug publishes under these tables. */
  inputsHash(slug: ComponentImageSlug): string;
}

/**
 * Load the render pipeline with `changed` in place of the emitted tables.
 * Every call resets the module registry, so the caller must not hold a module
 * across one.
 */
export async function loadWithTables(
  changed: Partial<Record<TableFileName, Rows>> = {},
): Promise<TableRenderer> {
  vi.resetModules();
  for (const name of Object.keys(TABLE_FILES) as TableFileName[]) {
    const rows = changed[name] ?? readTable(name);
    vi.doMock(path.join(DIST, TABLE_FILES[name]), () => ({ default: rows }));
  }
  const registry = await import("@/render/registry");
  const { CONTRACTS } = await import("@/render/contracts");
  const { renderToStaticMarkup } = await import("react-dom/server");
  return {
    async source(slug, query = "") {
      const props = CONTRACTS[slug].parse(new URLSearchParams(query));
      return renderToStaticMarkup(
        await registry.COMPONENT_IMAGE_REGISTRY[slug].render(props as never),
      );
    },
    inputsHash: (slug) => registry.componentInputsHash(slug),
  };
}

/**
 * Queries that between them draw everything a component can draw from the
 * data. The Tree takes at most four fields per label, so its contract's field
 * list is spent four at a time, with Da'at shown throughout (only the queen
 * scale defines it); the last two queries add the king scale, the Hebrew
 * letters and a highlighted path.
 */
export const DRAWING_QUERIES: Record<ComponentImageSlug, readonly string[]> = {
  "tree-of-life": [
    ...Array.from({ length: Math.ceil(TREE_IMAGE_FIELDS.length / 4) }, (_, i) =>
      TREE_IMAGE_FIELDS.slice(i * 4, i * 4 + 4).join(","),
    ).map((fields) => `field=${fields}&showDaat=true`),
    "colorScale=king&topText=name.he&bottomText=scent",
    "letterAttr=hebrew&activePath=2_5&field=gdGrade.id",
  ],
  "astro-geomancy-chart": ["", "m=2222111122221111"],
  "enochian-tablet": ["", "id=air", "font=enochian"],
  "seven-branched-candlestick": [""],
  "table-of-shewbread": [""],
  "rose-sigil": ["text=א&rose=false"],
};

/** A changed copy of one table, for `loadWithTables`. */
export function changeTable(
  table: TableFileName,
  change: (rows: Rows) => void,
): Partial<Record<TableFileName, Rows>> {
  const rows = structuredClone(readTable(table));
  change(rows);
  return { [table]: rows };
}
