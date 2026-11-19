import {
  checkedSentence,
  differencesSentence,
  type FirstTableRow,
  firstTable,
  firstTableCounts,
  type KircherRay,
  kircherSentence,
  partlyClause,
  plateRange,
  sourceCell,
  uncertainty,
} from "magick-data/kabbalah/lenain/firstTable";
import { MIRRORED_PAGES } from "@/sources/mirroredPages";
import SourceLink from "@/sources/SourceLink";
import { scriptOf } from "./hebrewRuns";
import styles from "./reading.module.css";

/**
 * Kircher's name of God, marked with its language and direction, and with
 * "reading uncertain" after it where the reader was not sure of the letters.
 */
function KircherName({ ray }: { ray: KircherRay }) {
  const script = scriptOf(ray.godName);
  const unsure = uncertainty(ray);
  return (
    <>
      {script ? (
        <span
          lang={script.lang}
          dir={script.dir}
          className={script.lang === "he" ? styles.hebrew : undefined}
        >
          {ray.godName}
        </span>
      ) : (
        <span lang="la">{ray.godName}</span>
      )}
      {unsure ? <small className={styles.kind}> ({unsure})</small> : null}
    </>
  );
}

/**
 * The first cabalistic table, put back together.
 *
 * The fold-out was photographed folded in both copies scanned: the reissue's
 * shows rows 62 to 72 and the 1823 printing's 57 to 72. The rest are derived
 * from each genius's own entry, which carries the same three columns, and
 * every one of them says so: a reconstruction that looks like a reading is
 * worse than no reconstruction at all. Beside each row is its source, the
 * same ray of Kircher's plate of the names of God by nation. Every number in
 * the prose is counted from the rows, so it cannot go stale.
 */
export default function FirstTable() {
  const rows = firstTable();
  const counts = firstTableCounts();
  const later = plateRange("plate1909");
  const original = plateRange("plate1823");
  const differences = differencesSentence();

  return (
    <section
      className={styles.reconstruction}
      aria-label="First cabalistic table, reconstructed"
    >
      <h2>The first cabalistic table, reconstructed</h2>
      <p>
        The plate is a fold-out, and both copies scanned caught it folded. The
        reissue&apos;s (
        <SourceLink
          page="lenainReissue25"
          aria-label={MIRRORED_PAGES.lenainReissue25.label}
        >
          p. 25
        </SourceLink>
        ) shows rows {later.from} to {later.to}, printed above as they survive.
        The 1823 printing&apos;s (
        <SourceLink page="lenain25" aria-label={MIRRORED_PAGES.lenain25.label}>
          p. 25
        </SourceLink>
        ) was opened further and shows rows {original.from} to {original.to}
        {partlyClause()}; the {counts.plate1823} rows it alone shows are given
        below from it. The {counts.reconstructed} rows before those are{" "}
        <strong>not from either plate</strong>. They are put back from each
        genius&apos;s own entry, which gives the same three columns.
      </p>
      <p>{checkedSentence()}</p>
      {differences ? <p>{differences}</p> : null}
      <p>
        {kircherSentence()} Kircher&apos;s names and nations are given as
        engraved, from the National Library of Poland&apos;s copy of{" "}
        <SourceLink
          page="kircherPlate"
          aria-label={MIRRORED_PAGES.kircherPlate.label}
        >
          the plate
        </SourceLink>
        ; &ldquo;reading uncertain&rdquo; marks a name whose engraved letters
        could not be read with confidence.
      </p>
      <div className={styles.tableWrap} role="region" tabIndex={0}>
        <table>
          <caption>
            Reconstructed from the entries, except where marked as on a plate;
            beside it, Lenain&apos;s source, Kircher&apos;s plate
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Genius</th>
              <th scope="col" lang="fr">
                Peuple
              </th>
              <th scope="col">Name of God</th>
              <th scope="col">Kircher&apos;s nation</th>
              <th scope="col">Kircher&apos;s name of God</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: FirstTableRow) => (
              <tr key={row.no}>
                <td>{row.no}</td>
                <td>{row.name}</td>
                <td lang="fr">{row.nation}</td>
                <td>{row.godName}</td>
                <td lang="la">{row.kircher.nation}</td>
                <td>
                  <KircherName ray={row.kircher} />
                </td>
                <td className={styles.kind}>{sourceCell(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
