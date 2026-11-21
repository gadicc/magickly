import {
  KAMEA_SIGIL_PROFILE,
  kameaLayout,
} from "magick-components/sigil/kameaLayout";
import { placeSigilWords } from "magick-components/sigil/placeSigil";
import { planSigil, sigilWords } from "magick-components/sigil/planSigil";
import { KAMEA_PLANETS } from "magick-data/astrology/kameas";
import { describe, expect, it } from "vitest";
import { DEFAULT_KAMEA_SIGIL, kameaSigilKey } from "./kameaSigilState";
import { kameaSigilNames } from "./names";
import { NAMES_NEEDING_FALLBACK, serverSeed } from "./serverSeed";

describe("the figures the server draws into the generator's HTML", () => {
  it("lists exactly the names placement's search leaves to the fallback", () => {
    // Every names-list spelling, both finals modes, placed as the
    // generator places it: clean when every word clears with no fallback
    // work.
    const needing = new Set<string>();
    for (const planet of KAMEA_PLANETS)
      for (const name of kameaSigilNames(planet))
        for (const finals of [false, true]) {
          const layout = kameaLayout(planet, { finals });
          const words = placeSigilWords(
            planSigil(sigilWords(name.he), layout, KAMEA_SIGIL_PROFILE),
            layout,
            KAMEA_SIGIL_PROFILE,
          );
          if (
            !words.every(
              (word) => word.failures.length === 0 && !word.fallbackWork,
            )
          )
            needing.add(kameaSigilKey(planet, name.he, finals));
        }
    expect([...needing].sort()).toEqual([...NAMES_NEEDING_FALLBACK].sort());
  }, 60_000);

  it("seeds the default and a clearing name, never a fallback or a free text", () => {
    expect(serverSeed(DEFAULT_KAMEA_SIGIL)).toMatchObject({
      ...DEFAULT_KAMEA_SIGIL,
      failed: false,
    });
    expect(
      serverSeed({ planet: "mercury", text: "תפתרתרת", finals: false }),
    ).toMatchObject({ text: "תפתרתרת", failed: false });
    expect(
      serverSeed({
        planet: "luna",
        text: "מלכא בתרשישים ועד ברוח שחקים",
        finals: true,
      }),
    ).toBeNull();
    expect(
      serverSeed({
        planet: "luna",
        text: "מלכאבתרשיסים עד ברוהשהקים",
        finals: false,
      }),
    ).toBeNull();
    // A name on another planet's list, and a text on no list.
    expect(
      serverSeed({ planet: "luna", text: "אגיאל", finals: false }),
    ).toBeNull();
    expect(
      serverSeed({ planet: "saturn", text: "גדי", finals: false }),
    ).toBeNull();
    expect(
      serverSeed({ planet: "saturn", text: "", finals: false }),
    ).toBeNull();
  });
});
