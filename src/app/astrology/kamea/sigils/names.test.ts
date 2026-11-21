import { describe, expect, it } from "vitest";
import { canonicalKameaSigilText } from "@/render/contracts/kameaSigil";
import { kameaSigilNames } from "./names";
import { reduceOnKamea } from "./reduction";

describe("the names the generator offers", () => {
  it("lists each planet's names in their traced spelling first", () => {
    const saturn = kameaSigilNames("saturn");
    expect(saturn.find((name) => name.id === "agiel")).toEqual({
      id: "agiel",
      roman: "Agiel",
      he: "אגיאל",
    });
    expect(saturn.map((name) => name.id)).toContain("zazel");
    // Only Saturn's.
    expect(saturn.map((name) => name.id)).not.toContain("hismael");
  });

  it("adds another witness's spelling where it traces differently", () => {
    const jupiter = kameaSigilNames("jupiter");
    expect(jupiter.filter((name) => name.id === "iophiel")).toEqual([
      { id: "iophiel", roman: "Iophiel", he: "יהפיאל" },
      { id: "iophiel", roman: "Iophiel", he: "יופיל", witness: "crowley777" },
    ]);
    // 777's Malcha, the spelling that does not clear with finals.
    expect(
      kameaSigilNames("luna").some(
        (name) =>
          name.he === "מלכא בתרשישים ועד ברוח שחקים" &&
          name.witness === "crowley777",
      ),
    ).toBe(true);
    // Shelachel has no witness, so nothing to trace.
    expect(
      kameaSigilNames("luna").some((name) => name.id === "shelachel"),
    ).toBe(false);
  });

  it("offers only what the image contract takes", () => {
    for (const planet of [
      "saturn",
      "jupiter",
      "mars",
      "sol",
      "venus",
      "mercury",
      "luna",
    ] as const)
      for (const name of kameaSigilNames(planet))
        expect(canonicalKameaSigilText(name.he), name.he).toBe(name.he);
  });
});

describe("the reduction table", () => {
  it("keeps what the square has and divides the rest by ten (vol. 4, n73)", () => {
    // Zazel on Saturn's square: 7, 1, 7, and Lamed's 30 as 3.
    expect(reduceOnKamea("saturn", "זאזל", false)).toEqual([
      [
        { letter: "ז", value: 7, cell: 7 },
        { letter: "א", value: 1, cell: 1 },
        { letter: "ז", value: 7, cell: 7 },
        { letter: "ל", value: 30, cell: 3 },
      ],
    ]);
    // Taphthartharath on Mercury's: 400 as 40, 80 as 8, 200 as 20.
    expect(
      reduceOnKamea("mercury", "תפתרתרת", false)[0].map((each) => each.cell),
    ).toEqual([40, 8, 40, 20, 40, 20, 40]);
  });

  it("counts a final at 500 to 900 only with finals, word by word", () => {
    expect(reduceOnKamea("venus", "בני שרפים", false)[1].at(-1)).toEqual({
      letter: "ם",
      value: 40,
      cell: 40,
    });
    expect(reduceOnKamea("venus", "בני שרפים", true)[1].at(-1)).toEqual({
      letter: "ם",
      value: 600,
      cell: 6,
    });
    expect(reduceOnKamea("luna", "אלים", true)[0].at(-1)?.cell).toBe(60);
    // Anything else is left out, as the sigil leaves it out.
    expect(reduceOnKamea("saturn", " אָב x ", false)).toEqual([
      [
        { letter: "א", value: 1, cell: 1 },
        { letter: "ב", value: 2, cell: 2 },
      ],
    ]);
    expect(reduceOnKamea("saturn", "", false)).toEqual([]);
  });
});
