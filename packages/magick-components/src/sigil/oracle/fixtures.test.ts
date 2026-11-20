import kameas from "magick-data/astrology/kameas";
import { describe, expect, it } from "vitest";
import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "../../gd/roseSigilLayout.ts";
import { KAMEA_SIGIL_PROFILE, kameaLayout } from "../kameaLayout.ts";
import type { PlaceId, Point, SigilLayout } from "../types.ts";
import { HAND_FIXTURES, KAMEA_FIXTURES } from "./fixtures.ts";
import { figureFactFailures } from "./fixturesFacts.ts";
import { referencePlan, referenceWords } from "./referencePlan.ts";

const gd = roseSigilLayout("gd");
const tolerance = ROSE_SIGIL_PROFILE.nooseTolerance;

/** `layout` with every anchor moved by `move`. */
function moved<Token>(
  layout: SigilLayout<Token>,
  move: (point: Point, place: PlaceId) => Point,
): SigilLayout<Token> {
  return { ...layout, anchor: (place) => move(layout.anchor(place), place) };
}

/** The fixtures whose figures `layout` does not reproduce. */
function failing(layout: SigilLayout<string>): string[] {
  return HAND_FIXTURES.filter(
    (fixture) => figureFactFailures(fixture, layout, tolerance).length > 0,
  ).map((fixture) => fixture.id);
}

describe("hand fixtures", () => {
  it("cover every row of plan 088's fixtures table", () => {
    expect(HAND_FIXTURES.map((fixture) => fixture.text)).toEqual([
      "מטטרון",
      "אלהים",
      "בינה",
      "יהוה",
      "יהוה אלהים",
      "צפקיאל",
      "אראלים",
      "שבתי",
      "יוד הא ואו הא",
      "אגיאל",
      "זאזל",
    ]);
  });

  it.each(HAND_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    "%s: the reference plans it as encoded",
    (_, fixture) => {
      expect(
        referencePlan(referenceWords(fixture.text), gd, ROSE_SIGIL_PROFILE),
      ).toEqual(fixture.plan);
    },
  );

  it.each(HAND_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    "%s: the gd rose's anchors turn, head and cross as the figure does",
    (_, fixture) => {
      expect(figureFactFailures(fixture, gd, tolerance)).toEqual([]);
    },
  );

  it("fail on a mirrored rose", () => {
    const mirrored = moved(gd, ({ x, y }) => ({ x: -x, y }));
    // Every fixture with a left or right turn turns the other way.
    expect(failing(mirrored)).toEqual(
      HAND_FIXTURES.filter((fixture) =>
        fixture.figure.some((word) =>
          word.turns.some((turn) => turn === "left" || turn === "right"),
        ),
      ).map((fixture) => fixture.id),
    );
  });

  it("fail on a rose turned upside down, which keeps every turn", () => {
    const turned = moved(gd, ({ x, y }) => ({ x: -x, y: -y }));
    expect(failing(turned)).toEqual(HAND_FIXTURES.map((fixture) => fixture.id));
  });

  it("tell Regardie's 1939 rose from the GD's by Shabbathai alone (R7)", () => {
    expect(failing(roseSigilLayout("regardie1939"))).toEqual(["shabbathai"]);
  });

  it("catch every exchange of two letters they use but three", () => {
    const letters = [
      ...new Set(
        HAND_FIXTURES.flatMap((fixture) =>
          fixture.plan.flatMap((word) => word.map((vertex) => vertex.place)),
        ),
      ),
    ];
    const missed: string[] = [];
    for (let i = 0; i < letters.length; i++) {
      for (let j = i + 1; j < letters.length; j++) {
        const [a, b] = [letters[i], letters[j]];
        const swapped = moved(gd, (point, place) =>
          place === a ? gd.anchor(b) : place === b ? gd.anchor(a) : point,
        );
        if (failing(swapped).length === 0) missed.push(a + b);
      }
    }
    // 150 of the 153 exchanges fail. Mem and Beth, Nun and Gimel, and
    // Peh and Zayin lie 10 to 20 units apart on one side of the rose, and
    // no figure's turns, headings, crossings or passes depend on which is
    // which (Tzaphqiel's pass by Kaph would catch the last, but the figure
    // cannot tell Kaph's place from Tau's on Regardie's rose).
    expect(missed).toEqual(["מב", "נג", "פז"]);
  });
});

describe("kamea fixtures", () => {
  it.each(KAMEA_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    "%s: the reference plans it as encoded, its letters on the text's cells",
    (_, fixture) => {
      const layout = kameaLayout(fixture.planet);
      expect(
        referencePlan(
          referenceWords(fixture.text),
          layout,
          KAMEA_SIGIL_PROFILE,
        ),
      ).toEqual(fixture.plan);
      // The letters reduce to the numbers the text gives.
      const cellOf = (n: number) => {
        const square = kameas[fixture.planet];
        const row = square.findIndex((cells) => cells.includes(n));
        return `${row},${square[row].indexOf(n)}`;
      };
      expect([...fixture.text].map((c) => layout.place(c))).toEqual(
        fixture.numbers.map(cellOf),
      );
    },
  );

  it.each(KAMEA_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    "%s: the square's cells turn and head as the figure does",
    (_, fixture) => {
      const layout = kameaLayout(fixture.planet);
      expect(
        figureFactFailures(fixture, layout, KAMEA_SIGIL_PROFILE.nooseTolerance),
      ).toEqual([]);
    },
  );

  it("fail on a mirrored square", () => {
    for (const fixture of KAMEA_FIXTURES) {
      const layout = kameaLayout(fixture.planet);
      const mirrored = moved(layout, ({ x, y }) => ({ x: -x, y }));
      expect(
        figureFactFailures(
          fixture,
          mirrored,
          KAMEA_SIGIL_PROFILE.nooseTolerance,
        ),
      ).not.toEqual([]);
    }
  });
});
