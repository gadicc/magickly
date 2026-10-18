import type { HallArt } from "../types";
import { original, PALETTE, sameForEveryNode } from "./shared";

export const provenance = original(
  "A plain circle standing in for an officer's lamen; the app injects the " +
    "lamens themselves.",
);

/** The fallback lamen: a labelled circle (the officer adds the label). */
export const lamenFallbackArt: HallArt = {
  Component: () => (
    <circle r={47} fill={PALETTE.paper} stroke={PALETTE.ink} strokeWidth={6} />
  ),
  box: { width: 100, height: 100 },
  // Inset in its cell like every lamen (layout.ts, DEFAULT_SCALES).
  inset: 0.8,
  variant: sameForEveryNode,
  provenance,
};
