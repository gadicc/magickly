/**
 * The grades in which some officers wear a lamen other than their Outer
 * Order one (plan 061, stage H, part 2). In the Portal, Regardie's rubric
 * gives the Hiereus and the Hegemon lamens of their own (*The Golden
 * Dawn*, vol. 2, Aries Press, 1938, p. 156; archive.org
 * `IsraelRegardie-TheGoldenDawn-Vol2-1938`, leaf n149). A hall says which
 * with an officer's `grade`; the ritual role icons always show the Outer
 * Order's. Kept apart from `Lamen`, so the hall's validator can read it
 * without the drawings.
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
