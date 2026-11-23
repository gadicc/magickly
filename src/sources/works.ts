import { MIRRORED_PAGES, type MirroredPageKey } from "./mirroredPages";

/**
 * The scanned books the site cites, each once (plan 094's B1): where its
 * scan is, and whether it may be shown or only linked. A page cites a
 * leaf or a printed page of one with `<Cite>`, which links that page of
 * the scan, or opens the site's mirror of it where there is one
 * (`mirroredPages.ts`); `citeUrl` gives the same link where a component
 * needs only the URL.
 *
 * `rights` is the work's standing where the site is read (AGENTS.md
 * "Outside sources"): `public-domain` everywhere; `in-copyright`
 * somewhere it is read, so linked and never shown or traced (Regardie's
 * volumes, plan 091); `unsettled` where who made it, or which edition the
 * scan is, has not been settled, so it is treated as in copyright.
 */

/** A book on archive.org: an item, or one file of a multi-file item. */
export interface ArchiveWork {
  site: "archive.org";
  item: string;
  /** The file within the item, for items that hold several books. */
  file?: string;
}

/** A book on Google Books, addressed by its printed pages. */
export interface GoogleBooksWork {
  site: "Google Books";
  id: string;
}

export interface Work {
  /** Who and what, for a test's message or a note: "Agrippa, De occulta philosophia (Cologne, 1533)". */
  title: string;
  scan: ArchiveWork | GoogleBooksWork;
  rights: "public-domain" | "in-copyright" | "unsettled";
}

export const WORKS = {
  agrippa1533: {
    title:
      "Agrippa, De occulta philosophia (Cologne, 1533), the Library of Congress copy",
    scan: { site: "archive.org", item: "DeOccultaPhilosophiaLoc1533" },
    rights: "public-domain",
  },
  agrippa1651: {
    title: "Agrippa, Three Books of Occult Philosophy (London, 1651)",
    scan: { site: "archive.org", item: "b30335231" },
    rights: "public-domain",
  },
  agrippaFourthBook1655: {
    title:
      "Agrippa, His Fourth Book of Occult Philosophy, tr. Turner (London, 1655)",
    scan: { site: "archive.org", item: "b20458563" },
    rights: "public-domain",
  },
  barrett1801: {
    title: "Barrett, The Magus (London, 1801)",
    scan: { site: "archive.org", item: "b22006795" },
    rights: "public-domain",
  },
  crowley777: {
    title: "Crowley, 777 Revised, the Celephaïs Press e-text",
    scan: { site: "archive.org", item: "aleister-crowley-liber-777" },
    rights: "unsettled",
  },
  equinoxI2: {
    title: "The Equinox, vol. I no. 2 (London, 1909)",
    scan: {
      site: "archive.org",
      item: "crowley-equinox_202110",
      file: "The Equinox Vol. 1, No. 2",
    },
    rights: "public-domain",
  },
  equinoxI7: {
    title: "The Equinox, vol. I no. 7 (London, 1912)",
    scan: {
      site: "archive.org",
      item: "crowley-equinox_202110",
      file: "The Equinox Vol. 1, No. 7",
    },
    // Public domain, but who drew Plate X is not established, so the
    // plate stays a link (mirroredPages.ts).
    rights: "public-domain",
  },
  heydon1663: {
    title: "Heydon, Theomagia, vol. 1 (London, 1663/4), the Getty copy",
    scan: { site: "archive.org", item: "theomagiaortempl00heyd" },
    rights: "public-domain",
  },
  james1994: {
    title:
      "James, The Enochian Magick of Dr. John Dee (Llewellyn, 1994), the 1998 printing",
    scan: {
      site: "archive.org",
      item: "theenochianmagickofdr.johndee.themostpowerfulsystemofmagickinitsoriginalunexpurg",
    },
    rights: "in-copyright",
  },
  kircher1653Complutense: {
    title:
      "Kircher, Oedipus Aegyptiacus, vol. II (Rome, 1653), the Complutense copy",
    scan: { site: "archive.org", item: "bub_gb_XjfzMnomDQoC" },
    rights: "public-domain",
  },
  lenain1823: {
    title:
      "Lenain, La Science Cabalistique (Amiens, 1823), the Koninklijke Bibliotheek copy",
    scan: { site: "Google Books", id: "qt9SAAAAcAAJ" },
    rights: "public-domain",
  },
  lenainReissue: {
    title:
      "Lenain, La Science Cabalistique, the reissue (recorded as 1909), Lyon's copy the site transcribes",
    scan: { site: "Google Books", id: "ZqgpxTZ43HkC" },
    rights: "public-domain",
  },
  lenainReissueLyon2: {
    title: "Lenain, La Science Cabalistique, the reissue, Lyon's second copy",
    scan: { site: "Google Books", id: "BqzyzEEX3MAC" },
    rights: "public-domain",
  },
  lenainMs5365: {
    title:
      "Bibliothèque interuniversitaire de santé, Ms 5365, a copy of Lenain's 1823 printing",
    scan: { site: "archive.org", item: "BIUSante_ms05365" },
    rights: "public-domain",
  },
  mathers1889: {
    title:
      "Mathers, The Key of Solomon the King (London, 1889), the Wellcome Library copy",
    scan: { site: "archive.org", item: "b24884431" },
    rights: "public-domain",
  },
  regardie1937: {
    title: "Regardie, The Golden Dawn, vol. 1 (Aries Press, Chicago, 1937)",
    scan: {
      site: "archive.org",
      item: "IsraelRegardie-thegoldenDawn-vol1-1937",
    },
    rights: "in-copyright",
  },
  regardie1938: {
    title: "Regardie, The Golden Dawn, vol. 2 (Aries Press, Chicago, 1938)",
    scan: {
      site: "archive.org",
      item: "IsraelRegardie-TheGoldenDawn-Vol2-1938",
    },
    rights: "in-copyright",
  },
  regardie1939: {
    title: "Regardie, The Golden Dawn, vol. 3 (Aries Press, Chicago, 1939)",
    scan: {
      site: "archive.org",
      item: "IsraelRegardie-TheGoldenDawn-Vol3-1939",
    },
    rights: "in-copyright",
  },
  regardie1940: {
    title: "Regardie, The Golden Dawn, vol. 4 (Aries Press, Chicago, 1940)",
    scan: {
      site: "archive.org",
      item: "IsraelRegardie-TheGoldenDawn-Vol4-1940",
    },
    rights: "in-copyright",
  },
} as const satisfies Record<string, Work>;

export type WorkId = keyof typeof WORKS;

/** The works scanned on archive.org, cited by leaf. */
export type ArchiveWorkId = {
  [K in WorkId]: (typeof WORKS)[K]["scan"]["site"] extends "archive.org"
    ? K
    : never;
}[WorkId];

/** The works on Google Books, cited by printed page. */
export type GoogleBooksWorkId = Exclude<WorkId, ArchiveWorkId>;

/** Where in a work: an archive.org leaf, or a Google Books printed page. */
export type Locator<W extends WorkId> = W extends ArchiveWorkId
  ? { leaf: number }
  : {
      /**
       * The printed page; roman for the front matter. For an unnumbered
       * preliminary page, Google's own count of the leaves before the
       * first numbered one.
       */
      page: number | string;
      /** The roman front matter (Google's PR), not the body (PA). */
      front?: boolean;
      /**
       * An unnumbered preliminary page, such as a title page (Google's PP),
       * which has no printed number to cite it by.
       */
      preliminary?: boolean;
    };

const scanOf = (work: WorkId): Work["scan"] => WORKS[work].scan;

const archiveBase = ({ item, file }: ArchiveWork) =>
  `https://archive.org/details/${item}${file ? `/${encodeURIComponent(file)}` : ""}`;

/** The whole book, on the site that scanned it. */
export function workUrl(work: WorkId): string {
  const scan = scanOf(work);
  return scan.site === "archive.org"
    ? archiveBase(scan)
    : `https://books.google.com/books?id=${scan.id}`;
}

/** That leaf or printed page of the work, on the site that scanned it. */
export function citeUrl<W extends WorkId>(work: W, at: Locator<W>): string {
  const scan = scanOf(work);
  if (scan.site === "archive.org")
    return `${archiveBase(scan)}/page/n${(at as { leaf: number }).leaf}/mode/1up`;
  const { page, front, preliminary } = at as {
    page: number | string;
    front?: boolean;
    preliminary?: boolean;
  };
  const sequence = preliminary ? "PP" : front ? "PR" : "PA";
  return `https://books.google.com/books?id=${scan.id}&pg=${sequence}${page}`;
}

/**
 * The site's mirror of that leaf or printed page, if it has one. A file
 * within a multi-file archive.org item is never mirrored, since the
 * mirror's scans name the item alone.
 */
export function mirrorOf<W extends WorkId>(
  work: W,
  at: Locator<W>,
): MirroredPageKey | undefined {
  const scan = scanOf(work);
  return (Object.keys(MIRRORED_PAGES) as MirroredPageKey[]).find((key) => {
    const mirrored = MIRRORED_PAGES[key].scan;
    if (scan.site === "archive.org")
      return (
        !scan.file &&
        mirrored.site === "archive.org" &&
        mirrored.item === scan.item &&
        mirrored.leaf === (at as { leaf: number }).leaf
      );
    const { page, front, preliminary } = at as {
      page: number | string;
      front?: boolean;
      preliminary?: boolean;
    };
    // The mirror cites body pages only.
    return (
      !front &&
      !preliminary &&
      mirrored.site === "Google Books" &&
      mirrored.id === scan.id &&
      String(mirrored.page) === String(page)
    );
  });
}
