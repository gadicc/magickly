import {
  firstTable,
  firstTableCounts,
  PRINTED_FROM,
} from "@/../data/kabbalah/lenain/firstTable";
import styles from "./reading.module.css";

/**
 * The first cabalistic table, put back together.
 *
 * The fold-out was photographed folded, so rows 1 to 61 are on no image of
 * this copy. They are derived from each genius's own entry, which carries the
 * same three columns, and every one of them says so: a reconstruction that
 * looks like a reading is worse than no reconstruction at all.
 */
export default function FirstTable() {
  const rows = firstTable();
  const counts = firstTableCounts();

  return (
    <section
      className={styles.reconstruction}
      aria-label="First cabalistic table, reconstructed"
    >
      <h2>The first cabalistic table, reconstructed</h2>
      <p>
        The plate is a fold-out and the scan caught it folded: only rows{" "}
        {PRINTED_FROM} to 72 are legible, and they are printed above as they
        survive. The {counts.reconstructed} rows below are{" "}
        <strong>not from the plate</strong>. They are put back from each
        genius&apos;s own entry, which gives the same three columns. Checked
        against the {counts.printed} rows that do survive, the method recovers
        the divine name and the nation for ten of them and the name for eight —
        the misses being places Lenain disagrees with himself.
      </p>
      <div className={styles.tableWrap} role="region" tabIndex={0}>
        <table>
          <caption>
            Reconstructed from the entries, except where marked “on the plate”
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
                  {row.source === "printed" ? "on the plate" : "reconstructed"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
