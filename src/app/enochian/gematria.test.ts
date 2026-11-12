import dictionary from "magick-data/enochian/dictionary";
import { describe, expect, it } from "vitest";
import { GEMATRIA_SOURCE } from "./gematria";

describe("the dictionary's gematria", () => {
  const withGematria = Object.entries(dictionary).filter(
    ([, entry]) => entry.gematria.length > 0,
  );

  it("is there to label", () => {
    expect(withGematria.length).toBeGreaterThan(0);
  });

  // The pages name every value as Schueler's, so a value from another
  // source would need its own label first. The data records no source per
  // value, so this checks the entry: one that cites EMPM nowhere cannot
  // have its gematria from him.
  it("comes only with entries that cite Schueler", () => {
    const uncited = withGematria
      .filter(
        ([, entry]) =>
          !entry.meanings.some(
            (one) =>
              one.source === GEMATRIA_SOURCE || one.source2 === GEMATRIA_SOURCE,
          ) &&
          !entry.pronounciations.some((one) => one.source === GEMATRIA_SOURCE),
      )
      .map(([word]) => word);
    expect(uncited).toEqual([]);
  });
});
