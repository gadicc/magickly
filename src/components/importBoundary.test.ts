import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The components here are MIT and "import no app code" (LICENSE.txt); plan
 * 061 (decision 1) turns that into a test. Nothing under src/components may
 * import the app (`@/`), Next (`next`, `next/*`), MUI, Tiptap or
 * ProseMirror, and no component may reach outside the directory by a
 * relative path or through the `@magick-components/` alias (`..` segments
 * included). Tests may also import the shared test helpers in ../../tests.
 */
const FORBIDDEN = /^(?:@\/|next(?:\/|$)|@mui\/|@tiptap(?:\/|$)|.*prosemirror)/;

/**
 * Files that broke the rule before it was a test, with exactly the
 * imports they had. Moving them out of src/components (or replacing the
 * imports) is a follow-up; an entry that no longer applies must be removed.
 */
const KNOWN_VIOLATIONS: ReadonlyMap<string, readonly string[]> = new Map([
  ["Link.tsx", ["@mui/material/Link", "next/link"]],
  ["Tiles.tsx", ["@mui/material", "next/image"]],
  ["astrology/Mercury.tsx", ["next/image"]],
  [
    "astrology/planetarySpirits.tsx",
    [
      "@/../svg/astrology/spirits/bartzabel.svg",
      "@/../svg/astrology/spirits/chasmodai.svg",
      "@/../svg/astrology/spirits/hismael.svg",
      "@/../svg/astrology/spirits/kedemel.svg",
      "@/../svg/astrology/spirits/sorath.svg",
      "@/../svg/astrology/spirits/taphthartharath.svg",
      "@/../svg/astrology/spirits/zazel.svg",
    ],
  ],
  // next/font/local; plan 061 lists moving it out as a follow-up.
  ["enochian/enochianFont.ts", ["next/font/local"]],
  ["entity/index.tsx", ["@mui/material/Box", "@mui/material/Container"]],
]);

/** The hall package (plan 061) may import only React and magick-data. */
const HALL = "gd/hall/";
const HALL_PACKAGES = /^(?:react|magick-data)(?:\/|$)/;

const root = path.resolve("src/components");
const testHelpers = path.resolve("tests");
const isTest = (file: string) => /\.test\.[cm]?[jt]sx?$/.test(file);

/**
 * Where a relative or `@magick-components/` specifier points, resolved
 * the way tsconfig's paths and the bundlers do (`..` segments and all);
 * undefined for a package. `@/` is forbidden outright above.
 */
function target(file: string, name: string): string | undefined {
  if (name.startsWith(".")) return path.resolve(path.dirname(file), name);
  if (name.startsWith("@magick-components/"))
    return path.resolve(root, name.slice("@magick-components/".length));
  return undefined;
}

const inside = (directory: string, resolved: string) =>
  resolved.startsWith(directory + path.sep);

/** Whether `file` importing `name` leaves what it may import. */
function escapes(file: string, name: string): boolean {
  const resolved = target(file, name);
  return (
    resolved !== undefined &&
    !inside(root, resolved) &&
    !(isTest(file) && inside(testHelpers, resolved))
  );
}

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [full] : [];
  });
}

/** Every module specifier a file imports, re-exports, requires or loads. */
function imports(file: string): string[] {
  return ts
    .preProcessFile(readFileSync(file, "utf8"), true, true)
    .importedFiles.map((imported) => imported.fileName);
}

describe("src/components import boundary", () => {
  const files = sources(root);

  it("finds the components, including dynamic imports", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(
      ts
        .preProcessFile(
          'const m = import("next/x"); export * from "@/y";',
          true,
          true,
        )
        .importedFiles.map((imported) => imported.fileName),
    ).toEqual(["next/x", "@/y"]);
  });

  it("imports no app, Next, MUI, Tiptap or ProseMirror code", () => {
    const found = new Map<string, string[]>();
    for (const file of files) {
      const forbidden = imports(file).filter((name) => FORBIDDEN.test(name));
      if (forbidden.length)
        found.set(
          path.relative(root, file).split(path.sep).join("/"),
          forbidden,
        );
    }
    expect(Object.fromEntries(found)).toEqual(
      Object.fromEntries(KNOWN_VIOLATIONS),
    );
  });

  it("never reaches outside src/components by a path or the alias", () => {
    const found = files.flatMap((file) =>
      imports(file)
        .filter((name) => escapes(file, name))
        .map((name) => `${path.relative(root, file)}: ${name}`),
    );
    expect(found).toEqual([]);
  });

  it("resolves the alias and `..` segments before judging", () => {
    const file = path.join(root, "gd/hall/GdHall.tsx");
    const test = path.join(root, "gd/hall/GdHall.test.tsx");
    expect(escapes(file, "@magick-components/../app/x")).toBe(true);
    expect(escapes(file, "@magick-components/gd/Lamen")).toBe(false);
    expect(escapes(file, "../../svgCoordinate")).toBe(false);
    expect(escapes(file, "../../../app/x")).toBe(true);
    expect(escapes(test, "../../../app/x")).toBe(true);
    expect(escapes(test, "../../../../tests/hydration")).toBe(false);
    expect(escapes(file, "../../../../tests/hydration")).toBe(true);
    expect(escapes(file, "react")).toBe(false);
  });

  it("keeps the hall package to React and magick-data", () => {
    const outside = files
      .filter((file) => {
        const relative = path.relative(root, file).split(path.sep).join("/");
        return relative.startsWith(HALL) && !isTest(file);
      })
      .flatMap((file) =>
        imports(file)
          .filter((name) => !name.startsWith(".") && !HALL_PACKAGES.test(name))
          .map((name) => `${path.relative(root, file)}: ${name}`),
      );
    expect(outside).toEqual([]);
  });
});
