import { format, getDay } from "date-fns";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  calcPlanetaryHoursForDayAndLocation,
  chaldean,
  DAY_IN_MS,
  formatFromTo,
  hourEnd,
  type PlanetaryDay,
  upcomingHoursForPlanetAtLocation,
} from "./utils";

/**
 * The planetary hours at real places, with SunCalc itself (utils.test.ts
 * mocks it): far places seen from a device in London, and days inside the
 * polar circles on which the sun does not rise or does not set (plan 072,
 * review findings 1 and 2).
 */

const london = { latitude: 51.5074, longitude: -0.1278 };
const tokyo = { latitude: 35.69, longitude: 139.69 };
const honolulu = { latitude: 21.31, longitude: -157.86 };
const auckland = { latitude: -36.85, longitude: 174.76 };
const tromso = { latitude: 69.65, longitude: 18.96 };
// Past the date line: both keep UTC+13 at about 172° and 175° west, so
// their calendar is a day ahead of their longitude's.
const apia = {
  latitude: -13.833,
  longitude: -171.767,
  timezone: "Pacific/Apia",
};
const nukualofa = {
  latitude: -21.139,
  longitude: -175.204,
  timezone: "Pacific/Tongatapu",
};
const murmansk = { latitude: 68.97, longitude: 33.08 };

// The device is in London: Node reads TZ again when it is assigned.
const deviceZone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Europe/London";
});
afterAll(() => {
  if (deviceZone === undefined) delete process.env.TZ;
  else process.env.TZ = deviceZone;
});
afterEach(() => {
  vi.useRealTimers();
});

function withHours(day: PlanetaryDay) {
  if (day.kind !== "hours") throw new Error(`expected hours, got ${day.kind}`);
  return day;
}

describe("the planet of the day at a far place", () => {
  it("runs with the device in London", () => {
    // GMT in November: 20:00 UTC is 20:00 on the device's clock.
    expect(new Date("2026-11-09T20:00:00Z").getHours()).toBe(20);
  });

  it("gives Tokyo's Tuesday sunrise Tuesday's rulers on Monday evening in London", () => {
    const date = new Date("2026-11-09T20:00:00Z"); // Monday 20:00 in London
    expect(getDay(date)).toBe(1); // the device's Monday, which ruled before
    const day = withHours(calcPlanetaryHoursForDayAndLocation(date, tokyo));
    // Tokyo's sunrise on Tuesday 10 November is about 06:12 JST.
    expect(day.meta.sunrise.toISOString()).toMatch(/^2026-11-09T21:/);
    expect(format(day.solarDate, "cccc d LLL")).toBe("Tuesday 10 Nov");
    expect(day.hours[0].planet).toBe("mars");
  });

  it("gives Honolulu's Sunday sunrise Sunday's rulers on Monday morning in London", () => {
    const date = new Date("2026-11-09T10:00:00Z"); // Monday 10:00 in London
    expect(getDay(date)).toBe(1);
    const day = withHours(calcPlanetaryHoursForDayAndLocation(date, honolulu));
    // Honolulu's sunrise on Sunday 8 November is about 06:40 HST.
    expect(day.meta.sunrise.toISOString()).toMatch(/^2026-11-08T16:/);
    expect(format(day.solarDate, "cccc d LLL")).toBe("Sunday 8 Nov");
    expect(day.hours[0].planet).toBe("sol");
  });

  it("leaves London's own day as it was", () => {
    const date = new Date("2026-11-09T20:00:00Z");
    const day = withHours(calcPlanetaryHoursForDayAndLocation(date, london));
    expect(format(day.meta.sunrise, "cccc d LLL")).toBe("Monday 9 Nov");
    expect(format(day.solarDate, "cccc d LLL")).toBe("Monday 9 Nov");
    expect(day.hours[0].planet).toBe("luna");
  });

  it.each([
    ["London", london],
    ["Tokyo", tokyo],
    ["Honolulu", honolulu],
    ["Auckland", auckland],
  ])(
    "steps through consecutive solar days at %s from any hour of the device's day",
    (_, place) => {
      for (let hour = 0; hour < 24; hour++) {
        const now = Date.UTC(2026, 10, 9, hour, 30);
        const week = [-1, 0, 1, 2, 3, 4, 5, 6].map((d) =>
          withHours(
            calcPlanetaryHoursForDayAndLocation(
              new Date(now + d * DAY_IN_MS),
              place,
            ),
          ),
        );
        for (let i = 1; i < week.length; i++) {
          const [before, after] = [week[i - 1], week[i]];
          // One calendar day apart (25 hours across a clock change is still one).
          const gap =
            after.solarDate.getTime() - before.solarDate.getTime() - DAY_IN_MS;
          expect(Math.abs(gap)).toBeLessThanOrEqual(3_600_000);
          // The day ruler moves three places back in the Chaldean order.
          expect(chaldean.indexOf(after.hours[0].planet)).toBe(
            (chaldean.indexOf(before.hours[0].planet) + 3) % 7,
          );
          // Each night ends at the next day's sunrise, within the minute the
          // hours are rounded to.
          const gapToSunrise =
            after.meta.sunrise.getTime() - hourEnd(before, 23).getTime();
          expect(gapToSunrise).toBeGreaterThanOrEqual(0);
          expect(gapToSunrise).toBeLessThan(60_000);
        }
      }
    },
  );
});

describe("the planet of the day where the date is not the longitude's", () => {
  // Tuesday 10 November, 12:00 UTC: Wednesday 01:00 in Apia and Nuku'alofa.
  const date = new Date("2026-11-10T12:00:00Z");

  it.each([
    ["Apia", apia],
    ["Nuku'alofa", nukualofa],
  ])("gives %s's Wednesday sunrise Wednesday's rulers", (_, place) => {
    const day = withHours(calcPlanetaryHoursForDayAndLocation(date, place));
    const sunrise = day.meta.sunrise.toLocaleString("en-GB", {
      timeZone: place.timezone,
      weekday: "long",
      day: "numeric",
    });
    expect(sunrise).toBe("Wednesday 11");
    expect(format(day.solarDate, "cccc d LLL")).toBe("Wednesday 11 Nov");
    expect(day.hours[0].planet).toBe("mercury");
  });

  it("uses the longitude's date for a place without a time zone", () => {
    const { timezone: _, ...apiaByLongitude } = apia;
    const day = withHours(
      calcPlanetaryHoursForDayAndLocation(date, apiaByLongitude),
    );
    expect(format(day.solarDate, "cccc d LLL")).toBe("Tuesday 10 Nov");
    expect(day.hours[0].planet).toBe("mars");
  });

  it("uses the longitude's date for a zone the runtime doesn't know", () => {
    const day = withHours(
      calcPlanetaryHoursForDayAndLocation(date, {
        ...apia,
        timezone: "Pacific/Nowhere",
      }),
    );
    expect(format(day.solarDate, "cccc d LLL")).toBe("Tuesday 10 Nov");
    expect(day.hours[0].planet).toBe("mars");
  });

  it.each([
    ["London", london, "Europe/London"],
    ["Tokyo", tokyo, "Asia/Tokyo"],
    ["Honolulu", honolulu, "Pacific/Honolulu"],
    ["Auckland", auckland, "Pacific/Auckland"],
  ])(
    "agrees with the longitude at %s, with its time zone, at any hour",
    (_, place, timezone) => {
      for (let hour = 0; hour < 24; hour++) {
        const at = new Date(Date.UTC(2026, 10, 9, hour, 30));
        const byZone = calcPlanetaryHoursForDayAndLocation(at, {
          ...place,
          timezone,
        });
        const byLongitude = calcPlanetaryHoursForDayAndLocation(at, place);
        expect(byZone).toEqual(byLongitude);
      }
    },
  );

  it.each([
    ["Apia", apia],
    ["Nuku'alofa", nukualofa],
  ])("steps through consecutive days at %s", (_, place) => {
    const now = Date.UTC(2026, 10, 9, 12, 30);
    const week = [-1, 0, 1, 2, 3, 4, 5, 6].map((d) =>
      withHours(
        calcPlanetaryHoursForDayAndLocation(
          new Date(now + d * DAY_IN_MS),
          place,
        ),
      ),
    );
    for (let i = 1; i < week.length; i++) {
      const [before, after] = [week[i - 1], week[i]];
      expect(after.solarDate.getTime() - before.solarDate.getTime()).toBe(
        DAY_IN_MS,
      );
      expect(chaldean.indexOf(after.hours[0].planet)).toBe(
        (chaldean.indexOf(before.hours[0].planet) + 3) % 7,
      );
    }
  });
});

describe("days without sunrise or sunset", () => {
  it.each([
    ["Tromsø", tromso, "2026-12-01T12:00:00Z", "polarNight"],
    ["Tromsø", tromso, "2026-06-10T12:00:00Z", "midnightSun"],
    ["Murmansk", murmansk, "2026-12-10T12:00:00Z", "polarNight"],
  ] as const)("finds %s on %s in %s", (_, place, iso, kind) => {
    const day = calcPlanetaryHoursForDayAndLocation(new Date(iso), place);
    expect(day.kind).toBe(kind);
    expect(format(day.solarDate, "yyyy-MM-dd")).toBe(iso.slice(0, 10));
  });

  it.each([
    // Polar night begins the next day.
    ["2026-11-27T12:00:00Z"],
    // Midnight sun begins the next day.
    ["2026-05-18T12:00:00Z"],
  ])("gives Tromsø only day hours on %s, the day before", (iso) => {
    const day = withHours(
      calcPlanetaryHoursForDayAndLocation(new Date(iso), tromso),
    );
    expect(day.hours).toHaveLength(12);
    expect(day.meta.nightHourInMinutes).toBeNull();
  });

  it("lists no upcoming hours in Tromsø's polar night", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-01T12:00:00Z"));
    for (const planet of chaldean)
      expect(upcomingHoursForPlanetAtLocation(planet, tromso)).toEqual([]);
  });

  it.each([
    ["polar night", "2026-11-24T12:00:00Z", "2026-11-27T"],
    ["midnight sun", "2026-05-15T12:00:00Z", "2026-05-18T"],
  ])(
    "lists upcoming hours in Tromsø up to the %s and none after",
    (_, iso, lastDay) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(iso));
      const hours = chaldean.flatMap((planet) =>
        upcomingHoursForPlanetAtLocation(planet, tromso),
      );
      expect(hours.length).toBeGreaterThan(0);
      const last = hours.reduce((a, b) => (a.from > b.from ? a : b));
      expect(last.from.toISOString().startsWith(lastDay)).toBe(true);
      for (const { from, to } of hours) {
        expect(from < to).toBe(true);
        expect(() => formatFromTo(from, to)).not.toThrow();
      }
    },
  );
});
