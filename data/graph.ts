/**
 * How the tables relate, declared once (plan 032, decision 2).
 *
 * Every id-shaped field in every table appears here as a `link`, or as
 * `pending`, `external` or `enum` — the check in
 * [integrity.test.ts](./integrity.test.ts) fails on one that does not, which
 * is what turns a typo such as `archangelIdId` into a build failure.
 * [assemble.ts](./assemble.ts) makes an accessor for each link, and
 * [types.ts](./types.ts) derives the row types from this literal and the JSON
 * together.
 *
 * Naming carries arity (decision 3): `fooId` gives the accessor `foo`,
 * `fooIds` gives `foos`. A nested field is its full dotted path, and its
 * accessor lands at the same depth. Optionality is never declared: it comes
 * from the data, where a missing link is an absent key or `null`.
 *
 * The build also emits this as `data/dist/graph.json`, for a reader that is
 * not TypeScript.
 */
import type { GraphSpec } from "./graphSpec";

export const graph = {
  // ASTROLOGY
  planet: {
    links: {
      // Singular, so the check proves one planet per letter: the seven double
      // letters carry a planet each, and no two planets share one.
      hebrewLetterId: { to: "hebrewLetter", inverse: "planet" },
      godNameId: { to: "godName" },
      archangelId: { to: "archangel", mirrors: "planetId" },
    },
    // The planetary spirits and intelligences have no table of their own; a
    // tetragram's rulers are the same namespace as `spiritId` (deferred).
    pending: { intelligenceId: "intelligence", spiritId: "spirit" },
  },
  zodiac: {
    links: {
      planetId: { to: "planet", inverse: "zodiacs", inverseMany: true },
      elementId: { to: "element", inverse: "zodiacs", inverseMany: true },
      tribeOfIsraelId: { to: "tribeOfIsrael" },
    },
  },
  house: {
    links: { zodiacId: { to: "zodiac" } },
  },

  hebrewLetter: {},

  // ENOCHIAN
  enochianLetter: {
    external: {
      // Three namespaces in one field — `taurus`, `fire`, `Cauda Draonis` —
      // which the format cannot express; a polymorphic `to` is deferred.
      "planet/element": "polymorphic",
      // The trump by name, where a path of the Tree names it by rank.
      tarot: "tarot-deck",
    },
  },
  enochianTablet: {},

  // GEOMANCY
  tetragram: {
    links: {
      zodiacId: { to: "zodiac" },
      elementId: { to: "element", inverse: "tetragrams", inverseMany: true },
      planetIds: {
        to: "planet",
        many: true,
        inverse: "tetragrams",
        inverseMany: true,
      },
    },
    pending: { rulerIds: "spirit" },
  },
  geomanicHouse: {},

  // GOLDEN DAWN
  gdGrade: {
    links: {
      elementId: { to: "element" },
      // Singular, so the check proves one grade per planet: no two grades
      // are attributed to the same one.
      planetId: { to: "planet", inverse: "gdGrade" },
      sephirahId: { to: "sephirah", mirrors: "gdGradeId" },
      degreeId: { to: "gdDegree" },
      nextId: { to: "gdGrade", mirrors: "prevId" },
      prevId: { to: "gdGrade", mirrors: "nextId" },
    },
    // Which of the three orders a grade belongs to, not a row anywhere.
    enum: { orderId: ["1st", "2nd", "3rd"] },
  },
  gdDegree: {
    pending: { pillarId: "pillar" },
  },

  // KABBALAH
  archangel: {
    links: {
      planetId: { to: "planet", mirrors: "archangelId" },
      sephirahId: { to: "sephirah", mirrors: "archangelId" },
    },
  },
  angelicOrder: {},
  christianChoir: {},
  fourWorlds: {},
  godName: {},
  kerub: {
    links: {
      zodiacId: { to: "zodiac" },
      elementId: { to: "element" },
    },
  },
  sephirah: {
    links: {
      chakraId: { to: "chakra" },
      godNameId: { to: "godName" },
      planetId: { to: "planet", inverse: "sephirot", inverseMany: true },
      archangelId: { to: "archangel", mirrors: "sephirahId" },
      soulId: { to: "soul" },
      angelicOrderId: { to: "angelicOrder" },
      gdGradeId: { to: "gdGrade", mirrors: "sephirahId" },
      nextId: { to: "sephirah", mirrors: "prevId" },
      prevId: { to: "sephirah", mirrors: "nextId" },
    },
  },
  tolPath: {
    links: {
      // Singular, so the check proves one path per letter on each tree: the
      // twenty-two letters are dealt to the paths once in each attribution.
      "hermetic.hebrewLetterId": {
        to: "hebrewLetter",
        inverse: "hermeticPath",
      },
      "hebrew.hebrewLetterId": { to: "hebrewLetter", inverse: "hebrewPath" },
      // The two spheres a path joins, in the order its id spells them, which
      // the integrity check holds the id to. One pair serves both trees.
      fromId: { to: "sephirah", inverse: "pathsFrom", inverseMany: true },
      toId: { to: "sephirah", inverse: "pathsTo", inverseMany: true },
      nextId: { to: "tolPath", mirrors: "prevId" },
      prevId: { to: "tolPath", mirrors: "nextId" },
    },
    // The trump by rank; the deck is its own package.
    external: { "hermetic.tarotId": "tarot-deck" },
  },
  soul: {},
  tribeOfIsrael: {},
  seventyTwoAngel: {},

  chakra: {},

  // ALCHEMY
  alchemySymbol: {
    // Singular, so the check proves one metal per planet: only the seven
    // metals carry a planet, and no two of them the same one.
    links: { planetId: { to: "planet", inverse: "alchemySymbol" } },
  },
  alchemyTerm: {},
  element: {
    links: { elementalId: { to: "elemental", mirrors: "elementId" } },
  },
  elemental: {
    links: { elementId: { to: "element", mirrors: "elementalId" } },
  },
} as const satisfies GraphSpec;

export type Graph = typeof graph;

export default graph;
