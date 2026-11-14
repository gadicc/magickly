/**
 * A package README's provenance table, with its "Signed off" column (plan
 * 080, decision 3, and stage G): magick-data's "Sources" and
 * magick-components' "Provenance". Each package's README test and smoke
 * test read it, and refuse a version past 0.0.0 while a row is not signed
 * off: a date, not a phrase in the source, so rewording a row cannot pass.
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
 * @typedef {object} SignOffRow
 * @property {string} item The row's first cell, backticks removed: what
 *   the row is about.
 * @property {string} source Where it comes from.
 * @property {string} signedOff The date the owner signed off the row's
 *   provenance, `YYYY-MM-DD`, or empty while it is not.
 */

/**
 * The rows of the Markdown table under `## <section>`, whose header must be
 * `| <firstColumn> | Source | Signed off |`. Throws on a missing section, a
 * different header, a row without three cells, or a sign-off that is
 * neither empty nor a date.
 *
 * @param {string} readme The README's text.
 * @param {{ section: string, firstColumn: string }} table
 * @returns {SignOffRow[]}
 */
export function signOffRows(readme, { section, firstColumn }) {
  const text = readme.split(/^## /m).find((s) => s.startsWith(`${section}\n`));
  if (!text) throw new Error(`README has no “${section}” section`);
  const lines = text.split("\n").filter((line) => line.startsWith("|"));
  const header = lines[0]
    ?.split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (
    JSON.stringify(header) !==
    JSON.stringify([firstColumn, "Source", "Signed off"])
  )
    throw new Error(`unexpected ${section} header: ${lines[0]}`);
  return lines.slice(2).map((line) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 3) throw new Error(`malformed row: ${line}`);
    const [item, source, signedOff] = cells;
    if (signedOff !== "" && !isDate(signedOff))
      throw new Error(`sign-off must be a date (YYYY-MM-DD) or empty: ${line}`);
    return { item: item.replace(/`/g, ""), source, signedOff };
  });
}

/**
 * The rows no one has signed off yet.
 *
 * @template {{ signedOff: string }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function unsignedRows(rows) {
  return rows.filter(({ signedOff }) => signedOff === "");
}
