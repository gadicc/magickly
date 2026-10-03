import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import type planets from "../dist/astrology/planets.js";
import type { PlanetId } from "./astrology/Planets.ts";
import { buildData, picklistPaths, TABLE_FILES, tableType } from "./build.ts";
import { schemas } from "./schemas.ts";
import { type TableName, tables } from "./tables.ts";

/**
 * What [the build](./build.ts) emits for each source: a module, a declaration
 * that states its type, and the JSON.
 *
 * The declarations are generated, so the question that matters is whether
 * they say what the data is. They are held here to the type TypeScript infers
 * from each table's JSON, in both directions, in a program of their own — so
 * that the repository's own type check never reads a `.json` table again.
 */

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const SRC = fileURLToPath(new URL(".", import.meta.url));
const NAMES = Object.keys(TABLE_FILES) as TableName[];

/** The three tables that are arrays rather than objects keyed by id. */
const ARRAY_TABLES = ["astrologicalHouse", "christianChoir", "seventyTwoAngel"];

/**
 * Whether two types are the same one, rather than merely assignable to each
 * other.
 */
type Same<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** Every file under a directory, relative to it. */
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
}

describe("the picklists a declaration states as literals", () => {
  it("are these, read off the schemas", () => {
    const found = Object.fromEntries(
      Object.entries(schemas)
        .map(([table, schema]) => [table, picklistPaths(schema)] as const)
        .filter(([, paths]) => paths.length),
    );
    // `gdGrade.orderId` is the graph's `enum`, which `ids()` in schemas.ts
    // makes a picklist like any other.
    expect(found).toEqual({
      planet: ["kind"],
      zodiac: ["quadruplicity"],
      tetragram: ["rows[]"],
      gdGrade: ["orderId"],
      seventyTwoAngel: ["name.heSource"],
      alchemySymbol: ["category"],
    });
  });

  it("are found through optional, nullable, objects and arrays", () => {
    const pick = v.picklist(["a", "b"]);
    const schema = v.strictObject({
      a: pick,
      b: v.optional(v.nullable(pick)),
      c: v.object({ d: v.array(v.strictObject({ e: pick })) }),
      f: v.tuple([v.number(), v.string()]),
      g: v.boolean(),
    });
    expect(picklistPaths(schema)).toEqual(["a", "b", "c.d[].e"]);
  });

  it("refuses a schema it cannot read, rather than passing over it", () => {
    expect(() =>
      picklistPaths(v.strictObject({ a: v.union([v.string(), v.number()]) })),
    ).toThrow("a: a union schema, which the declaration generator");
    expect(() =>
      picklistPaths(
        v.strictObject({ a: v.tuple([v.picklist(["x"]), v.string()]) }),
      ),
    ).toThrow("a: a picklist in a tuple");
  });
});

describe("a table's declared type", () => {
  it("is each row's own shape, widened, readonly, literal at a picklist", () => {
    const rows = {
      "a-1": { kind: "x", no: 1, ok: true, list: [], gone: null },
      b: { kind: "y", nested: { kind: "not picked" } },
    };
    expect(tableType(rows, new Set(["kind"]))).toBe(
      [
        "{",
        '    readonly "a-1": {',
        '        readonly kind: "x";',
        "        readonly no: number;",
        "        readonly ok: boolean;",
        "        readonly list: readonly never[];",
        "        readonly gone: null;",
        "    };",
        "    readonly b: {",
        '        readonly kind: "y";',
        "        readonly nested: {",
        "            readonly kind: string;",
        "        };",
        "    };",
        "}",
      ].join("\n"),
    );
  });

  it("is a readonly array of the union of its rows for an array table", () => {
    const rows = [{ n: [1, 2] }, { n: [2] }, { n: [1, 2] }, { m: "z" }];
    expect(tableType(rows, new Set(["n[]"]))).toBe(
      [
        "readonly ({",
        "    readonly n: readonly (1 | 2)[];",
        "} | {",
        "    readonly n: readonly 2[];",
        "} | {",
        "    readonly m: string;",
        "})[]",
      ].join("\n"),
    );
  });

  it("makes kind say which rows are planets", () => {
    const kind: Same<(typeof planets)["sol"]["kind"], "planet"> = true;
    const sphere: Same<(typeof planets)["zodiac"]["kind"], "sphere"> = true;
    const twelve: Same<
      PlanetId,
      | "sol"
      | "mercury"
      | "venus"
      | "earth"
      | "luna"
      | "mars"
      | "jupiter"
      | "saturn"
      | "uranus"
      | "neptune"
      | "rahu"
      | "ketu"
    > = true;
    expect([kind, sphere, twelve]).toEqual([true, true, true]);
  });
});

describe("dist/", () => {
  it("holds a module, a declaration and the JSON for every source", () => {
    const sources = files(SRC).filter((file) => file.endsWith(".json5"));
    const expected = sources
      .flatMap((source) =>
        [".js", ".d.ts", ".json"].map((ext) => source.replace(/\.json5$/, ext)),
      )
      .concat("graph.json")
      .sort();
    expect(files(DIST)).toEqual(expected);
  });

  it("imports nothing from the sources, or from anywhere", () => {
    const declarations = files(DIST).filter((file) => file.endsWith(".d.ts"));
    for (const file of declarations)
      expect([file, readFileSync(join(DIST, file), "utf8")]).not.toEqual([
        file,
        expect.stringMatching(/\bimport\b/),
      ]);
  });

  it("declares every text unknown and every table its type", () => {
    const tableFiles = new Set<string>(Object.values(TABLE_FILES));
    for (const file of files(DIST).filter((f) => f.endsWith(".d.ts"))) {
      const declaration = readFileSync(join(DIST, file), "utf8");
      const isTable = tableFiles.has(file.replace(/\.d\.ts$/, ""));
      expect([
        file,
        declaration.includes("declare const text: unknown;"),
      ]).toEqual([file, !isTable]);
    }
  });

  it("gives each table the same rows, in the same order, as its JSON", async () => {
    for (const name of NAMES) {
      const module = await import(
        /* @vite-ignore */ join(DIST, `${TABLE_FILES[name]}.js`)
      );
      // The same module tables.ts imports, so TABLE_FILES and its imports
      // cannot name different files.
      expect([name, module.default === tables[name]]).toEqual([name, true]);
      const json = readFileSync(
        join(DIST, `${TABLE_FILES[name]}.json`),
        "utf8",
      );
      expect(`${JSON.stringify(module.default, null, 2)}\n`).toBe(json);
    }
  });

  it("writes nothing when nothing changed, and removes what it no longer explains", async () => {
    const stray = [
      "__stray__.js",
      "__stray__.d.mts",
      "kabbalah/__stray__.json",
    ];
    for (const file of stray) writeFileSync(join(DIST, file), "");
    try {
      const { written, stale } = await buildData();
      expect(written).toEqual([]);
      expect([...stale].sort()).toEqual([...stray].sort());
      expect(files(DIST).filter((file) => file.includes("__stray__"))).toEqual(
        [],
      );
    } finally {
      for (const file of stray) rmSync(join(DIST, file), { force: true });
    }
  });
});

/**
 * Each table's generated declaration against the type TypeScript infers from
 * its JSON, compiled as a program of its own with the repository's options.
 *
 * `Widen` undoes the two things the declaration adds on purpose — `readonly`,
 * and a picklist's literal — and what is left must be assignable to the JSON
 * import's type and the JSON import's type to it. An object table's keys,
 * which are its ids, must be the same set. The three array tables differ in
 * one way that `Widen` hides: a `readonly` array lacks the methods that
 * mutate it, so its key set is the JSON's less exactly those, which is
 * asserted rather than left out.
 *
 * One line is wrong on purpose, so that a program that reports nothing at all
 * cannot pass, and `any` on either side is an error of its own, so that an
 * import that failed to resolve to a type cannot either.
 */
describe("the generated declarations", () => {
  it("say what the JSON says", () => {
    const lines = [
      "type Widen<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T extends readonly (infer E)[] ? Widen<E>[] : T extends object ? { -readonly [K in keyof T]: Widen<T[K]> } : T;",
      "type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;",
      "type IsAny<T> = 0 extends 1 & T ? true : false;",
      "type Mutating = Exclude<keyof unknown[], keyof (readonly unknown[])>;",
      "export const harness: Same<1, 2> = true;",
    ];
    NAMES.forEach((name, i) => {
      const file = TABLE_FILES[name];
      lines.push(
        `import g${i} from "../dist/${file}.js";`,
        `import j${i} from "../dist/${file}.json";`,
        `export const notAny${i}: [IsAny<typeof g${i}>, IsAny<typeof j${i}>] = [false, false];`,
        `export const toGenerated${i}: Widen<typeof g${i}> = j${i};`,
        `export const fromGenerated${i}: typeof j${i} = null as unknown as Widen<typeof g${i}>;`,
        ARRAY_TABLES.includes(name)
          ? `export const keys${i}: [Same<Exclude<keyof typeof j${i}, keyof typeof g${i}>, Mutating>, Same<Exclude<keyof typeof g${i}, keyof typeof j${i}>, never>] = [true, true];`
          : `export const keys${i}: Same<keyof typeof g${i}, keyof typeof j${i}> = true;`,
      );
    });

    // A file beside this one that exists only in memory, so that its
    // relative imports resolve as a module of the package's would.
    const fixture = join(SRC, "__declarations__.ts");
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      lib: ["lib.es2022.d.ts"],
      types: [],
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      resolveJsonModule: true,
      esModuleInterop: true,
      strict: false,
      strictNullChecks: true,
      skipLibCheck: true,
      noEmit: true,
    };
    const host = ts.createCompilerHost(options);
    const read = host.getSourceFile.bind(host);
    host.getSourceFile = (path, language, ...rest) =>
      path === fixture
        ? ts.createSourceFile(path, lines.join("\n"), language)
        : read(path, language, ...rest);
    const exists = host.fileExists.bind(host);
    host.fileExists = (path) => path === fixture || exists(path);

    const program = ts.createProgram([fixture], options, host);
    const errors = ts.getPreEmitDiagnostics(program).map((diagnostic) => {
      const where = diagnostic.file?.getLineAndCharacterOfPosition(
        diagnostic.start ?? 0,
      );
      const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
      const line = where ? lines[where.line] : "";
      return `${line.slice(0, 60)}: ${text.slice(0, 200)}`;
    });

    expect(errors).toEqual([
      "export const harness: Same<1, 2> = true;: Type 'true' is not assignable to type 'false'.",
    ]);
  }, 60_000);
});
