import type { GdHallSlug } from "@/render/contracts/gdHall";

/**
 * Each temple hall's page in our own words (plan 062, decision 9): a lead
 * on what the hall is and what tells it from its neighbours, and, where
 * the sources disagree, what the preset follows (plan 061, "Where the
 * sources disagree"). Written from the presets and plan 061, never from a
 * book's text; reviewed by Gadi before publication.
 */
export interface HallLead {
  lead: string;
  /** What the preset follows where its sources differ. */
  sources?: string;
}

/** Said of the halls the 1938 diagrams draw without the Chiefs. */
const NO_CHIEFS =
  "The 1938 diagrams draw only the Hierophant on the dais, so the Chiefs are left out of this hall.";

/** Said of both Portal halls (plan 061, conflict 1). */
const PORTAL_SWAP =
  "In the 1938 edition each part of the Portal is headed by the other part's diagram; this hall follows the diagram its own rubric describes.";

export const HALL_LEADS: Record<GdHallSlug, HallLead> = {
  neophyte: {
    lead: "The hall of the Neophyte grade, 0=0, the first ceremony of the Outer Order. The three Chiefs, the Hierophant and the Past Hierophant sit on the dais in the East, the Hiereus faces them from his platform in the West, and the altar stands at the centre with the black and white pillars to the East of it.",
    sources:
      "The Banner of the West stands free on the floor, North-West of the Hiereus' platform, as the 1938 diagram draws it.",
  },
  "zelator-1": {
    lead: "The first part of the Zelator grade, 1=10, with Shin, Tau and Qoph above the East. On the altar lie the Flaming Sword, a red lamp at its East end and the cross in the triangle at its base, and the Earth tablet stands on the North wall between a lantern and the salt.",
    sources:
      "The Earth tablet stands inside the hall on the North wall line, at the size the 1938 diagram draws it, with the lantern to its East and the salt to its West; the Flaming Sword and the red lamp on the altar follow the same diagram.",
  },
  "zelator-2": {
    lead: "The second part of the Zelator grade, 1=10: the altar has moved to the East of the floor, with the Table of Shewbread on the North side of the hall and the Seven-Branched Candlestick on the South. The Earth tablet, the lantern and the salt keep their places on the North wall.",
    sources:
      "The North wall follows the 1938 diagram of the first part; this part's own diagram in the 1938 edition is still to be located.",
  },
  "theoricus-1": {
    lead: "The first part of the Theoricus grade, 2=9: the 32nd path, of Tau, which leads from Malkuth to Yesod. The Universe, the path's trump, lies on the altar, and the Air tablet stands at the edge of the dais with a lantern and the Pantacle, the grade's badge.",
  },
  "theoricus-2": {
    lead: "The Theoricus hall in Yesod, the second part of the 2=9 grade, with Resh, Samekh and Tzaddi above the East and Tau beyond the West. The kamea of the Moon and its seals stand in the East, and the serpent on the Tree of Life East of the altar.",
  },
  "practicus-1": {
    lead: "The first part of the Practicus grade, 3=8: the 31st path, of Shin. Judgement, the path's trump, lies on the altar between two candles, the pillars stand in the North-East, incense burns in the South, and the Hiereus and Hegemon sit in the West, each with a red lamp.",
    sources: NO_CHIEFS,
  },
  "practicus-2": {
    lead: "The second part of the Practicus grade, 3=8: the 30th path, of Resh, laid out as the 31st, with the Sun, the path's trump, on the altar between two candles and the pillars in the North-East.",
    sources: NO_CHIEFS,
  },
  "practicus-3": {
    lead: "The Practicus hall in Hod, the third part of the 3=8 grade, with Mem in the East and the letters of the other paths from Hod on the South and West. Mercury stands on the dais beside the Hierophant's throne, the Garden of Eden on its stand East of the altar between the pillars, and the Hierophant is shown at his first station, West of the altar.",
    sources: NO_CHIEFS,
  },
  "philosophus-1": {
    lead: "The first part of the Philosophus grade, 4=7: the 29th path, of Qoph. Shin, Tau and Qoph run across the East, the Moon lies on the altar between two candles, the Fire tablet stands on the South wall, and each of the three officers has a cup of water.",
    sources:
      "The letters run from the North-East to the South-East: the 1938 diagram draws them across the East and its rubric puts Qoph in the South-East, which agree once the ends of the row are read as the corners.",
  },
  "philosophus-2": {
    lead: "The second part of the Philosophus grade, 4=7: the 28th path, of Tzaddi, laid out as the 29th, with Resh, Samekh and Tzaddi across the East and the Star on the altar.",
    sources:
      "No Tau stands beyond the West: neither the 1938 diagram nor its 1986 reprint has one, only a later redraw.",
  },
  "philosophus-3": {
    lead: "The third part of the Philosophus grade, 4=7: the 27th path, of Peh. The Hierophant sits on the dais, the Hiereus with his banner before it in the North-East and the Hegemon in the South-East, each with a red lamp, and the pillars stand before Peh in the South.",
    sources:
      "The 1938 diagram draws the three officers in a row at the East edge, each with a cup; this hall follows its rubric instead, with the Hierophant on the dais and red lamps, and keeps the diagram's pillars.",
  },
  "philosophus-4": {
    lead: "The Philosophus hall in Netzach, the fourth part of the 4=7 grade, with Caph in the East and Nun, Peh, Tzaddi and Qoph along the North wall. The Fall stands East of the altar, the kamea and seals of Venus are on the dais, and on the altar the cross and triangle have a red lamp at each angle.",
    sources:
      "The pillars stand North and South of the altar, as the rubric says twice, where the 1938 diagram puts them West of it; the dais shows both the kamea and seals of Venus that the diagram names and the symbol of Venus on the Tree of Life that the rubric names.",
  },
  "portal-1": {
    lead: "The first part of the Portal grade, with the letters of the five paths from the Portal across the East of the floor. The Chief Adept stands behind the veil with the brazier and the white altar, the Third and Second Adepts in the North-East and South-East, and the cross of four triangles lies on the altar; the Tablet of Union stands beyond the East wall.",
    sources: PORTAL_SWAP,
  },
  "portal-2": {
    lead: "The second part of the Portal grade: the Second and Third Adepts join the Chief Adept on the dais, the altar under the hanging pentagram holds the four elemental emblems round the Greek cross, and Pan, the Devil, Death and Typhon stand by the North and South walls.",
    sources: PORTAL_SWAP,
  },
};
