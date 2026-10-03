import { describe, expect, it } from "vitest";
import {
  ANGEL_COUNT,
  choirOf,
  dayOfYearOf,
  decadeOf,
  degreesOf,
  governedDaysOf,
  invocationOf,
  monthDayOf,
  planetOf,
  presidingDaysOf,
  signOf,
} from "./seventyTwoAngelsDerived";

/**
 * The expectations here are transcribed from Lenain's own four tables and from
 * the prose of the entries named, so that the derivation is checked against the
 * book rather than against itself. Where the scan and the arithmetic disagree,
 * the disagreement is called out rather than encoded.
 */

const everyAngel = Array.from({ length: ANGEL_COUNT }, (_, i) => i + 1);

describe("days of the year", () => {
  it("round-trips every day of a common year", () => {
    for (let day = 0; day < 365; day++)
      expect(dayOfYearOf(monthDayOf(day))).toBe(day);
  });

  it("knows the months", () => {
    expect(monthDayOf(0)).toEqual([1, 1]);
    expect(monthDayOf(58)).toEqual([2, 28]);
    expect(monthDayOf(59)).toEqual([3, 1]);
    expect(monthDayOf(364)).toEqual([12, 31]);
  });

  it("wraps past the year's end", () => {
    expect(monthDayOf(365)).toEqual([1, 1]);
    expect(monthDayOf(-1)).toEqual([12, 31]);
  });

  it("refuses days that are not in the month", () => {
    expect(() => dayOfYearOf([2, 29])).toThrow(/Not a day of month 2/);
    expect(() => dayOfYearOf([13, 1])).toThrow(/Not a month/);
  });
});

describe("degrees of the sphere", () => {
  it("gives each genius five degrees, as the prose states them", () => {
    // "les cinq premiers degrés", and then entries 2, 17, 25, 42, 64 and 65.
    expect(degreesOf(1)).toEqual({ from: 1, to: 5 });
    expect(degreesOf(2)).toEqual({ from: 6, to: 10 });
    expect(degreesOf(17)).toEqual({ from: 81, to: 85 });
    expect(degreesOf(25)).toEqual({ from: 121, to: 125 });
    expect(degreesOf(42)).toEqual({ from: 206, to: 210 });
    expect(degreesOf(64)).toEqual({ from: 316, to: 320 });
    expect(degreesOf(65)).toEqual({ from: 321, to: 325 });
  });

  it("covers the circle exactly once", () => {
    const covered = everyAngel.flatMap((no) => {
      const { from, to } = degreesOf(no);
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    });
    expect(covered).toEqual(Array.from({ length: 360 }, (_, i) => i + 1));
  });
});

describe("signs and quinances", () => {
  it("starts at the first degree of Aries", () => {
    // "son signe est le bélier" — the first genius.
    expect(signOf(1)).toEqual({
      zodiacId: "aries",
      from: 1,
      to: 5,
      quinance: 1,
    });
  });

  it("gives each sign six genii", () => {
    expect(signOf(6).zodiacId).toBe("aries");
    expect(signOf(6).quinance).toBe(6);
    expect(signOf(7)).toEqual({
      zodiacId: "taurus",
      from: 1,
      to: 5,
      quinance: 1,
    });
    expect(signOf(72)).toEqual({
      zodiacId: "pisces",
      from: 26,
      to: 30,
      quinance: 6,
    });
  });

  it("keeps the sign's degrees inside the sign", () => {
    for (const no of everyAngel) {
      const { from, to } = signOf(no);
      expect(to - from).toBe(4);
      expect(from).toBeGreaterThanOrEqual(1);
      expect(to).toBeLessThanOrEqual(30);
    }
  });
});

describe("the second table: the days each genius governs", () => {
  it("matches the table's opening rows", () => {
    expect(governedDaysOf(1)).toEqual({ from: [3, 20], to: [3, 24] });
    expect(governedDaysOf(2)).toEqual({ from: [3, 25], to: [3, 29] });
    expect(governedDaysOf(3)).toEqual({ from: [3, 30], to: [4, 3] });
    expect(governedDaysOf(4)).toEqual({ from: [4, 4], to: [4, 8] });
    expect(governedDaysOf(5)).toEqual({ from: [4, 9], to: [4, 13] });
    expect(governedDaysOf(6)).toEqual({ from: [4, 14], to: [4, 18] });
  });

  it("ends where the book says it ends", () => {
    // "vous arriverez au 72e génie, qui domine depuis le 10 mars jusqu'au 14".
    expect(governedDaysOf(72)).toEqual({ from: [3, 10], to: [3, 14] });
  });

  it("leaves the five epagomenal days to no genius", () => {
    // "il reste donc cinq jours" — 15 to 19 March, the sacred Pentad.
    const governed = new Set(
      everyAngel.flatMap((no) => {
        const first = dayOfYearOf(governedDaysOf(no).from);
        return Array.from({ length: 5 }, (_, i) => (first + i) % 365);
      }),
    );
    expect(governed.size).toBe(360);
    const ungoverned = Array.from({ length: 365 }, (_, day) => day)
      .filter((day) => !governed.has(day))
      .map(monthDayOf);
    expect(ungoverned).toEqual([
      [3, 15],
      [3, 16],
      [3, 17],
      [3, 18],
      [3, 19],
    ]);
  });

  it("shifts whole for a sidereal reading", () => {
    // Fagan-Bradley puts the first degree of Aries at 15 April.
    expect(governedDaysOf(1, 26)).toEqual({ from: [4, 15], to: [4, 19] });
    expect(governedDaysOf(72, 26)).toEqual({ from: [4, 5], to: [4, 9] });
  });
});

describe("the third table: the days each genius presides over", () => {
  it("matches the rows the table prints in full", () => {
    expect(presidingDaysOf(1)).toEqual([
      [3, 20],
      [5, 31],
      [8, 11],
      [10, 22],
      [1, 2],
    ]);
    expect(presidingDaysOf(2)).toEqual([
      [3, 21],
      [6, 1],
      [8, 12],
      [10, 23],
      [1, 3],
    ]);
    expect(presidingDaysOf(3)).toEqual([
      [3, 22],
      [6, 2],
      [8, 13],
      [10, 24],
      [1, 4],
    ]);
  });

  it("matches the days the entries themselves list", () => {
    expect(presidingDaysOf(17)).toEqual([
      [4, 5],
      [6, 16],
      [8, 27],
      [11, 7],
      [1, 18],
    ]);
    expect(presidingDaysOf(25)).toEqual([
      [4, 13],
      [6, 24],
      [9, 4],
      [11, 15],
      [1, 26],
    ]);
    expect(presidingDaysOf(33)).toEqual([
      [4, 21],
      [7, 2],
      [9, 12],
      [11, 23],
      // The scan reads ".5 février" here, but entries 32 and 34 give 2 and 4
      // February, so the day between them is the 3rd.
      [2, 3],
    ]);
    expect(presidingDaysOf(42)).toEqual([
      [4, 30],
      [7, 11],
      [9, 21],
      [12, 2],
      [2, 12],
    ]);
    expect(presidingDaysOf(57)).toEqual([
      [5, 15],
      [7, 26],
      [10, 6],
      [12, 17],
      [2, 27],
    ]);
    expect(presidingDaysOf(65)).toEqual([
      [5, 23],
      [8, 3],
      [10, 14],
      [12, 25],
      [3, 7],
    ]);
  });

  it("covers every day of the year but the five", () => {
    const presided = everyAngel.flatMap((no) =>
      presidingDaysOf(no).map(dayOfYearOf),
    );
    expect(new Set(presided).size).toBe(360);
  });
});

describe("the fourth table: twenty minutes each", () => {
  it("runs from midnight", () => {
    expect(invocationOf(1)).toEqual({ from: 0, to: 20 });
    expect(invocationOf(2)).toEqual({ from: 20, to: 40 });
    expect(invocationOf(3)).toEqual({ from: 40, to: 60 });
    expect(invocationOf(4)).toEqual({ from: 60, to: 80 });
  });

  it("matches the windows the entries name", () => {
    // 10:40, 13:20, 13:40, 16:00 and 18:40 in entries 33, 41, 42, 49 and 57.
    expect(invocationOf(33).from).toBe(10 * 60 + 40);
    expect(invocationOf(41).from).toBe(13 * 60 + 20);
    expect(invocationOf(42).from).toBe(13 * 60 + 40);
    expect(invocationOf(49).from).toBe(16 * 60);
    expect(invocationOf(57).from).toBe(18 * 60 + 40);
  });

  it("fills the day exactly", () => {
    expect(invocationOf(72)).toEqual({ from: 1420, to: 1440 });
  });
});

describe("the sacred calendar's decades", () => {
  it("gives each decade two genii", () => {
    expect(decadeOf(1)).toBe(1);
    expect(decadeOf(2)).toBe(1);
    expect(decadeOf(3)).toBe(2);
    expect(decadeOf(72)).toBe(36);
  });

  it("matches the decades the entries name", () => {
    expect(decadeOf(17)).toBe(9);
    expect(decadeOf(25)).toBe(13);
    expect(decadeOf(41)).toBe(21);
    expect(decadeOf(42)).toBe(21);
    expect(decadeOf(49)).toBe(25);
    expect(decadeOf(64)).toBe(32);
    expect(decadeOf(65)).toBe(33);
  });

  it("descends the Chaldean order from Mars", () => {
    // The calendar's own sequence: Mars, Sun, Venus, Mercury, Moon, Saturn,
    // Jupiter, then Mars again for the eighth decade.
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((d) => planetOf(d * 2 - 1))).toEqual([
      "mars",
      "sol",
      "venus",
      "mercury",
      "luna",
      "saturn",
      "jupiter",
      "mars",
    ]);
  });

  it("matches the planets the entries name", () => {
    expect(planetOf(1)).toBe("mars"); // "sous l'influence de Mars"
    expect(planetOf(17)).toBe("sol"); // decade 9, "du Soleil"
    expect(planetOf(25)).toBe("saturn"); // decade 13, "de Saturne"
    expect(planetOf(33)).toBe("venus"); // decade 17, "de Vénus"
    expect(planetOf(41)).toBe("jupiter"); // decade 21, "de Jupiter"
    expect(planetOf(49)).toBe("mercury"); // decade 25, "de Mercure"
    expect(planetOf(65)).toBe("luna"); // decade 33, "de la Lune"
  });
});

describe("the nine choirs", () => {
  it("opens each choir where the book declares it", () => {
    // Lenain announces a choir in the entry that opens it. The first eight
    // declarations fall on 1, 9, 17, 25, 33, 41, 49 and 57 — eight apiece.
    for (const [no, choir] of [
      [1, 1],
      [9, 2],
      [17, 3],
      [25, 4],
      [33, 5],
      [41, 6],
      [49, 7],
      [57, 8],
    ]) {
      expect(choirOf(no)).toBe(choir);
      if (no > 1) expect(choirOf(no - 1)).toBe(choir - 1);
    }
  });

  it("gives all nine choirs eight genii", () => {
    // The book's own last two declarations disagree with its pattern: entry 57
    // ends the archangels "jusqu'au 63e", and entry 64 — not 65 — opens the
    // angels "jusqu'au 72e", which would be seven then nine. Both numbers
    // corroborate each other, so it is Lenain's arithmetic rather than the
    // scan; the pattern his first eight declarations set is followed instead,
    // as Agrippa and Kircher also have it. See plan 031.
    const sizes = new Map<number, number>();
    for (const no of everyAngel)
      sizes.set(choirOf(no), (sizes.get(choirOf(no)) ?? 0) + 1);
    expect([...sizes.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...sizes.values()]).toEqual(Array(9).fill(8));
  });
});

describe("the bounds", () => {
  it("refuses anything that is not one of the seventy-two", () => {
    for (const derive of [
      degreesOf,
      signOf,
      governedDaysOf,
      presidingDaysOf,
      invocationOf,
      decadeOf,
      planetOf,
      choirOf,
    ]) {
      expect(() => derive(0)).toThrow(/Not one of the 72 angels/);
      expect(() => derive(73)).toThrow(/Not one of the 72 angels/);
      expect(() => derive(1.5)).toThrow(/Not one of the 72 angels/);
    }
  });
});
