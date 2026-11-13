/**
 * Proves the published shape of the package (plan 080, decision 7).
 *
 * The app never consumes the tarball: it is `workspace:*` and compiles the
 * TypeScript sources through `transpilePackages`. So nothing else would
 * notice if the projection that others install stopped working. This builds
 * it and magick-data, packs both with `pnpm pack` (which applies
 * `publishConfig`, as a publish would), installs them with npm into a
 * fixture outside the repository, and then reads them the way a stranger
 * would:
 *
 * 1. the tarball's listing: compiled JavaScript, declarations and the
 *    hall's JSON metrics, the fonts and their notices, the README and the
 *    licence, and no source, test or script; a manifest whose exports are
 *    the published ones and whose magick-data range is the version it was
 *    built with;
 * 2. which built files carry `"use client"`, first: Mercury, Moon and
 *    RoseSigil, and no other;
 * 3. every entry loaded in plain Node, and the Tree, a hall and the rose
 *    sigil's image rendered with `renderToStaticMarkup`, no bundler;
 * 4. a strict consumer type-checked under `bundler` and `nodenext`, with
 *    `skipLibCheck` off, and a prop the types must refuse;
 * 5. a Next app built with webpack and with Turbopack, first with every
 *    entry but the live rose sigil and no `fs` stub (nlopt must be out of
 *    reach), then with `RoseSigil` and the stub the README gives; each
 *    build's prerendered HTML is read for the server's drawings.
 *
 * The fixture's dependencies are installed by npm at the versions the
 * repository uses, with `--before` a week back, as the workspace's
 * `minimumReleaseAge` would have it. Every step throws on failure and the
 * process exits non-zero; the temporary directory is removed either way
 * (`--keep` keeps it, and prints where).
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const REPO_DIR = join(PACKAGE_DIR, "..", "..");
const DATA_DIR = join(REPO_DIR, "packages", "magick-data");

const { values: options } = parseArgs({
  options: { keep: { type: "boolean" } },
});

const sourceManifest = JSON.parse(
  readFileSync(join(PACKAGE_DIR, "package.json"), "utf8"),
);
const dataManifest = JSON.parse(
  readFileSync(join(DATA_DIR, "package.json"), "utf8"),
);
/** The version of a package the repository installed. */
const installed = (name) =>
  JSON.parse(
    readFileSync(join(REPO_DIR, "node_modules", name, "package.json"), "utf8"),
  ).version;

/** The modules that must, and alone may, start with "use client". */
const CLIENT_MODULES = [
  "lib/astrology/Mercury.js",
  "lib/astrology/Moon.js",
  "lib/gd/RoseSigil.js",
];
/**
 * Every component that can render as a Server Component, as the Next page
 * draws it: [its id on the page, its imports, its JSX]. A component that
 * passes a function to the browser, such as an event handler it was not
 * given, fails the page's prerender.
 */
const SERVER_DRAWINGS = [
  [
    "tree",
    `import TreeOfLife from "magick-components/kabbalah/TreeOfLife";`,
    `<TreeOfLife field="name.he" width={300} />`,
  ],
  [
    "grade-tree",
    `import GradeTree from "magick-components/gd/GradeTree";`,
    `<GradeTree />`,
  ],
  [
    "hall",
    `import { GdHall } from "magick-components/gd/hall";\nimport { hallPreset } from "magick-components/gd/hall/presets";`,
    `<GdHall hall={hallPreset("neophyte")!.hall} />`,
  ],
  [
    "lamen",
    `import Lamen from "magick-components/gd/Lamen";`,
    `<Lamen officer="hierophant" />`,
  ],
  [
    "candlestick",
    `import SevenBranchedCandleStick from "magick-components/gd/SevenBranchedCandleStick";`,
    `<SevenBranchedCandleStick />`,
  ],
  [
    "shewbread",
    `import TableOfShewbread from "magick-components/gd/TableOfShewbread";`,
    `<TableOfShewbread />`,
  ],
  [
    "fylfot",
    `import FylfotCross from "magick-components/gd/symbols/fylfot-cross";`,
    `<FylfotCross />`,
  ],
  [
    "rose",
    `import { RoseSigilImage } from "magick-components/gd/RoseSigilImage";\nimport { sigilPoints } from "magick-components/gd/roseSigilGeometry";`,
    `<RoseSigilImage sigilText="שלום" showRose debug={false} points={sigilPoints("שלום")} />`,
  ],
  [
    "tablet",
    `import Tablet from "magick-components/enochian/Tablet";`,
    `<Tablet id="water" />`,
  ],
  [
    "kamea",
    `import Kamea from "magick-components/astrology/Kamea";`,
    `<Kamea planet="saturn" />`,
  ],
  [
    "spirit",
    `import PlanetarySpirit from "magick-components/astrology/planetarySpirits";`,
    `<PlanetarySpirit id="zazel" height="2em" />`,
  ],
  [
    "chakras",
    `import Chakras from "magick-components/chakras/Chakras";`,
    `<Chakras />`,
  ],
];

/** The entries only the live rose sigil needs, which reach nlopt-js. */
const NLOPT_ENTRIES = ["./gd/RoseSigil", "./gd/roseSigilOptimizer"];

/** Runs a command and returns what it printed; a non-zero exit throws. */
function run(command, args, options = {}) {
  const { allowFailure = false, ...rest } = options;
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    ...rest,
  });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0 && !allowFailure)
    throw new Error(
      `${command} ${args.join(" ")} exited ${result.status}\n${output}`,
    );
  return { status: result.status, output };
}

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`);
}

function step(name, fn) {
  const t0 = Date.now();
  const result = fn();
  console.log(`ok - ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return result;
}

/** Every file path an `exports` value names. */
function targets(exports) {
  if (typeof exports === "string") return [exports];
  if (exports && typeof exports === "object")
    return Object.values(exports).flatMap(targets);
  return [];
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

const work = mkdtempSync(join(tmpdir(), "magick-components-smoke-"));
let failed = false;
try {
  const packs = join(work, "packs");
  mkdirSync(packs);

  step("build and pack magick-data", () => {
    run("pnpm", ["run", "build"], { cwd: DATA_DIR });
    run("pnpm", ["pack", "--pack-destination", packs], { cwd: DATA_DIR });
  });
  const dataTarball = join(packs, `magick-data-${dataManifest.version}.tgz`);
  assert(existsSync(dataTarball), `${dataTarball} was packed`);

  step("build and pack the package (the publish emit into lib/)", () => {
    run("pnpm", ["run", "build"], { cwd: PACKAGE_DIR });
    run("pnpm", ["pack", "--pack-destination", packs], { cwd: PACKAGE_DIR });
  });
  const tarball = join(
    packs,
    `magick-components-${sourceManifest.version}.tgz`,
  );
  assert(existsSync(tarball), `${tarball} was packed`);

  const extracted = join(work, "extracted");
  mkdirSync(extracted);
  run("tar", ["-xzf", tarball, "-C", extracted]);
  const packed = join(extracted, "package");
  const manifest = JSON.parse(
    readFileSync(join(packed, "package.json"), "utf8"),
  );
  const listing = run("tar", ["-tzf", tarball])
    .output.trim()
    .split("\n")
    .map((entry) => entry.replace(/^package\//, ""));

  step("the tarball holds the build, the fonts and nothing else", () => {
    const stray = listing.filter(
      (file) =>
        !(
          ["package.json", "README.md", "LICENSE.txt"].includes(file) ||
          /^lib\/.+\.(js|d\.ts|json)$/.test(file) ||
          /^fonts\/[^/]+\.(woff2|css|txt|md)$/.test(file)
        ),
    );
    assert(stray.length === 0, `no stray files: ${stray.join(", ")}`);
    assert(
      !listing.some((file) => /\.test\.|(^|\/)src\//.test(file)),
      "no source or test",
    );
    for (const file of [
      "fonts/gd-hall.css",
      "fonts/SOURCES.md",
      "fonts/NotoSerif-OFL.txt",
      "fonts/FrankRuhlLibre-OFL.txt",
      "fonts/NotoSerif-Italic-latin1.woff2",
      "fonts/NotoSerif-BoldItalic-compass.woff2",
      "fonts/FrankRuhlLibre-Bold-letters.woff2",
      "lib/gd/hall/fontMetrics.json",
    ])
      assert(listing.includes(file), `the tarball has ${file}`);
    console.log(`  ${listing.length} files`);
  });

  step("moon-phase's BSD notice ships with the code built from it", () => {
    const licence = readFileSync(join(packed, "LICENSE.txt"), "utf8");
    assert(
      licence.includes("BSD 3-Clause License") &&
        licence.includes("POSSIBILITY OF SUCH DAMAGE."),
      "LICENSE.txt carries the BSD notice",
    );
    for (const file of ["lib/astrology/moonPath.js", "lib/astrology/Moon.js"])
      assert(
        /\/\*![^]*tingletech\/moon-phase[^]*Regents of the University of California/.test(
          readFileSync(join(packed, file), "utf8"),
        ),
        `${file} keeps its attribution`,
      );
    assert(
      manifest.license === "(MIT AND OFL-1.1 AND BSD-3-Clause)",
      `license names BSD-3-Clause (got ${manifest.license})`,
    );
  });

  step("the packed manifest is the published one", () => {
    assert(
      JSON.stringify(manifest.exports) ===
        JSON.stringify(sourceManifest.publishConfig.exports),
      "exports are publishConfig.exports",
    );
    const missing = targets(manifest.exports)
      .filter((target) => !target.includes("*"))
      .filter((target) => !listing.includes(target.slice(2)));
    assert(missing.length === 0, `every export exists: ${missing.join(", ")}`);
    assert(
      !JSON.stringify(manifest).includes("./src/"),
      "nothing points into ./src/",
    );
    assert(
      manifest.dependencies["magick-data"] === `^${dataManifest.version}`,
      `magick-data ^${dataManifest.version}, the version built with (got ${manifest.dependencies["magick-data"]})`,
    );
    assert(
      dataManifest.version !== "0.0.0",
      "magick-data has a published version",
    );
    assert(manifest.peerDependencies?.react === "^19", "react ^19 is a peer");
  });

  step('only Mercury, Moon and RoseSigil are "use client"', () => {
    const client = listing
      .filter((file) => file.endsWith(".js"))
      .filter((file) =>
        readFileSync(join(packed, file), "utf8").startsWith('"use client";'),
      )
      .sort();
    assert(
      JSON.stringify(client) === JSON.stringify(CLIENT_MODULES),
      `client modules: ${client.join(", ")}`,
    );
    const anywhere = listing
      .filter((file) => file.endsWith(".js"))
      .filter((file) =>
        /^\s*"use client";/m.test(readFileSync(join(packed, file), "utf8")),
      )
      .sort();
    assert(
      JSON.stringify(anywhere) === JSON.stringify(CLIENT_MODULES),
      "no directive anywhere else (a comment may name one)",
    );
  });

  // The fixture: what a stranger's project installs.
  const fixture = join(work, "fixture");
  const before = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  step("install both tarballs and Next with npm", () => {
    write(
      join(fixture, "package.json"),
      `${JSON.stringify(
        {
          name: "magick-components-smoke",
          private: true,
          type: "module",
          dependencies: {
            "magick-components": `file:${tarball}`,
            "magick-data": `file:${dataTarball}`,
            next: installed("next"),
            react: installed("react"),
            "react-dom": installed("react-dom"),
          },
          devDependencies: {
            "@types/node": installed("@types/node"),
            "@types/react": installed("@types/react"),
            "@types/react-dom": installed("@types/react-dom"),
            typescript: installed("typescript"),
          },
          // The components' ^0.x range on magick-data, met by its tarball.
          overrides: { "magick-data": "$magick-data" },
        },
        null,
        2,
      )}\n`,
    );
    run(
      "npm",
      [
        "install",
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
        "--loglevel=error",
        `--before=${before}`,
      ],
      { cwd: fixture },
    );
    const nested = join(
      fixture,
      "node_modules",
      "magick-components",
      "node_modules",
      "magick-data",
    );
    assert(!existsSync(nested), "one magick-data, the packed one");
  });

  const entries = Object.keys(manifest.exports).filter(
    (key) => !key.includes("*"),
  );
  step("every entry loads in plain Node, and the drawings render", () => {
    write(
      join(fixture, "node-load.mjs"),
      `import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const entries = ${JSON.stringify(entries)};
// Types alone: it loads, and has nothing to export at run time.
const typesOnly = ["./gd/hall/types"];
for (const entry of entries) {
  const module = await import("magick-components/" + entry.slice(2));
  if (Object.keys(module).length === 0 && !typesOnly.includes(entry))
    throw new Error(entry + " exports nothing");
}
const { default: TreeOfLife } = await import("magick-components/kabbalah/TreeOfLife");
const { GdHall } = await import("magick-components/gd/hall");
const { hallPreset } = await import("magick-components/gd/hall/presets");
const { RoseSigilImage } = await import("magick-components/gd/RoseSigilImage");
const { sigilPoints } = await import("magick-components/gd/roseSigilGeometry");
const tree = renderToStaticMarkup(h(TreeOfLife, { field: "name.he", width: 300 }));
if (!tree.includes('id="TreeOfLife"') || !tree.includes("תפארת")) throw new Error("the Tree: " + tree.slice(0, 200));
const hall = renderToStaticMarkup(h(GdHall, { hall: hallPreset("neophyte").hall, fontBaseUrl: "/f" }));
if (!hall.includes("<svg")) throw new Error("the hall: " + hall.slice(0, 200));
if ((hall.match(/@font-face/g) ?? []).length !== 3) throw new Error("the hall's fonts: " + hall.slice(0, 200));
const rose = renderToStaticMarkup(h(RoseSigilImage, { sigilText: "שלום", showRose: true, debug: false, points: sigilPoints("שלום") }));
if (!rose.includes('stroke="red"')) throw new Error("the rose sigil: " + rose.slice(0, 200));
console.log(entries.length, "entries;", tree.length, hall.length, rose.length, "bytes of markup");
`,
    );
    console.log(
      `  ${run(process.execPath, ["node-load.mjs"], { cwd: fixture }).output.trim()}`,
    );
  });

  step("a strict consumer type-checks under bundler and nodenext", () => {
    write(
      join(fixture, "types", "consumer.tsx"),
      `${entries
        .map(
          (entry, i) =>
            `import * as entry${i} from "magick-components/${entry.slice(2)}";`,
        )
        .join("\n")}
export const all = [${entries.map((_, i) => `entry${i}`).join(", ")}];
import TreeOfLife, { type TreeColorScale } from "magick-components/kabbalah/TreeOfLife";
import { GdHall, type HallNode } from "magick-components/gd/hall";
import { hallPreset } from "magick-components/gd/hall/presets";
import RoseSigil from "magick-components/gd/RoseSigil";
import { RoseSigilImage } from "magick-components/gd/RoseSigilImage";
import { sigilPoints } from "magick-components/gd/roseSigilGeometry";
import { optimizeSigilPoints } from "magick-components/gd/roseSigilOptimizer";
import Tablet from "magick-components/enochian/Tablet";
import MercuryWidget from "magick-components/astrology/Mercury";
import { currentOrNextRetrograde } from "magick-components/astrology/mercuryRetrograde";
import PlanetarySpirit from "magick-components/astrology/planetarySpirits";

const scale: TreeColorScale = "king";
const hall: HallNode | undefined = hallPreset("neophyte")?.hall;
const end = currentOrNextRetrograde(new Date())?.end.toISODate();
export const points: Promise<{ x: number; y: number }[]> = optimizeSigilPoints(sigilPoints("אב"));

export const page = (
  <>
    <TreeOfLife colorScale={scale} letterAttr="hebrew" showDaat />
    {/* @ts-expect-error: a colour scale magick-data does not have */}
    <TreeOfLife colorScale="sepia" />
    {hall && <GdHall hall={hall} fontBaseUrl="/fonts" />}
    <RoseSigil sigilText="שלום" animate={false} />
    <RoseSigilImage sigilText="אב" showRose debug={false} points={[]} />
    <Tablet id="air" />
    <MercuryWidget image="/m.webp" />
    <PlanetarySpirit id="zazel" height="1em" />
    {end}
  </>
);
`,
    );
    const base = {
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      jsx: "react-jsx",
      target: "es2022",
      lib: ["dom", "es2022"],
      types: [],
    };
    for (const [name, compilerOptions] of [
      ["bundler", { ...base, module: "esnext", moduleResolution: "bundler" }],
      [
        "nodenext",
        { ...base, module: "nodenext", moduleResolution: "nodenext" },
      ],
    ]) {
      write(
        join(fixture, "types", `tsconfig.${name}.json`),
        JSON.stringify({ compilerOptions, files: ["consumer.tsx"] }),
      );
      run(
        process.execPath,
        [
          join(fixture, "node_modules", "typescript", "bin", "tsc"),
          "-p",
          `tsconfig.${name}.json`,
        ],
        { cwd: join(fixture, "types") },
      );
    }
  });

  // The Next app. Its server page imports every entry but the two that
  // reach nlopt, and builds with no fs stub; the second round adds the live
  // sigil, in a client page, and the stub.
  const serverEntries = entries.filter(
    (entry) => !NLOPT_ENTRIES.includes(entry),
  );
  write(
    join(fixture, "app", "layout.tsx"),
    `import "magick-components/fonts/gd-hall.css";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
`,
  );
  write(
    join(fixture, "app", "page.tsx"),
    `${serverEntries
      .map(
        (entry, i) =>
          `import * as entry${i} from "magick-components/${entry.slice(2)}";`,
      )
      .join("\n")}
${SERVER_DRAWINGS.map(([, imports]) => imports).join("\n")}
import MoonWidget from "magick-components/astrology/Moon";
import MercuryWidget from "magick-components/astrology/Mercury";
import { ClientTree } from "./ClientTree";

const loaded = [${serverEntries.map((_, i) => `entry${i}`).join(", ")}];

export default function Page() {
  return (
    <main data-entries={loaded.length}>
${SERVER_DRAWINGS.map(([id, , jsx]) => `      <div id="server-${id}">${jsx}</div>`).join("\n")}
      <MoonWidget />
      <MercuryWidget image="/m.webp" />
      <ClientTree />
    </main>
  );
}
`,
  );
  write(
    join(fixture, "app", "ClientTree.tsx"),
    `"use client";
import TreeOfLife from "magick-components/kabbalah/TreeOfLife";
import { useState } from "react";

/** The server-capable Tree, drawn from a Client Component. */
export function ClientTree() {
  const [scale] = useState<"queen" | "king">("king");
  return <div id="client-tree"><TreeOfLife colorScale={scale} width={200} /></div>;
}
`,
  );
  write(
    join(fixture, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "es2022",
          lib: ["dom", "dom.iterable", "esnext"],
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          module: "esnext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          isolatedModules: true,
          esModuleInterop: true,
          resolveJsonModule: true,
          plugins: [{ name: "next" }],
        },
        include: ["next-env.d.ts", "app/**/*.tsx"],
        exclude: ["node_modules", "types"],
      },
      null,
      2,
    ),
  );

  const nextConfig = (stub) => `import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
${
  stub
    ? `  // The README's stub for nlopt-js's fs, for both bundlers.
  turbopack: { resolveAlias: { fs: { browser: "./empty.ts" } } },
  webpack: (config, { isServer }) => {
    if (!isServer) config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
`
    : ""
}};
export default nextConfig;
`;

  function build(bundler) {
    rmSync(join(fixture, ".next"), { recursive: true, force: true });
    run(
      process.execPath,
      [
        join(fixture, "node_modules", "next", "dist", "bin", "next"),
        "build",
        bundler === "webpack" ? "--webpack" : "--turbopack",
      ],
      {
        cwd: fixture,
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      },
    );
    const html = (page) =>
      readFileSync(
        join(fixture, ".next", "server", "app", `${page}.html`),
        "utf8",
      );
    return html;
  }

  for (const bundler of ["webpack", "turbopack"])
    step(
      `Next builds every entry but the live sigil with ${bundler}, no fs stub`,
      () => {
        write(join(fixture, "next.config.ts"), nextConfig(false));
        const html = build(bundler)("index");
        for (const marker of ['id="TreeOfLife"', "תפארת", 'id="client-tree"'])
          assert(html.includes(marker), `the page has ${marker}`);
        for (const [id] of SERVER_DRAWINGS)
          assert(
            new RegExp(`id="server-${id}"><(svg|table|style|div)[ >]`).test(
              html,
            ),
            `the server drew ${id}`,
          );
        const css = readdirSync(join(fixture, ".next", "static"), {
          recursive: true,
        }).filter((file) => String(file).endsWith(".woff2"));
        assert(
          css.length === 3,
          `the hall's three fonts are emitted (${css.length})`,
        );
      },
    );

  write(join(fixture, "empty.ts"), "export {};\n");
  write(
    join(fixture, "app", "rose", "page.tsx"),
    `import { Rose } from "./Rose";
export default function Page() {
  return <main><Rose /></main>;
}
`,
  );
  write(
    join(fixture, "app", "rose", "Rose.tsx"),
    `"use client";
import RoseSigil from "magick-components/gd/RoseSigil";
import * as optimizer from "magick-components/gd/roseSigilOptimizer";

export function Rose() {
  return (
    <div id="client-rose" data-optimizer={typeof optimizer.optimizeSigilPoints}>
      <RoseSigil sigilText="שלום" />
    </div>
  );
}
`,
  );
  for (const bundler of ["webpack", "turbopack"])
    step(
      `Next builds the live sigil with ${bundler} and the README's stub`,
      () => {
        write(join(fixture, "next.config.ts"), nextConfig(true));
        const html = build(bundler);
        assert(
          html("rose").includes('id="client-rose"'),
          "the sigil page renders",
        );
        assert(html("rose").includes('stroke="red"'), "with its path");
        assert(
          html("index").includes('id="TreeOfLife"'),
          "the Tree still renders",
        );
      },
    );
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : error);
} finally {
  if (options.keep) console.log(`kept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}
if (failed) process.exitCode = 1;
