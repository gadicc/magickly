import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * MUI 9 removed the system props from Typography, Box, Link, Stack, Grid,
 * DialogContentText and the lab's Timeline content components, so a palette
 * path given as a component's `color` prop
 * (`color="warning.main"`, `color="text.secondary"`) no longer reaches the
 * styles: those components' own `color` props take palette keys such as
 * `warning` or `textSecondary`, and their types still accept any string, so
 * nothing else fails. Fifteen such colours went missing unnoticed until
 * 1 November 2026. A palette path belongs in `sx` (`sx={{ color:
 * "warning.main" }}`), or as the component's palette key.
 *
 * This test reads the syntax of every non-test source file under src/ and
 * packages/ and flags, inside JSX:
 *
 * - a `color` attribute on a component (a capitalised or dotted tag; an SVG
 *   element's `color` is CSS) whose value contains a palette path, also as
 *   a branch of a condition or in a template literal;
 * - a `color` property holding a palette path in an object that is itself
 *   an attribute's value (directly, in an array or behind a condition),
 *   such as `slotProps` or `style`, unless it sits inside `sx`. An object
 *   built inside a callback is not followed: where it ends up is unknown.
 *
 * Out of reach without the type checker, and absent today: a path held in a
 * variable (`const c = "warning.main"; <Typography color={c} />`), a spread
 * (`{...{ color: "warning.main" }}`) and `createElement` calls.
 */

/** A dotted theme path such as `warning.main` or `text.secondary`. */
const PALETTE_PATH = /^[A-Za-z]+(?:\.[A-Za-z0-9]+)+$/;

const repository = path.resolve(".");

/** One flagged colour: its line and the value as written. */
interface Finding {
  line: number;
  value: string;
}

/** The palette paths among the string values `node` can evaluate to. */
function palettePaths(node: ts.Node): string[] {
  const found: string[] = [];
  const visit = (current: ts.Node) => {
    if (
      ts.isStringLiteral(current) ||
      ts.isNoSubstitutionTemplateLiteral(current)
    ) {
      if (PALETTE_PATH.test(current.text)) found.push(current.text);
      return;
    }
    if (ts.isTemplateExpression(current)) {
      // `${tone}.main`: any literal part that continues a path.
      const parts = [
        current.head.text,
        ...current.templateSpans.map((span) => span.literal.text),
      ];
      if (parts.some((part) => /(?:^|[A-Za-z0-9])\.[A-Za-z]/.test(part)))
        found.push(current.getText());
      return;
    }
    // Only the values the expression yields, not a condition's operands.
    if (ts.isConditionalExpression(current)) {
      visit(current.whenTrue);
      visit(current.whenFalse);
      return;
    }
    // A call's arguments and a lookup's key are not the value itself.
    if (
      ts.isCallExpression(current) ||
      ts.isPropertyAccessExpression(current) ||
      ts.isElementAccessExpression(current)
    )
      return;
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

const propertyName = (node: ts.PropertyName) =>
  ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined;

/** Nodes an object can sit in and still be the attribute's value. */
const VALUE_PATH: readonly ((node: ts.Node) => boolean)[] = [
  ts.isObjectLiteralExpression,
  ts.isPropertyAssignment,
  ts.isArrayLiteralExpression,
  ts.isParenthesizedExpression,
  ts.isConditionalExpression,
  ts.isBinaryExpression,
  ts.isAsExpression,
  ts.isSatisfiesExpression,
  ts.isNonNullExpression,
  ts.isJsxExpression,
];

/**
 * Whether a `color` property is part of a non-`sx` attribute's value: the
 * walk up to the attribute passes only through literals and operators, and
 * through no `sx` property.
 */
function inAttributeValue(property: ts.PropertyAssignment): boolean {
  for (
    let current: ts.Node | undefined = property.parent;
    current;
    current = current.parent
  ) {
    if (ts.isJsxAttribute(current)) return current.name.getText() !== "sx";
    if (!VALUE_PATH.some((is) => is(current))) return false;
    if (ts.isPropertyAssignment(current) && propertyName(current.name) === "sx")
      return false;
  }
  return false;
}

/** Every palette-path colour in one source file. */
function findPalettePathColors(file: string, text: string): Finding[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    // The JS kind parses JSX too; the TS kind would read it as type casts.
    /\.tsx$/.test(file)
      ? ts.ScriptKind.TSX
      : /\.(?:[cm]?js|jsx)$/.test(file)
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.TS,
  );
  const findings: Finding[] = [];
  const flag = (node: ts.Node, values: readonly string[]) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line;
    for (const value of values) findings.push({ line: line + 1, value });
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText() === "color" &&
      node.initializer
    ) {
      const tag = (node.parent.parent as ts.JsxOpeningLikeElement).tagName;
      if (/^[A-Z]|\./.test(tag.getText()))
        flag(node, palettePaths(node.initializer));
    } else if (
      ts.isPropertyAssignment(node) &&
      propertyName(node.name) === "color" &&
      inAttributeValue(node)
    )
      flag(node, palettePaths(node.initializer));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

const isTest = (file: string) => /\.test\.[cm]?[jt]sx?$/.test(file);

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory())
      return ["node_modules", "dist"].includes(entry.name) ? [] : sources(full);
    return /\.[cm]?[jt]sx?$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts") &&
      !isTest(entry.name)
      ? [full]
      : [];
  });
}

const scan = (text: string, file = "fixture.tsx") =>
  findPalettePathColors(file, text).map((finding) => finding.value);

describe("no palette paths in MUI color props", () => {
  const files = [
    ...sources(path.join(repository, "src")),
    ...sources(path.join(repository, "packages")),
  ];

  it("reads the whole tree", () => {
    const relative = files.map((file) => path.relative(repository, file));
    expect(relative).toContain("src/app/study/study.tsx");
    expect(relative).toContain(
      "packages/magick-components/src/chakras/Chakras.tsx",
    );
    expect(relative).toContain("src/Copyright.js");
    expect(relative).not.toContain("src/muiColorProps.test.ts");
    expect(relative.some((file) => file.includes("node_modules"))).toBe(false);
  });

  // Parsing every source file takes seconds under a loaded gate.
  it("passes on the tree", { timeout: 60_000 }, () => {
    const found = files.flatMap((file) =>
      findPalettePathColors(file, readFileSync(file, "utf8")).map(
        ({ line, value }) =>
          `${path.relative(repository, file)}:${line} ${value}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it("reads JSX in JavaScript files", () => {
    const text = `export default () => <Typography color="warning.main" />;`;
    expect(scan(text, "Copyright.js")).toEqual(["warning.main"]);
    expect(scan(text, "x.jsx")).toEqual(["warning.main"]);
  });

  it("flags a palette path on any component", () => {
    expect(scan(`<Typography color="warning.main">x</Typography>`)).toEqual([
      "warning.main",
    ]);
    expect(scan(`<Link color={"text.secondary"} />`)).toEqual([
      "text.secondary",
    ]);
    expect(scan(`<Box color="primary.main" />`)).toEqual(["primary.main"]);
    expect(scan(`<Mui.Typography color="grey.500" />`)).toEqual(["grey.500"]);
  });

  it("flags either branch of a condition and a built path", () => {
    expect(
      scan(`<Typography color={err ? "error" : "warning.main"} />`),
    ).toEqual(["warning.main"]);
    expect(scan(`<Typography color={tone ?? "success.main"} />`)).toEqual([
      "success.main",
    ]);
    expect(scan("<Typography color={`${tone}.main`} />")).toEqual([
      "`${tone}.main`",
    ]);
  });

  it("flags a color property outside sx", () => {
    expect(
      scan(
        `<ListItemText slotProps={{ secondary: { color: "text.secondary" } }} />`,
      ),
    ).toEqual(["text.secondary"]);
    expect(scan(`<span style={{ color: "text.secondary" }} />`)).toEqual([
      "text.secondary",
    ]);
    expect(
      scan(`<LineChart series={[{ color: "primary.main" } as Series]} />`),
    ).toEqual(["primary.main"]);
  });

  it("passes palette keys, sx, SVG and plain CSS colours", () => {
    expect(
      scan(`<>
        <Typography color="textSecondary" />
        <Typography color={late ? "warning" : "textSecondary"} />
        <Typography sx={{ color: "warning.main", "&:hover": { color: "primary.main" } }} />
        <ListItemText slotProps={{ primary: { sx: { color: "text.secondary" } } }} />
        <circle color="#000" />
        <text color="text.secondary" />
        <Badge color={dirty ? "error" : "success"} />
        <Typography color={theme.palette.warning.main} />
        <Typography color={pick("text.secondary")} />
        <Typography color={TONES["warning.main"]} />
        <Button onClick={() => setStyle({ color: "text.secondary" })} />
      </>`),
    ).toEqual([]);
  });

  it("ignores color keys outside JSX", () => {
    expect(
      scan(`const theme = { palette: { color: "text.secondary" } };`, "x.ts"),
    ).toEqual([]);
  });
});
