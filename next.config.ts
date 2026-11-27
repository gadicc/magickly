import { createHash } from "node:crypto";
import {
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} from "next/constants";
import { COMPONENT_REDIRECTS } from "./src/explorer/redirects";
import { legacyStaticImageAliases } from "./src/files/legacyStaticImages";
import { RITUAL_PUBLICATION_STATIC_PATHS } from "./src/files/ritualPublicationStaticPaths";
import { ANGEL_SIGIL_RSC_REWRITE } from "./src/seo/angelSigilFileGuard";
import {
  HALL_REDIRECTS,
  RETIRED_DRAWING_REDIRECTS,
} from "./src/seo/hallRedirects";

// Vercel standalone can retain this package symlink while dropping a file traced
// through it. Trace the physical target while the runtime keeps the stable alias.
/**
 * Everything under public/ except the docs, which are downloads rather than
 * part of the app shell, and the mirrored source pages (public/sources),
 * about 640 KB of scans that are cached at runtime when viewed (Serwist's
 * default image rule). Mirrors what @serwist/next would have globbed, minus
 * the directories it gives no way to exclude.
 */
export function precacheEntries() {
  const publicDir = path.join(process.cwd(), "public");
  const skip = /^(docs\/|sources\/|sw\.js|sw\.js\.map|swe-worker-)/;
  const walk = (dir: string, prefix = ""): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return walk(path.join(dir, entry.name), rel);
      return skip.test(rel) ? [] : [rel];
    });

  return walk(publicDir).map((file) => ({
    url: `/${file}`,
    revision: createHash("md5")
      .update(readFileSync(path.join(publicDir, file)))
      .digest("hex"),
  }));
}

const resvgWasmTraceFile = `./${path
  .relative(
    process.cwd(),
    realpathSync(
      path.join(process.cwd(), "node_modules/@resvg/resvg-wasm/index_bg.wasm"),
    ),
  )
  .split(path.sep)
  .join("/")}`;

const physicalTraceFile = (file: string) =>
  `./${path.relative(process.cwd(), realpathSync(file)).split(path.sep).join("/")}`;
const cssTreeDirectory = path.dirname(
  realpathSync(path.join(process.cwd(), "node_modules/css-tree/package.json")),
);
const cssTreeDynamicDataTraceFiles = [
  path.join(cssTreeDirectory, "data/patch.json"),
  ...["at-rules.json", "properties.json", "syntaxes.json"].map((file) =>
    path.join(cssTreeDirectory, "../mdn-data/css", file),
  ),
].map(physicalTraceFile);

const ritualPublicationTraceFiles = [
  // Next 16 resolves include values from the project root and route keys with picomatch.
  ...RITUAL_PUBLICATION_STATIC_PATHS.map((pathname) => `./public${pathname}`),
  "./public/fonts/*.ttf",
  resvgWasmTraceFile,
  ...cssTreeDynamicDataTraceFiles,
];

/**
 * The 3D tablet's modules (plan 101): three.js, the base under
 * `src/three/` and the tablet's under `tablets/three/`. Real paths, as
 * webpack resolves pnpm's links to them.
 */
const THREE_MODULES =
  /[\\/](node_modules[\\/]three|src[\\/]three|src[\\/]app[\\/]enochian[\\/]tablets[\\/]three)[\\/]/;

/** What the 3D chunks' finders read of webpack's compilation. */
interface ChunkGraphModule {
  nameForCondition?(): string | null;
  modules?: Iterable<ChunkGraphModule>;
}
interface ChunkGraphChunk {
  id: string | number | null;
  files: Iterable<string>;
}
interface ChunkGraphCompilation {
  chunks: Iterable<ChunkGraphChunk>;
  chunkGroups: Iterable<{ isInitial(): boolean; chunks: ChunkGraphChunk[] }>;
  chunkGraph: { getChunkModules(chunk: ChunkGraphChunk): ChunkGraphModule[] };
}

/** A module's source files, those concatenated into it included. */
const sourcesOf = (module: ChunkGraphModule): string[] =>
  module.modules
    ? [...module.modules].flatMap(sourcesOf)
    : [module.nameForCondition?.() ?? ""];

const threeChunksFound = new WeakMap<object, ChunkGraphChunk[]>();
/**
 * The client chunks holding a 3D module, by the modules themselves, since
 * a chunk's name or contents are no guide: three is split across chunks,
 * and only one says so.
 */
function threeChunksOf(compilation: ChunkGraphCompilation) {
  let chunks = threeChunksFound.get(compilation);
  if (!chunks) {
    chunks = [...compilation.chunks].filter((chunk) =>
      compilation.chunkGraph
        .getChunkModules(chunk)
        .some((module) =>
          sourcesOf(module).some((source) => THREE_MODULES.test(source)),
        ),
    );
    threeChunksFound.set(compilation, chunks);
  }
  return chunks;
}

/** Serwist's condition: a 3D chunk's file stays out of the precache. */
const isThreeAsset = ({
  asset,
  compilation,
}: {
  asset: { name: string };
  compilation: ChunkGraphCompilation;
}) =>
  threeChunksOf(compilation).some((chunk) =>
    [...chunk.files].includes(asset.name),
  );

/**
 * Writes `three-chunks.json` beside the client build for
 * `scripts/checkThreeBuild.mts` (plan 101, invariant 3): the 3D chunks,
 * and every file of the lazy chunk groups that load them.
 */
class ThreeChunks {
  apply(compiler: {
    outputPath: string;
    hooks: {
      afterEmit: {
        tap(
          name: string,
          run: (compilation: ChunkGraphCompilation) => void,
        ): void;
      };
    };
  }) {
    compiler.hooks.afterEmit.tap("ThreeChunks", (compilation) => {
      const chunks = threeChunksOf(compilation);
      const scripts = (list: Iterable<ChunkGraphChunk>) => [
        ...new Set(
          [...list]
            .flatMap((chunk) => [...chunk.files])
            .filter((file) => file.endsWith(".js")),
        ),
      ];
      const lazy = [...compilation.chunkGroups].filter(
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

/** The temple halls' medium and small PNGs, which stay out of the index. */
const HALL_SMALLER_IMAGES =
  "/gd/halls/:slug/:file([a-z0-9-]+-(?:medium|small)\\.png)";

export default async function (phase: string): Promise<NextConfig> {
  const nextConfig: NextConfig = {
    /**
     * The raw files under /docs are downloads, not pages. The Markdown edition
     * is the same text as the HTML routes, so indexing it would set a plain
     * file against the edition it duplicates. A header rather than a
     * robots.txt Disallow: disallowing it would stop a crawler ever reading
     * the noindex.
     */
    headers: async () => [
      {
        source: "/docs/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        // A temple hall's smaller PNGs (plan 062): the full PNG and the SVG
        // are each hall's images in search; these are for phones and the
        // gallery.
        source: HALL_SMALLER_IMAGES,
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ],
    // `src/proxy.ts` sees Next's router headers (`RSC`), so that it can
    // answer a sigil file asked for as an RSC payload itself (plan 096,
    // decision 3). It is the only proxy, and runs only on the angels' files.
    skipProxyUrlNormalize: true,
    rewrites: async () => ({
      // The angels' sigil files: `src/proxy.ts` admits only the 576 names,
      // but sees `<name>.rsc` as `<name>`; this sends those to the 404
      // (plan 096, decision 3).
      beforeFiles: [ANGEL_SIGIL_RSC_REWRITE],
      afterFiles: [],
      fallback: [],
    }),
    redirects: () => [
      {
        source: "/help/ritual-text",
        destination: "/help/ritual-pug",
        permanent: true,
      },
      ...Object.entries(legacyStaticImageAliases).map(
        ([source, destination]) => ({
          source,
          destination,
          permanent: true,
        }),
      ),
      // The temple halls moved from /gd/hall to /gd/halls.
      ...HALL_REDIRECTS,
      // The old temple drawings, retired for the halls' own images.
      ...RETIRED_DRAWING_REDIRECTS,
      // Explorer pages of components renamed before the first publish.
      ...COMPONENT_REDIRECTS,
    ],
    // See also alternative with patch-package:
    // https://stackoverflow.com/a/77722836/1839099
    // css-tree's ESM data entry uses createRequire(import.meta.url). Keep the
    // package native so its relative data paths remain runtime-relative.
    serverExternalPackages: ["pdf-parse", "@resvg/resvg-wasm", "css-tree"],
    // The packages' exports are their TypeScript sources, compiled here as
    // the app's own code is. Their relative specifiers end in `.ts`, which
    // both bundlers resolve as written; neither resolves a `.js` specifier to
    // a `.ts` file, and webpack's `extensionAlias`, the one remedy, is not
    // read by Turbopack (plan 052).
    transpilePackages: ["magick-data", "magick-components"],
    outputFileTracingIncludes: {
      // The keyed vector artifact search:build assembles (plan 087).
      "/api/search": ["./src/search/generated/search-vectors.bin"],
      // Read with fs by src/geo/server/places.ts, so not traced on its own.
      "/api/places": ["./src/geo/server/places.tsv"],
      // Read with fs by src/app/enochian/translate/ruleNotes.server.ts when
      // the page is prerendered; listed in case it is ever rendered again.
      "/enochian/translate": ["./packages/magick-data/src/enochian/grammar.md"],
      // The legacy alias only renders the Tree, which uses the public base fonts.
      "/api/treeOfLife": ["./public/fonts/*.ttf", resvgWasmTraceFile],
      "/api/render/*": [
        "./public/fonts/*.ttf",
        "./assets/fonts/*.ttf",
        resvgWasmTraceFile,
      ],
      // The angels' bare and talisman sigils are drawn on their first
      // request (plan 096, decision 3): the base fonts the rose and the
      // styles draw over, the styles' two subsets and the WASM, which a
      // drawing at build time finds without tracing.
      "/kabbalah/angel/[slug]/[file]": [
        "./public/fonts/*.ttf",
        "./assets/fonts/NotoSerif-Regular-latin1.ttf",
        "./assets/fonts/FrankRuhlLibre-Bold-letters.ttf",
        resvgWasmTraceFile,
      ],
      "/api/rituals/publication": [...ritualPublicationTraceFiles],
      "/api/rituals/publication/backfill": [...ritualPublicationTraceFiles],
    },
    experimental: {
      // Inside a machine-wide CPU grant (`loom slots run`), size the build's
      // workers to it: Next counts every CPU, not the job's affinity.
      ...(Number.isSafeInteger(Number(process.env.LOOM_SLOTS)) &&
      Number(process.env.LOOM_SLOTS) > 0
        ? { cpus: Number(process.env.LOOM_SLOTS) }
        : {}),
      globalNotFound: true,
      swcPlugins: [["@lingui/swc-plugin", {}]],
    },
    // `pnpm dev` runs on Turbopack; production builds still use webpack, so
    // keep these in step with the `webpack()` rules below. Ritual sources
    // need no rule here: Turbopack reads `with { type: "text" }` itself.
    turbopack: {
      rules: {
        "*.svg": { loaders: ["@svgr/webpack"], as: "*.js" },
      },
    },
    webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
      // Built-in ritual sources are imported `with { type: "text" }`. Next's
      // webpack ignores that attribute, so match the extension.
      config.module.rules.push({
        test: /\.pug$/,
        type: "asset/source",
      });

      config.module.rules.push({
        test: /\.svg$/,
        use: ["@svgr/webpack"],
      });

      if (!dev && !isServer) config.plugins.push(new ThreeChunks());

      return config;
    },
  };

  if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_BUILD) {
    const withSerwist = (await import("@serwist/next")).default({
      // https://serwist.pages.dev/docs/next/configuring/cache-on-navigation
      // The auxiliary worker persists credentialed HTML despite private/no-store.
      // Public ritual shells are warmed explicitly by our service worker.
      cacheOnNavigation: false,

      // Note: This is only an example. If you use Pages Router,
      // use something else that works, such as "service-worker/index.ts".
      swSrc: "src/app/sw.ts",
      swDest: "public/sw.js",

      // @serwist/next precaches public/**/* by default, and public/docs holds
      // the Markdown edition of Lenain — 279 KB that every service worker
      // would download on install, and again after every reading correction.
      // The book has routes; the file is a download, not part of the shell.
      //
      // globPublicPatterns cannot express this: it is passed straight to
      // glob's pattern argument, where a leading "!" has meant nothing since
      // glob 9 — ["**/*", "!docs/**"] matches exactly what ["**/*"] does, as
      // the package itself confirms. Only glob's separate `ignore` option
      // excludes, and Serwist hardcodes that. Supplying the manifest instead
      // replaces the glob altogether, which is the documented hook for it.
      additionalPrecacheEntries: precacheEntries(),

      //   reloadOnOnline: true,

      disable: process.env.NODE_ENV !== "production",

      // https://serwist.pages.dev/docs/next/configuring/reload-on-online
      // Hopefully fixes issue where app reloads after phone lock/unlock on Android Chrome.
      reloadOnOnline: false,

      // The 3D tablet's code, which only a reader who opens the 3D view
      // needs (plan 101, invariant 3), with Serwist's own two defaults.
      // Not `excludeChunks`: `webpackChunkName` does survive `next/dynamic`
      // (the group is named "tablet3d", and so is its chunk), but the
      // group takes in every chunk the view needs that the tablets page
      // has not loaded, and so one of MUI's theme chunks, on the first load
      // of other pages, which their readers would then lose offline (seen
      // on 27 November 2026). This leaves out the chunks holding 3D
      // modules, as `scripts/checkThreeBuild.mts` checks.
      exclude: [/\.map$/, /^manifest.*\.js$/, isThreeAsset],

      // Handled in src/serwistStuff.tsx
      // https://serwist.pages.dev/docs/next/configuring/register
      register: false,
    });
    return withSerwist(nextConfig);
  }

  return nextConfig;
}
