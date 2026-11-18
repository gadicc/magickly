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
 *    built with, not private, naming the repository and the source's
 *    version; no version past 0.0.0 while a row of the README's Provenance
 *    is not signed off; and the publish guards, which refuse npm and the
 *    source manifest and let pnpm and the tarball through;
 * 2. which built files carry `"use client"`, first: MercuryWidget,
 *    MoonWidget and RoseSigil, and no other;
 * 3. every entry loaded in plain Node, and the Tree, a hall and the rose
 *    sigil's image rendered with `renderToStaticMarkup`, no bundler, a
 *    hall written as tags drawn as its `hallFromTags` data is, and the
 *    sigil engine planning, placing and drawing on a layout of its own;
 * 4. a strict consumer type-checked under `bundler` and `nodenext`, with
 *    `skipLibCheck` off, and a prop the types must refuse, with the
 *    README's TSX and TS examples; it writes a hall with the tags;
 * 5. 3 and 4 again in a second fixture that installs the components'
 *    tarball alone, so that npm takes magick-data from the registry, as a
 *    stranger's install would. While the registry lacks the magick-data
 *    version the components were built with, it is skipped, saying so,
 *    unless the tarball is kept past 0.0.0: a release's tarball fails
 *    instead (stage G review, H1), and `--allow-unpublished-data` skips
 *    it after all, for a run that publishes that magick-data too
 *    (`registryFixture.mjs` has the rule);
 * 6. a Next app built with webpack and with Turbopack, with every entry,
 *    the live rose sigil in a client page among them, and no `fs` stub
 *    (no dependency may need one); each build's prerendered HTML is read
 *    for the server's drawings, among
 *    them a hall written as tags in a Server Component, which must be
 *    the hall a Client Component draws from those tags' data.
 *
 * `--keep-tarball <path>` removes any file at `<path>` first, so that a
 * failed run leaves none from an earlier one, and copies the components'
 * tarball there once every step has passed (a relative path is read from
 * where pnpm was run). That file is what a release publishes, `npm publish
 * <path>` (plan 080, decision 3 and stage G), as magick-data's smoke test
 * keeps its own.
 * It prints the file's SHA-256 and npm's `sha512-…` integrity, to compare
 * with CI's log and, once published, with `npm view magick-components
 * dist.integrity`. `lib/` is git-ignored, so packing again could ship
 * whatever it holds; and `publishConfig.exports` is applied only by `pnpm
 * pack`, so `npm pack` or `npm publish` in the package would ship
 * `exports` that point at `./src/`. The shared guard,
 * `scripts/npm-publish-guard.mjs`, refuses both, and steps below prove it.
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
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { refusal } from "../../../scripts/npm-publish-guard.mjs";
import {
  signOffRows,
  unsignedRows,
} from "../../../scripts/provenance-sign-off.mjs";
import { registryFixture } from "./registryFixture.mjs";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const REPO_DIR = join(PACKAGE_DIR, "..", "..");
const DATA_DIR = join(REPO_DIR, "packages", "magick-data");

const { values: options } = parseArgs({
  options: {
    keep: { type: "boolean" },
    "keep-tarball": { type: "string" },
    "allow-unpublished-data": { type: "boolean" },
  },
});
// pnpm runs the script in the package's directory; INIT_CWD is where it was
// run from, which is what a relative path on its command line means.
const keepTarball =
  options["keep-tarball"] &&
  resolve(process.env.INIT_CWD ?? process.cwd(), options["keep-tarball"]);
// A failed run must not leave an earlier run's tarball to be published.
if (keepTarball) rmSync(keepTarball, { force: true });

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
  "lib/astrology/MercuryWidget.js",
  "lib/astrology/MoonWidget.js",
  "lib/gd/RoseSigil.js",
];
/** A small hall written with the hall tags, as GdHall's children. */
const TAGS_HALL = `<GdHall wall="gradient" compass={false}>
  <Hall.Dais><Hall.Officer role="hierophant" /></Hall.Dais>
  <Hall.Floor>
    {[4, 12].map((x) => <Hall.Pillar key={x} kind={x < 8 ? "black" : "white"} x={x} y={3} />)}
    <Hall.Altar at="center"><Hall.Item kind="cross" form="calvary" /></Hall.Altar>
    <Hall.Officer role="hiereus" x={8} y={14}><Hall.Label text="West" /></Hall.Officer>
  </Hall.Floor>
  <Hall.Caption text="Tags" />
</GdHall>`;

/**
 * Every component that can render as a Server Component, as the Next page
 * draws it: [its id on the page, its imports, its JSX]. A component that
 * passes a function to the browser, such as an event handler it was not
 * given, fails the page's prerender. The hall written as tags is drawn
 * twice: by GdHall on the server, and from hallFromTags' data by GdHall
 * in a Client Component, as a page hands a hall across that boundary.
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
    "hall-tags",
    `import * as Hall from "magick-components/gd/hall/tags";`,
    TAGS_HALL,
  ],
  [
    "hall-bridge",
    `import { ClientHall } from "./ClientHall";`,
    `<ClientHall hall={Hall.hallFromTags(${TAGS_HALL}).hall} />`,
  ],
  [
    "lamen",
    `import Lamen from "magick-components/gd/Lamen";`,
    `<Lamen officer="hierophant" />`,
  ],
  [
    "candlestick",
    `import SevenBranchedCandlestick from "magick-components/gd/SevenBranchedCandlestick";`,
    `<SevenBranchedCandlestick />`,
  ],
  [
    "shewbread",
    `import TableOfShewbread from "magick-components/gd/TableOfShewbread";`,
    `<TableOfShewbread />`,
  ],
  [
    "fylfot",
    `import FylfotCross from "magick-components/gd/FylfotCross";`,
    `<FylfotCross />`,
  ],
  [
    "rose",
    `import { RoseSigilImage } from "magick-components/gd/RoseSigilImage";\nimport { sigilPoints } from "magick-components/gd/roseSigilGeometry";`,
    `<RoseSigilImage text="שלום" showRose debug={false} points={sigilPoints("שלום")} />`,
  ],
  [
    "tablet",
    `import Tablet from "magick-components/enochian/Tablet";`,
    `<Tablet tablet="water" />`,
  ],
  [
    "kamea",
    `import Kamea from "magick-components/astrology/Kamea";`,
    `<Kamea planet="saturn" />`,
  ],
  [
    "spirit",
    `import PlanetarySpirit from "magick-components/astrology/PlanetarySpirit";`,
    `<PlanetarySpirit spirit="zazel" style={{ height: "2em" }} />`,
  ],
  [
    "chakras",
    `import Chakras from "magick-components/chakras/Chakras";`,
    `<Chakras />`,
  ],
  [
    "moon",
    `import Moon from "magick-components/astrology/Moon";`,
    `<Moon phase={0.3} height={85} />`,
  ],
];

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

/**
 * The hall drawn in an element of the page with this id, its `useId`
 * prefix replaced, so that two drawings of one hall compare equal.
 */
function hallSvg(html, id) {
  const svg = html.match(
    new RegExp(`id="${id}"><svg[^>]*>[^]*?</svg></div>`),
  )?.[0];
  const prefix = svg?.match(/aria-labelledby="([^"]+)-title"/)?.[1];
  assert(svg && prefix, `a hall in #${id}`);
  return svg.replace(`id="${id}">`, "").replaceAll(`${prefix}-`, "ID-");
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
    assert(!manifest.private, "the manifest is not private");
    // npm's provenance check matches the repository against the workflow's.
    assert(
      manifest.repository?.url ===
        "git+https://github.com/gadicc/magickly.git" &&
        manifest.repository?.directory === "packages/magick-components",
      "repository names gadicc/magickly's packages/magick-components",
    );
    assert(
      manifest.version === sourceManifest.version,
      `version ${manifest.version}, the source says ${sourceManifest.version}`,
    );
  });

  // The packed README's, as the README test checks the source's (stage G).
  step("no version past 0.0.0 before the provenance sign-off", () => {
    const readme = readFileSync(join(packed, "README.md"), "utf8");
    const open = unsignedRows(
      signOffRows(readme, { section: "Provenance", firstColumn: "Drawing" }),
    );
    assert(
      manifest.version === "0.0.0" || open.length === 0,
      `version ${manifest.version}, but Provenance has rows not signed off: ${open
        .map((row) => row.item)
        .join("; ")}`,
    );
  });

  // By npm_execpath, which each package manager sets afresh; npm passes on
  // an inherited pnpm user agent (plan 080, second stage A review).
  step(
    "the prepack guard refuses npm, even under pnpm, and lets pnpm pack",
    () => {
      const guard = join(REPO_DIR, "scripts", "npm-publish-guard.mjs");
      const pnpmAgent = "pnpm/11.28.2 npm/? node/v24.18.0 linux x64";
      const npmCli = "/usr/lib/node_modules/npm/bin/npm-cli.js";
      const pack = (npm_execpath, npm_config_user_agent) =>
        run(process.execPath, [guard, "--pack"], {
          cwd: PACKAGE_DIR,
          env: {
            ...process.env,
            npm_package_json: join(PACKAGE_DIR, "package.json"),
            npm_execpath,
            npm_config_user_agent,
          },
          allowFailure: true,
        });
      for (const [what, result] of [
        ["npm", pack(npmCli, "npm/11.18.0 node/v24.18.0 linux x64")],
        ["npm with pnpm's user agent", pack(npmCli, pnpmAgent)],
        ["no npm_execpath", pack("", pnpmAgent)],
      ])
        assert(
          result.status === 1 &&
            result.output.includes("Refusing to pack magick-components"),
          `the guard let ${what} pack\n${result.output}`,
        );
      const pnpm = pack("/opt/pnpm/bin/pnpm.cjs", pnpmAgent);
      assert(pnpm.status === 0, `the guard refused pnpm\n${pnpm.output}`);
    },
  );

  step("the prepublishOnly guard refuses the source, not the tarball", () => {
    const guard = join(REPO_DIR, "scripts", "npm-publish-guard.mjs");
    const source = run(process.execPath, [guard], {
      cwd: PACKAGE_DIR,
      env: {
        ...process.env,
        npm_package_json: join(PACKAGE_DIR, "package.json"),
      },
      allowFailure: true,
    });
    assert(
      source.status === 1 &&
        source.output.includes("Refusing to publish magick-components"),
      `the guard let the source manifest through\n${source.output}`,
    );
    assert(refusal(manifest) === undefined, "the guard refuses the tarball");
    // pnpm drops the hooks from what it packs, so nothing in the tarball
    // can run them, whatever a package manager does with its scripts.
    for (const hook of ["prepublishOnly", "prepack"])
      assert(
        manifest.scripts?.[hook] === undefined,
        `the tarball carries ${hook}`,
      );
  });

  step('only MercuryWidget, MoonWidget and RoseSigil are "use client"', () => {
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
for (const entry of entries) {
  const module = await import("magick-components/" + entry.slice(2));
  if (Object.keys(module).length === 0)
    throw new Error(entry + " exports nothing");
}
const { default: TreeOfLife } = await import("magick-components/kabbalah/TreeOfLife");
const { GdHall } = await import("magick-components/gd/hall");
const { hallPreset } = await import("magick-components/gd/hall/presets");
const Hall = await import("magick-components/gd/hall/tags");
const { RoseSigilImage } = await import("magick-components/gd/RoseSigilImage");
const { sigilPoints } = await import("magick-components/gd/roseSigilGeometry");
const tree = renderToStaticMarkup(h(TreeOfLife, { field: "name.he", width: 300 }));
if (!tree.includes('class="magick-tree-sephirot"') || !tree.includes("תפארת")) throw new Error("the Tree: " + tree.slice(0, 200));
const hall = renderToStaticMarkup(h(GdHall, { hall: hallPreset("neophyte").hall, fontBaseUrl: "/f" }));
if (!hall.includes("<svg")) throw new Error("the hall: " + hall.slice(0, 200));
if ((hall.match(/@font-face/g) ?? []).length !== 3) throw new Error("the hall's fonts: " + hall.slice(0, 200));
const tags = h(GdHall, { wall: "gradient" }, h(Hall.Floor, null, h(Hall.Pillar, { kind: "white", x: 12, y: 3 })), h(Hall.Caption, { text: "Tags" }));
const data = Hall.hallFromTags(tags);
if (data.diagnostics.length || data.hall.children?.[0]?.children?.[0]?.type !== "pillar") throw new Error("the tags' data: " + JSON.stringify(data));
if (renderToStaticMarkup(tags) !== renderToStaticMarkup(h(GdHall, { hall: data.hall }))) throw new Error("the hall drawn from tags differs from its data's");
const rose = renderToStaticMarkup(h(RoseSigilImage, { text: "שלום", showRose: true, debug: false, points: sigilPoints("שלום") }));
if (!rose.includes('stroke="red"')) throw new Error("the rose sigil: " + rose.slice(0, 200));
// The sigil engine on a layout of the consumer's own: three places in a row.
const { SigilImage } = await import("magick-components/sigil/SigilImage");
const { planSigil, sigilWords } = await import("magick-components/sigil/planSigil");
const { placeSigil } = await import("magick-components/sigil/placeSigil");
const { ROSE_SIGIL_PROFILE, roseSigilLayout } = await import("magick-components/gd/roseSigilLayout");
const row = { a: { x: -20, y: 0 }, b: { x: 0, y: 0 }, c: { x: 20, y: 0 } };
const layout = { place: (t) => (t in row ? t : null), anchor: (p) => row[p], slack: () => 4, placeAt: () => null, unit: 1, places: Object.keys(row) };
const own = renderToStaticMarkup(h(SigilImage, { text: "ab ca", layout, profile: { id: "row", nooseTolerance: 1 } }));
if (!own.includes('viewBox="-102 -34 136 68"') || (own.match(/<path /g) ?? []).length !== 1) throw new Error("the engine on its own layout: " + own);
const plan = planSigil(sigilWords("מטטרון"), roseSigilLayout(), ROSE_SIGIL_PROFILE);
if (JSON.stringify(plan[0].map((v) => v.marks)) !== JSON.stringify([["start"], ["crook"], ["noose"], [], ["end"]])) throw new Error("the plan: " + JSON.stringify(plan));
if (placeSigil(plan, roseSigilLayout(), ROSE_SIGIL_PROFILE)[0].length !== 5) throw new Error("the placed plan");
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

  /**
   * The README's TypeScript examples, TSX and TS, each a file of its own,
   * as the packed README has them: the consumer below type-checks them
   * too, in one program, so a declaration one block gives (`*.css`) holds
   * for another.
   */
  const readmeExamples = [
    ...readFileSync(join(packed, "README.md"), "utf8").matchAll(
      /^( *)```(tsx?)\n([^]*?)^\1```$/gm,
    ),
  ].map(([, indent, lang, code]) => ({
    lang,
    code: code.replace(new RegExp(`^${indent}`, "gm"), ""),
  }));
  for (const lang of ["tsx", "ts"])
    assert(
      readmeExamples.some((example) => example.lang === lang),
      `the README has ${lang} examples`,
    );

  /** Type-checks a strict consumer of every entry, both resolutions. */
  const typeCheck = (dir) => {
    const examples = readmeExamples.map(({ lang, code }, i) => {
      // A block that opens by naming its file (`// css.d.ts`) is written
      // as one, so that a declaration file is one.
      const named = code.match(/^\/\/ ([\w.-]+\.(?:d\.ts|tsx?))\n/)?.[1];
      const file = named ? `readme${i}-${named}` : `readme${i}.${lang}`;
      write(join(dir, "types", file), code);
      return file;
    });
    write(
      join(dir, "types", "consumer.tsx"),
      `${entries
        .map(
          (entry, i) =>
            `import * as entry${i} from "magick-components/${entry.slice(2)}";`,
        )
        .join("\n")}
export const all = [${entries.map((_, i) => `entry${i}`).join(", ")}];
import TreeOfLife, { type TreeColorScale, type TreeOfLifeProps } from "magick-components/kabbalah/TreeOfLife";
import { GdHall, type HallNode } from "magick-components/gd/hall";
import { hallPreset } from "magick-components/gd/hall/presets";
import RoseSigil from "magick-components/gd/RoseSigil";
import { RoseSigilImage } from "magick-components/gd/RoseSigilImage";
import { sigilPoints } from "magick-components/gd/roseSigilGeometry";
import { ROSE_SIGIL_PROFILE, roseSigilLayout } from "magick-components/gd/roseSigilLayout";
import { SigilImage } from "magick-components/sigil/SigilImage";
import { planSigil, sigilWords } from "magick-components/sigil/planSigil";
import { placeSigil } from "magick-components/sigil/placeSigil";
import type { PlacedWord, SigilLayout, SigilPlan, SigilProfile } from "magick-components/sigil/types";
import Tablet from "magick-components/enochian/Tablet";
import MercuryWidget from "magick-components/astrology/MercuryWidget";
import { MoonWidget } from "magick-components/astrology/MoonWidget";
import Moon from "magick-components/astrology/Moon";
import { currentOrNextRetrograde } from "magick-components/astrology/mercuryRetrograde";
import PlanetarySpirit from "magick-components/astrology/PlanetarySpirit";
import { Kamea } from "magick-components/astrology/Kamea";
import Lamen from "magick-components/gd/Lamen";
import FylfotCross, { FYLFOT_CELLS, type FylfotCellClick } from "magick-components/gd/FylfotCross";
import { GradeTree } from "magick-components/gd/GradeTree";
import Chakras from "magick-components/chakras/Chakras";
import * as Hall from "magick-components/gd/hall/tags";

const scale: TreeColorScale = "king";
const Sistrum = Hall.defineHallItem<{ metal?: "gold" | "silver" }>("sistrum");
const SerpentTree = Hall.defineHallTag<Hall.HallPlaced & { coils?: number }>("serpentTree");
const pillars = () => [4, 12].map((x) => <Hall.Pillar key={x} kind={x < 8 ? "black" : "white"} x={x} y={3} />);
const tagged = (
  <GdHall wall="gradient" width={300}>
    <Hall.Floor>
      {pillars()}
      <Hall.Altar at="center"><Sistrum metal="gold" /></Hall.Altar>
      <SerpentTree coils={3} x={8} y={12} />
    </Hall.Floor>
    <Hall.Caption text="Tags" />
  </GdHall>
);
export const tagsHall: HallNode = Hall.hallFromTags(tagged).hall;
const sephirahHref: TreeOfLifeProps["sephirahHref"] = (sephirah) => "/s/" + sephirah.id;
const pathHref: TreeOfLifeProps["pathHref"] = (path) => (path.id === "1_2" ? null : "/p/" + path.id);
const onCellClick = ({ id, row, column, expected }: FylfotCellClick) =>
  console.log(id, row, column, expected === FYLFOT_CELLS[row][column]);
const hall: HallNode | undefined = hallPreset("neophyte")?.hall;
const end: string | undefined = currentOrNextRetrograde(new Date())?.end.toISOString();
const cells: Record<number, { x: number; y: number }> = { 1: { x: 0, y: 0 }, 7: { x: 10, y: 0 }, 3: { x: 0, y: 10 } };
const square: SigilLayout<number> = {
  place: (n) => (n in cells ? String(n) : null),
  anchor: (place) => cells[Number(place)],
  slack: () => 2,
  placeAt: () => null,
  unit: 0.5,
  places: ["1", "7", "3"],
};
const zazel: SigilProfile = { id: "kamea", nooseTolerance: 1 };
export const plan: SigilPlan = planSigil([[7, 1, 7, 3]], square, zazel);
export const placed: PlacedWord[] = placeSigil(plan, square, zazel);
export const words: string[][] = sigilWords("יהוה אלהים");

export const page = (
  <>
    <TreeOfLife colorScale={scale} letterAttr="hebrew" showDaat />
    <TreeOfLife id="tree" fontBaseUrl="/fonts" />
    <TreeOfLife activeSephirah={null} sephirahHref={sephirahHref} pathHref={pathHref} />
    <GradeTree activeSephirah="tiferet" sephirahHref={(s) => "/g/" + s.gdGradeId} />
    {/* @ts-expect-error: a colour scale magick-data does not have */}
    <TreeOfLife colorScale="sepia" />
    {/* @ts-expect-error: the Tree's sphere is activeSephirah */}
    <TreeOfLife active="tiferet" />
    {hall && <GdHall hall={hall} fontBaseUrl="/fonts" />}
    <RoseSigil text="שלום" animate={false} />
    <RoseSigilImage text="אב" showRose debug={false} points={[]} />
    <RoseSigilImage text="אב" points={sigilPoints("אב")} />
    <SigilImage text="יהוה אלהים" layout={roseSigilLayout("regardie1939")} profile={ROSE_SIGIL_PROFILE} stroke="black" />
    {/* @ts-expect-error: a layout of numbers cannot draw a text */}
    <SigilImage text="אב" layout={square} profile={zazel} />
    <Chakras activeChakra="heart" />
    <Chakras activeChakra={null} />
    {/* @ts-expect-error: the chakra is activeChakra, as the Tree's sphere is activeSephirah */}
    <Chakras active="heart" />
    <Tablet tablet="air" />
    <Tablet tablet="earth" frame label={false} mirrorReversed={false} showSecondLetters />
    {/* @ts-expect-error: the tablet is tablet, an id is a DOM id */}
    <Tablet id="air" />
    <MercuryWidget image="/m.webp" />
    <MoonWidget latitude={-33.9} padding="4px" background="/sky.jpg" />
    <Moon date={new Date()} width={60} hemisphere="south" />
    <Moon phase={0.5} />
    {/* @ts-expect-error: the widget's padding is padding */}
    <MoonWidget moonPadding="4px" />
    <PlanetarySpirit spirit="zazel" style={{ height: "1em" }} ink="currentColor" className="seal" />
    <Kamea planet="saturn" width={120} label="Saturn's square" />
    <Kamea planet="luna" height="4em" label={false} />
    <Lamen officer="hierophant" ringStyle={{ fill: "gold" }} discStyle={{ stroke: "red" }} />
    <FylfotCross cells={[["fire", "", "cursor", null, "water"]]} onCellClick={onCellClick} />
    {tagged}
    {/* @ts-expect-error: a caption's text is a prop, not a child */}
    <Hall.Caption text="a">Neophyte Temple</Hall.Caption>
    {/* @ts-expect-error: an officer's role is one the vocabulary knows */}
    <Hall.Officer role="hegemen" />
    {/* @ts-expect-error: the tags form takes no hall, and the data form no root attributes */}
    <GdHall hall={hall!} wall="plain" />
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
    // Next's own declarations do not check with skipLibCheck off, so an
    // example that imports Next (next.config.ts) is checked below as a
    // Next app checks it, and the rest here as well.
    const plain = examples.filter(
      (_, i) => !/^import [^\n]* from "next";$/m.test(readmeExamples[i].code),
    );
    for (const [name, compilerOptions] of [
      ["bundler", { ...base, module: "esnext", moduleResolution: "bundler" }],
      [
        "nodenext",
        { ...base, module: "nodenext", moduleResolution: "nodenext" },
      ],
    ]) {
      write(
        join(dir, "types", `tsconfig.${name}.json`),
        JSON.stringify({
          compilerOptions,
          files: ["consumer.tsx", ...plain],
        }),
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
    if (!existsSync(join(dir, "node_modules", "next"))) return;
    // Every example, as a Next app's tsconfig (the fixture's below) checks it.
    write(
      join(dir, "types", "tsconfig.next.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          jsx: "react-jsx",
          target: "es2022",
          lib: ["dom", "dom.iterable", "esnext"],
          module: "esnext",
          moduleResolution: "bundler",
          isolatedModules: true,
        },
        files: examples,
      }),
    );
    run(
      process.execPath,
      [
        join(dir, "node_modules", "typescript", "bin", "tsc"),
        "-p",
        "tsconfig.next.json",
      ],
      { cwd: join(dir, "types") },
    );
  };
  step(
    "a strict consumer type-checks under bundler and nodenext, and the README's examples as a Next app",
    () => typeCheck(fixture),
  );

  // The same, against the registry's magick-data rather than the
  // workspace's: what a stranger installs once the components are
  // published. The fixture above overrides magick-data with its tarball,
  // so a component that used something magick-data gained since its last
  // publish would pass there and fail here. Until the registry has the
  // version the components were built with, there is nothing to compare,
  // and a tarball kept for a release fails (registryFixture.mjs).
  const registryData = publishTime("magick-data", dataManifest.version);
  const againstRegistry = registryFixture({
    version: manifest.version,
    keepTarball: Boolean(keepTarball),
    allowUnpublishedData: Boolean(options["allow-unpublished-data"]),
    dataPublished: registryData !== undefined,
  });
  if (againstRegistry === "fail")
    throw new Error(
      `against the registry's magick-data: it has no ${dataManifest.version}, the version the components were built with, so ${manifest.name}@${manifest.version} kept for a release could never be installed; publish magick-data first, or pass --allow-unpublished-data when the same run publishes it`,
    );
  if (againstRegistry === "skip")
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

  // The Next app. Its server page imports every entry, and a client page
  // draws the live sigil; it builds with no fs stub.
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
    `${entries
      .map(
        (entry, i) =>
          `import * as entry${i} from "magick-components/${entry.slice(2)}";`,
      )
      .join("\n")}
${SERVER_DRAWINGS.map(([, imports]) => imports).join("\n")}
import MoonWidget from "magick-components/astrology/MoonWidget";
import MercuryWidget from "magick-components/astrology/MercuryWidget";
import { ClientTree } from "./ClientTree";

const loaded = [${entries.map((_, i) => `entry${i}`).join(", ")}];

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
    join(fixture, "app", "ClientHall.tsx"),
    `"use client";
import { GdHall, type HallNode } from "magick-components/gd/hall";

/** A hall drawn from data in a Client Component, where tags would be erased. */
export function ClientHall({ hall }: { hall: HallNode }) {
  return <GdHall hall={hall} />;
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

  write(
    join(fixture, "next.config.ts"),
    `import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
};
export default nextConfig;
`,
  );
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

export function Rose() {
  return (
    <div id="client-rose">
      <RoseSigil text="שלום" />
    </div>
  );
}
`,
  );

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
      `Next builds every entry and the live sigil with ${bundler}, no fs stub`,
      () => {
        const pages = build(bundler);
        const rose = pages("rose");
        assert(rose.includes('id="client-rose"'), "the sigil page renders");
        assert(rose.includes('stroke="red"'), "with its path");
        const html = pages("index");
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
        // The hall written as tags draws as its hallFromTags data does,
        // and draws the hall: its caption, a label child and its objects.
        const tagsHall = hallSvg(html, "server-hall-tags");
        assert(
          tagsHall === hallSvg(html, "server-hall-bridge"),
          "the hall drawn from tags is the hall drawn from their data",
        );
        for (const text of [">Tags</text>", ">West</text>", ">Hierophant<"])
          assert(tagsHall.includes(text), `the tags hall draws ${text}`);
        const uses = tagsHall.match(/<use /g)?.length ?? 0;
        assert(uses >= 6, `the tags hall places its objects (${uses})`);
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

  if (keepTarball)
    step(`keep the verified tarball at ${keepTarball}`, () => {
      mkdirSync(dirname(keepTarball), { recursive: true });
      copyFileSync(tarball, keepTarball);
      const bytes = readFileSync(keepTarball);
      const sha = createHash("sha256").update(bytes).digest("hex");
      const integrity = createHash("sha512").update(bytes).digest("base64");
      console.log(`   sha256 ${sha}`);
      console.log(`   integrity sha512-${integrity}`);
    });
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : error);
} finally {
  if (options.keep) console.log(`kept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}
if (failed) process.exitCode = 1;
