/**
 * The props manifest the component explorer reads (plan 080, decision 6):
 * `react-docgen-typescript` over each component the examples name, trimmed
 * to what `/open-source/components/<name>` shows. The output is committed,
 * and `component-props.test.ts` re-runs this and fails when it is stale,
 * so nothing has to generate it before a build, a test or `pnpm dev`.
 *
 *   pnpm components:props
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ComponentDoc,
  type PropItem,
  withCustomConfig,
} from "react-docgen-typescript";
import ts from "typescript";
import { COMPONENT_EXAMPLES } from "../packages/magick-components/examples/index.ts";
import manifest from "../packages/magick-components/package.json" with {
  type: "json",
};
import type {
  ComponentProps,
  PropControl,
  PropsManifest,
} from "../src/explorer/props.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.join(root, "packages/magick-components");

/** Where the manifest is written, relative to the repository. */
export const PROPS_MANIFEST = "src/explorer/componentProps.json";

/** Longer defaults are source, not a value a reader can use (`GdHall`'s `art`). */
const MAX_DEFAULT = 80;

/**
 * Keeps a prop unless every declaration of it is in `node_modules`: dropping
 * one on *any* would lose a component's own prop that shares an SVG
 * attribute's name, and no filter gives an SVG component hundreds. `ref`
 * and `key` always go: docgen's cache leaks one component's `ref` type into
 * another's when the package is parsed in one call (spike, 11 November).
 */
function keep(prop: PropItem): boolean {
  if (prop.name === "ref" || prop.name === "key") return false;
  const declarations = prop.declarations ?? [];
  return !(
    declarations.length > 0 &&
    declarations.every((declaration) =>
      declaration.fileName.includes("/node_modules/"),
    )
  );
}

/** Each member of a union as docgen writes it: `string | number`. */
const members = (type: string) => type.split(" | ").map((part) => part.trim());

/** A string literal as docgen writes an enum member (`"king"`), or undefined. */
function stringLiteral(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^"(?:[^"\\]|\\.)*"$/.test(value))
    return undefined;
  return JSON.parse(value) as string;
}

/**
 * The control a prop's type allows (plan 080, decision 5): a union of
 * string literals is a choice, a boolean a switch, a number or a string a
 * field, and a union of `string` with `number` or `boolean` a text field
 * whose value is parsed. Anything else (callbacks, objects, nodes, styles)
 * has none and appears only in the props table.
 */
export function controlOf(type: PropItem["type"]): PropControl | undefined {
  if (type.name === "enum") {
    const values = (type.value ?? []) as { value: unknown }[];
    const options = values.map(({ value }) => stringLiteral(value));
    if (options.length && options.every((option) => option !== undefined))
      return { kind: "choice", options: options as string[] };
    const raw = values.map(({ value }) => String(value)).sort();
    if (raw.join() === "false,true") return { kind: "switch" };
    return undefined;
  }
  if (type.name === "boolean") return { kind: "switch" };
  if (type.name === "number") return { kind: "number" };
  if (type.name === "string") return { kind: "text" };
  const parts = new Set(members(type.name));
  if (
    parts.has("string") &&
    parts.size > 1 &&
    [...parts].every((part) => ["string", "number", "boolean"].includes(part))
  )
    return { kind: "parsed" };
  return undefined;
}

/** Whether a prop's values are strings, so its default needs quotes. */
function stringValued(type: PropItem["type"]): boolean {
  if (type.name === "enum")
    return ((type.value ?? []) as { value: unknown }[]).some(
      ({ value }) => stringLiteral(value) !== undefined,
    );
  return members(type.name).includes("string");
}

/**
 * A default as the source would write it. docgen gives a string literal's
 * text without its quotes ("index" and 240 look alike), so a value that is
 * not already a literal of another kind is quoted when the prop takes
 * strings.
 */
export function defaultSource(
  value: string,
  type: PropItem["type"],
): string | undefined {
  if (value.length > MAX_DEFAULT) return undefined;
  const literal = /^(?:true|false|null|undefined|-?\d+(?:\.\d+)?)$/.test(value);
  const onlyStrings =
    type.name === "string" ||
    (type.name === "enum" &&
      ((type.value ?? []) as { value: unknown }[]).every(
        ({ value: member }) => stringLiteral(member) !== undefined,
      ));
  if (literal && !onlyStrings) return value;
  if (/^["'`[{(]|^new\s/.test(value)) return value;
  return stringValued(type) ? JSON.stringify(value) : value;
}

/** Strings in code-point order, the same in every locale. */
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** One component's entry: its description and its props, required first. */
function componentEntry(doc: ComponentDoc): ComponentProps {
  const props = Object.values(doc.props)
    .map((prop) => {
      const control = controlOf(prop.type);
      const fallback =
        prop.defaultValue?.value === undefined
          ? undefined
          : defaultSource(String(prop.defaultValue.value), prop.type);
      return {
        name: prop.name,
        type:
          prop.type.name === "enum" ? (prop.type.raw ?? "") : prop.type.name,
        required: prop.required,
        ...(fallback === undefined ? {} : { default: fallback }),
        description: prop.description.trim(),
        ...(control ? { control } : {}),
      };
    })
    .sort(
      (a, b) =>
        Number(b.required) - Number(a.required) || byCodePoint(a.name, b.name),
    );
  return { description: doc.description.trim(), props };
}

/** The program docgen reads, from the package's own strict tsconfig. */
function packageProgram(files: string[]): ts.Program {
  const configFile = path.join(packageDir, "tsconfig.json");
  const { config } = ts.readConfigFile(configFile, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    packageDir,
    {},
    configFile,
  );
  return ts.createProgram(files, options);
}

/**
 * The declarations each file's default export resolves to. docgen names a
 * default export after its file (`fylfotcross`) or its function, so the
 * script finds it by declaration instead and calls it `default`.
 */
function defaultDeclarations(program: ts.Program, files: string[]) {
  const checker = program.getTypeChecker();
  const found = new Set<ts.Declaration>();
  for (const file of files) {
    const source = program.getSourceFile(file);
    const module = source && checker.getSymbolAtLocation(source);
    const exported = module
      ? checker
          .getExportsOfModule(module)
          .find((symbol) => symbol.escapedName === "default")
      : undefined;
    if (!exported) continue;
    const target =
      exported.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(exported)
        : exported;
    for (const declaration of target.declarations ?? []) found.add(declaration);
  }
  return found;
}

/**
 * The manifest: every component with an example module, by name, in the
 * examples' order. Its name comes from the example module, never from
 * docgen (plan 080, decision 5).
 */
export function componentProps(): PropsManifest {
  const exportsMap = manifest.exports as Record<string, string>;
  const entries = Object.entries(COMPONENT_EXAMPLES);
  const fileOf = (entry: string) =>
    path.join(packageDir, exportsMap[`./${entry}`]);
  const files = [...new Set(entries.map(([, { entry }]) => fileOf(entry)))];
  const program = packageProgram(files);
  const defaults = defaultDeclarations(program, files);
  const parser = withCustomConfig(path.join(packageDir, "tsconfig.json"), {
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    savePropValueAsString: true,
    propFilter: keep,
    componentNameResolver: (symbol) =>
      symbol.declarations?.some((declaration) => defaults.has(declaration))
        ? "default"
        : undefined,
  });
  const docs = parser.parseWithProgramProvider(files, () => program);
  const result: PropsManifest = {};
  for (const [name, { entry, exportName }] of entries) {
    const file = fileOf(entry);
    const doc = docs.find(
      (candidate) =>
        candidate.filePath === file && candidate.displayName === exportName,
    );
    if (!doc) throw new Error(`docgen found no ${exportName} in ${entry}`);
    result[name] = componentEntry(doc);
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = path.join(root, PROPS_MANIFEST);
  writeFileSync(file, JSON.stringify(componentProps()));
  // In the repository's own format, so that `pnpm check` leaves it be.
  execFileSync(path.join(root, "node_modules/.bin/biome"), [
    "format",
    "--write",
    file,
  ]);
  console.log(`Wrote ${PROPS_MANIFEST}`);
}
