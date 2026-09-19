/**
 * Converts the JSON5 sources to the plain JSON the data layer imports.
 *
 * The sources stay JSON5, which is what a human edits: comments, trailing
 * commas and unquoted keys. Everything downstream — the typed modules, the
 * graph, the schemas, another language — reads `data/dist`, where a table is
 * ordinary JSON and TypeScript derives its ids from the file itself rather
 * than from a union copied by hand (plan 032, decision 1).
 *
 * The Enochian dictionary is deliberately not converted: as a JSON import it
 * costs about 19,300 types, more than every other table combined, and step 3
 * gives it a declared record type instead.
 *
 * `data/dist` is generated and gitignored, so every task that reads it runs
 * this first: `data:build` chains ahead of `dev`, `typecheck`, `build`,
 * `check:turbopack` and the test scripts, and this module is also vitest's
 * globalSetup, so a bare `vitest run <file>` works. A missing table is a
 * module resolution error rather than a silent `any`, because nothing
 * declares `*.json`.
 *
 * It is `.mts` because the repository is CommonJS: tsx compiles a `.ts` here
 * to CJS, where neither `import.meta.url` nor top-level await exists, and
 * this build wants both.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import JSON5 from "json5";
import { graph } from "./graph";

const DATA_DIR = fileURLToPath(new URL(".", import.meta.url));
const DIST_DIR = join(DATA_DIR, "dist");

/** Relative to `data/`, the sources this build leaves alone. */
const SKIP = new Set(["enochian/dictionary.json5"]);

/** Every `*.json5` under `data/`, `dist` aside, relative to `data/`. */
async function sources(dir = DATA_DIR): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path === DIST_DIR) continue;
      found.push(...(await sources(path)));
    } else if (entry.name.endsWith(".json5")) {
      const name = relative(DATA_DIR, path);
      if (!SKIP.has(name)) found.push(name);
    }
  }
  return found.sort();
}

/** Writes only when the bytes change, so bundlers do not see a new mtime. */
async function writeIfChanged(path: string, content: string) {
  const already = await readFile(path, "utf8").catch(() => null);
  if (already === content) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  return true;
}

/** Every `.json` this build owns, relative to `data/dist`. */
async function emitted(dir = DIST_DIR): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await emitted(path)));
    else if (entry.name.endsWith(".json")) found.push(relative(DIST_DIR, path));
  }
  return found;
}

/** Converts every source, and removes output a source no longer explains. */
export async function buildData() {
  const written: string[] = [];
  const expected = new Set<string>();
  let tables = 0;

  for (const name of await sources()) {
    const out = name.replace(/\.json5$/, ".json");
    expected.add(out);
    tables++;
    const parsed = JSON5.parse(await readFile(join(DATA_DIR, name), "utf8"));
    // Source order is insertion order through both parse and stringify, so a
    // diff of the output reads like a diff of the source.
    const json = `${JSON.stringify(parsed, null, 2)}\n`;
    if (await writeIfChanged(join(DIST_DIR, out), json)) written.push(out);
  }

  // The graph, for a reader that is not TypeScript. `as const satisfies`
  // leaves an ordinary object behind, so this is the same literal.
  expected.add("graph.json");
  const graphJson = `${JSON.stringify(graph, null, 2)}\n`;
  if (await writeIfChanged(join(DIST_DIR, "graph.json"), graphJson))
    written.push("graph.json");

  const stale = (await emitted()).filter((name) => !expected.has(name));
  for (const name of stale) await rm(join(DIST_DIR, name));

  return { tables, written, stale };
}

/** vitest's globalSetup, so a test file run on its own still has its data. */
export async function setup() {
  await buildData();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { tables, written, stale } = await buildData();
  const changed = written.length + stale.length;
  console.log(
    `data: ${tables} tables in data/dist` +
      (changed ? `, ${written.length} written, ${stale.length} removed` : ""),
  );
}
