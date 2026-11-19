import type { NoteWitness } from "magick-data/kabbalah/lenain/notes";
import { Fragment } from "react";
import { MIRRORED_PAGES, type MirroredPageKey } from "@/sources/mirroredPages";
import SourceLink from "@/sources/SourceLink";

/** A witness the site mirrors, by its key in the manifest. */
const mirrored = (witness: NoteWitness): MirroredPageKey | undefined =>
  witness.mirror && witness.mirror in MIRRORED_PAGES
    ? (witness.mirror as MirroredPageKey)
    : undefined;

/**
 * The other copies an editorial note cites, each a link to the page or leaf
 * it was read from: "1823 printing, p. 57 · Ms 5365, leaf n66". Set after the
 * note's reason, on the book's pages and the angels' alike. A witness the
 * site mirrors, Kircher's plate, opens in the lightbox instead.
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
      {witnesses.map((witness, index) => {
        const page = mirrored(witness);
        return (
          <Fragment key={witness.source}>
            {index ? " · " : null}
            {page ? (
              <SourceLink plain page={page}>
                {witness.label}
              </SourceLink>
            ) : (
              <a href={witness.url} rel="noopener">
                {witness.label}
              </a>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
