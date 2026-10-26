/**
 * The grades in which some officers wear a lamen other than their Outer
 * Order one (plan 061, stage H, part 2). In the Portal, Regardie's rubric
 * gives the Hiereus and the Hegemon lamens of their own (*The Golden
 * Dawn*, vol. 2, Aries Press, 1938, p. 156; archive.org
 * `IsraelRegardie-TheGoldenDawn-Vol2-1938`, leaf n149). A hall says which
 * with an officer's `grade`; the ritual role icons always show the Outer
 * Order's. Kept apart from `Lamen`, so the hall's validator can read it
 * without the drawings.
 *
 * The adepts' Portal lamens are drawn without a grade, being the only
 * ones they have here. A 5=6 grade, if added, would give the Adepts the
 * Rose-Cross instead. The Chief's is stated (Regardie 1938, vol. 2,
 * p.202, leaf n195, and p.220, n213, where in the Pastos it hangs from a
 * double Phoenix collar); the Second's and Third's are inferred, not in
 * the 5=6 rubric: every Adept wears it at all meetings of Adepts (vol. 3,
 * p.51, n44, on a yellow collarette), and the Third touches his own
 * (vol. 2, p.254, n248). The Portal's triangle-in-pentagram and
 * cup-on-octagram belong to the Portal only (plan 061, stage H, part 2,
 * follow-ups).
 */
export const LAMEN_GRADES = ["portal"] as const;
export type LamenGrade = (typeof LAMEN_GRADES)[number];

/** Each grade as the editor and its messages name it. */
export const LAMEN_GRADE_NAMES: ReadonlyMap<LamenGrade, string> = new Map([
  ["portal", "Portal"],
]);

/** The officers with a lamen of their own in each grade. */
const GRADE_OFFICERS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["portal", new Set(["hiereus", "hegemon"])],
]);

/** Whether `officer` wears a lamen of its own in `grade` (both untrusted). */
export function hasGradeLamen(officer: string, grade: string): boolean {
  return GRADE_OFFICERS.get(grade)?.has(officer) ?? false;
}

/** The officers with a lamen of their own in any grade. */
export const GRADE_LAMEN_OFFICERS: ReadonlySet<string> = new Set(
  [...GRADE_OFFICERS.values()].flatMap((officers) => [...officers]),
);
