import {
  type MinorCardId,
  minorCardId,
  type SmallCardNumber,
  suitOfElement,
} from "../tarot/minorCards.ts";
import type { PlanetId } from "./Planets.ts";
import zodiac, { type ZodiacId } from "./Zodiac.ts";

/**
 * The 36 decans of the zodiac in the Golden Dawn's sequence, computed
 * rather than written out (plan 095, decision 1): each sign's three tens of
 * degrees, each ruled by a planet, the 36 taking the planets in the
 * Chaldean order, Saturn to the Moon, from Mars on the first decan of Aries
 * round to Mars again on the last of Pisces; and each decan's small card,
 * of the suit of the sign's element, 2 to 4 for a cardinal sign, 5 to 7 for
 * a kerubic (fixed) one and 8 to 10 for a mutable one. Regardie, *The
 * Golden Dawn*, vol. 4 (Chicago, 1940), pp.285–286 (archive.org
 * `IsraelRegardie-TheGoldenDawn-Vol4-1940`, leaves n277–n278), and "Liber
 * Chanokh", *The Equinox* I(7) (London, 1912), p.237 (archive.org
 * `crowley-equinox_202110`, "The Equinox Vol. 1, No. 7", leaf n249).
 *
 * The one source for the decans in the package: Lenain's decades of the
 * seventy-two genii (`kabbalah/seventyTwoAngels/derived`) take their
 * planets from here.
 */

/** The seven planets of the decans. */
type DecanPlanet =
  | "saturn"
  | "jupiter"
  | "mars"
  | "sol"
  | "venus"
  | "mercury"
  | "luna";

/** The planets in the Chaldean order, slowest first (vol. 4, p.285). */
export const CHALDEAN_ORDER: readonly (PlanetId & DecanPlanet)[] =
  Object.freeze([
    "saturn",
    "jupiter",
    "mars",
    "sol",
    "venus",
    "mercury",
    "luna",
  ] as const);

/** A decan's planet: one of the seven of the Chaldean order. */
export type DecanPlanetId = (typeof CHALDEAN_ORDER)[number];

/** A decan within its sign, from the sign's first degree. */
export type DecanNumber = 1 | 2 | 3;

/** A decan's id: its sign and its number within it (`aries-1`). */
export type DecanId = `${ZodiacId}-${DecanNumber}`;

/** One decan. */
export interface Decan {
  readonly id: DecanId;
  /** Its place among the 36, from 1 for the first decan of Aries. */
  readonly no: number;
  readonly zodiacId: ZodiacId;
  readonly decan: DecanNumber;
  /** The planet that rules it. */
  readonly planetId: DecanPlanetId;
  /** Its small card (`tarot/minorCards`): `2-swords` for Libra's first. */
  readonly minorCardId: MinorCardId;
}

/** The first small card of a sign's three, by the sign's quality. */
const FIRST_SMALL_CARD: Readonly<
  Record<"cardinal" | "kerubic" | "mutable", 2 | 5 | 8>
> = Object.freeze({ cardinal: 2, kerubic: 5, mutable: 8 });

/** Mars' place in the Chaldean order: the first decan's planet. */
const FIRST_PLANET = CHALDEAN_ORDER.indexOf("mars");

/** The signs from Aries, by their `no`. */
const SIGNS: readonly ZodiacId[] = Object.freeze(
  (Object.keys(zodiac) as ZodiacId[]).sort(
    (a, b) => zodiac[a].no - zodiac[b].no,
  ),
);

/**
 * The 36 decans from the first of Aries to the last of Pisces, frozen.
 */
export const DECANS: readonly Decan[] = Object.freeze(
  SIGNS.flatMap((zodiacId, sign) => {
    const { elementId, quadruplicity } = zodiac[zodiacId];
    const suit = suitOfElement(elementId as "fire" | "water" | "air" | "earth");
    return ([1, 2, 3] as const).map((decan) => {
      const step = sign * 3 + decan - 1;
      return Object.freeze({
        id: `${zodiacId}-${decan}` as DecanId,
        no: step + 1,
        zodiacId,
        decan,
        planetId: CHALDEAN_ORDER[(FIRST_PLANET + step) % CHALDEAN_ORDER.length],
        minorCardId: minorCardId(
          suit,
          (FIRST_SMALL_CARD[quadruplicity] + decan - 1) as SmallCardNumber,
        ),
      });
    });
  }),
);

/** Each sign's three decans, frozen, by the sign. */
const BY_SIGN: ReadonlyMap<ZodiacId, readonly [Decan, Decan, Decan]> = new Map(
  SIGNS.map((zodiacId, sign) => [
    zodiacId,
    Object.freeze(DECANS.slice(sign * 3, sign * 3 + 3)) as unknown as readonly [
      Decan,
      Decan,
      Decan,
    ],
  ]),
);

/** A sign's three decans, in order: the same frozen triple each time. */
export function decansOf(zodiacId: ZodiacId): readonly [Decan, Decan, Decan] {
  const decans = BY_SIGN.get(zodiacId);
  if (!decans) throw new RangeError(`Not a sign: ${zodiacId}`);
  return decans;
}

/** One decan by its id, or nothing for an id that is not a decan's. */
export function decanById(id: string): Decan | undefined {
  return DECANS.find((decan) => decan.id === id);
}
