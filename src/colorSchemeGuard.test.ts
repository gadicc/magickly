import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Nothing may render by colour mode (plan 076, decision 3). The server
 * always renders light and the inline script picks the scheme before the
 * first paint, so a component that branches on `theme.palette.mode` or on
 * `useColorScheme().mode` either mismatches at hydration or flashes. Colours
 * go through `sx` palette strings, `theme.applyStyles("dark", …)`,
 * `var(--mui-palette-…)` or `.dark` page CSS instead.
 *
 * - `palette.mode` may appear only in src/theme.ts.
 * - `useColorScheme` (whose `mode` is undefined until after hydration) only
 *   in the files below.
 */
const PALETTE_MODE_ALLOWED: ReadonlySet<string> = new Set(["src/theme.ts"]);

/**
 * Empty until plan 076 adds its three named readers: the drawer's
 * Light / System / Dark switch (step 6), the `theme-color` effect for an
 * explicit choice (step 6) and the CodeMirror theme in
 * src/doc/RitualSourceEditor.tsx (step 5), which mounts on the client.
 */
const USE_COLOR_SCHEME_ALLOWED: ReadonlySet<string> = new Set([]);

/** `palette.mode`, `palette?.mode`, `palette["mode"]`, `{ mode } = …palette`. */
const PALETTE_MODE =
  /palette\s*(?:\?\.|\.)\s*mode\b|palette\s*(?:\?\.)?\[\s*["'`]mode|\{[^{}]*\bmode\b[^{}]*\}\s*=\s*[\w.?()]*palette\b/;
const USE_COLOR_SCHEME = /\buseColorScheme\b/;

const repository = path.resolve(".");
const self = path.join("src", "colorSchemeGuard.test.ts");

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory())
      return entry.name === "node_modules" ? [] : sources(full);
    return /\.(?:[cm]?[jt]sx?|css)$/.test(entry.name) ? [full] : [];
  });
}

/** Every `file:line` under src/ where `pattern` matches, outside `allowed`. */
function offenders(pattern: RegExp, allowed: ReadonlySet<string>): string[] {
  return sources(path.join(repository, "src")).flatMap((file) => {
    const relative = path.relative(repository, file);
    if (relative === self || allowed.has(relative)) return [];
    return readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        pattern.test(line) ? [`${relative}:${index + 1}`] : [],
      );
  });
}

describe("nothing renders by colour mode", () => {
  it("reads the whole tree", () => {
    const relative = sources(path.join(repository, "src")).map((file) =>
      path.relative(repository, file),
    );
    expect(relative).toContain("src/theme.ts");
    expect(relative).toContain("src/app/layout.tsx");
    expect(relative).toContain(self);
  });

  it("reads palette.mode only in the theme", () => {
    expect(offenders(PALETTE_MODE, PALETTE_MODE_ALLOWED)).toEqual([]);
  });

  it("calls useColorScheme only in the allowed files", () => {
    expect(offenders(USE_COLOR_SCHEME, USE_COLOR_SCHEME_ALLOWED)).toEqual([]);
  });

  it("recognises the forms it forbids", () => {
    for (const line of [
      "if (theme.palette.mode === 'dark') {",
      "theme.palette?.mode",
      'theme.palette["mode"]',
      "const { mode } = theme.palette;",
      "const { mode, primary } = useTheme().palette;",
    ])
      expect(line).toMatch(PALETTE_MODE);
    for (const line of [
      "theme.palette.primary.main",
      "const { mode } = useColorScheme();",
      "palette.modeless",
    ])
      expect(line).not.toMatch(PALETTE_MODE);
    expect("const { mode } = useColorScheme();").toMatch(USE_COLOR_SCHEME);
  });
});
