import type { NoteWitness } from "magick-data/kabbalah/lenain/notes";
import { Fragment } from "react";

/**
 * The other copies an editorial note cites, each a link to the page or leaf
 * it was read from: "1823 printing, p. 57 · Ms 5365, leaf n66". Set after the
 * note's reason, on the book's pages and the angels' alike.
 */
export default function Witnesses({
  witnesses,
}: {
  witnesses?: NoteWitness[];
}) {
  if (!witnesses?.length) return null;
  return (
    <>
      {" "}
      {witnesses.map((witness, index) => (
        <Fragment key={witness.source}>
          {index ? " · " : null}
          <a href={witness.url} rel="noopener">
            {witness.label}
          </a>
        </Fragment>
      ))}
    </>
  );
}
