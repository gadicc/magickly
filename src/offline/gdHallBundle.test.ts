import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { GD_HALL_FONT_FILES, validateHall } from "@magick-components/gd/hall";
import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import type { HallNode } from "@magick-components/gd/hall/types";
import { afterEach, expect, it, vi } from "vitest";
import { gdHallArt } from "../app/gd/hall/art";
import { GD_HALL_FONT_BASE } from "../app/gd/hall/fontBase";
import { gdHallSource } from "../doc/gdHallRows";
import { parseRitualPug, RITUAL_PUG_HEADER } from "../doc/ritualPug";
import { compileSemanticSource } from "../doc/semanticCompile";
import { RITUAL_PUBLICATION_STATIC_PATHS } from "../files/ritualPublicationStaticPaths";
import { createStaticRitualImageCatalog } from "../files/staticRitualImageCatalog";
import { createUuidV7 } from "../lib/ids";
import { prepareRitualBundle } from "./prepareRitualBundle";
import { inventoryRitualAssetJson } from "./ritualAssetInventory";
import { createRitualAssetPlan } from "./ritualAssetPlan";
import { parseRitualBundleManifest } from "./ritualBundleManifest";
import { createRitualRenderDescriptor } from "./ritualRenderDescriptor";

vi.mock("server-only", () => ({}));
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const disposals: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
});

/** A published ritual: the Neophyte hall in its text, and every preset. */
function publishedHallRitual() {
  const document = parseRitualPug(
    `${RITUAL_PUG_HEADER}\n${readFileSync("src/doc/fixtures/gdHallNeophyte.pug", "utf8")}`,
  );
  document.nodes.push(
    ...HALL_PRESETS.map((preset) => gdHallSource(preset.hall)),
  );
  const compiled = compileSemanticSource(JSON.stringify(document));
  if (!compiled) throw new Error("The hall ritual did not compile");
  return compiled.contentJson;
}

it("inventories a ritual with halls completely: they load no assets", () => {
  const inventory = inventoryRitualAssetJson(publishedHallRitual(), {
    knownAppOrigins: ["https://magick.ly"],
    staticPaths: RITUAL_PUBLICATION_STATIC_PATHS,
  });
  expect(inventory.issues).toEqual([]);
  expect(inventory.occurrences).toEqual([]);
  expect(inventory.enumerationComplete).toBe(true);
});

it("bundles a ritual with halls for offline reading, rows intact", async () => {
  const contentJson = publishedHallRitual();
  const catalog = await createStaticRitualImageCatalog({
    publicDirectory: path.resolve("public"),
    paths: [],
  });
  disposals.push(() => catalog.dispose());
  const plan = await createRitualAssetPlan(contentJson, {
    contentSha256: hash(contentJson),
    knownAppOrigins: ["https://magick.ly"],
    staticCatalog: catalog,
  });
  disposals.push(() => plan.dispose());
  expect(plan.metadata.assets).toEqual([]);
  const ritualId = createUuidV7();
  const descriptor = createRitualRenderDescriptor(
    {
      id: ritualId,
      currentRevisionId: createUuidV7(),
      currentCompiledArtifactId: null,
      version: 1,
    },
    { contentSha256: hash(contentJson) },
  );
  const bundle = await prepareRitualBundle({
    ritualId,
    title: "Halls",
    contentJson,
    descriptor,
    plan,
  });
  disposals.push(() => bundle.dispose());
  expect(bundle.kind).toBe("prepared");
  expect(bundle.manifest.assets).toEqual([]);
  const manifest = await parseRitualBundleManifest(bundle.manifestJson, {
    manifestSha256: bundle.manifestSha256,
    bundleId: bundle.manifest.bundleId,
    ritualId,
    descriptor,
  });
  expect(manifest).toEqual(bundle.manifest);
  if (!manifest) throw new Error("The manifest did not parse");
  // What the offline reader draws: the rows as compiled, which draw
  // without a diagnostic from the art the app ships.
  const rows = (
    JSON.parse(manifest.renderedJson) as { children: HallNode[] }
  ).children.filter((row) => row.type === "gdHall");
  expect(rows).toHaveLength(HALL_PRESETS.length + 1);
  for (const row of rows)
    expect(validateHall(row, { art: gdHallArt })).toEqual([]);
});

it("serves the hall fonts from the precached public directory", () => {
  // `next.config.ts` precaches everything in `public` except `docs/`.
  expect(GD_HALL_FONT_BASE).toBe("/fonts");
  for (const font of GD_HALL_FONT_FILES)
    expect(existsSync(path.join("public/fonts", font.file)), font.file).toBe(
      true,
    );
});
