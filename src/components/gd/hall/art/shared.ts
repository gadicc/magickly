import type { HallArtProvenance } from "../types";

/** Provenance of art drawn for this package from geometry. */
export function original(notes: string): HallArtProvenance {
  return {
    origin: "original",
    author: "Gadi Cohen (the gdHall package)",
    licence: "MIT",
    notes,
  };
}

/** `HallArt.variant` for art that draws every node alike. */
export const sameForEveryNode = (): string => "";

/** `HallArt.variant` from the normalised values a drawing reads. */
export const variantOf = (
  ...values: readonly (string | number | boolean | undefined)[]
): string => JSON.stringify(values);

/** The hall's palette (plan 061, decision 13: light only for now). */
export const PALETTE = {
  ink: "#000000",
  paper: "#ffffff",
  checkerLight: "#f9f9f9",
  checkerDark: "#ececec",
  rim: "#cccccc",
  glow: "#ff0000",
  bannerDark: "#252524",
  bannerLightFrom: "#e0e0e0",
  bannerLightTo: "#ffffff",
  knob: "#ffe600",
  tassel: "#d92128",
  gold: "#fae513",
  water: "#406ab3",
  fire: "#d92128",
  tau: "#f9f9f9",
  placeholder: "#888888",
  veil: "#c8b8e0",
  veilPleat: "#7a64a0",
  bronze: "#b08d3c",
  flame: "#ff9a1f",
  wax: "#fffbe8",
} as const;
