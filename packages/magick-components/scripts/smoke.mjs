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
 * 5. 3 and 4 again in a second fixture that installs the components'
 *    tarball alone, so that npm takes magick-data from the registry, as a
 *    stranger's install would; skipped, saying so, while the registry
 *    lacks the magick-data version the components were built with;
 * 6. a Next app built with webpack and with Turbopack, first with every
 *    entry but the live rose sigil and no `fs` stub (nlopt must be out of
 *    reach), then with `RoseSigil` and the stub the README gives; each
 *    build's prerendered HTML is read for the server's drawings.
 *
 * The fixtures' dependencies are installed by npm at the exact versions
 * the repository uses, and npm's `--before` holds what it resolves under
 * them to a week back, as the workspace's `minimumReleaseAge` would; where
 * a pinned version, or the floor of one of the components' ranges, is
 * younger than that (taken early with `--config.minimumReleaseAge=0`),
 * `--before` moves up to its publish time, which the registry gives
 * (`installCutoff`). Every step throws on
 * failure and the process exits non-zero; the temporary directory is
 * removed either way (`--keep` keeps it, and prints where).
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

/**
 * When the registry published `name@version`, or undefined if it has no
 * such version (or no such package). Any other failure throws.
 */
function publishTime(name, version) {
  const result = spawnSync("npm", ["view", name, "time", "--json"], {
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (/E404/.test(`${result.stdout}${result.stderr}`)) return undefined;
    throw new Error(
      `npm view ${name} time exited ${result.status}\n${result.stderr}`,
    );
  }
  const time = JSON.parse(result.stdout)[version];
  return time === undefined ? undefined : new Date(time);
}

const WEEK = 7 * 24 * 3600 * 1000;

/**
 * npm's `--before` for installing `pins` ([name, exact version] pairs):
 * a week back, as the workspace's `minimumReleaseAge` has it, so that the
 * ranges npm resolves below the pins take nothing fresher; or, where a pin
 * was published since (the workspace can take one early with
 * `--config.minimumReleaseAge=0`), the moment that pin was published, so
 * that npm can still install it. A pin the registry lacks throws.
 */
function installCutoff(pins) {
  let cutoff = Date.now() - WEEK;
  for (const [name, version] of pins) {
    const published = publishTime(name, version);
    assert(published !== undefined, `${name}@${version} is on the registry`);
    cutoff = Math.max(cutoff, published.getTime());
  }
  return new Date(cutoff).toISOString();
}

/** Installs a fixture's package.json with npm, its versions as of `before`. */
function npmInstall(dir, before) {
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
    { cwd: dir },
  );
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

  // The fixture: what a stranger's project installs, at the repository's
  // versions of React, Next and TypeScript.
  const fixture = join(work, "fixture");
  const pinned = Object.fromEntries(
    [
      "next",
      "react",
      "react-dom",
      "@types/node",
      "@types/react",
      "@types/react-dom",
      "typescript",
    ].map((name) => [name, installed(name)]),
  );
  const { next: _next, ...consumerPins } = pinned;
  /**
   * The lowest version each of the components' ranges takes (`^10.2.0`
   * takes 10.2.0), magick-data's aside: a floor raised to a release
   * younger than a week must move `--before` up as a pin does.
   */
  const floors = Object.entries(manifest.dependencies)
    .filter(([name]) => name !== "magick-data")
    .map(([name, range]) => [name, range.match(/^[\^~]?(\d+\.\d+\.\d+)$/)?.[1]])
    .filter(([, floor]) => floor !== undefined);
  /** A fixture's dependencies: the pins, React's and Next's at run time. */
  const fixtureDependencies = (pins, extra) => {
    const runtime = ["next", "react", "react-dom"];
    const pick = (keep) =>
      Object.fromEntries(
        Object.entries(pins).filter(
          ([name]) => runtime.includes(name) === keep,
        ),
      );
    return {
      dependencies: { ...extra, ...pick(true) },
      devDependencies: pick(false),
    };
  };
  step("install both tarballs and Next with npm", () => {
    const before = installCutoff([...Object.entries(pinned), ...floors]);
    console.log(`  --before=${before}`);
    write(
      join(fixture, "package.json"),
      `${JSON.stringify(
        {
          name: "magick-components-smoke",
          private: true,
          type: "module",
          ...fixtureDependencies(pinned, {
            "magick-components": `file:${tarball}`,
            "magick-data": `file:${dataTarball}`,
          }),
          // The components' ^0.x range on magick-data, met by its tarball.
          overrides: { "magick-data": "$magick-data" },
        },
        null,
        2,
      )}\n`,
    );
    npmInstall(fixture, before);
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
  /** Loads every entry in plain Node and renders three drawings. */
  const loadEntries = (dir) => {
    write(
      join(dir, "node-load.mjs"),
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
if (!tree.includes('class="magick-tree-sephirot"') || !tree.includes("תפארת")) throw new Error("the Tree: " + tree.slice(0, 200));
const hall = renderToStaticMarkup(h(GdHall, { hall: hallPreset("neophyte").hall, fontBaseUrl: "/f" }));
if (!hall.includes("<svg")) throw new Error("the hall: " + hall.slice(0, 200));
if ((hall.match(/@font-face/g) ?? []).length !== 3) throw new Error("the hall's fonts: " + hall.slice(0, 200));
const rose = renderToStaticMarkup(h(RoseSigilImage, { sigilText: "שלום", showRose: true, debug: false, points: sigilPoints("שלום") }));
if (!rose.includes('stroke="red"')) throw new Error("the rose sigil: " + rose.slice(0, 200));
console.log(entries.length, "entries;", tree.length, hall.length, rose.length, "bytes of markup");
`,
    );
    console.log(
      `  ${run(process.execPath, ["node-load.mjs"], { cwd: dir }).output.trim()}`,
    );
  };
  step("every entry loads in plain Node, and the drawings render", () =>
    loadEntries(fixture),
  );

  /** Type-checks a strict consumer of every entry, both resolutions. */
  const typeCheck = (dir) => {
    write(
      join(dir, "types", "consumer.tsx"),
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
    <TreeOfLife id="tree" fontBaseUrl="/fonts" />
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
        join(dir, "types", `tsconfig.${name}.json`),
        JSON.stringify({ compilerOptions, files: ["consumer.tsx"] }),
      );
      run(
        process.execPath,
        [
          join(dir, "node_modules", "typescript", "bin", "tsc"),
          "-p",
          `tsconfig.${name}.json`,
        ],
        { cwd: join(dir, "types") },
      );
    }
  };
  step("a strict consumer type-checks under bundler and nodenext", () =>
    typeCheck(fixture),
  );

  // The same, against the registry's magick-data rather than the
  // workspace's: what a stranger installs once the components are
  // published. The fixture above overrides magick-data with its tarball,
  // so a component that used something magick-data gained since its last
  // publish would pass there and fail here. Until the registry has the
  // version the components were built with, there is nothing to compare.
  const registryData = publishTime("magick-data", dataManifest.version);
  if (registryData === undefined)
    console.log(
      `skip - against the registry's magick-data: it has no ${dataManifest.version}, the version the components were built with`,
    );
  else
    step(
      `against the registry's magick-data ${dataManifest.version}, every entry loads and type-checks`,
      () => {
        const registry = join(work, "registry");
        const before = installCutoff([
          ...Object.entries(consumerPins),
          ...floors,
          ["magick-data", dataManifest.version],
        ]);
        console.log(`  --before=${before}`);
        write(
          join(registry, "package.json"),
          `${JSON.stringify(
            {
              name: "magick-components-smoke-registry",
              private: true,
              type: "module",
              // No magick-data and no override: npm resolves the packed
              // manifest's range from the registry.
              ...fixtureDependencies(consumerPins, {
                "magick-components": `file:${tarball}`,
              }),
            },
            null,
            2,
          )}\n`,
        );
        npmInstall(registry, before);
        const lock = JSON.parse(
          readFileSync(join(registry, "package-lock.json"), "utf8"),
        );
        const data =
          lock.packages["node_modules/magick-data"] ??
          lock.packages[
            "node_modules/magick-components/node_modules/magick-data"
          ];
        assert(
          data?.resolved?.startsWith("https://registry.npmjs.org/"),
          `magick-data came from the registry (${data?.resolved})`,
        );
        console.log(`  magick-data ${data.version} from the registry`);
        loadEntries(registry);
        typeCheck(registry);
      },
    );

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
        for (const marker of [
          'class="magick-tree-sephirot"',
          "תפארת",
          'id="client-tree"',
        ])
          assert(html.includes(marker), `the page has ${marker}`);
        for (const [id] of SERVER_DRAWINGS)
          assert(
            new RegExp(`id="server-${id}"><(svg|table|style|div)[ >]`).test(
              html,
            ),
            `the server drew ${id}`,
          );
        // Three Trees, two from Server Components and one from a Client
        // Component: each has its own ids, and its labels' curves its own.
        const trees = [
          ...html.matchAll(/<svg[^>]* id="(tree-of-life-[^"]+)"/g),
        ];
        assert(trees.length === 3, `three Trees (${trees.length})`);
        const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id);
        const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
        assert(repeated.length === 0, `no id twice: ${repeated.slice(0, 5)}`);
        const curves = [...html.matchAll(/ xlink:href="#([^"]+)"/g)];
        assert(
          curves.length > 0 && curves.every(([, id]) => ids.includes(id)),
          "every label's curve is on the page",
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
          html("index").includes('class="magick-tree-sephirot"'),
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
