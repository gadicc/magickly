/**
 * Pages of public-domain books that our pages cite, mirrored in
 * `public/sources/` so a reader can see the cited page without leaving
 * the site (plan 080, "The sigils' sources"). Each is one leaf of an
 * archive.org scan, resized and re-encoded as WebP by
 * `scripts/sources/mirror.mts` (`pnpm sources:mirror`), which checks the
 * download against `original.sha256`; `public/sources/README.md` gives
 * each file's source and the basis for its public-domain status.
 *
 * Only works out of copyright everywhere belong here. The Equinox's
 * Plate X stays an outside link: who drew it is not established.
 */

/** A rectangle as fractions of the page's width and height, from its top left. */
export interface PageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MirroredPage {
  /** The file's name in `public/sources/`, without `.webp`. */
  id: string;
  /** The archive.org item. */
  item: string;
  /** The leaf: archive.org's page index, the `n…` of its page URLs. */
  leaf: number;
  /** The citation, as a link's or the dialog's name. */
  label: string;
  /** Whose copy was scanned, as the caption names it. */
  copy: string;
  /** What on the page is cited, and outlined, in lower case: "the Rulers' sigils…". */
  cited: string;
  /** Where the cited text or figures are on the page. */
  highlight: PageRegion;
  /** The download: archive.org's full-size JPEG of the leaf. */
  original: { url: string; sha256: string; width: number; height: number };
  /** The committed WebP, as `pnpm sources:mirror` writes it. */
  output: { width: number; height: number; bytes: number; sha256: string };
}

/** The mirrored file's width: enough to read a sigil, at about 280 KB. */
export const MIRROR_WIDTH = 1600;
/** The WebP quality the mirror encodes at. */
export const MIRROR_QUALITY = 75;

/** archive.org's single-page view of a leaf. */
export const archivePageUrl = (page: Pick<MirroredPage, "item" | "leaf">) =>
  `https://archive.org/details/${page.item}/page/n${page.leaf}/mode/1up`;

/** archive.org's page for the whole book. */
export const archiveBookUrl = (page: Pick<MirroredPage, "item">) =>
  `https://archive.org/details/${page.item}`;

/** Where the site serves the mirrored page. */
export const mirrorPath = (page: Pick<MirroredPage, "id">) =>
  `/sources/${page.id}.webp`;

/** The full-size JPEG archive.org renders for a leaf. */
const leafImage = (item: string, leaf: number) =>
  `https://archive.org/download/${item}/page/n${leaf}.jpg`;

export const MIRRORED_PAGES = {
  heydon13: {
    id: "heydon-theomagia-1663-p13",
    item: "theomagiaortempl00heyd",
    leaf: 124,
    label: "Heydon, Theomagia (1663/4), p. 13",
    copy: "the Getty Research Institute's copy",
    cited: "the Rulers' sigils, in the first column",
    highlight: { x: 0.02, y: 0.05, width: 0.145, height: 0.89 },
    original: {
      url: leafImage("theomagiaortempl00heyd", 124),
      sha256:
        "8942795dca6abbbde55ff46bfa1974c4e1c5cd812e632f1457c97b3235aa7a09",
      width: 1860,
      height: 3172,
    },
    output: {
      width: 1600,
      height: 2729,
      bytes: 228774,
      sha256:
        "5c94f32a0d8c393168b5cb714f02eb48c9990158fff17ade5156b18ca7de9817",
    },
  },
  heydon15: {
    id: "heydon-theomagia-1663-p15",
    item: "theomagiaortempl00heyd",
    leaf: 126,
    label: "Heydon, Theomagia (1663/4), p. 15",
    copy: "the Getty Research Institute's copy",
    cited: "the Rulers' sigils, in the first column",
    highlight: { x: 0.03, y: 0.05, width: 0.135, height: 0.9 },
    original: {
      url: leafImage("theomagiaortempl00heyd", 126),
      sha256:
        "05d36cd6d3240951e3a2731520ca793ac8bec5b1eeee0434ec7d7f176690f7e9",
      width: 1860,
      height: 3172,
    },
    output: {
      width: 1600,
      height: 2729,
      bytes: 203016,
      sha256:
        "995cc4f5d536b4f8cee09a6491e2ea911b4a74ae680d1f9168528d6eee2fa761",
    },
  },
  agrippa149: {
    id: "agrippa-de-occulta-philosophia-1533-p149",
    item: "DeOccultaPhilosophiaLoc1533",
    leaf: 164,
    label: "Agrippa, De occulta philosophia (1533), book II, p. CXLIX",
    copy: "the Library of Congress's copy",
    cited: "the Moon's intelligence of intelligences, numbered 3321",
    highlight: { x: 0.11, y: 0.139, width: 0.635, height: 0.032 },
    original: {
      url: leafImage("DeOccultaPhilosophiaLoc1533", 164),
      sha256:
        "a765a1d827da2319d93ae421683ed3ee946272bd634510a537af440c9505ec39",
      width: 1800,
      height: 2428,
    },
    output: {
      width: 1600,
      height: 2158,
      bytes: 212048,
      sha256:
        "5c0e39e1c5f0ab8721abb9015de606d92c1dde682b7d59a30b4e62f5881159ae",
    },
  },
} as const satisfies Record<string, MirroredPage>;

export type MirroredPageKey = keyof typeof MIRRORED_PAGES;
