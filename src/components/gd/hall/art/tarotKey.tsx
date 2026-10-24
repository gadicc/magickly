import hebrewLetters, { type HebrewLetter } from "magick-data/hebrewLetters";
import paths, { type Path } from "magick-data/kabbalah/paths";
import { specNumberAttr } from "../attributes";
import { GD_HALL_FONT_STACKS } from "../fonts";
import { LINE_HEIGHT, wrapText } from "../labels";
import type { HallArt, HallArtProps, HallAttrSpec } from "../types";
import { original, PALETTE, variantOf } from "./shared";

export const provenance = original(
  "A simplified tarot trump drawn from geometry: a framed card with its " +
    "Roman numeral, its Hebrew letter and its title, all from " +
    "magick-data's Hermetic paths. Stands in for the RWS card the " +
    "Theoricus drawing pasted onto the altar.",
);

/** What a trump's card shows. */
interface Trump {
  numeral: string;
  letter: string;
  title: string;
}

const ROMAN: readonly [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** A trump's number as the cards write it: 0, I … XXI. */
export function romanNumeral(n: number): string {
  if (n === 0) return "0";
  let rest = n;
  let out = "";
  for (const [value, numeral] of ROMAN)
    while (rest >= value) {
      out += numeral;
      rest -= value;
    }
  return out;
}

const letters = hebrewLetters as Record<string, HebrewLetter>;

/** The 22 trumps by number, from the paths they belong to. */
export const TRUMPS: ReadonlyMap<number, Trump> = new Map(
  Object.values(paths as Record<string, Path>).flatMap((path) => {
    const hermetic = path.hermetic;
    if (!hermetic) return [];
    const n = Number(hermetic.tarotId);
    return [
      [
        n,
        {
          numeral: romanNumeral(n),
          letter: letters[hermetic.hebrewLetterId].letter.he,
          title: hermetic.tarotTitle,
        },
      ] as const,
    ];
  }),
);

/** `n`: a trump's number, clamped and rounded as the validator warns. */
const N_SPEC = {
  kind: "number",
  min: 0,
  max: 21,
  integer: true,
} as const satisfies HallAttrSpec;

/** The card's box, in units; a trump's proportions. */
export const CARD_BOX = { width: 58, height: 100 } as const;
const { width: WIDTH, height: HEIGHT } = CARD_BOX;
const TITLE_SIZE = 7;
const TITLE_WIDTH = 46;

/** The card's frame: a rounded white card and an inner rule. */
export function CardFrame() {
  return (
    <>
      <rect
        x={-WIDTH / 2 + 1}
        y={-HEIGHT / 2 + 1}
        width={WIDTH - 2}
        height={HEIGHT - 2}
        rx={4}
        fill={PALETTE.paper}
        stroke={PALETTE.ink}
        strokeWidth={1.6}
      />
      <rect
        x={-WIDTH / 2 + 5}
        y={-HEIGHT / 2 + 5}
        width={WIDTH - 10}
        height={HEIGHT - 10}
        fill="none"
        stroke={PALETTE.ink}
        strokeWidth={0.6}
      />
    </>
  );
}

/** A card's numeral, at the top. */
export function CardNumeral({ numeral }: { numeral: string }) {
  return (
    <text
      y={-31}
      fontSize={11}
      fontFamily={GD_HALL_FONT_STACKS.serif}
      fontStyle="italic"
    >
      {numeral}
    </text>
  );
}

/** A card's title, wrapped, its last line 40 units below the centre. */
export function CardTitle({ title }: { title: string }) {
  const lines = wrapText(title, TITLE_WIDTH, TITLE_SIZE);
  const advance = TITLE_SIZE * LINE_HEIGHT;
  const first = 40 - (lines.length - 1) * advance;
  return lines.map((line, index) => (
    <text
      // biome-ignore lint/suspicious/noArrayIndexKey: lines keep their order
      key={index}
      y={first + index * advance}
      fontSize={TITLE_SIZE}
      fontFamily={GD_HALL_FONT_STACKS.serif}
      fontStyle="italic"
      style={{ fontVariantLigatures: "none", fontKerning: "normal" }}
    >
      {line.text}
    </text>
  ));
}

function TarotKey({ node }: HallArtProps) {
  const n = specNumberAttr(node, "n", N_SPEC);
  const trump = n === undefined ? undefined : TRUMPS.get(n);
  return (
    <>
      <CardFrame />
      {trump && (
        <g fill={PALETTE.ink} textAnchor="middle">
          <CardNumeral numeral={trump.numeral} />
          <text
            y={12}
            fontSize={36}
            fontFamily={GD_HALL_FONT_STACKS.hebrew}
            fontWeight={700}
          >
            {trump.letter}
          </text>
          <CardTitle title={trump.title} />
        </g>
      )}
    </>
  );
}

/**
 * A tarot trump (`tarotKey(n=21)`), 58 × 100: an original simplified card.
 * `n` is clamped to 0–21 and rounded; a card without a number is blank.
 */
export const tarotKeyArt: HallArt = {
  Component: TarotKey,
  box: CARD_BOX,
  attributes: new Map([["n", N_SPEC]]),
  // One of 22 cards or a blank one: at most 23 drawings in a hall.
  variant: (node) => variantOf(specNumberAttr(node, "n", N_SPEC)),
  provenance,
};
