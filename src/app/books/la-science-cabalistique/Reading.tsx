import { Fragment, type ReactNode } from "react";
import type { Note } from "@/../data/kabbalah/lenain/notes";
import {
  footnoteText,
  leafClosings,
  type Piece,
  piecesOf,
  segmentsOf,
} from "@/../data/kabbalah/lenain/pieces";
import type { Leaf } from "@/../data/kabbalah/lenain/volume";
// Roboto has no Hebrew, and the volume runs 1,223 Hebrew letters through its
// French. Frank Ruehl CLM is already in public/fonts and covers U+05C4, the
// upper dot Lenain points his letters with; without this it falls back to
// whatever the system has.
import "@/../public/fonts/FrankRuehlCLM-stylesheet.css";
import styles from "./reading.module.css";

/**
 * Lenain's text as HTML, from the same fold the Markdown edition uses.
 *
 * A server component rendering plain elements: the chapter of the genii is
 * 94 KB of prose, and every @mui/material component is a client component.
 *
 * Structure follows DPUB-ARIA, which exists for exactly this. `doc-pagebreak`
 * is the one that earns its keep — a screen reader announces it and offers
 * navigation by page, which is how anyone reads a book by citation.
 */

const SCAN = "https://books.google.com/books?id=ZqgpxTZ43HkC";

/** The facsimile of one leaf. Roman front matter is PR, the body PA. */
function facsimileUrl(label: string, sequence: string) {
  if (!label) return null;
  const prefix = sequence === "body" ? "PA" : "PR";
  return `${SCAN}&pg=${prefix}${label}`;
}

const HEBREW = /[֐-׿יִ-ﭏ]+/;

/**
 * Hebrew set inside French runs left to right unless it is told otherwise, and
 * the damage is already visible in the data: "Vehuiah .והויה" has the stop on
 * the wrong side of the name. Each run is marked with its language and
 * direction so the browser's bidi algorithm has something to work with, and so
 * a screen reader switches voice rather than spelling it out.
 */
function withHebrew(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let index = 0;
  while (rest) {
    const found = rest.match(HEBREW);
    if (!found || found.index === undefined) {
      out.push(rest);
      break;
    }
    if (found.index > 0) out.push(rest.slice(0, found.index));
    out.push(
      <span
        key={`${keyPrefix}-he-${index}`}
        lang="he"
        dir="rtl"
        className={styles.hebrew}
      >
        {found[0]}
      </span>,
    );
    rest = rest.slice(found.index + found[0].length);
    index++;
  }
  return out;
}

function PageBreak({
  anchor,
  label,
  sequence,
}: {
  anchor: string;
  label: string;
  sequence: string;
}) {
  const href = facsimileUrl(label, sequence);
  const shown = label ? `p. ${label}` : "—";
  const said = label ? `page ${label}` : "unnumbered leaf";
  return (
    <span
      id={anchor}
      role="doc-pagebreak"
      aria-label={said}
      className={styles.pagebreak}
    >
      {href ? (
        <a
          href={href}
          rel="noopener"
          title={`${said} in the Google Books scan`}
        >
          [{shown}]
        </a>
      ) : (
        `[${shown}]`
      )}
    </span>
  );
}

/** A piece's text with its page breaks set where they fall inside it. */
function Body({
  piece,
  sequences,
  keyPrefix,
}: {
  piece: Piece;
  sequences: Map<string, string>;
  keyPrefix: string;
}) {
  return (
    <>
      {segmentsOf(piece).map((segment, index) => (
        // The index is the key because a segment has no identity of its own —
        // it is a slice of one paragraph at a page break — and the book is
        // rendered once on the server and never reordered.
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed slice of static text
        <Fragment key={`${keyPrefix}-${index}`}>
          {segment.before ? (
            <PageBreak
              anchor={segment.before.anchor}
              label={segment.before.label}
              sequence={sequences.get(segment.before.anchor) ?? "body"}
            />
          ) : null}
          {withHebrew(segment.text, `${keyPrefix}-${index}`)}
        </Fragment>
      ))}
    </>
  );
}

function Apparatus({ notes }: { notes: Note[] }) {
  if (!notes.length) return null;
  return (
    <aside
      className={styles.apparatus}
      role="doc-endnotes"
      aria-label="Editorial notes"
    >
      <p>Editorial notes</p>
      <ul>
        {notes.map((note) => (
          <li key={`${note.no}-${note.field}-${note.printed}`}>
            <strong>
              {note.no ? `Genius ${note.no}, ` : ""}
              {note.field}
            </strong>
            <span className={styles.kind}>{note.kind}</span>
            {note.printed ? (
              <>
                {" · "}
                {withHebrew(note.printed, `n-${note.no}-${note.field}`)}
                {note.used ? ` → ${note.used}` : ", kept as printed"}
              </>
            ) : null}
            {" — "}
            {note.why}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Doubts({ doubts }: { doubts: string[] }) {
  if (!doubts.length) return null;
  return (
    <details className={styles.doubts}>
      <summary>Reading notes</summary>
      <ul>
        {doubts.map((doubt) => (
          <li key={doubt.slice(0, 60)}>{doubt}</li>
        ))}
      </ul>
    </details>
  );
}

export default function Reading({
  leaves,
  notesByPage,
  label,
}: {
  leaves: Leaf[];
  notesByPage: Map<string, Note[]>;
  label: string;
}) {
  const pieces = piecesOf(leaves);
  const sequences = new Map(
    leaves.map((leaf) => [leaf.page.anchor, leaf.page.sequence]),
  );
  const doubts = new Map(
    leaves.map((leaf) => [leaf.page.anchor, leaf.uncertain]),
  );

  // A leaf's notes are set once every piece belonging to it is rendered, so a
  // paragraph spanning two leaves is not cut in half by them.
  const closesAt = leafClosings(pieces);

  return (
    <article lang="fr" className={styles.reading} aria-label={label}>
      {pieces.map((piece, index) => {
        const key = `piece-${index}`;
        const closing = closesAt.get(index) ?? [];
        const after = closing.map((anchor) => (
          <Fragment key={`after-${anchor}`}>
            <Apparatus notes={notesByPage.get(anchor) ?? []} />
            <Doubts doubts={doubts.get(anchor) ?? []} />
          </Fragment>
        ));

        if (piece.kind === "table")
          return (
            <Fragment key={key}>
              <div className={styles.tableWrap} role="region" tabIndex={0}>
                <table>
                  <caption>
                    Table as Lenain sets it, without a header row
                  </caption>
                  <tbody>
                    {piece.rows.map((row, rowIndex) => (
                      // Cells repeat and may be empty, so position is the only
                      // identity a row or cell of Lenain's tables has.
                      // biome-ignore lint/suspicious/noArrayIndexKey: position is the cell's identity
                      <tr key={`${key}-r${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: position is the cell's identity
                          <td key={`${key}-r${rowIndex}-c${cellIndex}`}>
                            {withHebrew(
                              cell,
                              `${key}-${rowIndex}-${cellIndex}`,
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {after}
            </Fragment>
          );

        if (piece.kind === "heading")
          return (
            <Fragment key={key}>
              <h2>
                <Body piece={piece} sequences={sequences} keyPrefix={key} />
              </h2>
              {after}
            </Fragment>
          );

        if (piece.kind === "footnote")
          return (
            <Fragment key={key}>
              <p className={styles.footnote} role="doc-footnote">
                {piece.marker ? (
                  <span className={styles.marker}>({piece.marker}) </span>
                ) : null}
                <Body
                  piece={{ ...piece, text: footnoteText(piece) }}
                  sequences={sequences}
                  keyPrefix={key}
                />
              </p>
              {after}
            </Fragment>
          );

        return (
          <Fragment key={key}>
            {piece.text || piece.breaks.length ? (
              <p>
                <Body piece={piece} sequences={sequences} keyPrefix={key} />
              </p>
            ) : null}
            {after}
          </Fragment>
        );
      })}
    </article>
  );
}
