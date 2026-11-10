import SunCalc from "suncalc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calcPlanetaryHoursForDayAndLocation,
  chaldean,
  DAY_IN_MS,
  formatFromTo,
  hourEnd,
  type PlanetaryDay,
  upcomingHoursForPlanetAtLocation,
} from "./utils";

vi.mock("suncalc", () => ({
  default: { getTimes: vi.fn(), getPosition: vi.fn() },
}));

const geo = { latitude: 51.5074, longitude: -0.1278 };
const dayRulers = [
  "sol",
  "luna",
  "mars",
  "mercury",
  "jupiter",
  "venus",
  "saturn",
];

beforeEach(() => {
  vi.mocked(SunCalc.getTimes).mockReset();
  vi.mocked(SunCalc.getPosition).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

function regularSolarDay(date: Date) {
  const day = date.toISOString().slice(0, 10);
  return {
    sunrise: new Date(`${day}T06:00:00Z`),
    solarNoon: new Date(`${day}T12:00:00Z`),
    sunset: new Date(`${day}T18:00:00Z`),
  };
}

/** SunCalc's answer inside the polar circles: no sunrise or sunset. */
function polarSolarDay(date: Date) {
  return {
    ...regularSolarDay(date),
    sunrise: new Date(NaN),
    sunset: new Date(NaN),
  };
}

function withHours(day: PlanetaryDay) {
  if (day.kind !== "hours") throw new Error(`expected hours, got ${day.kind}`);
  return day;
}

describe("planetary hours used by astrology and geomancy", () => {
  it("keeps minute truncation and separate sunrise/sunset anchors", () => {
    const date = new Date("2024-03-20T12:00:00Z");
    const sunrise = new Date("2024-03-20T06:01:59.900Z");
    const sunset = new Date("2024-03-20T18:02:00.100Z");
    const solarNoon = new Date("2024-03-20T12:02:00Z");
    vi.mocked(SunCalc.getTimes)
      .mockReturnValueOnce({ sunrise, solarNoon, sunset })
      .mockReturnValueOnce({ sunrise: new Date("2024-03-21T06:03:00.300Z") });

    const day = withHours(calcPlanetaryHoursForDayAndLocation(date, geo));
    const hours = day.hours;
    expect(hours).toHaveLength(24);
    expect(day.meta).toEqual({
      sunrise,
      sunset,
      dayHourInMinutes: 60,
      nightHourInMinutes: 721 / 12,
    });
    expect(hours[0].date).toEqual(sunrise);
    expect(hours[11].date).toEqual(new Date("2024-03-20T17:01:59.900Z"));
    expect(hours[12].date).toEqual(sunset);
    expect(hours[23].date).toEqual(new Date("2024-03-21T05:02:55.100Z"));
    expect(SunCalc.getTimes).toHaveBeenNthCalledWith(
      1,
      date,
      geo.latitude,
      geo.longitude,
    );
    expect(SunCalc.getTimes).toHaveBeenNthCalledWith(
      2,
      new Date("2024-03-21T12:00:00Z"),
      geo.latitude,
      geo.longitude,
    );
  });

  it.each([
    [2024, 2, 17, "sol"],
    [2024, 2, 18, "luna"],
    [2024, 2, 19, "mars"],
    [2024, 2, 20, "mercury"],
    [2024, 2, 21, "jupiter"],
    [2024, 2, 22, "venus"],
    [2024, 2, 23, "saturn"],
  ] as const)(
    "starts the solar day %s/%s/%s at the place with %s",
    (year, month, day, ruler) => {
      const date = new Date(Date.UTC(year, month, day, 12));
      vi.mocked(SunCalc.getTimes).mockImplementation(regularSolarDay);
      const { hours, solarDate } = withHours(
        calcPlanetaryHoursForDayAndLocation(date, geo),
      );
      expect(solarDate).toEqual(new Date(year, month, day));
      expect(hours[0].planet).toBe(ruler);
      expect(hours[7].planet).toBe(ruler);
      expect(hours[14].planet).toBe(ruler);
      expect(hours[21].planet).toBe(ruler);
    },
  );

  it("continues the Chaldean cycle through sunset", () => {
    vi.mocked(SunCalc.getTimes).mockImplementation(regularSolarDay);
    const { hours } = withHours(
      calcPlanetaryHoursForDayAndLocation(
        new Date(Date.UTC(2024, 2, 20, 12)),
        geo,
      ),
    );
    expect(hours.slice(0, 7).map((hour) => hour.planet)).toEqual([
      "mercury",
      "luna",
      "saturn",
      "jupiter",
      "mars",
      "sol",
      "venus",
    ]);
    expect(hours.slice(10, 15).map((hour) => hour.planet)).toEqual([
      "jupiter",
      "mars",
      "sol",
      "venus",
      "mercury",
    ]);
  });

  it.each([
    "2024-03-30T12:00:00Z",
    "2024-10-26T12:00:00Z",
    "2024-03-09T12:00:00Z",
    "2024-11-02T12:00:00Z",
  ])("preserves the existing 24-hour next-day lookup across DST: %s", (iso) => {
    const date = new Date(iso);
    vi.mocked(SunCalc.getTimes).mockImplementation(regularSolarDay);
    calcPlanetaryHoursForDayAndLocation(date, geo);
    const nextDate = vi.mocked(SunCalc.getTimes).mock.calls[1][0];
    expect(nextDate.getTime() - date.getTime()).toBe(DAY_IN_MS);
  });

  it("returns only future occurrences in the existing seven-day window", () => {
    const now = new Date("2024-03-20T06:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.mocked(SunCalc.getTimes).mockImplementation(regularSolarDay);
    const hours = upcomingHoursForPlanetAtLocation(
      dayRulers[now.getDay()],
      geo,
    );
    expect(hours).toHaveLength(23);
    expect(hours[0]).toEqual({
      from: new Date("2024-03-20T13:00:00Z"),
      to: new Date("2024-03-20T14:00:00Z"),
    });
    expect(hours.at(-1)?.from.getTime()).toBe(
      now.getTime() + 161 * 60 * 60 * 1000,
    );
    for (const hour of hours) {
      expect(hour.from.getTime()).toBeGreaterThan(now.getTime());
      expect(hour.to.getTime() - hour.from.getTime()).toBe(60 * 60 * 1000);
    }
  });

  it("keeps local display labels and the current 12-hour notation", () => {
    expect(
      formatFromTo(new Date(2024, 2, 20, 13, 5), new Date(2024, 2, 20, 14, 10)),
    ).toBe("Wed Mar 20th 1:05 - 2:10 pm");
  });

  it("counts the night still running after solar midnight", () => {
    // 02:00 by the Sun: the nearest solar day is the coming Wednesday, but
    // Tuesday's night has hours left, and Mars rules Tuesday's 22nd hour.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2024-03-20T02:00:00Z"));
    vi.mocked(SunCalc.getTimes).mockImplementation(regularSolarDay);
    const hours = upcomingHoursForPlanetAtLocation("mars", geo);
    expect(hours[0]).toEqual({
      from: new Date("2024-03-20T03:00:00Z"),
      to: new Date("2024-03-20T04:00:00Z"),
    });
    // Then Wednesday's (Mercury's) fifth hour.
    expect(hours[1].from).toEqual(new Date("2024-03-20T10:00:00Z"));
  });

  it.each([
    [-0.1, "polarNight"],
    [0.3, "midnightSun"],
  ] as const)(
    "tells a day the sun stays on one side of the horizon (noon altitude %s rad) as %s",
    (altitude, kind) => {
      const date = new Date("2026-12-01T12:00:00Z");
      vi.mocked(SunCalc.getTimes).mockImplementation(polarSolarDay);
      vi.mocked(SunCalc.getPosition).mockReturnValue({ altitude });
      expect(calcPlanetaryHoursForDayAndLocation(date, geo)).toEqual({
        kind,
        solarDate: new Date(2026, 11, 1),
      });
      expect(SunCalc.getPosition).toHaveBeenCalledWith(
        new Date("2026-12-01T12:00:00Z"),
        geo.latitude,
        geo.longitude,
      );
      // Only today's times were needed.
      expect(SunCalc.getTimes).toHaveBeenCalledTimes(1);
    },
  );

  it("gives only the day hours when the next day has no sunrise to end the night", () => {
    vi.mocked(SunCalc.getTimes)
      .mockImplementationOnce(regularSolarDay)
      .mockImplementationOnce(polarSolarDay);
    const day = withHours(
      calcPlanetaryHoursForDayAndLocation(
        new Date("2026-11-27T12:00:00Z"),
        geo,
      ),
    );
    expect(day.hours).toHaveLength(12);
    expect(day.meta.nightHourInMinutes).toBeNull();
    expect(hourEnd(day, 11)).toEqual(new Date("2026-11-27T18:00:00Z"));
    expect(() => hourEnd({ ...day, hours: new Array(24) }, 12)).toThrow(
      RangeError,
    );
  });

  it("skips days and nights without hours in the upcoming list", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T00:00:00Z"));
    // The 25th, 26th and 27th have hours; the night of the 27th has no end
    // and from the 28th the sun does not rise.
    vi.mocked(SunCalc.getTimes).mockImplementation((date: Date) =>
      date < new Date("2026-11-28T00:00:00Z")
        ? regularSolarDay(date)
        : polarSolarDay(date),
    );
    vi.mocked(SunCalc.getPosition).mockReturnValue({ altitude: -0.1 });
    const hours = chaldean.flatMap((planet) =>
      upcomingHoursForPlanetAtLocation(planet, geo),
    );
    // The 24th's night hours that begin after midnight (01:00 to 05:00), all
    // 24 of the 25th and 26th, and the 27th's 12 day hours.
    expect(hours).toHaveLength(5 + 24 + 24 + 12);
    for (const { from, to } of hours) {
      expect(Number.isNaN(from.getTime())).toBe(false);
      expect(Number.isNaN(to.getTime())).toBe(false);
      expect(from < new Date("2026-11-27T18:00:00Z")).toBe(true);
      expect(() => formatFromTo(from, to)).not.toThrow();
    }
  });
});
