/**
 * Proves the published shape of the package (plan 052, decision 9).
 *
 * The app never consumes the tarball — it is `workspace:*` and compiles the
 * TypeScript sources — so nothing else would notice if the projection that
 * others install stopped working. This builds it, packs it with `pnpm pack`
 * (which applies `publishConfig`, as a publish would), and then reads it the
 * way a stranger would:
 *
 * 1. the tarball's listing: compiled JavaScript and declarations only, no
 *    check, build or test module, no Enochian dictionary, both licences and
 *    the README, and a `package.json` whose exports are the published ones;
 * 2. extracted as `node_modules/magick-data` in a fixture (the package has no
 *    dependencies, so extraction is what an install does), a consumer
 *    type-checked under `bundler` with `skipLibCheck` and without
 *    `resolveJsonModule`, the settings that once turned every row into `any`;
 * 3. negatives, each an error the types must still report, proved twice:
 *    every `@ts-expect-error` is used, and the same file without them gives
 *    exactly that many errors on exactly those lines;
 * 4. the consumer again under `nodenext`, as an ES module;
 * 5. the barrel, a table, `./tools`, the kameas, the Enochian tablets and a
 *    JSON subpath loaded in Node, with real values asserted, and the
 *    dictionary refused.
 *
 * Every step throws on failure and the process exits non-zero; the temporary
 * directory is removed either way.
 *
 * `--keep-tarball <path>` copies the tarball to `<path>` once every step has
 * passed (a relative path is read from where pnpm was run), and that file is
 * what a release publishes, `npm publish <path>` (plan 080, decision 3). It
 * prints the file's SHA-256 and npm's `sha512-…` integrity, to compare with
 * CI's log and, once published, with `npm view magick-data dist.integrity`.
 * `lib/` and `dist/` are git-ignored, so packing again could ship whatever
 * they hold; and `publishConfig.exports` is applied only by `pnpm pack`, so
 * `npm publish` from the package would ship `exports` that point at
 * `./src/*.ts`. The package's `prepublishOnly` guard refuses that.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { refusal } from "./prepublishGuard.mjs";
import {
  publishedPathOf,
  readmeSources,
  unsettledSources,
} from "./readmeSources.mjs";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const REPO_DIR = join(PACKAGE_DIR, "..", "..");
const TSC = createRequire(join(REPO_DIR, "package.json")).resolve(
  "typescript/bin/tsc",
);

const sourceManifest = JSON.parse(
  readFileSync(join(PACKAGE_DIR, "package.json"), "utf8"),
);

const { values: options } = parseArgs({
  options: { "keep-tarball": { type: "string" } },
});
// pnpm runs the script in the package's directory; INIT_CWD is where it was
// run from, which is what a relative path on its command line means.
const keepTarball =
  options["keep-tarball"] &&
  resolve(process.env.INIT_CWD ?? process.cwd(), options["keep-tarball"]);

/** Runs a command and returns what it printed; a non-zero exit throws. */
function run(command, args, options = {}) {
  const { allowFailure = false, ...rest } = options;
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
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

function tsc(project, extra = [], options = {}) {
  return run(process.execPath, [TSC, "-p", project, ...extra], {
    cwd: options.cwd,
    allowFailure: options.allowFailure,
  });
}

const steps = [];
function step(name, fn) {
  const result = fn();
  steps.push(name);
  console.log(`ok - ${name}`);
  return result;
}

const work = mkdtempSync(join(tmpdir(), "magick-data-smoke-"));
let failed = false;
try {
  step("build the package (data:build, then the publish emit into lib/)", () =>
    run("pnpm", ["run", "build"], { cwd: PACKAGE_DIR }),
  );

  const packDir = join(work, "pack");
  mkdirSync(packDir);
  const tarball = step("pnpm pack into a fresh directory", () => {
    run("pnpm", ["pack", "--pack-destination", packDir], {
      cwd: PACKAGE_DIR,
    });
    const found = readdirSync(packDir).filter((f) => f.endsWith(".tgz"));
    assert(found.length === 1, `one tarball, found ${found.join(", ")}`);
    return join(packDir, found[0]);
  });

  const entries = step("list the tarball", () =>
    run("tar", ["-tzf", tarball])
      .output.split("\n")
      .filter(Boolean)
      .map((entry) => entry.replace(/^package\//, "")),
  );

  step("no TypeScript other than declarations", () => {
    const ts = entries.filter(
      (f) => /\.(ts|mts|cts|tsx)$/.test(f) && !/\.d\.(ts|mts|cts)$/.test(f),
    );
    assert(ts.length === 0, `TypeScript sources shipped: ${ts.join(", ")}`);
    assert(!entries.some((f) => f.startsWith("src/")), "src/ is shipped");
  });

  step("no check, build or test module", () => {
    const unwanted = entries.filter(
      (f) =>
        /(^|\/)(integrity|schemas|coverage|duplicateKeys|check|build)\.(js|d\.ts)$/.test(
          f,
        ) || /\.test\./.test(f),
    );
    assert(unwanted.length === 0, `shipped: ${unwanted.join(", ")}`);
  });

  step("no Enochian dictionary", () => {
    const dictionary = entries.filter((f) => /dictionary/i.test(f));
    assert(dictionary.length === 0, `shipped: ${dictionary.join(", ")}`);
  });

  step("both licences and the README", () => {
    for (const file of ["LICENSE.txt", "LICENSE-DATA.txt", "README.md"])
      assert(entries.includes(file), `${file} is missing`);
  });

  // The README's test holds its Sources to the JSON5 sources; this holds it
  // to what the tarball actually carries (plan 080, stage A review, L8).
  step("the README's Sources name every JSON file in the tarball", () => {
    const readme = readFileSync(join(PACKAGE_DIR, "README.md"), "utf8");
    const named = readmeSources(readme).map((row) => publishedPathOf(row.file));
    const shipped = entries.filter((f) => /^dist\/.*\.json$/.test(f));
    const sort = (list) => JSON.stringify([...list].sort());
    assert(
      sort(named) === sort(shipped),
      `Sources name ${named.filter((f) => !shipped.includes(f)).join(", ") || "nothing"} not shipped; ` +
        `shipped without a row: ${shipped.filter((f) => !named.includes(f)).join(", ") || "nothing"}`,
    );
  });

  step("no version past 0.0.0 before the provenance sign-off", () => {
    const readme = readFileSync(join(PACKAGE_DIR, "README.md"), "utf8");
    const open = unsettledSources(readmeSources(readme));
    assert(
      sourceManifest.version === "0.0.0" || open.length === 0,
      `version ${sourceManifest.version}, but Sources still has open rows: ${open
        .map((row) => row.file)
        .join(", ")}`,
    );
  });

  const fixture = join(work, "fixture");
  const installed = join(fixture, "node_modules", "magick-data");
  mkdirSync(installed, { recursive: true });
  run("tar", ["-xzf", tarball, "-C", installed, "--strip-components=1"]);

  step("package.json carries the published exports and no ./src/", () => {
    const text = readFileSync(join(installed, "package.json"), "utf8");
    const manifest = JSON.parse(text);
    assert(
      JSON.stringify(manifest.exports) ===
        JSON.stringify(sourceManifest.publishConfig.exports),
      "exports are not publishConfig.exports",
    );
    assert(!text.includes("./src/"), "a ./src/ path survives");
    assert(
      !("./enochian/dictionary" in manifest.exports),
      "./enochian/dictionary is exported",
    );
    assert(!manifest.private, "the manifest is private");
    // npm's provenance check matches the repository against the workflow's.
    assert(
      manifest.repository?.url ===
        "git+https://github.com/gadicc/magickly.git" &&
        manifest.repository?.directory === "packages/magick-data",
      "repository does not name gadicc/magickly's packages/magick-data",
    );
    assert(
      manifest.version === sourceManifest.version,
      `version ${manifest.version}, the source says ${sourceManifest.version}`,
    );
    // Every target the map names is in the tarball.
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      if (subpath.includes("*")) continue;
      const files =
        typeof target === "string" ? [target] : Object.values(target);
      for (const file of files)
        assert(
          entries.includes(file.replace(/^\.\//, "")),
          `${subpath} names ${file}, which is not in the tarball`,
        );
    }
  });

  step("the prepack guard refuses npm and lets pnpm pack", () => {
    const guard = join(PACKAGE_DIR, "scripts", "prepublishGuard.mjs");
    const pack = (userAgent) =>
      run(process.execPath, [guard, "--pack"], {
        cwd: PACKAGE_DIR,
        env: { ...process.env, npm_config_user_agent: userAgent },
        allowFailure: true,
      });
    const npm = pack("npm/11.18.0 node/v24.18.0 linux x64 workspaces/false");
    assert(
      npm.status === 1 && npm.output.includes("Refusing to pack"),
      `the guard let npm pack\n${npm.output}`,
    );
    const pnpm = pack("pnpm/11.28.2 npm/? node/v24.18.0 linux x64");
    assert(pnpm.status === 0, `the guard refused pnpm\n${pnpm.output}`);
  });

  step("the prepublishOnly guard refuses the source, not the tarball", () => {
    const guard = join(PACKAGE_DIR, "scripts", "prepublishGuard.mjs");
    const source = run(process.execPath, [guard], {
      cwd: PACKAGE_DIR,
      env: {
        ...process.env,
        npm_package_json: join(PACKAGE_DIR, "package.json"),
      },
      allowFailure: true,
    });
    assert(
      source.status === 1 && source.output.includes("Refusing to publish"),
      `the guard let the source manifest through\n${source.output}`,
    );
    const packed = JSON.parse(
      readFileSync(join(installed, "package.json"), "utf8"),
    );
    assert(refusal(packed) === undefined, "the guard refuses the tarball");
    // pnpm drops the hook from what it packs, so nothing in the tarball can
    // run it, whatever a package manager does with a tarball's scripts.
    for (const hook of ["prepublishOnly", "prepack"])
      assert(
        packed.scripts?.[hook] === undefined,
        `the tarball carries ${hook}`,
      );
  });

  writeFileSync(
    join(fixture, "package.json"),
    `${JSON.stringify({ name: "fixture", private: true, type: "module" })}\n`,
  );

  const base = {
    target: "es2022",
    lib: ["es2022"],
    types: [],
    strict: false,
    strictNullChecks: true,
    noEmit: true,
    incremental: false,
    isolatedModules: true,
    skipLibCheck: true,
    resolveJsonModule: false,
    forceConsistentCasingInFileNames: true,
  };
  const bundler = { ...base, module: "esnext", moduleResolution: "bundler" };
  const nodenext = {
    ...base,
    module: "nodenext",
    moduleResolution: "nodenext",
  };
  const project = (name, compilerOptions, files) => {
    const path = join(fixture, `tsconfig.${name}.json`);
    writeFileSync(path, JSON.stringify({ compilerOptions, files }, null, 2));
    return path;
  };

  writeFileSync(
    join(fixture, "consumer.ts"),
    `import data from "magick-data";
import sephirot, { type SephirahId } from "magick-data/kabbalah/sephirot";
import elements from "magick-data/alchemy/elements";
import elementals from "magick-data/alchemy/elementals";
import { assemble, pathTarget, rowOf, type PathTarget } from "magick-data/tools";
import type { GraphSpec, LinkSpec, TableSpec } from "magick-data/graph";
import { graph } from "magick-data/graph";

// The barrel, and a four-hop read through it.
export const roman: string = data.sephirah.hod.name.roman;
export const he: string | undefined =
  data.sephirah.hod.gdGrade?.planet?.hebrewLetter?.letter.he;

// One table's subpath, raw.
export const hod: string = sephirot.hod.name.en;
export const id: SephirahId = "hod";

// ./tools.
declare const anyId: string;
export const row: string | undefined = rowOf(sephirot, anyId)?.name.roman;
const scoped = assemble({ element: elements, elemental: elementals });
export const elemental: string | undefined =
  scoped.element.fire.elemental?.name.en;
export const target: PathTarget | undefined = pathTarget(
  "sephirah",
  "gdGrade.planet.symbol",
);

// ./graph's types.
export const spec: GraphSpec = graph;
export const table: TableSpec = graph.planet;
export const link: LinkSpec = graph.planet.links.godNameId;
`,
  );

  step("(a) the consumer type-checks under bundler", () =>
    tsc(project("bundler", bundler, ["consumer.ts"]), [], { cwd: fixture }),
  );

  // Each negative is one line, directly under its directive, so that the
  // stripped run can be matched line for line.
  const negatives = `import data from "magick-data";
import sephirot from "magick-data/kabbalah/sephirot";
import elements from "magick-data/alchemy/elements";
import elementals from "magick-data/alchemy/elementals";
import { assemble } from "magick-data/tools";

const scoped = assemble({ element: elements, elemental: elementals });

// @ts-expect-error a field no row has, through the barrel
export const a = data.sephirah.hod.nonesuch;
// @ts-expect-error a field no row has, through a table's subpath
export const b = sephirot.hod.nonesuch;
// @ts-expect-error an unknown id, through the barrel
export const c = data.sephirah.nonesuch;
// @ts-expect-error an unknown id, through a table's subpath
export const d = sephirot.nonesuch;
// @ts-expect-error an optional link read without ?.
export const e = data.sephirah.hod.gdGrade.planet;
// @ts-expect-error an assignment into a frozen row
data.sephirah.hod.index = 3;
// @ts-expect-error an assignment into a raw table's row
sephirot.hod.index = 3;
// @ts-expect-error a link whose target the scoped assemble() left out
export const f = scoped.element.fire.zodiacs;
// @ts-expect-error a table the barrel does not assemble
export const g = data.seventyTwoAngel;
`;
  const lines = negatives.split("\n");
  const expectedLines = lines.flatMap((line, i) =>
    line.startsWith("// @ts-expect-error") ? [i + 1] : [],
  );
  writeFileSync(join(fixture, "negatives.ts"), negatives);
  // The same file with each directive blanked rather than removed, so that
  // every negative stays on the line after its directive's.
  writeFileSync(
    join(fixture, "stripped.ts"),
    lines
      .map((line) => (line.startsWith("// @ts-expect-error") ? "" : line))
      .join("\n"),
  );

  step(
    `(b) ${expectedLines.length} negatives: every @ts-expect-error is used`,
    () =>
      tsc(project("negatives", bundler, ["negatives.ts"]), [], {
        cwd: fixture,
      }),
  );

  step(
    `(b) without the directives, exactly ${expectedLines.length} errors on those lines`,
    () => {
      const { status, output } = tsc(
        project("stripped", bundler, ["stripped.ts"]),
        ["--pretty", "false"],
        { cwd: fixture, allowFailure: true },
      );
      assert(status !== 0, "the stripped negatives compiled");
      const errors = [
        ...output.matchAll(/^stripped\.ts\((\d+),\d+\): error (TS\d+)/gm),
      ];
      const got = errors.map((m) => Number(m[1]));
      const want = expectedLines.map((line) => line + 1);
      assert(
        JSON.stringify(got) === JSON.stringify(want),
        `errors on lines ${got.join(",")}, wanted ${want.join(",")}\n${output}`,
      );
      // A missing module would make every name `any` and fail differently,
      // but say so plainly if it ever happens.
      const resolution = errors.filter((m) =>
        ["TS2307", "TS7016", "TS2792"].includes(m[2]),
      );
      assert(resolution.length === 0, `module resolution failed\n${output}`);
    },
  );

  step("(c) the consumer type-checks under nodenext, as an ES module", () =>
    tsc(project("nodenext", nodenext, ["consumer.ts"]), [], { cwd: fixture }),
  );

  // What the consumer pays, for the record: not asserted, since a number
  // that moves is not a failure.
  // The README's figures for the barrel and a table are these.
  for (const [name, label, source] of [
    [
      "barrel",
      "barrel, one field",
      `import data from "magick-data";\nexport const r = data.sephirah.hod.name.roman;\n`,
    ],
    [
      "hops",
      "barrel, four hops",
      `import data from "magick-data";\nexport const r = data.sephirah.hod.gdGrade?.planet?.hebrewLetter?.letter.he;\n`,
    ],
    [
      "table",
      "table, one field",
      `import s from "magick-data/kabbalah/sephirot";\nexport const r = s.hod.name.roman;\n`,
    ],
  ]) {
    writeFileSync(join(fixture, `cost-${name}.ts`), source);
    const { output } = tsc(
      project(`cost-${name}`, bundler, [`cost-${name}.ts`]),
      ["--extendedDiagnostics"],
      { cwd: fixture },
    );
    const files = output.match(/^Files:\s+(\d+)/m)?.[1];
    const instantiations = output.match(/^Instantiations:\s+(\d+)/m)?.[1];
    console.log(
      `   ${label}: ${files} files, ${instantiations} instantiations`,
    );
  }

  writeFileSync(
    join(fixture, "load.mjs"),
    `import assert from "node:assert/strict";
import data from "magick-data";
import sephirot from "magick-data/kabbalah/sephirot";
import kameas from "magick-data/astrology/kameas";
import tablets, { WATCHTOWER_IDS, tabletVersion } from "magick-data/enochian/tablets";
import { squareNote, versionNote } from "magick-data/enochian/tabletNotes";
import keys, { aethyrCall, aethyrs, checkedText, keyByNumber, keyVersion } from "magick-data/enochian/keys";
import * as tools from "magick-data/tools";
import sephirotJson from "magick-data/json/kabbalah/sephirot.json" with { type: "json" };

assert.equal(data.sephirah.hod.gdGrade?.planet?.hebrewLetter?.letter.he, "ב");
assert.ok(Object.isFrozen(data.sephirah.hod));
assert.equal(tools.problemsOf(data).length, 0);
assert.equal(sephirot.hod.name.roman, "Hod");
assert.equal(tools.rowOf(sephirot, "hod"), sephirot.hod);
assert.equal(tools.rowOf(sephirot, "constructor"), undefined);
assert.deepEqual(Object.keys(tools).sort(), [
  "accessorName", "assemble", "pathTarget", "problemsOf", "rowOf",
]);
assert.deepEqual(tools.pathTarget("sephirah", "gdGrade.planet.symbol"), {
  table: "planet", field: "symbol", many: false,
});
assert.equal(tools.pathTarget("sephirah", "nonesuch"), undefined);
const scoped = tools.assemble({
  element: (await import("magick-data/alchemy/elements")).default,
  elemental: (await import("magick-data/alchemy/elementals")).default,
});
assert.equal(scoped.element.fire.elemental?.elementId, "fire");
assert.deepEqual(sephirotJson.hod, sephirot.hod);
assert.deepEqual(kameas.saturn, [[4, 9, 2], [3, 5, 7], [8, 1, 6]]);
assert.equal(kameas.luna[4][4], 41);
assert.ok(Object.isFrozen(kameas.sol[0]));
assert.deepEqual(WATCHTOWER_IDS, ["earth", "air", "water", "fire"]);
assert.match(squareNote("water", 4, 11)?.note ?? "", /four letters/);
assert.equal(versionNote("raphael")?.title, "Raphael's, 1587");
assert.equal(tabletVersion(tablets.union)?.grid.map((row) => row.join("")).join(" "), "EXARP HCOMA NANTA BITOM");
assert.equal(tabletVersion(tablets.union, "dee"), undefined);
assert.equal(tabletVersion(tablets.fire, "dee")?.grid[0][11], null);
assert.equal(keyByNumber(1)?.key, 1);
assert.ok(Object.isFrozen(keys[0]));
assert.equal(keyVersion(keys[0])?.length, keys[0].rows.length);
assert.match(keyVersion(keys[0])?.find((word) => word.word)?.word ?? "", /^[A-Z]+$/);
assert.match(checkedText(keys[0].checked), /checked/i);
assert.equal(keys.length, 19);
assert.equal(keyByNumber(19)?.rows.length, 163);
assert.equal(aethyrs.length, 30);
assert.equal(aethyrCall(14, "dee")?.find((word) => word.slot === "aethyr")?.word, "UTA");
await assert.rejects(import("magick-data/enochian/dictionary"), {
  code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
});
console.log("loaded:", Object.keys(data).length, "tables in the barrel");
`,
  );

  step("(d) Node loads the barrel, tables, ./tools and a JSON subpath", () => {
    const { output } = run(process.execPath, ["load.mjs"], { cwd: fixture });
    process.stdout.write(`   ${output}`);
  });

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

  console.log(
    `smoke: ${steps.length} steps passed; ${entries.length} files in the tarball`,
  );
} catch (error) {
  failed = true;
  console.error(`not ok - ${error.stack ?? error}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
if (failed) process.exit(1);
