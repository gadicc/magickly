/**
 * After `next build`: that the 3D tablet costs the flat page nothing
 * (plan 101, invariant 3). `next.config.ts`'s `ThreeChunks` plugin lists
 * every client chunk holding three.js or the 3D view's code, found by
 * their modules, and the lazy chunk groups' files; this fails the build
 * when the list is empty, when a listed chunk is on any page's first load
 * or in the service worker's precache, when leaving them out of the
 * precache left out another page's chunk, or when the lazy JS is over the
 * ceiling. Webpack builds only: `check:turbopack` has neither the plugin
 * nor Serwist.
 *
 *   node --import tsx scripts/checkThreeBuild.mts [.next] [public/sw.js]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";

/** The lazy JS's ceiling, gzipped, three and the mark sheet included. */
export const LAZY_JS_CEILING = 200 * 1024;

/** What the build wrote that the check reads. */
export interface ThreeBuild {
  /** `three-chunks.json`, or null where the plugin wrote none. */
  threeChunks: {
    chunks: { id: string | number | null; files: string[] }[];
    lazyFiles: string[];
  } | null;
  /** `build-manifest.json`. */
  buildManifest: { rootMainFiles?: string[]; polyfillFiles?: string[] };
  /** Each page's client reference manifest, by page. */
  clientManifests: Record<
    string,
    { clientModules?: Record<string, { chunks?: unknown[] }> }
  >;
  /** `public/sw.js`, or null where there is none. */
  serviceWorker: string | null;
  /** A lazy file's size, gzipped. */
  gzipBytes: (file: string) => number;
  /** On Vercel, whose build may leave no client manifests to read. */
  vercel?: boolean;
}

/**
 * A chunk as one name, whether written `/_next/static/…` or `static/…`,
 * URI-encoded (as Next writes a manifest's chunks and Serwist its URLs)
 * or not, and with a query (`?dpl=`, a deployment's id) or without.
 */
const normal = (file: string) =>
  decodeURI(file.replace(/^\/?(_next\/)?/, "").replace(/\?.*$/, ""));

/** The URLs Serwist injected into the worker's precache manifest. */
export const precacheUrls = (worker: string) =>
  [...worker.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  );

/** What is wrong with the build, and the lazy JS's gzipped size. */
export function threeBuildProblems(build: ThreeBuild): {
  problems: string[];
  lazyBytes: number;
} {
  const problems: string[] = [];
  const listed = new Set(
    (build.threeChunks?.chunks ?? []).flatMap((chunk) =>
      chunk.files.map(normal),
    ),
  );
  if (listed.size === 0)
    problems.push(
      "three-chunks.json lists no chunk: the 3D view was not built, or the plugin no longer finds its modules",
    );
  // Every page's first load, which a manifest's `chunks` give as ids and
  // files in turn.
  const firstLoad = new Set<string>();
  const onFirstLoad = (where: string, files: Iterable<unknown>) => {
    for (const each of files) {
      const file = typeof each === "string" ? normal(each) : "";
      if (!file.endsWith(".js")) continue;
      firstLoad.add(file);
      if (listed.has(file))
        problems.push(`${file} is on the first load of ${where}`);
    }
  };
  onFirstLoad(
    "every page (rootMainFiles)",
    build.buildManifest.rootMainFiles ?? [],
  );
  onFirstLoad(
    "every page (polyfillFiles)",
    build.buildManifest.polyfillFiles ?? [],
  );
  const pages = Object.entries(build.clientManifests);
  if (pages.length === 0 && !build.vercel)
    problems.push("no client reference manifests to read");
  for (const [page, manifest] of pages)
    onFirstLoad(
      page,
      Object.values(manifest.clientModules ?? {}).flatMap(
        (module) => module.chunks ?? [],
      ),
    );
  if (build.serviceWorker === null) problems.push("no service worker to read");
  else {
    const urls = precacheUrls(build.serviceWorker);
    if (urls.length === 0)
      problems.push("the service worker has no precache list to read");
    const precached = new Set(urls.map(normal));
    for (const file of precached)
      if (listed.has(file))
        problems.push(`${file} is in the service worker's precache`);
    // Leaving the 3D chunks out must not leave out a chunk they share
    // with a page's first load, as excluding their chunk group did.
    for (const file of firstLoad)
      if (urls.length > 0 && !listed.has(file) && !precached.has(file))
        problems.push(`${file} is on a first load but not precached`);
  }
  const lazy = new Set([
    ...listed,
    ...(build.threeChunks?.lazyFiles ?? []).map(normal),
  ]);
  const lazyBytes = [...lazy].reduce(
    (sum, file) => sum + build.gzipBytes(file),
    0,
  );
  if (lazyBytes > LAZY_JS_CEILING)
    problems.push(
      `the lazy JS is ${(lazyBytes / 1024).toFixed(1)} KB gzipped, over its ${LAZY_JS_CEILING / 1024} KB`,
    );
  return { problems, lazyBytes };
}

/** Every page's client reference manifest under the build's server app. */
function clientManifests(dist: string) {
  const app = path.join(dist, "server/app");
  if (!existsSync(app)) return {};
  const files = (readdirSync(app, { recursive: true }) as string[]).filter(
    (file) => file.endsWith("_client-reference-manifest.js"),
  );
  return Object.assign(
    {},
    ...files.map((file) => {
      const context: { __RSC_MANIFEST?: ThreeBuild["clientManifests"] } = {};
      runInNewContext(readFileSync(path.join(app, file), "utf8"), context);
      return context.__RSC_MANIFEST ?? {};
    }),
  ) as ThreeBuild["clientManifests"];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = process.argv[2] ?? ".next";
  const worker = process.argv[3] ?? "public/sw.js";
  const read = (file: string) =>
    existsSync(file) ? readFileSync(file, "utf8") : null;
  const chunks = read(path.join(dist, "three-chunks.json"));
  const manifests = clientManifests(dist);
  // As in checkProxyBuild.mts: Vercel's build may write less under
  // .next/server/app; the shared first load and the precache still count.
  const vercel =
    process.env.VERCEL === "1" && Object.keys(manifests).length === 0;
  const { problems, lazyBytes } = threeBuildProblems({
    threeChunks: chunks && JSON.parse(chunks),
    buildManifest: JSON.parse(
      read(path.join(dist, "build-manifest.json")) ?? "{}",
    ),
    clientManifests: manifests,
    serviceWorker: read(worker),
    gzipBytes: (file) => gzipSync(readFileSync(path.join(dist, file))).length,
    vercel,
  });
  if (problems.length > 0) {
    console.error(
      `checkThreeBuild: the 3D tablet costs the flat page (plan 101, invariant 3):\n${problems
        .map((line) => `- ${line}`)
        .join("\n")}`,
    );
    process.exit(1);
  }
  console.log(
    `checkThreeBuild: ${JSON.parse(chunks ?? "{}").chunks.length} 3D chunks, on no first load${vercel ? " (Vercel: rootMainFiles and polyfillFiles only)" : ""} and not precached; the lazy JS is ${(lazyBytes / 1024).toFixed(1)} KB gzipped.`,
  );
}
