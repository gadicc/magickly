/**
 * What a drawing's versions say about themselves, as the rose's and the
 * candlestick's entries export it: a name for a menu, a note for a
 * footnote and the works cited, much as magick-data's tablet notes give
 * the Enochian tablets' versions. Private: each entry exports its own
 * notes and these types.
 */

/** A work a version is taken from: the citation, and its scan where public. */
export interface DrawingSource {
  /** The work and the place in it, with the scan's leaf where there is one. */
  readonly text: string;
  /** The page of the work's public scan, where there is one. */
  readonly url?: string;
}

/** One version of a drawing. */
export interface DrawingVersionNote<Id extends string = string> {
  readonly id: Id;
  /** The version's name, for a menu: "Regardie 1939". */
  readonly title: string;
  /** Where the version comes from and how it differs, for a footnote. */
  readonly text: string;
  /** The works it is drawn from, in the order the note names them. */
  readonly sources: readonly DrawingSource[];
}

/**
 * A leaf of an archive.org scan: the item, and the file within it where
 * the item holds several, as magick-data's `sourceUrl` links them.
 */
export function archiveLeaf(item: string, leaf: number, file?: string): string {
  const within = file ? `/${encodeURIComponent(file)}` : "";
  return `https://archive.org/details/${item}${within}/page/n${leaf}`;
}
