/**
 * Leitch's spellings of Key words that our Keys and dictionary don't
 * have, so the translator can take them as input (plan 081, decision
 * 13). Each maps to the Key rows it reads, and so to Dee's word there.
 *
 * Source: Aaron Leitch, *The Angelical Language*, vol. II (Llewellyn,
 * 2010), the lexicon, each headword checked against the book's own
 * images on 13 November 2026. Only the spelling, its place in the Keys
 * and the page are taken: facts, not text. The book prints no page
 * numbers in its e-book; `page` is the printed page worked out from the
 * contents (right to within one page). Leitch numbers the Call of the
 * Aethyrs as 30; it is our Key 19. His word numbers can differ from
 * ours by up to five, since he divides some words differently; the
 * rows here are ours.
 *
 * Six differ in spelling. The rest are words Leitch writes joined; the
 * join rule splits some of them, and the table makes all of them map to
 * the right rows. Two of his readings are other words at their place
 * (BALTLE at his 1.70, TORB at his 10.41) and are left to the expert
 * (plan 082).
 */
export interface LeitchSpelling {
  /** Leitch's headword, in capitals. */
  readonly word: string;
  /**
   * `spelling`: one of Dee's words, spelled otherwise. `joined`: Dee's
   * words of consecutive rows, written as one.
   */
  readonly kind: "spelling" | "joined";
  /** The Key it is in (Leitch's 30 is our 19). */
  readonly key: number;
  /**
   * Our row numbers in that Key (1-based, as in `keys.json5`), in order:
   * one, or several if joined.
   */
  readonly rows: readonly number[];
  /** The printed page of Leitch's entry. */
  readonly page: number;
}

/** Who the spellings are from, for labels. */
export const LEITCH_SOURCE =
  "Aaron Leitch, The Angelical Language, vol. II (Llewellyn, 2010)";

/**
 * The table, sorted as Leitch's lexicon is, so by page (a test checks
 * both). Two forms appear twice, once for each place they read.
 */
export const LEITCH_SPELLINGS: readonly LeitchSpelling[] = [
  { word: "BAZEMLO", kind: "spelling", key: 8, rows: [1], page: 152 },
  { word: "CHISMICAOLZ", kind: "joined", key: 19, rows: [5, 6], page: 191 },
  { word: "COMOBLIORT", kind: "joined", key: 18, rows: [25, 26], page: 201 },
  { word: "DSINSI", kind: "joined", key: 16, rows: [12, 13], page: 228 },
  { word: "DSIUM", kind: "joined", key: 14, rows: [23, 24], page: 228 },
  { word: "DSOADO", kind: "joined", key: 15, rows: [8, 9], page: 229 },
  { word: "DSPRAF", kind: "joined", key: 19, rows: [2, 3], page: 230 },
  { word: "FCAOSGA", kind: "spelling", key: 4, rows: [37], page: 243 },
  { word: "IVONPH", kind: "joined", key: 12, rows: [22, 23], page: 308 },
  {
    word: "IVONPOVNPH",
    kind: "joined",
    key: 17,
    rows: [17, 18, 19],
    page: 308,
  },
  { word: "ODAPILA", kind: "joined", key: 4, rows: [41, 42], page: 380 },
  { word: "ODBRINT", kind: "joined", key: 17, rows: [9, 10], page: 380 },
  { word: "ODCACOCASB", kind: "joined", key: 19, rows: [110, 111], page: 381 },
  { word: "ODCHIS", kind: "joined", key: 6, rows: [24, 25], page: 381 },
  { word: "ODECRIN", kind: "joined", key: 6, rows: [42, 43], page: 381 },
  { word: "ODES", kind: "joined", key: 7, rows: [28, 29], page: 382 },
  { word: "ODFAORGT", kind: "joined", key: 19, rows: [117, 118], page: 382 },
  { word: "ODIPURAN", kind: "joined", key: 8, rows: [26, 27], page: 382 },
  { word: "ODLONSHIN", kind: "joined", key: 4, rows: [29, 30], page: 383 },
  { word: "ODMIAM", kind: "joined", key: 7, rows: [25, 26], page: 383 },
  { word: "ODMIAM", kind: "joined", key: 7, rows: [34, 35], page: 383 },
  { word: "ODQUASB", kind: "joined", key: 19, rows: [134, 135], page: 384 },
  { word: "ODUGEG", kind: "joined", key: 4, rows: [23, 24], page: 384 },
  { word: "ODVOOAN", kind: "joined", key: 3, rows: [60, 61], page: 384 },
  { word: "ODZAMRAN", kind: "joined", key: 4, rows: [46, 47], page: 385 },
  { word: "ODZAMRAN", kind: "joined", key: 19, rows: [148, 149], page: 385 },
  { word: "OSLONDOH", kind: "joined", key: 3, rows: [8, 9], page: 403 },
  { word: "PRGEL", kind: "spelling", key: 9, rows: [3], page: 432 },
  { word: "QMOSPLEH", kind: "joined", key: 3, rows: [17, 18], page: 440 },
  { word: "QTA", kind: "joined", key: 2, rows: [18, 19], page: 441 },
  { word: "SOBAIAD", kind: "joined", key: 17, rows: [15, 16], page: 456 },
  { word: "TOLHAM", kind: "spelling", key: 14, rows: [11], page: 480 },
  { word: "VIVIALPRT", kind: "spelling", key: 16, rows: [2], page: 496 },
  { word: "ZOMDUX", kind: "spelling", key: 1, rows: [65], page: 529 },
];
