/**
 * The README's Sources table, read by `src/readme.test.ts` and by the smoke
 * test (plan 080, decision 3). The test holds it to the JSON5 sources the
 * manifest publishes; the smoke test holds it to the JSON files in the
 * tarball itself; both refuse a version past 0.0.0 while a row is not
 * signed off. The table is read as magick-components' is
 * (`scripts/provenance-sign-off.mjs`).
 */
import {
  signOffRows,
  unsignedRows,
} from "../../../scripts/provenance-sign-off.mjs";

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
  return signOffRows(readme, {
    section: "Sources",
    firstColumn: "Data file",
  }).map(({ item, source, signedOff }) => ({ file: item, source, signedOff }));
}

/**
 * The rows no one has signed off yet.
 *
 * @param {SourcesRow[]} rows
 */
export function unsignedSources(rows) {
  return unsignedRows(rows);
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
