import { describe, expect, it } from "vitest";
import type { SigilLayout } from "../types.ts";
import { checkInvariants } from "./invariants.ts";
import { KNOWN_GOOD, MUTANTS, scrambleSvg } from "./mutants.ts";
import { checkReadBack } from "./readBack.ts";

const judge = (
  svg: string,
  plan: Parameters<typeof checkInvariants>[1],
  layout: SigilLayout<string> | SigilLayout<number>,
) => {
  const caught: ("O2" | "O3")[] = [];
  if (checkInvariants(svg, plan, layout).length) caught.push("O2");
  if (!checkReadBack(svg, plan, layout).ok) caught.push("O3");
  return caught;
};

describe("the oracle's known-good figures", () => {
  for (const { id, figure } of KNOWN_GOOD)
    it(`passes ${id}, however its commands are written`, () => {
      const { svg, plan, layout } = figure();
      expect(checkInvariants(svg, plan, layout)).toEqual([]);
      expect(checkReadBack(svg, plan, layout).failures).toEqual([]);
      for (const seed of [1, 2])
        expect(judge(scrambleSvg(svg, seed), plan, layout)).toEqual([]);
    });
});

describe("the oracle's mutants", () => {
  for (const { id, caughtBy, figure } of MUTANTS)
    it(`catches ${id} with ${caughtBy.join(" and ")}`, () => {
      const { svg, plan, layout } = figure();
      expect(judge(svg, plan, layout)).toEqual(caughtBy);
      expect(judge(scrambleSvg(svg, 3), plan, layout)).toEqual(caughtBy);
    });
});
