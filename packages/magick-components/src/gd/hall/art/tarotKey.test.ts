import { describe, expect, it, vi } from "vitest";

describe("the trumps", () => {
  it("name each trump's letter", async () => {
    const { TRUMPS } = await import("./tarotKey");
    expect(TRUMPS.size).toBe(22);
    for (const trump of TRUMPS.values())
      expect(trump.letter).toMatch(/^[א-ת]$/);
  });

  it("fail a trump's drawing, not the module, when its letter is missing", async () => {
    vi.resetModules();
    vi.doMock("magick-data/hebrewLetters", () => ({ default: {} }));
    const { TRUMPS } = await import("./tarotKey");
    const universe = TRUMPS.get(21);
    expect(universe?.title).toBe("The Universe");
    expect(() => universe?.letter).toThrow(/^Trump 21: no Hebrew letter "/);
    vi.doUnmock("magick-data/hebrewLetters");
    vi.resetModules();
  });
});
