/**
 * The README's Sources table, read by `src/readme.test.ts` and by the smoke
 * test (plan 080, decision 3). The test holds it to the JSON5 sources the
 * manifest publishes; the smoke test holds it to the JSON files in the
 * tarball itself; both refuse a version past 0.0.0 while a row is unsettled.
 */

/**
 * What a Sources row says while its provenance is an open question for the
 * owner's sign-off (plan 080, stage A′). No row may say either once the
 * version leaves 0.0.0, since the CC BY grant cannot be withdrawn.
 */
export const UNSETTLED = ["not recorded", "not known"];

/**
 * The rows of the Markdown table under "## Sources": the data file, as its
 * JSON5 source in `src/` (or `graph.json`), and where it comes from.
 *
 * @param {string} readme The README's text.
 * @returns {{ file: string, source: string }[]}
 */
export function readmeSources(readme) {
  const section = readme.split(/^## /m).find((s) => s.startsWith("Sources"));
  if (!section) throw new Error("README has no “Sources” section");
  const lines = section
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2); // the header and its rule
  return lines.map((line) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 2) throw new Error(`malformed row: ${line}`);
    return { file: cells[0].replace(/`/g, ""), source: cells[1] };
  });
}

/**
 * The rows whose source still says one of the {@link UNSETTLED} phrases.
 *
 * @param {{ file: string, source: string }[]} rows
 */
export function unsettledSources(rows) {
  return rows.filter(({ source }) =>
    UNSETTLED.some((phrase) => source.toLowerCase().includes(phrase)),
  );
}

/**
 * Where a Sources row's file is in the tarball: `x.json5` is built into
 * `dist/x.json`, and `graph.json` is `dist/graph.json`.
 *
 * @param {string} file
 */
export function publishedPathOf(file) {
  return `dist/${file.replace(/\.json5$/, ".json")}`;
}
