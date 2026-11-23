/**
 * The Tarot's minor cards, as the Golden Dawn names them (plan 095,
 * decision 1): the four Aces, the thirty-six small cards from 2 to 10, and
 * the sixteen court cards in the Order's ranks, King, Queen, Prince and
 * Princess (Regardie, *The Golden Dawn*, vol. 4, Chicago, 1940, p.288,
 * archive.org leaf n280), which are not the common deck's King, Queen,
 * Knight and Page. Ids and English names only, computed rather than written
 * out; the Order's titles of the cards ("Lord of Peace Restored") are a
 * later table. The trumps are the paths' (`kabbalah/paths`, `hermetic`).
 */

/** The four suits, in the order of the Name's letters, Yod to He final. */
export const TAROT_SUITS: readonly ["wands", "cups", "swords", "pentacles"] =
  Object.freeze(["wands", "cups", "swords", "pentacles"] as const);

/** A suit. */
export type TarotSuit = (typeof TAROT_SUITS)[number];

/** An element of the four, as `alchemy/elements` ids them. */
type SuitElementId = "fire" | "water" | "air" | "earth";

/**
 * Each suit's element: Wands Fire, Cups Water, Swords Air, Pentacles Earth,
 * as the table of the Tablet of Union's cards pairs its lines' elements
 * with the suits (vol. 4, p.290, leaf n282).
 */
export const SUIT_ELEMENTS: Readonly<Record<TarotSuit, SuitElementId>> =
  Object.freeze({
    wands: "fire",
    cups: "water",
    swords: "air",
    pentacles: "earth",
  });

/** The suit of an element of the four (`SUIT_ELEMENTS` turned round). */
export function suitOfElement(element: SuitElementId): TarotSuit {
  const suit = TAROT_SUITS.find((each) => SUIT_ELEMENTS[each] === element);
  /* c8 ignore next -- every element of the four has a suit */
  if (!suit) throw new RangeError(`Not an element of the four: ${element}`);
  return suit;
}

/**
 * The Order's court ranks, in the order of the Name's letters (vol. 4,
 * p.288, leaf n280): the King Yod and Fire, the Queen He and Water, the
 * Prince Vau and Air, the Princess He final and Earth.
 */
export const COURT_RANKS: readonly ["king", "queen", "prince", "princess"] =
  Object.freeze(["king", "queen", "prince", "princess"] as const);

/** A court rank. */
export type CourtRank = (typeof COURT_RANKS)[number];

/** Each court rank's element, by its letter of the Name (p.288). */
export const COURT_ELEMENTS: Readonly<Record<CourtRank, SuitElementId>> =
  Object.freeze({
    king: "fire",
    queen: "water",
    prince: "air",
    princess: "earth",
  });

/** A small card's number. */
export type SmallCardNumber = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** A card's rank: the Ace, a small card's number, or a court rank. */
export type MinorCardRank = "ace" | SmallCardNumber | CourtRank;

/**
 * A minor card's id: its rank, then its suit (`ace-wands`, `2-cups`,
 * `princess-pentacles`). No id moves.
 */
export type MinorCardId = `${MinorCardRank}-${TarotSuit}`;

/** One minor card. */
export interface MinorCard {
  readonly id: MinorCardId;
  readonly suit: TarotSuit;
  readonly rank: MinorCardRank;
  /** Which of the three the card is: an Ace, a small card or a court card. */
  readonly kind: "ace" | "small" | "court";
  /** Its English name: "Ace of Wands", "Two of Cups", "Princess of Pentacles". */
  readonly name: string;
}

const NUMBER_NAMES: Readonly<Record<SmallCardNumber, string>> = Object.freeze({
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine",
  10: "Ten",
});

const SMALL_NUMBERS: readonly SmallCardNumber[] = Object.freeze([
  2, 3, 4, 5, 6, 7, 8, 9, 10,
] as const);

const capital = (word: string) => word[0].toUpperCase() + word.slice(1);

/** A card's id, by suit and rank. */
export function minorCardId(suit: TarotSuit, rank: MinorCardRank): MinorCardId {
  return `${rank}-${suit}`;
}

function cardOf(suit: TarotSuit, rank: MinorCardRank): MinorCard {
  const kind =
    rank === "ace" ? "ace" : typeof rank === "number" ? "small" : "court";
  const named =
    typeof rank === "number" ? NUMBER_NAMES[rank] : capital(String(rank));
  return Object.freeze({
    id: minorCardId(suit, rank),
    suit,
    rank,
    kind,
    name: `${named} of ${capital(suit)}`,
  });
}

/**
 * The 56 minor cards, suit by suit in the order of `TAROT_SUITS`, each
 * suit's Ace, then 2 to 10, then its King, Queen, Prince and Princess.
 * Frozen.
 */
export const MINOR_CARDS: readonly MinorCard[] = Object.freeze(
  TAROT_SUITS.flatMap((suit) =>
    (["ace", ...SMALL_NUMBERS, ...COURT_RANKS] as const).map((rank) =>
      cardOf(suit, rank),
    ),
  ),
);

const BY_ID: ReadonlyMap<string, MinorCard> = new Map(
  MINOR_CARDS.map((card) => [card.id, card]),
);

/** One card by its id, or nothing for an id that is not a minor card's. */
export function minorCard(id: string): MinorCard | undefined {
  return BY_ID.get(id);
}

/** Whether a string is a minor card's id. */
export function isMinorCardId(id: string): id is MinorCardId {
  return BY_ID.has(id);
}
