import { describe, expect, it } from "vitest";
import paths, { type Path } from "./Paths.ts";

describe("the trumps' titles on the paths", () => {
  const trumps = Object.values(paths).flatMap((path: Path) =>
    path.hermetic ? [path.hermetic] : [],
  );

  it("names each of the 22 trumps once, by its Golden Dawn title", () => {
    const byNumber = new Map(
      trumps.map((trump) => [Number(trump.tarotId), trump.tarotTitle]),
    );
    expect([...byNumber.keys()].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 22 }, (_, n) => n),
    );
    expect(new Set(byNumber.values()).size).toBe(22);
    expect(byNumber.get(0)).toBe("The Fool");
    expect(byNumber.get(8)).toBe("Strength");
    expect(byNumber.get(11)).toBe("Justice");
    expect(byNumber.get(21)).toBe("The Universe");
  });

  it("puts Strength on Teth and Justice on Lamed", () => {
    const on = (letter: string) =>
      trumps.find((trump) => trump.hebrewLetterId === letter)?.tarotTitle;
    expect(on("tet")).toBe("Strength");
    expect(on("lamed")).toBe("Justice");
    expect(on("tav")).toBe("The Universe");
  });
});
