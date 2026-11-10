import dictionary from "magick-data/enochian/dictionary";
import keys, { aethyrs } from "magick-data/enochian/keys";
import { describe, expect, it } from "vitest";
import { buildKeyUses, CONTEXT, countUses } from "./keyUses";

const uses = buildKeyUses();

describe("buildKeyUses (plan 074, decision 9)", () => {
  it("files every use under a dictionary word", () => {
    for (const word of Object.keys(uses))
      expect(Object.hasOwn(dictionary, word)).toBe(true);
  });

  it("gives each use its row's English and some context", () => {
    const [first] = uses.OLPIRT;
    expect(first).toMatchObject({ key: 18, english: "light," });
    expect(first.before.length).toBeGreaterThan(0);
  });

  it("counts a Key 19 row once, not once per Aethyr", () => {
    for (const list of Object.values(uses)) {
      const ids = list.map((use) => `${use.key}:${use.row}:${use.aethyr}`);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const key19 = Object.values(uses)
      .flat()
      .filter((use) => use.key === 19 && use.aethyr === undefined);
    const rows = keys.find((key) => key.key === 19)?.rows.length ?? 0;
    expect(key19.length).toBeLessThanOrEqual(rows * 2);
  });

  it("names the Aethyr for each use of Key 19's slot", () => {
    const slot = Object.values(uses)
      .flat()
      .filter((use) => use.aethyr !== undefined);
    expect(slot.length).toBe(aethyrs.length);
    expect(uses.LIL?.[0]).toMatchObject({ key: 19, aethyr: 1 });
  });

  it("gives each part of a split word the compound's row", () => {
    const nor = uses.NOR?.find((use) => use.part);
    expect(nor?.part?.startsWith("NOR")).toBe(true);
    const rest = nor?.part?.slice(3) ?? "";
    expect(
      Object.values(uses)
        .flat()
        .some((use) => use.part === nor?.part && use !== nor),
    ).toBe(rest.length > 0);
  });

  it("keeps context to a few rows", () => {
    for (const use of Object.values(uses).flat()) {
      expect(use.before.split(" ").length).toBeLessThan(CONTEXT * 12);
      expect(use.after.split(" ").length).toBeLessThan(CONTEXT * 12);
    }
  });

  it("counts uses per word", () => {
    const counts = countUses(uses);
    expect(counts.OLPIRT).toBe(uses.OLPIRT.length);
    expect(counts.MAD).toBeGreaterThan(counts.ASCHA ?? 0);
  });
});
