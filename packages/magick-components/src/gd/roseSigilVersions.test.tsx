import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoseSigilImage } from "./RoseSigilImage.tsx";
import {
  DEFAULT_ROSE_VERSION,
  letterPoint,
  ROSE_LETTERS,
  ROSE_VERSION_NOTES,
  ROSE_VERSIONS,
  type RoseVersionId,
  roseRings,
  roseVersion,
  sigilPoints,
} from "./roseSigilGeometry.ts";
import { pathFromPoints, roseLetters } from "./roseSigilInternals.ts";
import { optimizeSigilPoints } from "./roseSigilOptimizer.ts";

const KAPH = "כ";
const TAV = "ת";
const LETTERS = ROSE_LETTERS.flat();

/** The connecting path of `text` on a version's rose, unoptimised. */
const path = (text: string, version?: RoseVersionId) =>
  pathFromPoints({
    points: sigilPoints(text, version),
    sigilTokens: roseLetters(text),
  });

/** Every word of one to three of the 22 letters. */
function* words() {
  for (const a of LETTERS) {
    yield a;
    for (const b of LETTERS) {
      yield a + b;
      for (const c of LETTERS) yield a + b + c;
    }
  }
}

describe("the rose's versions", () => {
  it("are the Golden Dawn's by default, and Regardie's of 1939", () => {
    expect(ROSE_VERSIONS).toEqual(["gd", "regardie1939"]);
    expect(DEFAULT_ROSE_VERSION).toBe("gd");
    expect(roseVersion()).toBe("gd");
    expect(roseVersion("regardie1939")).toBe("regardie1939");
    // Anything else is the default, as for the tablets' versions.
    expect(roseVersion("regardie")).toBe("gd");
    expect(roseRings()).toBe(ROSE_LETTERS);
    expect(roseRings("gd")).toBe(ROSE_LETTERS);
    expect(roseRings("nonsense")).toBe(ROSE_LETTERS);
  });

  it("differ only in Kaph and Tau, which exchange places", () => {
    const gd = roseRings("gd");
    const regardie = roseRings("regardie1939");
    expect(gd[1].slice(-3)).toEqual(["ג", TAV, KAPH]);
    expect(regardie[1].slice(-3)).toEqual(["ג", KAPH, TAV]);
    expect(regardie[0]).toBe(gd[0]);
    expect(regardie[2]).toBe(gd[2]);
    for (const letter of LETTERS) {
      const swapped =
        letter === KAPH ? TAV : letter === TAV ? KAPH : (letter as string);
      expect(letterPoint(letter, "regardie1939")).toEqual(
        letterPoint(swapped, "gd"),
      );
    }
    // Kaph lies to the right and Tau above it on Regardie's rose.
    const kaph = letterPoint(KAPH, "regardie1939");
    const tav = letterPoint(TAV, "regardie1939");
    expect(kaph.x).toBeGreaterThan(tav.x);
    expect(tav.y).toBeLessThan(kaph.y);
  });

  it("change exactly the sigils that pass through Kaph or Tau", () => {
    let changed = 0;
    let same = 0;
    for (const text of words()) {
      const through = text.includes(KAPH) || text.includes(TAV);
      const differs = path(text, "regardie1939") !== path(text, "gd");
      expect(differs, text).toBe(through);
      if (through) changed++;
      else same++;
    }
    expect(changed + same).toBe(22 + 22 ** 2 + 22 ** 3);
    // A final Kaph is Kaph on the rose.
    expect(path("מלך", "regardie1939")).not.toBe(path("מלך", "gd"));
  });

  it("draw a name without Kaph or Tau identically, optimised too", async () => {
    const name = "אדני";
    const draw = (version?: RoseVersionId, showRose = false) =>
      renderToStaticMarkup(
        <RoseSigilImage
          text={name}
          showRose={showRose}
          version={version}
          points={sigilPoints(name, version)}
        />,
      );
    expect(draw("regardie1939")).toBe(draw("gd"));
    expect(draw("regardie1939")).toBe(draw());
    expect(
      await optimizeSigilPoints(sigilPoints(name, "regardie1939")),
    ).toEqual(await optimizeSigilPoints(sigilPoints(name, "gd")));
    // With the rose behind it only the two letters' labels move.
    const labels = (html: string) =>
      [...html.matchAll(/<text x="([^"]*)" y="([^"]*)"[^>]*>(.)<\/text>/g)].map(
        ([, x, y, letter]) => `${letter}@${x},${y}`,
      );
    const gd = labels(draw("gd", true));
    const regardie = labels(draw("regardie1939", true));
    expect(gd).toHaveLength(22);
    expect(regardie.filter((label) => !gd.includes(label)).sort()).toEqual(
      gd
        .filter((label) => !regardie.includes(label))
        .map((label) =>
          label.startsWith(KAPH) ? TAV + label.slice(1) : KAPH + label.slice(1),
        )
        .sort(),
    );
  });

  it("draw a name through Tau on its own rose", async () => {
    const name = "שבתאי";
    const gd = await optimizeSigilPoints(sigilPoints(name, "gd"));
    const regardie = await optimizeSigilPoints(
      sigilPoints(name, "regardie1939"),
    );
    expect(regardie).not.toEqual(gd);
    const draw = (version: RoseVersionId, points: typeof gd) =>
      renderToStaticMarkup(
        <RoseSigilImage text={name} version={version} points={points} />,
      );
    expect(draw("regardie1939", regardie)).not.toBe(draw("gd", gd));
  });

  it("draw the default's markup when no version is given", () => {
    for (const text of ["גדי", "שלום", "מלכות", "אבגדהוזחטיכלמנסעפצקרשת"])
      for (const showRose of [true, false])
        for (const debug of [true, false]) {
          const draw = (version?: RoseVersionId) =>
            renderToStaticMarkup(
              <RoseSigilImage
                text={text}
                showRose={showRose}
                debug={debug}
                version={version}
                points={sigilPoints(text, version)}
              />,
            );
          expect(draw("gd")).toBe(draw());
        }
  });

  it("have a note each, with a title and sources", () => {
    expect(Object.keys(ROSE_VERSION_NOTES)).toEqual([...ROSE_VERSIONS]);
    expect(ROSE_VERSION_NOTES.gd.title).toBe("Golden Dawn (Equinox 1910)");
    expect(ROSE_VERSION_NOTES.regardie1939.title).toBe("Regardie 1939");
    for (const version of ROSE_VERSIONS) {
      const note = ROSE_VERSION_NOTES[version];
      expect(note.id).toBe(version);
      expect(note.text.length).toBeGreaterThan(100);
      expect(note.sources.length).toBeGreaterThan(0);
      for (const source of note.sources)
        expect(source.url).toMatch(
          /^https:\/\/archive\.org\/details\/[\w-]+(\/[^/]+)?\/page\/n\d+$/,
        );
    }
    expect(ROSE_VERSION_NOTES.gd.sources[0].url).toBe(
      "https://archive.org/details/crowley-equinox_202110/The%20Equinox%20Vol.%201%2C%20No.%203/page/n220",
    );
  });
});
