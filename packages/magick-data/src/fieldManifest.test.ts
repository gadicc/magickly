import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { TABLE_FILES } from "./build.ts";
import { fieldManifest, MAP_MIN_KEYS, TEXTS } from "./fieldManifest.ts";
import fields, { type Field, type FieldLink } from "./fields.ts";
import { graph } from "./graph.ts";
import type { TableSpec } from "./graphSpec.ts";
import { schemas } from "./schemas.ts";
import { type TableName, tables } from "./tables.ts";

/**
 * The field manifest (plan 080, decision 6), as the build emits it to
 * `dist/fields.json` and `magick-data/fields` reads it.
 */

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const NAMES = Object.keys(tables) as TableName[];

const field = (table: TableName, path: string): Field => {
  const found = fields.tables[table].fields.find((f) => f.path === path);
  if (!found) throw new Error(`${table}: no field ${path}`);
  return found;
};

/** A manifest of one made-up table, `planet`, from `schema` and `rows`. */
function manifestOf(
  schema: v.GenericSchema,
  rows: unknown = { a: { id: "a" } },
) {
  return fieldManifest({
    schemas: { planet: schema } as never,
    graph: { planet: {} } as never,
    tableFiles: { planet: "x" } as never,
    rowsOf: () => rows,
    sizeOf: () => 0,
    texts: {},
  }).tables.planet;
}

describe("the field manifest", () => {
  it("is what the build emitted", () => {
    const dist = fileURLToPath(new URL("../dist/", import.meta.url));
    const json = (source: string) =>
      JSON.parse(readFileSync(`${dist}${source}.json`, "utf8"));
    const fresh = fieldManifest({
      schemas,
      graph,
      tableFiles: TABLE_FILES,
      rowsOf: (table) => json(TABLE_FILES[table]),
      sizeOf: (source) => readFileSync(`${dist}${source}.json`).length,
    });
    expect(fields).toEqual(fresh);
    expect(json("fields")).toEqual(fresh);
  });

  it("has every table, in the order the tables are named", () => {
    expect(Object.keys(fields.tables)).toEqual(NAMES);
  });

  it.each(NAMES)("%s: its subpath, source, shape and row count", (table) => {
    const entry = fields.tables[table];
    const rows = tables[table] as object;
    expect(entry.subpath).toBe(`./${TABLE_FILES[table]}`);
    expect(pkg.publishConfig.exports[entry.subpath]).toBeDefined();
    expect(entry.source).toBe(`${TABLE_FILES[table]}.json5`);
    expect(entry.shape).toBe(Array.isArray(rows) ? "array" : "object");
    expect(entry.rows).toBe(
      Array.isArray(rows) ? rows.length : Object.keys(rows).length,
    );
  });

  it("names rows by id, or by what the tables without one have (decision 4)", () => {
    const keys = Object.fromEntries(
      NAMES.map((table) => {
        const key = fields.tables[table].rowKey;
        return [table, "field" in key ? key.field : "(key)"];
      }),
    );
    expect(
      Object.fromEntries(
        Object.entries(keys).filter(([, key]) => key !== "id"),
      ),
    ).toEqual({
      astrologicalHouse: "index",
      angelicOrder: "(key)",
      godName: "(key)",
      seventyTwoAngel: "no",
    });
  });

  it("refuses a row key that does not name each row once", () => {
    const schema = v.strictObject({ id: v.string() });
    expect(() => manifestOf(schema, [{ id: "a" }, { id: "a" }])).toThrow(
      "planet: id does not name each row once",
    );
    expect(() => manifestOf(v.strictObject({ n: v.number() }), [])).toThrow(
      "an array with no field to name its rows",
    );
  });

  it("marks every id-shaped field the graph declares, and no other", () => {
    const declared: [string, string, FieldLink][] = [];
    for (const table of NAMES) {
      const spec = graph[table] as TableSpec;
      for (const [path, link] of Object.entries(spec.links ?? {}))
        declared.push([
          table,
          path,
          { kind: "link", to: link.to, many: !!link.many },
        ]);
      for (const [path, to] of Object.entries(spec.pending ?? {}))
        declared.push([
          table,
          path,
          { kind: "pending", to, many: path.endsWith("Ids") },
        ]);
      for (const [path, to] of Object.entries(spec.external ?? {}))
        declared.push([
          table,
          path,
          { kind: "external", to, many: path.endsWith("Ids") },
        ]);
    }
    const marked = NAMES.flatMap((table) =>
      fields.tables[table].fields
        .filter((f) => f.link)
        .map((f) => [table, f.path, f.link] as const),
    );
    expect(marked).toHaveLength(declared.length);
    expect(new Set(marked.map(([t, p]) => `${t}.${p}`))).toEqual(
      new Set(declared.map(([t, p]) => `${t}.${p}`)),
    );
    for (const [table, path, link] of declared)
      expect(field(table as TableName, path).link, `${table}.${path}`).toEqual(
        link,
      );
  });

  it("states the graph's enum as a picklist", () => {
    expect(field("gdGrade", "orderId").type).toEqual({
      kind: "picklist",
      values: ["1st", "2nd", "3rd"],
    });
    expect(field("gdGrade", "orderId").link).toBeUndefined();
  });

  it("reads optional and nullable, and keeps them out of the type", () => {
    const soul = field("sephirah", "soulId");
    expect(soul).toMatchObject({ optional: true, nullable: true });
    expect(soul.type).toEqual({ kind: "string" });
    expect(soul.display).toBe("string | null");
    expect(field("sephirah", "id")).toMatchObject({
      optional: false,
      nullable: false,
    });
  });

  it("lists an object's keys, then each key as a field", () => {
    expect(field("sephirah", "name").type).toEqual({
      kind: "object",
      keys: ["he", "roman", "en"],
    });
    const paths = fields.tables.sephirah.fields.map((f) => f.path);
    expect(
      paths.slice(paths.indexOf("name"), paths.indexOf("name") + 4),
    ).toEqual(["name", "name.he", "name.roman", "name.en"]);
  });

  it("finds the maps by rule, and lists their fields once", () => {
    const maps = NAMES.flatMap((table) =>
      fields.tables[table].fields
        .filter((f) => f.type.kind === "map")
        .map((f) => `${table}.${f.path}`),
    );
    expect(maps).toEqual(["enochianTablet.readings", "tetragram.meanings"]);
    const readings = field("enochianTablet", "readings").type;
    expect(readings).toMatchObject({
      kind: "map",
      keys: ["regardie1940", "equinox1912", "greer", "dee1584", "raphael1587"],
      of: { kind: "object", keys: ["rows", "marks"] },
    });
    expect(field("enochianTablet", "readings.*.rows").type).toEqual({
      kind: "array",
      of: { kind: "string", constraints: { pattern: "^[A-Za-z.]+$" } },
    });
    expect(field("tetragram", "meanings.*.en").type).toEqual({
      kind: "string",
    });
    expect(
      fields.tables.tetragram.fields.some((f) => f.path === "meanings.1"),
    ).toBe(false);
  });

  it("does not take an object whose keys merely share a type for a map", () => {
    const s = v.string();
    const same = Object.fromEntries(
      ["a", "b", "c", "d"].map((key) => [key, s]),
    );
    const equal = Object.fromEntries(
      ["a", "b", "c", "d"].map((key) => [key, v.string()]),
    );
    const fewer = { a: s, b: s, c: s };
    expect(MAP_MIN_KEYS).toBe(4);
    const kinds = manifestOf(
      v.strictObject({
        id: v.string(),
        same: v.strictObject(same),
        equal: v.strictObject(equal),
        fewer: v.strictObject(fewer),
      }),
    ).fields.map((f) => `${f.path}:${f.type.kind}`);
    expect(kinds).toEqual([
      "id:string",
      "same:map",
      "same.*:string",
      "equal:object",
      "equal.a:string",
      "equal.b:string",
      "equal.c:string",
      "equal.d:string",
      "fewer:object",
      "fewer.a:string",
      "fewer.b:string",
      "fewer.c:string",
    ]);
  });

  it("lists an array of objects' fields at []", () => {
    expect(field("enochianTablet", "choices.gd").type).toEqual({
      kind: "array",
      of: { kind: "object", keys: ["row", "column", "from"] },
    });
    expect(field("enochianTablet", "choices.gd[].row").type).toEqual({
      kind: "number",
      constraints: { integer: true, min: 0 },
    });
    expect(field("enochianTablet", "readings.*.marks[].beside").type).toEqual({
      kind: "array",
      of: { kind: "string", constraints: { pattern: "^[A-Za-z]$" } },
    });
  });

  it("types tuples and picklists", () => {
    expect(field("zodiac", "rulesFrom").type).toEqual({
      kind: "tuple",
      of: [
        { kind: "tuple", of: [{ kind: "number" }, { kind: "number" }] },
        { kind: "tuple", of: [{ kind: "number" }, { kind: "number" }] },
      ],
    });
    expect(field("zodiac", "rulesFrom").display).toBe(
      "[[number, number], [number, number]]",
    );
    expect(field("tetragram", "rows").type).toEqual({
      kind: "array",
      of: { kind: "picklist", values: [1, 2] },
    });
    expect(field("tetragram", "rows").display).toBe("(1 | 2)[]");
  });

  it("gives the tablets' four rules", () => {
    expect(fields.tables.enochianTablet.rules).toHaveLength(4);
    expect(fields.tables.enochianTablet.rules[0]).toBe(
      "a tablet has at least one reading",
    );
    expect(
      NAMES.filter((table) => fields.tables[table].rules.length > 0),
    ).toEqual(["enochianTablet"]);
  });

  it("reads descriptions and columns through the wrappers", () => {
    const table = manifestOf(
      v.pipe(
        v.strictObject({
          id: v.pipe(v.string(), v.description("The id.")),
          color: v.optional(
            v.pipe(
              v.strictObject({ a: v.string(), b: v.string() }),
              v.description("Two colours."),
              v.metadata({ columns: ["b"] }),
            ),
          ),
          n: v.pipe(
            v.pipe(v.number(), v.integer(), v.description("inner")),
            v.description("outer"),
          ),
        }),
        v.description("A table."),
        v.check(() => true, "a rule"),
      ),
    );
    expect(table.description).toBe("A table.");
    expect(table.rules).toEqual(["a rule"]);
    const [id, color, , , n] = table.fields;
    expect(id.description).toBe("The id.");
    expect(color).toMatchObject({
      path: "color",
      optional: true,
      description: "Two colours.",
      columns: ["b"],
    });
    expect(n).toMatchObject({
      description: "outer",
      type: { kind: "number", constraints: { integer: true } },
    });
  });

  it("refuses a validation it does not read, wherever it is", () => {
    expect(() =>
      manifestOf(
        v.strictObject({
          id: v.string(),
          n: v.pipe(v.number(), v.maxValue(3)),
        }),
      ),
    ).toThrow(
      "n: a max_value validation, which the field manifest does not read",
    );
    expect(() =>
      manifestOf(
        v.strictObject({
          id: v.string(),
          list: v.pipe(v.array(v.string()), v.length(2)),
        }),
      ),
    ).toThrow("list: a length validation");
  });

  it("refuses a schema it does not read, rather than passing over it", () => {
    expect(() =>
      manifestOf(
        v.strictObject({
          id: v.string(),
          a: v.union([v.string(), v.number()]),
        }),
      ),
    ).toThrow("a: a union schema, which the field manifest does not read");
  });
});

/** The subpaths that are code, documented by hand on /open-source/data. */
const HELPERS = [
  ".",
  "./tools",
  "./assemble",
  "./rowOf",
  "./pathTarget",
  "./tables",
  "./graph",
  "./types",
  "./rows",
];

describe("the texts", () => {
  const published = Object.keys(pkg.publishConfig.exports as object);
  const tableSubpaths = NAMES.map((table) => `./${TABLE_FILES[table]}`);

  it("are every published module that is neither a table nor code", () => {
    const modules = published.filter(
      (subpath) =>
        !HELPERS.includes(subpath) &&
        !tableSubpaths.includes(subpath) &&
        !subpath.endsWith(".json"),
    );
    const listed = Object.keys(TEXTS).filter(
      (subpath) => !subpath.endsWith(".json"),
    );
    expect([...listed].sort()).toEqual([...modules].sort());
  });

  it("cover every data file that is not a table, bar the dictionary", () => {
    const src = fileURLToPath(new URL(".", import.meta.url));
    const tableSources = new Set(Object.values(TABLE_FILES));
    const texts = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".json5"))
      .map((file) =>
        file
          .split("\\")
          .join("/")
          .replace(/\.json5$/, ""),
      )
      .filter(
        (file) =>
          !tableSources.has(file as never) && file !== "enochian/dictionary",
      )
      .sort();
    const named = Object.values(TEXTS).flatMap(({ sources }) => sources);
    expect(named.length).toBe(new Set(named).size);
    expect([...named].sort()).toEqual(texts);
  });

  it("key a text with no module by its published JSON", () => {
    for (const [subpath, { sources }] of Object.entries(TEXTS))
      if (subpath.endsWith(".json"))
        expect(sources.map((source) => `./json/${source}.json`)).toEqual([
          subpath,
        ]);
  });

  it("have their size computed from their JSON", () => {
    expect(fields.texts["./enochian/keys"].size).toBeGreaterThan(500_000);
    expect(fields.texts["./astrology/kameas"]).toMatchObject({
      sources: [],
      size: null,
    });
    expect(fields.texts["./kabbalah/seventyTwoAngels/text"].sources).toEqual([
      "kabbalah/seventyTwoAngelsText/en.json5",
      "kabbalah/seventyTwoAngelsText/fr.json5",
    ]);
  });
});

/**
 * Every table and every field is described (plan 080, decision 6), so that
 * the reference cannot thin out: a new field without a description fails
 * here, and the data pages would otherwise show it with none.
 */
describe("the descriptions", () => {
  it.each(NAMES)("%s: the table and every field have one", (table) => {
    const entry = fields.tables[table];
    const missing = entry.fields
      .filter((f) => !f.description?.trim())
      .map((f) => f.path);
    expect(entry.description?.trim(), table).toBeTruthy();
    expect(missing).toEqual([]);
  });

  it("are sentences: a capital or a code span first, a full stop last", () => {
    const all = NAMES.flatMap((table) => [
      [table, fields.tables[table].description ?? ""],
      ...fields.tables[table].fields.map((f) => [
        `${table}.${f.path}`,
        f.description ?? "",
      ]),
    ]);
    for (const [where, text] of all)
      expect([where, /^[A-Z0-9`"'(]/.test(text) && text.endsWith(".")]).toEqual(
        [where, true],
      );
  });

  it("say which look like links but are not", () => {
    expect(field("alchemySymbol", "gdGrade").description).toContain(
      "not a link",
    );
    expect(field("seventyTwoAngel", "godName").description).toContain(
      "not a link",
    );
  });

  it("number 272 field paths, the shared English text described once", () => {
    const paths = NAMES.flatMap((table) => fields.tables[table].fields);
    expect(paths).toHaveLength(272);
    expect(
      paths.filter((f) => f.description === "The text in English.").length,
    ).toBeGreaterThan(30);
  });
});
