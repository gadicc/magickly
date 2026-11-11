/**
 * The README's Sources table, read by `src/readme.test.ts` and by the smoke
 * test (plan 080, decision 3). The test holds it to the JSON5 sources the
 * manifest publishes; the smoke test holds it to the JSON files in the
 * tarball itself; both refuse a version past 0.0.0 while a row is not
 * signed off.
 */

/** A sign-off: the date the owner settled the row's provenance. */
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whether `text` is a real calendar date written `YYYY-MM-DD`.
 *
 * @param {string} text
 */
function isDate(text) {
  const match = DATE.exec(text);
  if (!match) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
  );
}

/**
 * @typedef {object} SourcesRow
 * @property {string} file The data file, as its JSON5 source in `src/` (or
 *   `graph.json`).
 * @property {string} source Where it comes from.
 * @property {string} signedOff The date the owner signed off the row's
 *   provenance (plan 080, stage A′), `YYYY-MM-DD`, or empty while it is
 *   not. The CC BY grant cannot be withdrawn, so no version past 0.0.0
 *   ships with an empty one.
 */

/**
 * The rows of the Markdown table under "## Sources". Throws on a row
 * without three cells, or whose sign-off is neither empty nor a date.
 *
 * @param {string} readme The README's text.
 * @returns {SourcesRow[]}
 */
export function readmeSources(readme) {
  const section = readme.split(/^## /m).find((s) => s.startsWith("Sources"));
  if (!section) throw new Error("README has no “Sources” section");
  const lines = section.split("\n").filter((line) => line.startsWith("|"));
  const header = lines[0]
    ?.split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (JSON.stringify(header) !== '["Data file","Source","Signed off"]')
    throw new Error(`unexpected Sources header: ${lines[0]}`);
  return lines.slice(2).map((line) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 3) throw new Error(`malformed row: ${line}`);
    const [file, source, signedOff] = cells;
    if (signedOff !== "" && !isDate(signedOff))
      throw new Error(`sign-off must be a date (YYYY-MM-DD) or empty: ${line}`);
    return { file: file.replace(/`/g, ""), source, signedOff };
  });
}

/**
 * The rows no one has signed off yet.
 *
 * @param {SourcesRow[]} rows
 */
export function unsignedSources(rows) {
  return rows.filter(({ signedOff }) => signedOff === "");
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
