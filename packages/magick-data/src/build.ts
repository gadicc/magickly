/**
 * Converts the JSON5 sources to the modules the data layer imports.
 *
 * The sources stay JSON5, which is what a human edits: comments, trailing
 * commas and unquoted keys. Each is emitted to `dist/` three times over: as
 * a JavaScript module, as a declaration that states its type, and as plain
 * JSON for a reader that is not JavaScript. The typed modules, the tables and
 * the barrel import the JavaScript by its full name
 * (`../../dist/kabbalah/sephirot.js`), since the three sit side by side.
 *
 * The module's value is `JSON.parse` of a string literal, which is what a
 * bundler makes of a JSON import anyway and what an engine parses fastest at
 * this size. The declaration is generated rather than left to a `.json`
 * import (plan 052, decision 7): a consumer whose compiler lacks
 * `resolveJsonModule` cannot resolve a `.json` type import, and under
 * `skipLibCheck` every row type it reaches silently becomes `any`; Node will
 * not load a JSON import without an import attribute; and a generator can say
 * one thing inference cannot ([below](#tableType)).
 *
 * A table's declaration is the type TypeScript would infer from its JSON —
 * each key with that row's own structural type, an array table a `readonly`
 * array of the union of its element shapes, primitives widened — with every
 * property `readonly`, and one difference: a field whose schema in
 * [schemas.ts](./schemas.ts) is a `v.picklist` is stated as the row's literal
 * value. That is how `planet.kind` is `"planet"` on the twelve planets and
 * `"sphere"` on the three spheres, and so how `PlanetId` is derived. The
 * schemas are read here, at build time, so valibot is a dependency of the
 * build and of nothing published; and a literal cannot disagree with the
 * data, because `data:check` holds every row to the same picklist.
 *
 * Every other source is a text — the Enochian dictionary, Lenain's pages,
 * evidence and apparatus, and the two translations of the seventy-two — and
 * is declared `unknown`; the hand-written module that wraps one states its
 * type with a cast. Inferring the dictionary's type from its JSON would cost
 * TypeScript about 19,300 types, more than every table combined (plan 032,
 * decision 1). `unknown` costs none, and names nothing outside `dist/`.
 *
 * `dist/` sits at the package root, beside `src/`, and is generated and
 * gitignored, so every task that reads it runs this first: `data:build`
 * chains ahead of the app's `typecheck`, `build`, `check:turbopack` and test
 * scripts, `pnpm dev` runs it in `--watch` ([below](#watchData)), and this
 * module is also vitest's globalSetup, so a bare `vitest run <file>` works.
 * A missing table is a module resolution error rather than a silent `any`,
 * because nothing declares `*.js` or `*.json`.
 *
 * The package is `"type": "module"`, so this is an ES module as a `.ts`, and
 * awaits at the top level, at the end.
 */
import { watch } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import JSON5 from "json5";
import type { GenericSchema } from "valibot";
import { graph } from "./graph";
import { schemas } from "./schemas";
import type { TableName } from "./tables";

const DATA_DIR = fileURLToPath(new URL(".", import.meta.url));
const DIST_DIR = fileURLToPath(new URL("../dist", import.meta.url));

/**
 * Where each table's source is, relative to `src/` and without its
 * extension. A table's name is not its file's — `sephirah` is
 * `kabbalah/sephirot.json5` — and this is how the build knows which sources
 * are tables, and so which schema states each declaration. A source not
 * named here is a text.
 *
 * [tables.ts](./tables.ts) imports the same files, and
 * [build.test.ts](./build.test.ts) holds the two to each other.
 */
export const TABLE_FILES = {
  planet: "astrology/planets",
  zodiac: "astrology/zodiac",
  astrologicalHouse: "astrology/houses",
  hebrewLetter: "hebrewLetters",
  enochianLetter: "enochian/letters",
  enochianTablet: "enochian/tablets",
  tetragram: "geomancy/tetragrams",
  geomanticHouse: "geomancy/houses",
  gdGrade: "gd/grades",
  gdDegree: "gd/degrees",
  archangel: "kabbalah/archangels",
  angelicOrder: "kabbalah/angelicOrders",
  christianChoir: "kabbalah/christianChoirs",
  fourWorlds: "kabbalah/fourWorlds",
  godName: "kabbalah/godNames",
  kerub: "kabbalah/kerubim",
  sephirah: "kabbalah/sephirot",
  treeOfLifePath: "kabbalah/paths",
  soul: "kabbalah/souls",
  tribeOfIsrael: "kabbalah/tribesOfIsrael",
  seventyTwoAngel: "kabbalah/seventyTwoAngels",
  chakra: "chakras",
  bodyPart: "body/parts",
  stone: "materia/stones",
  scent: "materia/scents",
  alchemySymbol: "alchemy/symbols",
  alchemyTerm: "alchemy/terms",
  element: "alchemy/elements",
  elemental: "alchemy/elementals",
} as const satisfies Record<TableName, string>;

/** The table each source is, by its path relative to `src/`. */
const TABLE_OF_SOURCE = new Map(
  (Object.keys(TABLE_FILES) as TableName[]).map((table) => [
    `${TABLE_FILES[table]}.json5`,
    table,
  ]),
);

/**
 * What `dist/` holds, and this build owns. Nothing is written as `.mjs` or
 * `.d.mts` any more — they are what the dictionary was emitted as before
 * every source became a module — and they are listed so that a `dist/` an
 * older build left behind loses them as stale.
 */
const OUTPUTS = [".json", ".js", ".d.ts", ".mjs", ".d.mts"];

/** Every `*.json5` under `src/`, relative to it. */
async function sources(dir = DATA_DIR): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await sources(path)));
    else if (entry.name.endsWith(".json5"))
      found.push(relative(DATA_DIR, path));
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

/** Everything this build owns under `dist/`, relative to it. */
async function emitted(dir = DIST_DIR): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await emitted(path)));
    else if (OUTPUTS.some((extension) => entry.name.endsWith(extension)))
      found.push(relative(DIST_DIR, path));
  }
  return found;
}

/** What a source emits: its module, the module's declaration, and its JSON. */
function outputsOf(name: string) {
  const base = name.replace(/\.json5$/, "");
  return [`${base}.js`, `${base}.d.ts`, `${base}.json`] as const;
}

/**
 * The parts of a valibot schema the walk below reads. valibot types each of
 * them on its own schema kind; the walk branches on `type` and wants them on
 * one shape.
 */
interface SchemaNode {
  type: string;
  entries?: Record<string, SchemaNode>;
  wrapped?: SchemaNode;
  item?: SchemaNode;
  items?: SchemaNode[];
}

/** Schema kinds that hold no other schema, and so no picklist. */
const LEAVES = new Set(["string", "number", "boolean", "null"]);

/**
 * Every path in a row whose schema is a `v.picklist`, sorted: an object's
 * keys joined by `.`, and `[]` for an array's elements, so the seventy-two's
 * `name.heSource` is `name.heSource` and a tetragram's list of points is
 * `rows[]`. `optional` and `nullable` are seen through, since they wrap a
 * field without moving it.
 *
 * A schema kind the walk does not know throws rather than being passed over,
 * because a picklist inside it would otherwise be declared a plain `string`
 * with nobody having decided that. A picklist inside a tuple throws too: the
 * declaration writes every array as one element type, as a JSON import
 * does, so there is no single path to state it at.
 */
export function picklistPaths(schema: GenericSchema): string[] {
  const found: string[] = [];
  const walk = (node: SchemaNode, path: string) => {
    switch (node.type) {
      case "picklist":
        found.push(path);
        return;
      case "strict_object":
      case "object":
        for (const [key, entry] of Object.entries(node.entries ?? {}))
          walk(entry, path ? `${path}.${key}` : key);
        return;
      case "optional":
      case "nullable":
        if (node.wrapped) walk(node.wrapped, path);
        return;
      case "array":
        if (node.item) walk(node.item, `${path}[]`);
        return;
      case "tuple":
        for (const item of node.items ?? [])
          if (picklistPaths(item as unknown as GenericSchema).length)
            throw new Error(
              `${path}: a picklist in a tuple, which a declaration cannot state`,
            );
        return;
      default:
        if (!LEAVES.has(node.type))
          throw new Error(
            `${path || "the row"}: a ${node.type} schema, which the declaration generator does not read`,
          );
    }
  };
  walk(schema as unknown as SchemaNode, "");
  return found.sort();
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const indent = (depth: number) => "    ".repeat(depth);

/** An object type's members, one per line, at `depth`. */
function members(lines: readonly [string, string][], depth: number) {
  if (lines.length === 0) return "{}";
  const written = lines.map(([key, type]) => {
    const name = IDENTIFIER.test(key) ? key : JSON.stringify(key);
    return `${indent(depth + 1)}readonly ${name}: ${type};`;
  });
  return `{\n${written.join("\n")}\n${indent(depth)}}`;
}

/** A value's type, at `path` within its row. */
function typeOf(
  value: unknown,
  path: string,
  picked: ReadonlySet<string>,
  depth: number,
): string {
  if (value === null) return "null";
  if (Array.isArray(value))
    return arrayOf(
      value.map((item) => typeOf(item, `${path}[]`, picked, depth)),
    );
  if (typeof value === "object")
    return members(
      Object.entries(value).map(([key, field]) => [
        key,
        typeOf(field, path ? `${path}.${key}` : key, picked, depth + 1),
      ]),
      depth,
    );
  // A JSON import widens a literal to its primitive; a picklist's is kept.
  return picked.has(path) ? JSON.stringify(value) : typeof value;
}

/**
 * An array as a JSON import types it, but `readonly`: the union of its
 * elements' types, each written once, and `never` where there are none.
 */
function arrayOf(items: readonly string[]): string {
  const distinct = [...new Set(items)];
  if (distinct.length === 0) return "readonly never[]";
  if (distinct.length === 1 && !distinct[0].startsWith("readonly "))
    return `readonly ${distinct[0]}[]`;
  return `readonly (${distinct.join(" | ")})[]`;
}

/**
 * A table's type, as its declaration states it: each row's own shape, by key
 * for an object table and as a union for an array table, `readonly`
 * throughout, and literal at the paths `picked` names.
 *
 * Each row keeps its own shape, as a JSON import's does, rather than one
 * shape for the table: [types.ts](./types.ts) unions them where a uniform row
 * is wanted, and an object table's keys are what its ids are read off. A
 * picklist's literal is per row too, which is what lets `kind` say which rows
 * are planets.
 */
export function tableType(rows: unknown, picked: ReadonlySet<string>): string {
  if (Array.isArray(rows))
    return arrayOf(rows.map((row) => typeOf(row, "", picked, 0)));
  // An object table's keys are ids, not fields, so each row starts its paths
  // afresh.
  return members(
    Object.entries(rows as Record<string, unknown>).map(([id, row]) => [
      id,
      typeOf(row, "", picked, 1),
    ]),
    0,
  );
}

/** The declaration beside a source's module: a table's type, or `unknown`. */
function declaration(name: string, parsed: unknown) {
  const table = TABLE_OF_SOURCE.get(name);
  if (!table)
    return (
      `// Generated by build.ts from ${name}, which is not a table: the module\n` +
      "// that wraps it states its type. Do not edit.\n" +
      "declare const text: unknown;\nexport default text;\n"
    );
  const picked = new Set(picklistPaths(schemas[table]));
  return (
    `// Generated by build.ts from ${name}: the \`${table}\` table. Do not edit.\n` +
    `declare const table: ${tableType(parsed, picked)};\nexport default table;\n`
  );
}

/** Converts one source, and says which of its outputs changed. */
async function buildOne(name: string) {
  const parsed = JSON5.parse(await readFile(join(DATA_DIR, name), "utf8"));
  const [module, types, json] = outputsOf(name);
  const written: string[] = [];
  const write = async (out: string, content: string) => {
    if (await writeIfChanged(join(DIST_DIR, out), content)) written.push(out);
  };
  await write(
    module,
    `export default /* @__PURE__ */ JSON.parse(\n  ${JSON.stringify(
      JSON.stringify(parsed),
    )},\n);\n`,
  );
  await write(types, declaration(name, parsed));
  // Source order is insertion order through both parse and stringify, so a
  // diff of the output reads like a diff of the source.
  await write(json, `${JSON.stringify(parsed, null, 2)}\n`);
  return written;
}

/** Converts every source, and removes output a source no longer explains. */
export async function buildData() {
  const found = await sources();
  // A table whose source is not there would otherwise surface as a module
  // resolution error in whichever file imported it first.
  const missing = [...TABLE_OF_SOURCE.keys()].filter((s) => !found.includes(s));
  if (missing.length)
    throw new Error(`TABLE_FILES names ${missing.join(", ")}: no such source`);

  const written: string[] = [];
  const expected = new Set<string>();
  for (const name of found) {
    for (const out of outputsOf(name)) expected.add(out);
    written.push(...(await buildOne(name)));
  }

  // The graph, for a reader that is not TypeScript. `as const satisfies`
  // leaves an ordinary object behind, so this is the same literal.
  expected.add("graph.json");
  const graphJson = `${JSON.stringify(graph, null, 2)}\n`;
  if (await writeIfChanged(join(DIST_DIR, "graph.json"), graphJson))
    written.push("graph.json");

  const stale = (await emitted()).filter((name) => !expected.has(name));
  for (const name of stale) await rm(join(DIST_DIR, name));

  const tables = TABLE_OF_SOURCE.size;
  return { tables, texts: found.length - tables, written, stale };
}

/** vitest's globalSetup, so a test file run on its own still has its data. */
export async function setup() {
  await buildData();
}

/**
 * `--watch`: builds, then rebuilds a source as it is edited, so that a JSON5
 * edit reaches a running `pnpm dev` (which starts this beside `next dev`
 * through the app's `scripts/dev.mts`). Turbopack and webpack both pick the
 * modules up from `dist/` on their own once they are written.
 *
 * Nothing here is fatal. A file caught half-written is a parse error that
 * the next save fixes, and a file that has gone sends the whole build round
 * again, which is what prunes the outputs it explained.
 *
 * What is watched is the JSON5 sources and nothing else, so an edit to
 * [graph.ts](./graph.ts) or [schemas.ts](./schemas.ts) while the task runs
 * leaves `dist/graph.json`, and any declaration a picklist decides, as the
 * first build wrote them; restarting the task rewrites them. `graph.json` is
 * for a reader that is not TypeScript — nothing under `src/` imports it, and
 * the graph reaches the app as a module, which Next reloads itself.
 */
async function watchData() {
  const { tables, texts } = await buildData();

  const rebuild = async (name: string) => {
    try {
      for (const out of await buildOne(name)) console.log(`data: ${out}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") await buildData();
      else console.error(`data: ${name}: ${(error as Error).message}`);
    }
  };

  // An editor writes in bursts, and one save raises several events; a save
  // that renames a new file over the old one raises them for both names.
  const dirty = new Set<string>();
  let soon: NodeJS.Timeout | undefined;
  const flush = () => {
    const names = [...dirty];
    dirty.clear();
    for (const name of names) void rebuild(name);
  };

  // One watcher per directory, and deliberately not one recursive watcher
  // over `src/`: a recursive watch on Linux follows the file, so an editor
  // that saves by writing a new file and renaming it over the old one — sed,
  // vim, VS Code — is invisible to it from the second save on. Measured, not
  // assumed. A directory's watch survives a rename inside it, because the
  // directory is what it holds.
  const dirs = [
    ...new Set((await sources()).map((name) => dirname(join(DATA_DIR, name)))),
  ];
  for (const dir of dirs)
    watch(dir, (_event, file) => {
      if (!file) return;
      const name = relative(DATA_DIR, join(dir, file.toString()));
      if (!name.endsWith(".json5")) return;
      dirty.add(name);
      clearTimeout(soon);
      soon = setTimeout(flush, 30);
    });

  console.log(
    `data: watching ${tables + texts} sources in ${dirs.length} directories`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--watch")) await watchData();
  else {
    const { tables, texts, written, stale } = await buildData();
    const changed = written.length + stale.length;
    console.log(
      `data: ${tables} tables and ${texts} texts in packages/magick-data/dist` +
        (changed ? `, ${written.length} written, ${stale.length} removed` : ""),
    );
  }
}
