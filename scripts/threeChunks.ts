/**
 * The 3D tablet's client chunks in a webpack build (plan 101, invariant
 * 3), for `next.config.ts`: which chunks hold its modules, Serwist's
 * condition that leaves them out of the precache, and a plugin that lists
 * them for `scripts/checkThreeBuild.mts`.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Asset, Chunk, Compilation, Compiler, Module } from "webpack";

/**
 * The 3D tablet's modules: three.js, the base under `src/three/` and the
 * tablet's under `tablets/three/`. Real paths, as webpack resolves pnpm's
 * links to them.
 */
export const THREE_MODULES =
  /[\\/](node_modules[\\/]three|src[\\/]three|src[\\/]app[\\/]enochian[\\/]tablets[\\/]three)[\\/]/;

/** A module's source files, those concatenated into it included. */
const sourcesOf = (
  module: Module & { modules?: Iterable<Module> },
): string[] =>
  module.modules
    ? [...module.modules].flatMap(sourcesOf)
    : [module.nameForCondition() ?? ""];

const found = new WeakMap<Compilation, Chunk[]>();
/**
 * The client chunks holding a 3D module, by the modules themselves, since
 * a chunk's name or contents are no guide: three is split across chunks,
 * and only one says so.
 */
export function threeChunksOf(compilation: Compilation): Chunk[] {
  let chunks = found.get(compilation);
  if (!chunks) {
    chunks = [...compilation.chunks].filter((chunk) =>
      compilation.chunkGraph
        .getChunkModules(chunk)
        .some((module) =>
          sourcesOf(module).some((source) => THREE_MODULES.test(source)),
        ),
    );
    found.set(compilation, chunks);
  }
  return chunks;
}

/** Serwist's condition: a 3D chunk's file stays out of the precache. */
export const isThreeAsset = ({
  asset,
  compilation,
}: {
  asset: Asset;
  compilation: Compilation;
}) => threeChunksOf(compilation).some((chunk) => chunk.files.has(asset.name));

/**
 * Writes `three-chunks.json` beside the client build: the 3D chunks, and
 * every file of the lazy chunk groups that load them.
 */
export class ThreeChunks {
  apply(compiler: Compiler) {
    compiler.hooks.afterEmit.tap("ThreeChunks", (compilation) => {
      const chunks = threeChunksOf(compilation);
      const scripts = (list: Iterable<Chunk>) => [
        ...new Set(
          [...list]
            .flatMap((chunk) => [...chunk.files])
            .filter((file) => file.endsWith(".js")),
        ),
      ];
      const lazy = compilation.chunkGroups.filter(
        (group) =>
          !group.isInitial() &&
          group.chunks.some((chunk) => chunks.includes(chunk)),
      );
      writeFileSync(
        path.join(compiler.outputPath, "three-chunks.json"),
        `${JSON.stringify(
          {
            chunks: chunks.map((chunk) => ({
              id: chunk.id,
              files: scripts([chunk]),
            })),
            lazyFiles: scripts(lazy.flatMap((group) => group.chunks)),
          },
          null,
          2,
        )}\n`,
      );
    });
  }
}
