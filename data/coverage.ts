import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { tables } from "./tables";

/**
 * Which JSON5 sources the graph checks, and which it does not.
 *
 * `data:check` walks `tables`, and `data/build.mts` globs every `*.json5`, so
 * a file can be compiled into `data/dist` and served to the app while no check
 * ever opens it. That is the state Lenain's edition is in: `pages.json5` is
 * the largest file in `data/` by some way, and the run that reports "nothing
 * wrong" has never read a byte of it.
 *
 * Bringing it under `tables` was the alternative and is the wrong shape. The
 * graph checks links, mirrors and chains between id-keyed rows, and a book has
 * none of those — it would be declared a table of 168 rows to borrow a
 * validator whose every check would be a no-op, and the things that do matter
 * for it (anchors distinct, each sequence in its own order, notes resolving,
 * seventy-two entries present) are not expressible there. They live in
 * `lenainEdition.test.ts` instead.
 *
 * So the gap is reported rather than closed: a new uncovered file is named on
 * every run, and whoever adds one decides what checks it needs rather than
 * discovering years later that none ran. See plan 033.
 */

/** Files with checks of their own, and where those live. */
const CHECKED_ELSEWHERE: Record<string, string> = {
  "kabbalah/lenain/pages.json5": "lenainEdition.test.ts",
  "kabbalah/lenain/apparatus.json5": "lenainEdition.test.ts",
  "kabbalah/lenain/evidence.json5": "lenainQuotations.test.ts",
  "kabbalah/seventyTwoAngelsText/fr.json5": "lenainQuotations.test.ts",
  // Not a table and never was: it is emitted as a module, which tables.ts
  // says in as many words.
  "enochian/dictionary.json5": "its own module build",
};

function sources(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "node_modules") return [];
      return sources(path.join(dir, entry.name), rel);
    }
    return entry.name.endsWith(".json5") ? [rel] : [];
  });
}

/**
 * The sources the graph covers, read from what `tables.ts` imports.
 *
 * By path and not by name: the table called `sephirah` is `sephirot.json5` and
 * `tolPath` is `paths.json5`, so matching a table's name against a file's name
 * reports seven covered tables as uncovered, which is how the first attempt at
 * this went.
 */
function covered(dir: string) {
  const source = readFileSync(path.join(dir, "tables.ts"), "utf8");
  const imports = source.matchAll(/from\s+"\.\/dist\/(.+?)\.json"/g);
  return new Set([...imports].map((match) => `${match[1]}.json5`));
}

export interface Coverage {
  /** Sources the graph checks, by table name. */
  checked: number;
  /** Sources nothing in `tables` covers, and what does cover them. */
  uncovered: { file: string; by: string }[];
}

export function coverage(dir = import.meta.dirname): Coverage {
  const inGraph = covered(dir);
  const uncovered = sources(dir)
    .sort()
    .filter((file) => !inGraph.has(file))
    .map((file) => ({ file, by: CHECKED_ELSEWHERE[file] ?? "nothing" }));

  return { checked: Object.keys(tables).length, uncovered };
}
