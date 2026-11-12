import { describe, expect, it } from "vitest";
import rows, { type EnochianLetter } from "./Letters.ts";

const letters: EnochianLetter[] = Object.values(rows);

/**
 * These are read from the printed Golden Dawn papers, not from Schueler's
 * *Enochian Magic* (1985), which the file used to follow and which differs
 * for several of them. Do not "fix" them back.
 */
describe("the Enochian letters", () => {
  it("give the Golden Dawn's geomantic figure for sixteen letters", () => {
    // Regardie, The Golden Dawn, vol. 4 (1940), "Talismans", p.77 (leaf
    // n71), its glyphs read against the alphabet on p.299 (leaf n291). C, D,
    // H, Q and X have no figure there.
    const figures = Object.fromEntries(
      letters.map((letter) => [letter.id, letter.tetragramId ?? null]),
    );
    expect(figures).toEqual({
      A: "amissio",
      B: "puer",
      C: null,
      D: null,
      E: "albus",
      F: "cauda_draconis",
      G: "fortuna_major",
      H: null,
      I: "acquisitio",
      L: "via",
      M: "tristitia",
      N: "rubeus",
      O: "puella",
      P: "populus",
      Q: null,
      R: "laetitia",
      S: "conjunctio",
      T: "caput_draconis",
      V: "carcer",
      X: null,
      Z: "fortuna_minor",
    });
  });

  it("name six letters differently in the two traditions", () => {
    // `gd`: the Order's table in Regardie, vol. 4, p.299 (leaf n291);
    // `dee`: the action of 26 March 1583 (Sloane MS 3188). The other
    // fifteen names agree.
    const differ = letters
      .filter((letter) => letter.names.gd !== letter.names.dee)
      .map((letter) => [letter.id, letter.names.gd, letter.names.dee]);
    expect(differ).toEqual([
      ["B", "Pe", "Pa"],
      ["F", "Orth", "Or"],
      ["H", "Na-hath", "Na"],
      ["N", "Drun", "Drux"],
      ["T", "Gisa", "Gisg"],
      ["V", "Vau", "Van"],
    ]);
  });
});
