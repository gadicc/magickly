/**
 * Every study set's id, apart from the sets themselves, so a server page can
 * answer 404 for an unknown id without importing the sets' React components.
 * `sets.tsx` is typed by this list, so the two cannot drift apart.
 */
export const STUDY_SET_IDS = [
  "hebrew-latin",
  "hebrew-name",
  "hebrew-value",
  "hebrew-meaning",
  "planet-signs",
  "zodiac-signs",
  "zodiac-triples",
  "zodiac-quads",
  "alchemy-principals",
  "alchemy-planetary-metals",
  "geomancy-names-translation",
  "geomancy-symbol-names",
  "planets-hebrew-hebrew",
  "planets-hebrew-romanized",
  "planets-archangels-he",
  "sephirot-atziluth-divine-names-he",
  "sephirot-atziluth-divine-names-he-roman",
  "alchemy-basic-terms",
  "elementals-titles",
  "kerubim-face",
  "kerubim-zodiac",
  "four-worlds-desc",
  "four-worlds-residents",
  "ten-heavens",
  "sephirot-stones",
  "enochian-letters-latin",
  "enochian-letter-names",
] as const;

export type StudySetId = (typeof STUDY_SET_IDS)[number];

const ids: ReadonlySet<string> = new Set(STUDY_SET_IDS);

/** Whether `id` names a study set; never true for an `Object.prototype` key. */
export function isStudySetId(id: string): id is StudySetId {
  return ids.has(id);
}
