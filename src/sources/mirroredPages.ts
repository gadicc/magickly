/**
 * Pages of public-domain books that our pages cite, mirrored in
 * `public/sources/` so a reader can see the cited page without leaving
 * the site (plan 080, "The sigils' sources"; plan 033, "Other
 * witnesses"). Each is one page of an archive.org, Google Books or
 * Wikimedia Commons scan, resized and re-encoded as WebP by `scripts/sources/mirror.mts`
 * (`pnpm sources:mirror`), which checks the original against
 * `original.sha256`; `public/sources/README.md` gives each file's source
 * and the basis for its public-domain status.
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
  /**
   * Outline a ring instead of the rectangle: the ellipse inscribed in it,
   * and inside that a second, this fraction of its size, with the same
   * centre. For the rings of a wheel, such as Kircher's names of God.
   */
  ring?: { inner: number };
}

/** One leaf of an archive.org item. */
export interface ArchiveScan {
  site: "archive.org";
  /** The archive.org item. */
  item: string;
  /** The leaf: archive.org's page index, the `n…` of its page URLs. */
  leaf: number;
}

/**
 * One printed page of a Google Books scan. Its image URLs carry a
 * short-lived signature, so the original is fetched by hand and kept
 * outside the repository (`pnpm sources:mirror --originals <dir>`).
 */
export interface GoogleBooksScan {
  site: "Google Books";
  /** The book's Google Books id, its `id=` parameter. */
  id: string;
  /** The printed page, the `n` of its `pg=PA<n>` parameter. */
  page: number;
}

/**
 * A file on Wikimedia Commons: an image of a plate, which Commons serves at
 * a stable URL a script can download.
 */
export interface CommonsScan {
  site: "Wikimedia Commons";
  /** The file's name on Commons, without "File:". */
  file: string;
  /** The original's download URL on upload.wikimedia.org. */
  download: string;
  /** The whole book, in the viewer of the library that scanned it. */
  book: string;
}

export type Scan = ArchiveScan | GoogleBooksScan | CommonsScan;

/** A passage of a mirrored page that a link cites: what, and where. */
export interface CitedRegion {
  /** What on the page is cited, in lower case, as `MirroredPage.cited`. */
  cited: string;
  /** Where it is on the page. */
  highlight: PageRegion;
}

export interface MirroredPage {
  /** The file's name in `public/sources/`, without `.webp`. */
  id: string;
  /** Where the page was scanned and published. */
  scan: Scan;
  /** The citation, as a link's or the dialog's name. */
  label: string;
  /** Whose copy was scanned, as the caption names it. */
  copy: string;
  /** What on the page is cited, and outlined, in lower case: "the Rulers' sigils…". */
  cited: string;
  /** Where the cited text or figures are on the page. */
  highlight: PageRegion;
  /**
   * Other passages on the same page that pages cite on their own, each
   * outlined instead of `highlight` when a link names it (`SourceLink`'s
   * `region`): Agrippa's names leaf, one planet's names at a time.
   */
  regions?: Readonly<Record<string, CitedRegion>>;
  /** The original image the mirror is made from (see `originalOf`). */
  original: { sha256: string; width: number; height: number };
  /** The committed WebP, as `pnpm sources:mirror` writes it. */
  output: { width: number; height: number; bytes: number; sha256: string };
}

/**
 * The mirrored file's widest: enough to read a sigil, at about 280 KB. A
 * narrower original keeps its own width; the mirror never enlarges.
 */
export const MIRROR_WIDTH = 1600;
/** The WebP quality the mirror encodes at. */
export const MIRROR_QUALITY = 75;

/** archive.org's single-page view of a leaf. */
export const archivePageUrl = (scan: Pick<ArchiveScan, "item" | "leaf">) =>
  `https://archive.org/details/${scan.item}/page/n${scan.leaf}/mode/1up`;

/** archive.org's page for the whole book. */
export const archiveBookUrl = (scan: Pick<ArchiveScan, "item">) =>
  `https://archive.org/details/${scan.item}`;

/** Google Books' view of a printed page. */
export const googleBooksPageUrl = (
  scan: Pick<GoogleBooksScan, "id" | "page">,
) => `https://books.google.com/books?id=${scan.id}&pg=PA${scan.page}`;

/** Google Books' page for the whole book. */
export const googleBooksBookUrl = (scan: Pick<GoogleBooksScan, "id">) =>
  `https://books.google.com/books?id=${scan.id}`;

/** A file's page on Wikimedia Commons. */
export const commonsFileUrl = (scan: Pick<CommonsScan, "file">) =>
  `https://commons.wikimedia.org/wiki/File:${scan.file.replace(/ /g, "_")}`;

/** The scanned page on the site that published it: a `SourceLink`'s href. */
export const pageUrl = ({ scan }: Pick<MirroredPage, "scan">) =>
  scan.site === "archive.org"
    ? archivePageUrl(scan)
    : scan.site === "Google Books"
      ? googleBooksPageUrl(scan)
      : commonsFileUrl(scan);

/** The whole scanned book on the site that published it. */
export const bookUrl = ({ scan }: Pick<MirroredPage, "scan">) =>
  scan.site === "archive.org"
    ? archiveBookUrl(scan)
    : scan.site === "Google Books"
      ? googleBooksBookUrl(scan)
      : scan.book;

/**
 * Where the mirror's original comes from: archive.org's full-size JPEG of
 * the leaf or the Commons original, downloaded, or a Google Books page image
 * fetched by hand and read from the `--originals` directory under this name.
 */
export const originalOf = ({
  scan,
}: Pick<MirroredPage, "scan">): { url: string } | { file: string } =>
  scan.site === "archive.org"
    ? {
        url: `https://archive.org/download/${scan.item}/page/n${scan.leaf}.jpg`,
      }
    : scan.site === "Google Books"
      ? { file: `googlebooks-${scan.id}-PA${scan.page}.png` }
      : { url: scan.download };

/** Where the site serves the mirrored page. */
export const mirrorPath = (page: Pick<MirroredPage, "id">) =>
  `/sources/${page.id}.webp`;

const theomagia = (leaf: number): ArchiveScan => ({
  site: "archive.org",
  item: "theomagiaortempl00heyd",
  leaf,
});

/** Kircher's *Oedipus Aegyptiacus*, vol. II part 1 (Rome, 1653). */
const oedipus = (leaf: number): ArchiveScan => ({
  site: "archive.org",
  item: "A027083",
  leaf,
});

/** Agrippa's *La Philosophie occulte* (The Hague, 1727), vols I and II. */
const philosophieOcculte = (leaf: number): ArchiveScan => ({
  site: "archive.org",
  item: "per_witchcraft-in-europe-and-america_agrippa-von-nettesh_1727_12_22",
  leaf,
});

export const MIRRORED_PAGES = {
  heydon13: {
    id: "heydon-theomagia-1663-p13",
    scan: theomagia(124),
    label: "Heydon, Theomagia (1663/4), p. 13",
    copy: "the Getty Research Institute's copy",
    cited: "the Rulers' sigils, in the first column",
    highlight: { x: 0.02, y: 0.05, width: 0.145, height: 0.89 },
    original: {
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
    scan: theomagia(126),
    label: "Heydon, Theomagia (1663/4), p. 15",
    copy: "the Getty Research Institute's copy",
    cited: "the Rulers' sigils, in the first column",
    highlight: { x: 0.03, y: 0.05, width: 0.135, height: 0.9 },
    original: {
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
  // The names of the planets' squares (plan 093, decision 7): Saturn's
  // to Mercury's on this leaf, the Moon's on the next. The regions were
  // read off archive.org's 1800-pixel image of the leaf, one block of
  // names under each planet's heading.
  agrippa148: {
    id: "agrippa-de-occulta-philosophia-1533-p148",
    scan: {
      site: "archive.org",
      item: "DeOccultaPhilosophiaLoc1533",
      leaf: 163,
    },
    label: "Agrippa, De occulta philosophia (1533), book II, p. CXLVIII",
    copy: "the Library of Congress's copy",
    cited: "the names of the squares of Saturn to Mercury, with their numbers",
    highlight: { x: 0.31, y: 0.238, width: 0.64, height: 0.563 },
    regions: {
      saturn: {
        cited: "the names of Saturn's square, with their numbers",
        highlight: { x: 0.31, y: 0.238, width: 0.625, height: 0.118 },
      },
      jupiter: {
        cited: "the names of Jupiter's square, with their numbers",
        highlight: { x: 0.31, y: 0.357, width: 0.64, height: 0.1 },
      },
      mars: {
        cited: "the names of Mars' square, with their numbers",
        highlight: { x: 0.31, y: 0.455, width: 0.625, height: 0.09 },
      },
      sol: {
        cited: "the names of the Sun's square, with their numbers",
        highlight: { x: 0.31, y: 0.543, width: 0.625, height: 0.088 },
      },
      venus: {
        cited: "the names of Venus' square, with their numbers",
        highlight: { x: 0.31, y: 0.629, width: 0.64, height: 0.077 },
      },
      mercury: {
        cited: "the names of Mercury's square, with their numbers",
        highlight: { x: 0.31, y: 0.703, width: 0.64, height: 0.098 },
      },
    },
    original: {
      sha256:
        "32f7f8289bed9242bcb4b4c16c3717f253bc96897a13902b332388f893288460",
      width: 1800,
      height: 2395,
    },
    output: {
      width: 1600,
      height: 2129,
      bytes: 293488,
      sha256:
        "852534b7c0ad3dad40b575638129d475aabecb0e15037a69a712325375112c9c",
    },
  },
  agrippa149: {
    id: "agrippa-de-occulta-philosophia-1533-p149",
    scan: {
      site: "archive.org",
      item: "DeOccultaPhilosophiaLoc1533",
      leaf: 164,
    },
    label: "Agrippa, De occulta philosophia (1533), book II, p. CXLIX",
    copy: "the Library of Congress's copy",
    cited: "the Moon's intelligence of intelligences, numbered 3321",
    // Its top edge in the gap below the line above, whose "3321
    // Schedbarschemoth" it used to clip (ink measured on this image).
    highlight: { x: 0.11, y: 0.143, width: 0.635, height: 0.028 },
    // What the kameas' pages cite on the leaf (plan 093, decision 7).
    regions: {
      luna: {
        cited: "the names of the Moon's square, with their numbers",
        highlight: { x: 0.11, y: 0.065, width: 0.64, height: 0.107 },
      },
      saturnSquare: {
        cited:
          "Saturn's square, in numbers and in Hebrew letters, with its seal and the characters of its intelligence and spirit",
        highlight: { x: 0.11, y: 0.178, width: 0.61, height: 0.32 },
      },
      jupiterSquare: {
        cited:
          "Jupiter's square, in numbers and in Hebrew letters, with its seal and the characters of its intelligence and spirit",
        highlight: { x: 0.11, y: 0.506, width: 0.66, height: 0.35 },
      },
      // What the planetary seals cite on the leaf: the two squares, with
      // their seals, the two boxes above as one.
      saturnAndJupiter: {
        cited:
          "the squares of Saturn and Jupiter, with their seals and the characters of their intelligences and spirits",
        highlight: { x: 0.11, y: 0.178, width: 0.66, height: 0.678 },
      },
      // What the kamea sigils' sources cite on the leaf: the Moon's names
      // and the squares of Saturn and Jupiter, the three boxes above as one.
      kameaSigils: {
        cited:
          "the names of the Moon's square, with their numbers, and the squares of Saturn and Jupiter",
        highlight: { x: 0.11, y: 0.065, width: 0.66, height: 0.791 },
      },
      // The four characters on the leaf, each the box K6 read it in
      // (magick-data's planetaryNameCharacters, pixels of this 1800 by
      // 2428 image) as a fraction of the page, widened to the next
      // thousandth; a test holds the two equal.
      agielCharacter: {
        cited: "the character of Agiel, the intelligence of Saturn",
        highlight: { x: 0.366, y: 0.401, width: 0.151, height: 0.081 },
      },
      zazelCharacter: {
        cited: "the character of Zazel, the spirit of Saturn",
        highlight: { x: 0.555, y: 0.395, width: 0.223, height: 0.096 },
      },
      iophielCharacter: {
        cited: "the character of Iophiel, the intelligence of Jupiter",
        highlight: { x: 0.383, y: 0.753, width: 0.179, height: 0.112 },
      },
      hismaelCharacter: {
        cited: "the character of Hismael, the spirit of Jupiter",
        highlight: { x: 0.575, y: 0.747, width: 0.15, height: 0.112 },
      },
    },
    original: {
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
  lenain25: {
    id: "lenain-science-cabalistique-1823-p25",
    scan: { site: "Google Books", id: "qt9SAAAAcAAJ", page: 25 },
    label: "Lenain, La Science cabalistique (1823), p. 25",
    copy: "the Koninklijke Bibliotheek's copy",
    cited: "the first cabalistic table, folded so that rows 57 to 72 show",
    highlight: { x: 0.095, y: 0.355, width: 0.7, height: 0.285 },
    original: {
      sha256:
        "2519a63a554e331ee1f1d33b54f4c07851a309a1854c2b274bc57065e7d7077a",
      width: 1574,
      height: 2500,
    },
    output: {
      width: 1574,
      height: 2500,
      bytes: 223294,
      sha256:
        "313b468478b548b4497ab50eb100386d27251e8bef7d4fbadfeeab870b616360",
    },
  },
  lenainReissue25: {
    id: "lenain-science-cabalistique-reissue-p25",
    scan: { site: "Google Books", id: "ZqgpxTZ43HkC", page: 25 },
    label: "Lenain, La Science cabalistique (reissue), p. 25",
    copy: "the Bibliothèque municipale de Lyon's copy",
    cited: "the first cabalistic table, folded so that rows 62 to 72 show",
    highlight: { x: 0.15, y: 0.31, width: 0.73, height: 0.21 },
    original: {
      sha256:
        "4b70bceaf9421a8ddfd1d618ded326de1d7ca473808ea2c601db86dd31ef41b6",
      width: 1633,
      height: 2500,
    },
    output: {
      width: 1600,
      height: 2449,
      bytes: 174376,
      sha256:
        "791476c6d4aee7f784641481cade0e1f8c53b6f071a340fc24933010260438cc",
    },
  },
  kircher271: {
    id: "kircher-oedipus-aegyptiacus-1653-p271",
    scan: oedipus(278),
    label: "Kircher, Oedipus Aegyptiacus, vol. II part 1 (1653), p. 271",
    copy: "the Universidad de Sevilla's copy",
    cited: "the seventy-two names of God from Exodus 14, rows 1 to 24",
    highlight: { x: 0.07, y: 0.355, width: 0.69, height: 0.5 },
    original: {
      sha256:
        "7801818bfe0619c7a5deaf740f4979d32376262662710f878e67b5dbb358b9d0",
      width: 3456,
      height: 5184,
    },
    output: {
      width: 1600,
      height: 2400,
      bytes: 302400,
      sha256:
        "c810b18f98ca7dc50f5bef4b04af20e602b00599b6df006e3a7fba2cbcb19018",
    },
  },
  kircher272: {
    id: "kircher-oedipus-aegyptiacus-1653-p272",
    scan: oedipus(279),
    label: "Kircher, Oedipus Aegyptiacus, vol. II part 1 (1653), p. 272",
    copy: "the Universidad de Sevilla's copy",
    cited: "the seventy-two names, rows 25 to 67",
    highlight: { x: 0.3, y: 0.065, width: 0.58, height: 0.81 },
    original: {
      sha256:
        "367d28cf9bd61257e60faeb80836c81e5c5507a347e05252ad1d68462801b1f6",
      width: 3456,
      height: 5184,
    },
    output: {
      width: 1600,
      height: 2400,
      bytes: 271166,
      sha256:
        "ec4082a6afe2a94b007b4aa1c51d984868363ce6185da7cfcd2219c4ffb8fb4a",
    },
  },
  kircher273: {
    id: "kircher-oedipus-aegyptiacus-1653-p273",
    scan: oedipus(280),
    label: "Kircher, Oedipus Aegyptiacus, vol. II part 1 (1653), p. 273",
    copy: "the Universidad de Sevilla's copy",
    cited: "the seventy-two names, rows 68 to 72",
    highlight: { x: 0.15, y: 0.095, width: 0.52, height: 0.1 },
    original: {
      sha256:
        "bda31660c2599f5e32c8c4f7952decbe1133ac81fbf9f67a61455c3672229897",
      width: 3456,
      height: 5184,
    },
    output: {
      width: 1600,
      height: 2400,
      bytes: 453438,
      sha256:
        "f9033bc7a6df286cf60ec6c60b0a09555fa4312214684b4850178efd4982a5b2",
    },
  },
  kircher287: {
    id: "kircher-oedipus-aegyptiacus-1653-p287",
    scan: oedipus(294),
    label: "Kircher, Oedipus Aegyptiacus, vol. II part 1 (1653), p. 287",
    copy: "the Universidad de Sevilla's copy",
    cited:
      "where Kircher says every nation's name of God has four letters and introduces the plate of them that follows, and the section after it",
    highlight: { x: 0.07, y: 0.16, width: 0.81, height: 0.7 },
    original: {
      sha256:
        "179eac0dbcc687d0c9f2b5dbf1427285d69207dbf6cbe28e3e809cc7449d34a4",
      width: 3456,
      height: 5184,
    },
    output: {
      width: 1600,
      height: 2400,
      bytes: 438122,
      sha256:
        "0f3b3f25511cf8500b4c6ee8a608915ea1084fd27a6dfeacb51712a8585ec088",
    },
  },
  agrippaFr109: {
    id: "agrippa-philosophie-occulte-1727-p109",
    scan: philosophieOcculte(588),
    label: "Agrippa, La Philosophie occulte (1727), vol. II, p. 109",
    copy: "a microfilm in the series Witchcraft in Europe and America",
    cited: "the line introducing the seventy-two angels' table",
    highlight: { x: 0.03, y: 0.545, width: 0.62, height: 0.045 },
    original: {
      sha256:
        "384e4aa44f17f10bd6621c040929673bd3f2486df774c91ea26f800f2cf89564",
      width: 5560,
      height: 9289,
    },
    output: {
      width: 1600,
      height: 2673,
      bytes: 240202,
      sha256:
        "5a69930290d512b0debc9c9cdc5a65bc581aca180b2dd4e02eef039971de030f",
    },
  },
  agrippaFr110: {
    id: "agrippa-philosophie-occulte-1727-p110",
    scan: philosophieOcculte(589),
    label: "Agrippa, La Philosophie occulte (1727), vol. II, p. 110",
    copy: "a microfilm in the series Witchcraft in Europe and America",
    cited: "the seventy-two angels' names, in four columns",
    highlight: { x: 0.32, y: 0.155, width: 0.57, height: 0.53 },
    original: {
      sha256:
        "9adfba99c5da26301bf4894d1d5efcb1da9de1f78cffac409588c57aa9dd2687",
      width: 5459,
      height: 9247,
    },
    output: {
      width: 1600,
      height: 2710,
      bytes: 253674,
      sha256:
        "616ed4befc67676ab210696fa470f7713e22fd687bf0f0d99f6a5fa8e913fc2b",
    },
  },
  kircherPlate: {
    id: "kircher-oedipus-aegyptiacus-1653-plate-p287",
    scan: {
      site: "Wikimedia Commons",
      file: "Kircher-Diagram of the names of God (22593924).jpg",
      download:
        "https://upload.wikimedia.org/wikipedia/commons/6/60/Kircher-Diagram_of_the_names_of_God_%2822593924%29.jpg",
      // The whole volume; the plate is its image 289.
      book: "https://polona.pl/item/athanasii-kircheri-soc-iesu-oedipi-aegyptiaci-tomus-t-2-ps-1-gymnasium-siue,OTAyNjM5Ng/",
    },
    label:
      "Kircher, Oedipus Aegyptiacus, vol. II part 1 (1653), the plate after p. 287",
    copy: "the National Library of Poland's copy",
    cited:
      "the wheel's two outer rings, seventy-two names of God and, inside them, their nations",
    // The wheel's centre is at (1467, 2004) of 2926 × 4000; the names'
    // ring ends about 1150 pixels out (1140 up and down), and the nations'
    // begins about 825 out, 0.72 of that.
    highlight: {
      x: 0.106,
      y: 0.216,
      width: 0.789,
      height: 0.57,
      ring: { inner: 0.72 },
    },
    original: {
      sha256:
        "02d659c4e1326866bae618389de6baeef5ff9b121f4e57121faa116bc1ccbea6",
      width: 2926,
      height: 4000,
    },
    output: {
      width: 1600,
      height: 2187,
      bytes: 779994,
      sha256:
        "5c6a24a7756e9d219283f396de5e0ad9ee1f14a1c79fa53ecf657d38fff40125",
    },
  },
} as const satisfies Record<string, MirroredPage>;

export type MirroredPageKey = keyof typeof MIRRORED_PAGES;

/** The cited regions a mirrored page names, if it has any. */
export type MirroredRegionKey<K extends MirroredPageKey> =
  (typeof MIRRORED_PAGES)[K] extends { regions: infer R }
    ? keyof R & string
    : never;

/**
 * A mirrored page as a link to one of its regions shows it: the region's
 * passage cited and outlined in place of the page's own. Without a region,
 * or with one the page does not have, the page as it is.
 */
export function citedPage(page: MirroredPage, region?: string): MirroredPage {
  const cited =
    region !== undefined && page.regions && Object.hasOwn(page.regions, region)
      ? page.regions[region]
      : undefined;
  return cited
    ? { ...page, cited: cited.cited, highlight: cited.highlight }
    : page;
}
