import type { HallArt } from "../types";
import {
  ITEM_DETAIL,
  ITEM_OUTLINE,
  original,
  PALETTE,
  sameForEveryNode,
} from "./shared";

export const gongProvenance = original(
  "A gong on its frame, drawn from geometry: two posts and a bar, the " +
    "disc hanging from two cords, its rings and boss.",
);
export const brazierProvenance = original(
  "A brazier drawn from geometry: a bowl on three legs with flames.",
);
export const candleProvenance = original(
  "A candle on a candlestick, drawn from geometry, its flame lit.",
);

/** Every art module exports its provenance; these three share a module. */
export const provenance = [gongProvenance, brazierProvenance, candleProvenance];

const ink = PALETTE.ink;

/** A gong (`item(kind="gong")`), the Portal's, 100 × 100. */
export const gongArt: HallArt = {
  Component: () => (
    <>
      <path
        d="M-40,46V-42M40,46V-42M-46,-42H46M-48,46H-32M32,46H48"
        stroke={ink}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M-12,-42L-10,-25M12,-42L10,-25"
        stroke={ink}
        strokeWidth={ITEM_DETAIL}
        fill="none"
      />
      <circle
        cy={4}
        r={30}
        fill={PALETTE.bronze}
        stroke={ink}
        strokeWidth={ITEM_OUTLINE.strokeWidth}
      />
      <circle
        cy={4}
        r={20}
        fill="none"
        stroke={ink}
        strokeWidth={ITEM_DETAIL}
      />
      <circle
        cy={4}
        r={8}
        fill={PALETTE.gold}
        stroke={ink}
        strokeWidth={ITEM_DETAIL}
      />
    </>
  ),
  box: { width: 100, height: 100 },
  variant: sameForEveryNode,
  provenance: gongProvenance,
};

/** Three tongues of flame, outer red and inner yellow. */
const FLAMES = [
  [-22, 0.8],
  [0, 1],
  [22, 0.8],
] as const;

/** A brazier (`item(kind="brazier")`): a bowl of fire on legs, 100 × 100. */
export const brazierArt: HallArt = {
  Component: () => (
    <>
      <path
        d="M-26,14L-34,46M0,20V46M26,14L34,46"
        stroke={ink}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {FLAMES.map(([x, k]) => (
        <g key={x} transform={`translate(${x} -8) scale(${k})`}>
          <path
            d="M0,-42C14,-24 14,-8 0,0C-14,-8 -14,-24 0,-42Z"
            fill={PALETTE.fire}
            stroke={ink}
            strokeWidth={ITEM_DETAIL}
          />
          <path
            d="M0,-24C7,-14 7,-6 0,-2C-7,-6 -7,-14 0,-24Z"
            fill={PALETTE.flame}
          />
        </g>
      ))}
      <path
        d="M-44,-8H44A44,28 0 0 1 -44,-8Z"
        fill={PALETTE.bronze}
        {...ITEM_OUTLINE}
      />
    </>
  ),
  box: { width: 100, height: 100 },
  variant: sameForEveryNode,
  provenance: brazierProvenance,
};

/** A candle (`item(kind="candle")`) on its stick, 40 × 100. */
export const candleArt: HallArt = {
  Component: () => (
    <>
      <rect
        x={-18}
        y={40}
        width={36}
        height={8}
        fill={PALETTE.bronze}
        stroke={ink}
        strokeWidth={ITEM_OUTLINE.strokeWidth}
      />
      <rect
        x={-11}
        y={30}
        width={22}
        height={10}
        fill={PALETTE.bronze}
        stroke={ink}
        strokeWidth={ITEM_OUTLINE.strokeWidth}
      />
      <rect
        x={-7}
        y={-22}
        width={14}
        height={52}
        fill={PALETTE.wax}
        stroke={ink}
        strokeWidth={ITEM_OUTLINE.strokeWidth}
      />
      <path d="M0,-22V-28" stroke={ink} strokeWidth={ITEM_DETAIL} />
      <path
        d="M0,-50C8,-38 7,-30 0,-27C-7,-30 -8,-38 0,-50Z"
        fill={PALETTE.flame}
        stroke={PALETTE.fire}
        strokeWidth={ITEM_DETAIL}
      />
    </>
  ),
  box: { width: 40, height: 100 },
  variant: sameForEveryNode,
  provenance: candleProvenance,
};
