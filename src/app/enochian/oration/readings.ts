/**
 * The Oration's two versions.
 *
 * The page prints Dee's own text, chapter 5 of *De Heptarchia Mystica*
 * (British Library Sloane MS 3191, ff. 45r–45v), as Joseph H. Peterson
 * transcribes it (https://esotericarchives.com/dee/hm.htm#chap5), with
 * the spelling modernised by us and Dee's words, punctuation and capitals
 * kept. Geoffrey James's text, *The Enochian Magick of Dr. John Dee*
 * (Llewellyn, 1994), pp. 53–55, is kept only as the places where its
 * words differ from Dee's, so that a reader following his book can switch
 * to his wording without the page holding a copy of his edition.
 *
 * Every difference in wording or spelling between the two was found by a
 * word-by-word comparison of James's pages (the archive.org scan of the
 * 1998 printing) with Peterson's transcription, made by us in November
 * 2026; punctuation and capitals were not compared.
 */

export const ORATION_VERSIONS = ["dee", "james"] as const;
export type OrationVersion = (typeof ORATION_VERSIONS)[number];
export const DEFAULT_ORATION_VERSION: OrationVersion = "dee";

/** Each version's name, as the page's version menu shows it. */
export const ORATION_VERSION_TITLES: Record<OrationVersion, string> = {
  dee: "Dee's manuscript",
  james: "Geoffrey James (1994)",
};

/** A place where James's words differ from Dee's. */
export interface Reading {
  /** Dee's words, in our modern spelling, as the prayer's JSX has them. */
  dee: string;
  /** James's words there; empty where he leaves Dee's out. */
  james: string;
  /** The archive.org leaf of James's page that has it: n38 is p. 53. */
  leaf: 38 | 39;
  /**
   * A change of wording, noted below the prayer under a letter
   * (`OrationText`); a reading without it differs in spelling only.
   */
  wording?: true;
}

export const READINGS = {
  eternal: { dee: "Eternal", james: "Æternal", leaf: 38 },
  who: {
    dee: "Who",
    james: "I",
    leaf: 38,
    wording: true,
  },
  manifest: {
    dee: "manifest, might abundantly instruct, furnish,",
    james: "",
    leaf: 38,
    wording: true,
  },
  majestical: {
    dee: "Majestical",
    james: "Majestic",
    leaf: 38,
    wording: true,
  },
  forever: { dee: "for ever", james: "forever", leaf: 38 },
  urgent: { dee: "so urgent", james: "", leaf: 39, wording: true },
  form: { dee: "form", james: "forme", leaf: 39 },
  isagogically: {
    dee: "Isagogically",
    james: "theurgically",
    leaf: 39,
    wording: true,
  },
} as const satisfies Record<string, Reading>;

export type ReadingId = keyof typeof READINGS;

/** The changes of wording, in the prayer's order, each with its letter. */
export const WORDINGS = (Object.keys(READINGS) as ReadingId[])
  .filter((id) => "wording" in READINGS[id])
  .map((id, i) => ({
    id,
    letter: String.fromCharCode(97 + i),
    ...(READINGS[id] as Reading),
  }));

/** The letter a change of wording is marked with, or none for a spelling. */
export const readingLetter = (id: ReadingId) =>
  WORDINGS.find((each) => each.id === id)?.letter;

/** The fragment id of a change of wording's note. */
export const readingAnchor = (id: ReadingId) => `oration-reading-${id}`;

/**
 * James, *The Enochian Magick of Dr. John Dee* (Llewellyn, 1994; the scan is
 * the 1998 printing) on archive.org, a spread a leaf: pp. 52–53 on n38,
 * pp. 54–55 on n39. In copyright: linked, never mirrored.
 */
export const jamesPage = (leaf: number) =>
  `https://archive.org/details/theenochianmagickofdr.johndee.themostpowerfulsystemofmagickinitsoriginalunexpurg/page/n${leaf}/mode/1up`;

/** The British Library's record for Dee's holograph, Sloane MS 3191. */
export const SLOANE_3191 = "https://searcharchives.bl.uk/catalog/040-002115575";

/**
 * Peterson's transcription of *De Heptarchia Mystica* from Sloane 3191, at
 * chapter 5 (ff. 45r–45v). © Peterson: his readings are cited, and the
 * prayer is our own modernisation of Dee's text, not a copy of his page.
 */
export const PETERSON = "https://esotericarchives.com/dee/hm.htm#chap5";
