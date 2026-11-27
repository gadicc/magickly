import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Asset, Compilation, Compiler } from "webpack";
import { isThreeAsset, ThreeChunks, threeChunksOf } from "./threeChunks";

const module = (file: string) => ({ nameForCondition: () => file });
const chunk = (id: number, ...files: string[]) => ({
  id,
  files: new Set(files),
});
const NM = "/repo/node_modules/.pnpm/three@0.187.0/node_modules/three";

/** A client build: three split in two, the view, and the page beside. */
function compilation() {
  const three = chunk(9654, "static/chunks/c23c07e0.js");
  const core = chunk(6193, "static/chunks/d02cf09b.js");
  const view = chunk(
    1506,
    "static/chunks/tablet3d.js",
    "static/chunks/tablet3d.js.map",
  );
  const theme = chunk(3441, "static/chunks/3441.js");
  const page = chunk(8123, "static/chunks/app/page.js");
  const modules = new Map<object, object[]>([
    [three, [module(`${NM}/build/three.module.js`)]],
    // Concatenated: only an inner module is three's.
    [
      core,
      [
        {
          nameForCondition: () => null,
          modules: [
            module("/repo/src/x.ts"),
            module(`${NM}/build/three.core.js`),
          ],
        },
      ],
    ],
    [
      view,
      [
        module("/repo/src/app/enochian/tablets/three/Tablet3D.tsx"),
        module("/repo/src/three/viewer.ts"),
      ],
    ],
    [theme, [module("/repo/node_modules/@mui/material/styles/index.js")]],
    // Outside three/, and so on the first load.
    [
      page,
      [
        module("/repo/src/app/enochian/tablets/Tablet3DLoader.tsx"),
        module("/repo/src/threejs/other.ts"),
      ],
    ],
  ]);
  return {
    chunks: new Set([three, core, view, theme, page]),
    chunkGroups: [
      { isInitial: () => true, chunks: [page, theme] },
      { isInitial: () => false, chunks: [three, core, theme, view] },
    ],
    chunkGraph: { getChunkModules: (each: object) => modules.get(each) ?? [] },
  } as unknown as Compilation;
}

let dir = "";
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

describe("the 3D tablet's chunks (plan 101, invariant 3)", () => {
  it("are the chunks holding three or the view's modules, concatenated or not", () => {
    const build = compilation();
    expect(threeChunksOf(build).map((each) => each.id)).toEqual([
      9654, 6193, 1506,
    ]);
    // Found once a compilation.
    expect(threeChunksOf(build)).toBe(threeChunksOf(build));
  });

  it("stay out of the precache, and nothing else does", () => {
    const build = compilation();
    const precached = (name: string) =>
      !isThreeAsset({ asset: { name } as Asset, compilation: build });
    expect(precached("static/chunks/tablet3d.js")).toBe(false);
    expect(precached("static/chunks/c23c07e0.js")).toBe(false);
    expect(precached("static/chunks/3441.js")).toBe(true);
    expect(precached("static/chunks/app/page.js")).toBe(true);
  });

  it("are written out with the lazy groups' scripts after emit", () => {
    dir = mkdtempSync(path.join(tmpdir(), "three-chunks-"));
    let run: ((build: Compilation) => void) | undefined;
    new ThreeChunks().apply({
      outputPath: dir,
      hooks: {
        afterEmit: { tap: (_: string, each: typeof run) => (run = each) },
      },
    } as unknown as Compiler);
    run?.(compilation());
    expect(
      JSON.parse(readFileSync(path.join(dir, "three-chunks.json"), "utf8")),
    ).toEqual({
      chunks: [
        { id: 9654, files: ["static/chunks/c23c07e0.js"] },
        { id: 6193, files: ["static/chunks/d02cf09b.js"] },
        { id: 1506, files: ["static/chunks/tablet3d.js"] },
      ],
      lazyFiles: [
        "static/chunks/c23c07e0.js",
        "static/chunks/d02cf09b.js",
        "static/chunks/3441.js",
        "static/chunks/tablet3d.js",
      ],
    });
  });
});
