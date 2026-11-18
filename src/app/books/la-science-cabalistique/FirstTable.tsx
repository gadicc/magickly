import {
  checkedSentence,
  differencesSentence,
  firstTable,
  firstTableCounts,
  partlyClause,
  plateRange,
  SOURCE_LABEL,
} from "magick-data/kabbalah/lenain/firstTable";
import { MIRRORED_PAGES } from "@/sources/mirroredPages";
import SourceLink from "@/sources/SourceLink";
import styles from "./reading.module.css";

/**
 * The first cabalistic table, put back together.
 *
 * The fold-out was photographed folded in both copies scanned: the reissue's
 * shows rows 62 to 72 and the 1823 printing's 57 to 72. The rest are derived
 * from each genius's own entry, which carries the same three columns, and
 * every one of them says so: a reconstruction that looks like a reading is
 * worse than no reconstruction at all. Every number in the prose is counted
 * from the rows, so it cannot go stale.
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
      <div className={styles.tableWrap} role="region" tabIndex={0}>
        <table>
          <caption>
            Reconstructed from the entries, except where marked as on a plate
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Genius</th>
              <th scope="col" lang="fr">
                Peuple
              </th>
              <th scope="col">Name of God</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.no}>
                <td>{row.no}</td>
                <td>{row.name}</td>
                <td lang="fr">{row.nation}</td>
                <td>{row.godName}</td>
                <td className={styles.kind}>
                  {SOURCE_LABEL[row.source]}
                  {row.partly ? ", partly legible" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
