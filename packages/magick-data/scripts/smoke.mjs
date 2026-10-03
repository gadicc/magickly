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
 * 5. the barrel, a table, `./tools` and a JSON subpath loaded in Node, with
 *    real values asserted, and the dictionary refused.
 *
 * Every step throws on failure and the process exits non-zero; the temporary
 * directory is removed either way.
 */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const REPO_DIR = join(PACKAGE_DIR, "..", "..");
const TSC = createRequire(join(REPO_DIR, "package.json")).resolve(
  "typescript/bin/tsc",
);

const sourceManifest = JSON.parse(
  readFileSync(join(PACKAGE_DIR, "package.json"), "utf8"),
);

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
  for (const [name, source] of [
    [
      "barrel",
      `import data from "magick-data";\nexport const r = data.sephirah.hod.name.roman;\n`,
    ],
    [
      "table",
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
      `   ${name}, one field: ${files} files, ${instantiations} instantiations`,
    );
  }

  writeFileSync(
    join(fixture, "load.mjs"),
    `import assert from "node:assert/strict";
import data from "magick-data";
import sephirot from "magick-data/kabbalah/sephirot";
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
await assert.rejects(import("magick-data/enochian/dictionary"), {
  code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
});
console.log("loaded:", Object.keys(data).length, "tables in the barrel");
`,
  );

  step("(d) Node loads the barrel, a table, ./tools and a JSON subpath", () => {
    const { output } = run(process.execPath, ["load.mjs"], { cwd: fixture });
    process.stdout.write(`   ${output}`);
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
