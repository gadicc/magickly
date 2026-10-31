import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Plan 065: a deleted ritual must behave like an ID that never existed, so
 * every query of the `rituals` table filters deletion. This test reads the
 * syntax of every non-test source file under src/, scripts/ and tests/
 * (TypeScript and JavaScript) and flags each use of the table as a query's
 * table:
 *
 * - the table, under any local name (`rituals as ritualRows`, a
 *   destructured `const { rituals } = schema`, a re-bound `const t =
 *   rituals`) or as a namespace member (`schema.rituals`), as the argument
 *   of `from`, `update`, `delete` or a join;
 * - `alias(rituals, …)`, whose columns `liveRitual` cannot filter;
 * - any `.query.rituals` relational access;
 * - a tagged SQL template whose text names the table (with or without
 *   `public.`, quoted or not, in a comma join too) after `from`, `join`,
 *   `update` or `into`, or interpolates the table there;
 * - `sql.identifier("rituals")`, and `sql.raw` of text naming the table.
 *
 * A use passes when its enclosing statement mentions `liveRitual` outside
 * any `or(…)` or `not(…)` or, in raw SQL, `deleted_at is null`. Anything
 * else needs an ALLOWED entry with its reason, and an entry that no longer
 * matches fails, as in src/components/importBoundary.test.ts. An entry
 * trusts its whole file. Re-exporting the table outside the schema
 * directory is flagged too, since it would hide the name.
 */
const ALLOWED: ReadonlyMap<string, string> = new Map([
  [
    "tests/ritualBundleFixtures.ts",
    "A test fixture that builds and resets ritual rows directly.",
  ],
  [
    "src/migration/sqlLegacyImport.ts",
    "The fenced, one-shot legacy importer inserts the imported rows itself.",
  ],
]);

const QUERY_METHODS = new Set([
  "from",
  "update",
  "delete",
  "innerJoin",
  "leftJoin",
  "rightJoin",
  "fullJoin",
]);
const TABLE = String.raw`(?:"?public"?\s*\.\s*)?"?rituals"?\b`;
const RAW_TABLE = new RegExp(
  String.raw`\b(?:(?:from|join|update|into)\s+|(?:from|join)\s+[^;()]*?,\s*)` +
    TABLE,
  "i",
);
const RAW_INTERPOLATED = /\b(?:from|join|update|into)\s*(?:[^;()]*?,\s*)?"?$/i;
const RAW_LIVE = /\bdeleted_at\s+is\s+null\b/i;

const repository = path.resolve(".");
const schemaDirectory = path.join(repository, "src/db/schema");

/** Whether an import specifier names the schema barrel or its rituals module. */
function isSchemaModule(file: string, specifier: string): boolean {
  const resolved = specifier.startsWith("@/")
    ? path.join(repository, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(file), specifier)
      : undefined;
  if (!resolved) return false;
  const bare = resolved.replace(/\.[cm]?[jt]sx?$/, "");
  return (
    bare === schemaDirectory ||
    bare === path.join(schemaDirectory, "index") ||
    bare === path.join(schemaDirectory, "rituals")
  );
}

/** One flagged use: where it is and why. */
interface Finding {
  line: number;
  kind: "query" | "alias" | "relational" | "raw-sql" | "re-export";
}

function statementOf(node: ts.Node): ts.Node {
  let current: ts.Node = node;
  while (current.parent) {
    if (
      ts.isVariableStatement(current) ||
      ts.isExpressionStatement(current) ||
      ts.isReturnStatement(current) ||
      ts.isThrowStatement(current) ||
      (ts.isArrowFunction(current.parent) && current.parent.body === current)
    )
      return current;
    current = current.parent;
  }
  return current;
}

/** Whether `node` sits inside an `or(…)` or `not(…)` call within `statement`. */
function negatedOrAlternative(node: ts.Node, statement: ts.Node): boolean {
  for (
    let current = node.parent;
    current && current !== statement.parent;
    current = current.parent
  )
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      (current.expression.text === "or" || current.expression.text === "not")
    )
      return true;
  return false;
}

function mentionsLive(statement: ts.Node): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (
      ts.isIdentifier(node) &&
      node.text === "liveRitual" &&
      !negatedOrAlternative(node, statement)
    )
      found = true;
    else if (
      (ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)) &&
      RAW_LIVE.test(node.text)
    )
      found = true;
    else ts.forEachChild(node, visit);
  };
  visit(statement);
  return found;
}

const literalText = (node: ts.Node | undefined) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : node && ts.isTemplateExpression(node)
      ? [
          node.head.text,
          ...node.templateSpans.map((span) => span.literal.text),
        ].join(" ")
      : undefined;

/** Every unfiltered query of the rituals table in one source file. */
function findUnfilteredRitualQueries(file: string, text: string): Finding[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : /\.[cm]?js$/.test(file)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS,
  );
  const tables = new Set<string>();
  const namespaces = new Set<string>();
  const insideSchema = path.dirname(path.resolve(file)) === schemaDirectory;
  const findings: Finding[] = [];
  const flag = (node: ts.Node, kind: Finding["kind"]) => {
    if (kind !== "re-export" && mentionsLive(statementOf(node))) return;
    findings.push({
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      kind,
    });
  };

  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      isSchemaModule(file, statement.moduleSpecifier.text)
    ) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings))
        namespaces.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings))
        for (const element of bindings.elements)
          if ((element.propertyName ?? element.name).text === "rituals")
            tables.add(element.name.text);
    }
    if (
      !insideSchema &&
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.some(
        (element) => (element.propertyName ?? element.name).text === "rituals",
      ) &&
      (!statement.moduleSpecifier ||
        (ts.isStringLiteral(statement.moduleSpecifier) &&
          isSchemaModule(file, statement.moduleSpecifier.text)))
    )
      flag(statement, "re-export");
  }

  const isTable = (node: ts.Node): boolean =>
    (ts.isIdentifier(node) && tables.has(node.text)) ||
    (ts.isPropertyAccessExpression(node) &&
      node.name.text === "rituals" &&
      ts.isIdentifier(node.expression) &&
      namespaces.has(node.expression.text)) ||
    ((ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node)) &&
      isTable(node.expression));

  // Re-bound and destructured names, until no new one appears.
  for (let grew = true; grew; ) {
    grew = false;
    const bind = (name: string) => {
      if (!tables.has(name)) {
        tables.add(name);
        grew = true;
      }
    };
    const scan = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (ts.isIdentifier(node.name) && isTable(node.initializer))
          bind(node.name.text);
        if (ts.isObjectBindingPattern(node.name))
          for (const element of node.name.elements) {
            const key = element.propertyName ?? element.name;
            if (
              ts.isIdentifier(key) &&
              key.text === "rituals" &&
              ts.isIdentifier(element.name)
            )
              bind(element.name.text);
          }
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left) &&
        isTable(node.right)
      )
        bind(node.left.text);
      ts.forEachChild(node, scan);
    };
    scan(source);
  }

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      QUERY_METHODS.has(node.expression.name.text) &&
      node.arguments.length > 0 &&
      isTable(node.arguments[0])
    )
      flag(node, "query");
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "alias" &&
      node.arguments.length > 0 &&
      isTable(node.arguments[0])
    )
      flag(node, "alias");
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "sql"
    ) {
      const text = literalText(node.arguments[0]);
      if (
        text !== undefined &&
        ((node.expression.name.text === "identifier" &&
          /^(?:public\.)?rituals$/i.test(text)) ||
          (node.expression.name.text === "raw" && RAW_TABLE.test(text)))
      )
        flag(node, "raw-sql");
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "rituals" &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "query"
    )
      flag(node, "relational");
    if (ts.isTaggedTemplateExpression(node)) {
      const template = node.template;
      if (ts.isNoSubstitutionTemplateLiteral(template)) {
        if (RAW_TABLE.test(template.text)) flag(node, "raw-sql");
      } else {
        const literals = [
          template.head.text,
          ...template.templateSpans.map((span) => span.literal.text),
        ];
        const named = literals.some((literal) => RAW_TABLE.test(literal));
        const interpolated = template.templateSpans.some(
          (span, index) =>
            isTable(span.expression) && RAW_INTERPOLATED.test(literals[index]),
        );
        if (named || interpolated) flag(node, "raw-sql");
      }
    }
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
      // tests/fixtures holds serialised data, not code.
      return entry.name === "node_modules" ||
        full === path.join(repository, "tests/fixtures")
        ? []
        : sources(full);
    return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts") &&
      !isTest(entry.name)
      ? [full]
      : [];
  });
}

/** Files with unfiltered uses, compared with ALLOWED both ways. */
function compareWithAllowed(
  found: ReadonlyMap<string, readonly Finding[]>,
  allowed: ReadonlyMap<string, string>,
) {
  return {
    unexpected: [...found.keys()].filter((file) => !allowed.has(file)).sort(),
    stale: [...allowed.keys()].filter((file) => !found.has(file)).sort(),
  };
}

describe("every rituals query filters deleted rituals", () => {
  const files = [
    ...sources(path.join(repository, "src")),
    ...sources(path.join(repository, "scripts")),
    ...sources(path.join(repository, "tests")),
  ];

  it("reads the whole tree", () => {
    const relative = files.map((file) => path.relative(repository, file));
    expect(relative).toContain("src/doc/sqlReads.ts");
    expect(relative).toContain("scripts/export-ritual-corpus.ts");
    expect(relative).toContain("scripts/docs-screenshots/capture.mts");
    expect(relative).not.toContain("src/doc/sqlReads.test.ts");
    expect(relative).toContain("scripts/release-checks.mjs");
    expect(relative).toContain("tests/ritualFixtures.ts");
  });

  it("passes on the tree, with only the allowed exceptions", () => {
    const found = new Map<string, Finding[]>();
    for (const file of files) {
      const findings = findUnfilteredRitualQueries(
        file,
        readFileSync(file, "utf8"),
      );
      if (findings.length)
        found.set(
          path.relative(repository, file).split(path.sep).join("/"),
          findings,
        );
    }
    expect(compareWithAllowed(found, ALLOWED)).toEqual({
      unexpected: [],
      stale: [],
    });
    // Parsing every source file takes seconds under a loaded gate.
  }, 60_000);

  const scan = (text: string, file = "src/doc/example.ts") =>
    findUnfilteredRitualQueries(path.join(repository, file), text).map(
      (finding) => finding.kind,
    );

  it("flags an aliased import", () => {
    expect(
      scan(`import { rituals as rows } from "../db/schema/rituals";
        export const q = (tx) => tx.select().from(rows).where(x);`),
    ).toEqual(["query"]);
    expect(
      scan(`import { rituals as rows } from "@/db/schema";
        export const q = (tx) => tx.update(rows).set({}).where(x);`),
    ).toEqual(["query"]);
  });

  it("flags a namespace member", () => {
    expect(
      scan(`import * as schema from "../db/schema";
        async function f(tx) { await tx.delete(schema.rituals); }`),
    ).toEqual(["query"]);
    expect(
      scan(`import * as schema from "../db/schema";
        async function f(tx) { await tx.select().from(a).leftJoin(schema.rituals, on); }`),
    ).toEqual(["query"]);
  });

  it("flags relational queries", () => {
    expect(
      scan(`export const f = (db) => db.query.rituals.findFirst();`),
    ).toEqual(["relational"]);
  });

  it("flags raw SQL that names or interpolates the table", () => {
    expect(scan("export const q = sql`select id from rituals`;")).toEqual([
      "raw-sql",
    ]);
    expect(
      scan('export const q = (tx, id) => tx`update "rituals" set x = ${id}`;'),
    ).toEqual(["raw-sql"]);
    expect(
      scan(`import { rituals } from "../db/schema/rituals";
        export const q = sql\`select 1 from \${rituals} where x\`;`),
    ).toEqual(["raw-sql"]);
  });

  it("flags aliases, destructured and re-bound names", () => {
    expect(
      scan(`import { rituals } from "../db/schema/rituals";
        const r = alias(rituals, "r");`),
    ).toEqual(["alias"]);
    expect(
      scan(`import * as schema from "../db/schema";
        const { rituals: hidden } = schema;
        const again = hidden;
        export const q = (tx) => tx.select().from(again);`),
    ).toEqual(["query"]);
    expect(
      scan(`import { rituals } from "@/db/schema/rituals";
        let t; t = (rituals as any);
        export const q = (tx) => tx.select().from(t!);`),
    ).toEqual(["query"]);
  });

  it("does not count liveRitual inside or() or not()", () => {
    expect(
      scan(`import { rituals } from "../db/schema/rituals";
        export const q = (tx) => tx.select().from(rituals).where(or(liveRitual, x));
        export const r = (tx) => tx.select().from(rituals).where(not(liveRitual));
        export const s = (tx) => tx.select().from(rituals).where(and(or(a, b), liveRitual));`),
    ).toEqual(["query", "query"]);
  });

  it("flags schema-qualified, quoted, comma-joined and built identifiers", () => {
    expect(
      scan(`export const a = sql\`select 1 from public.rituals\`;
        export const b = sql\`select 1 from "public"."rituals" r\`;
        export const c = sql\`select 1 from temples t, rituals r where 1\`;
        export const d = sql\`select 1 from \${sql.identifier("rituals")}\`;
        export const e = sql.raw("delete from rituals");
        export const f = sql.raw(\`update public.rituals set x = 1\`);
        export const g = sql\`select 1 from temples, ritual_revisions\`;`),
    ).toEqual([
      "raw-sql",
      "raw-sql",
      "raw-sql",
      "raw-sql",
      "raw-sql",
      "raw-sql",
    ]);
  });

  it("reads JavaScript too", () => {
    expect(
      scan(
        "export const q = (tx) => tx`select id from rituals`;",
        "scripts/x.mjs",
      ),
    ).toEqual(["raw-sql"]);
  });

  it("flags a re-export of the table outside the schema", () => {
    expect(
      scan(`export { rituals as hidden } from "../db/schema/rituals";`),
    ).toEqual(["re-export"]);
  });

  it("passes filtered queries, other tables and URLs", () => {
    expect(
      scan(`import { rituals as rows } from "../db/schema/rituals";
        import { liveRitual } from "./sqlPolicy";
        export const q = (tx) => tx.select().from(rows).where(and(eq(rows.id, id), liveRitual));
        export const r = tx\`select id from rituals r where r.deleted_at is null\`;
        export const s = (tx) => tx.select().from(revisions);
        export const u = \`\${base}/gd/rituals\`;
        export const v = sql\`select \${rows.id}\`;`),
    ).toEqual([]);
  });

  it("reports unexpected files and stale allowlist entries", () => {
    const finding: Finding = { line: 1, kind: "query" };
    expect(
      compareWithAllowed(
        new Map([["src/a.ts", [finding]]]),
        new Map([["src/b.ts", "gone"]]),
      ),
    ).toEqual({ unexpected: ["src/a.ts"], stale: ["src/b.ts"] });
  });
});
