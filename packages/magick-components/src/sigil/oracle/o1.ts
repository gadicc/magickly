/**
 * O1, expected plans (plan 088): a planner against the plans written by
 * hand (the primary fixtures, the templates, and vol. 4's two kamea
 * examples and the grid's templates, plan 093), and
 * against the reference planner over the 72 names and, when asked, every
 * two- and three-letter text on both roses. The hand plans catch a rule
 * misread in the list itself, which the reference, written from the same
 * list, would share; the reference catches what no hand case happens to
 * reach.
 */

import type { RoseVersionId } from "../../gd/roseSigilInternals.ts";
import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "../../gd/roseSigilLayout.ts";
import { KAMEA_SIGIL_PROFILE, kameaLayout } from "../kameaLayout.ts";
import type { SigilLayout, SigilPlan, SigilProfile } from "../types.ts";
import {
  CORPUS_ROSE_VERSIONS,
  roseTexts,
  SEVENTY_TWO_NAMES,
} from "./corpus.ts";
import { HAND_FIXTURES, KAMEA_FIXTURES } from "./fixtures.ts";
import { KAMEA_TEMPLATES } from "./kameaTemplates.ts";
import { referencePlan, referenceWords } from "./referencePlan.ts";
import { PLAN_TEMPLATES } from "./templates.ts";

/** A planner with the reference's signature: words of tokens to a plan. */
export type Planner = <Token>(
  words: readonly (readonly Token[])[],
  layout: SigilLayout<Token>,
  profile: SigilProfile,
) => SigilPlan;

/** Where an expected plan came from. */
export type O1Source =
  | "fixture"
  | "template"
  | "kamea"
  | "kamea-template"
  | "names"
  | "pairs"
  | "triples";

/** One case where the planner's plan is not the expected one. */
export interface O1Mismatch {
  source: O1Source;
  id: string;
  /** The rose's version, for rose cases. */
  version?: RoseVersionId;
  /** The text. */
  input: string;
  /** The first difference, in words: "word 0, vertex 1: crooks 0, expected 1". */
  difference: string;
  expected: SigilPlan;
  /** The planner's plan, or undefined when it threw. */
  actual?: SigilPlan;
}

export interface O1Options {
  /** Compare with the reference over the 72 names (default true). */
  names?: boolean;
  /** Compare with the reference over all pairs and triples on both roses (default false). */
  exhaustive?: boolean;
  /**
   * How a text becomes words of characters for the planner under test;
   * the reference's split (whitespace) unless given, so a planner that
   * splits for itself is held to the whitespace templates.
   */
  split?: (text: string) => string[][];
}

/** The first way `actual` differs from `expected`, or null if it does not. */
export function firstDifference(
  expected: SigilPlan,
  actual: SigilPlan,
): string | null {
  if (!Array.isArray(actual)) return `not a plan: ${JSON.stringify(actual)}`;
  if (actual.length !== expected.length)
    return `${actual.length} words, expected ${expected.length}`;
  for (let w = 0; w < expected.length; w++) {
    const want = expected[w];
    const got = actual[w];
    if (got.length !== want.length)
      return `word ${w}: ${got.length} vertices, expected ${want.length}`;
    for (let i = 0; i < want.length; i++) {
      const a = got[i];
      const e = want[i];
      const where = `word ${w}, vertex ${i}`;
      if (a.place !== e.place)
        return `${where}: place ${a.place}, expected ${e.place}`;
      if (a.visit !== e.visit)
        return `${where}: visit ${a.visit}, expected ${e.visit}`;
      if (a.crooks !== e.crooks)
        return `${where}: crooks ${a.crooks}, expected ${e.crooks}`;
      const marks = (a.marks ?? []).join(",");
      if (marks !== e.marks.join(","))
        return `${where}: marks [${marks}], expected [${e.marks.join(",")}]`;
      const extra = Object.keys(a).filter(
        (key) => !["place", "visit", "crooks", "marks"].includes(key),
      );
      if (extra.length > 0) return `${where}: unexpected ${extra.join(", ")}`;
    }
  }
  return null;
}

/** Every case where `planner` disagrees with an expected plan. */
export function checkPlanner(
  planner: Planner,
  options: O1Options = {},
): O1Mismatch[] {
  const { names = true, exhaustive = false, split = referenceWords } = options;
  const mismatches: O1Mismatch[] = [];

  function compare<Token>(
    source: O1Source,
    id: string,
    input: string,
    words: Token[][],
    layout: SigilLayout<Token>,
    profile: SigilProfile,
    expected: SigilPlan,
    version?: RoseVersionId,
  ) {
    let actual: SigilPlan | undefined;
    let difference: string | null;
    try {
      actual = planner(words, layout, profile);
      difference = firstDifference(expected, actual);
    } catch (error) {
      difference = `threw: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (difference !== null)
      mismatches.push({
        source,
        id,
        version,
        input,
        difference,
        expected,
        actual,
      });
  }

  const roses = Object.fromEntries(
    CORPUS_ROSE_VERSIONS.map((version) => [version, roseSigilLayout(version)]),
  ) as Record<RoseVersionId, SigilLayout<string>>;

  for (const fixture of HAND_FIXTURES)
    compare(
      "fixture",
      fixture.id,
      fixture.text,
      split(fixture.text),
      roses.gd,
      ROSE_SIGIL_PROFILE,
      fixture.plan,
      "gd",
    );

  for (const template of PLAN_TEMPLATES)
    compare(
      "template",
      template.id,
      template.text,
      split(template.text),
      roses[template.version],
      ROSE_SIGIL_PROFILE,
      template.plan,
      template.version,
    );

  for (const fixture of KAMEA_FIXTURES)
    compare(
      "kamea",
      fixture.id,
      fixture.text,
      split(fixture.text),
      kameaLayout(fixture.planet),
      KAMEA_SIGIL_PROFILE,
      fixture.plan,
    );

  for (const template of KAMEA_TEMPLATES)
    compare(
      "kamea-template",
      template.id,
      template.text,
      split(template.text),
      kameaLayout(template.planet),
      KAMEA_SIGIL_PROFILE,
      template.plan,
    );

  const againstReference = (
    source: O1Source,
    id: string,
    text: string,
    version: RoseVersionId,
  ) =>
    compare(
      source,
      id,
      text,
      split(text),
      roses[version],
      ROSE_SIGIL_PROFILE,
      referencePlan(referenceWords(text), roses[version], ROSE_SIGIL_PROFILE),
      version,
    );

  if (names)
    for (const name of SEVENTY_TWO_NAMES)
      for (const version of CORPUS_ROSE_VERSIONS)
        againstReference("names", name.id, name.text, version);

  if (exhaustive)
    for (const version of CORPUS_ROSE_VERSIONS) {
      for (const text of roseTexts(2, version))
        againstReference("pairs", text, text, version);
      for (const text of roseTexts(3, version))
        againstReference("triples", text, text, version);
    }

  return mismatches;
}
