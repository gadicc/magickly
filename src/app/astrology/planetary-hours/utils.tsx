import { differenceInMinutes, format } from "date-fns";
import SunCalc from "suncalc";
import type { Place } from "@/geo/place";
import { utcOffsetMinutes } from "@/geo/timeZone";

// Useful Resources:
// https://plentifulearth.com/calculate-planetary-hours/
// https://www.lunarium.co.uk/planets/hours.jsp
// https://www.lunarium.co.uk/articles/planetary-hours-and-days.jsp
// https://en.wikipedia.org/wiki/Planetary_hours

const start = ["sol", "luna", "mars", "mercury", "jupiter", "venus", "saturn"];
export const DAY_IN_MS = 60_000 * 60 * 24;
export const chaldean = [
  "saturn", // ♄
  "jupiter", // ♃
  "mars", // ♂
  "sol", // ☉
  "venus", // ♀
  "mercury", // ☿
  "luna", // ☽
];

/** SunCalc's altitude for sunrise and sunset: -0.833°, for refraction. */
const HORIZON = (-0.833 * Math.PI) / 180;

/**
 * Where the hours are counted: the coordinates, and the place's IANA time
 * zone when known, which says what date it keeps (see `solarDateOf`).
 */
export type Coordinates = Pick<Place, "latitude" | "longitude" | "timezone">;

interface PlanetaryHour {
  /** When the hour begins. */
  date: Date;
  planet: string;
}

interface PlanetaryHoursMeta {
  sunrise: Date;
  sunset: Date;
  dayHourInMinutes: number;
  /**
   * Null when the sun neither rises nor sets the next day (polar night or
   * midnight sun begins), so the night has no sunrise to end it and no
   * hours: `hours` then holds the 12 day hours only.
   */
  nightHourInMinutes: number | null;
}

/**
 * One solar day's planetary hours at a place, or why it has none.
 *
 * `solarDate` is the place's date on the day the hours belong to (its civil
 * date at solar noon, or by the Sun at its longitude without a time zone),
 * as midnight on the device's clock: for labelling the day, not an instant at
 * the place.
 */
export type PlanetaryDay =
  | {
      kind: "hours";
      solarDate: Date;
      hours: PlanetaryHour[];
      meta: PlanetaryHoursMeta;
    }
  /** The sun stays below the horizon all day. */
  | { kind: "polarNight"; solarDate: Date }
  /** The sun stays above the horizon all day. */
  | { kind: "midnightSun"; solarDate: Date };

/**
 * The place's date for the day whose solar noon this is, and its weekday.
 * Noon, not sunrise, so that it exists on polar days and is never near
 * midnight, whatever the latitude.
 *
 * With the place's time zone, it is the civil date there at solar noon:
 * Apia and Nuku'alofa keep UTC+13 at about 172° and 175° west, so their
 * calendar is a day ahead of their longitude's. Without one (or with a zone
 * the runtime doesn't know), noon shifted by the longitude (15° to the hour)
 * reads as about 12:00 in UTC, so its UTC date is the place's by the Sun.
 */
function solarDateOf(solarNoon: Date, geo: Coordinates) {
  let offsetMinutes = (geo.longitude / 15) * 60;
  if (geo.timezone) {
    try {
      offsetMinutes = utcOffsetMinutes(geo.timezone, solarNoon);
    } catch {
      // An unknown zone: the longitude's date.
    }
  }
  const shifted = new Date(solarNoon.getTime() + offsetMinutes * 60_000);
  return {
    weekday: shifted.getUTCDay(), // 0-6 where 0=Sunday.
    solarDate: new Date(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  };
}

function rises(times: { sunrise: Date }) {
  return !Number.isNaN(times.sunrise.getTime());
}

/**
 * The planetary hours of the solar day SunCalc finds nearest `date` at the
 * place: 12 day hours from sunrise to sunset and 12 night hours from sunset
 * to the next sunrise, the first ruled by the planet of the day.
 *
 * The planet of the day is the weekday of the place's date, not the
 * device's: from London on Monday evening, Tokyo's next sunrise is Tuesday's
 * and Mars rules it. Inside the polar circles a day may have no sunrise and
 * sunset (SunCalc gives Invalid Date), which is returned as `polarNight` or
 * `midnightSun` rather than as hours.
 */
export function calcPlanetaryHoursForDayAndLocation(
  date: Date,
  geo: Coordinates,
): PlanetaryDay {
  const solar = SunCalc.getTimes(date, geo.latitude, geo.longitude);
  const { weekday, solarDate } = solarDateOf(solar.solarNoon, geo);

  // SunCalc's sunrise and sunset are both found or both not: the sun either
  // crosses the horizon that day or stays on one side of it.
  if (!rises(solar)) {
    const noon = SunCalc.getPosition(
      solar.solarNoon,
      geo.latitude,
      geo.longitude,
    );
    return {
      kind: noon.altitude > HORIZON ? "midnightSun" : "polarNight",
      solarDate,
    };
  }

  const nextDay = new Date(date.getTime() + DAY_IN_MS);
  const solarNext = SunCalc.getTimes(nextDay, geo.latitude, geo.longitude);
  const chaldeanStartPos = chaldean.indexOf(start[weekday]);

  // Daytime Hours
  const daytimeMinutes = differenceInMinutes(solar.sunset, solar.sunrise);
  const dayHourInMinutes = daytimeMinutes / 12;

  // Nighttime Hours
  const nightHourInMinutes = rises(solarNext)
    ? differenceInMinutes(solarNext.sunrise, solar.sunset) / 12
    : null;

  const hours: PlanetaryHour[] = [];
  for (let hour = 0; hour < 12; hour++) {
    const minutesSinceSunrise = dayHourInMinutes * hour;
    hours.push({
      date: new Date(solar.sunrise.getTime() + minutesSinceSunrise * 60_000),
      planet: chaldean[(chaldeanStartPos + hour) % 7],
    });
  }

  if (nightHourInMinutes !== null) {
    for (let hour = 12; hour < 24; hour++) {
      const minutesSinceSunset = nightHourInMinutes * (hour - 12);
      hours.push({
        date: new Date(solar.sunset.getTime() + minutesSinceSunset * 60_000),
        planet: chaldean[(chaldeanStartPos + hour) % 7],
      });
    }
  }

  return {
    kind: "hours",
    solarDate,
    hours,
    meta: {
      sunrise: solar.sunrise,
      sunset: solar.sunset,
      dayHourInMinutes,
      nightHourInMinutes,
    },
  };
}

/**
 * When the hour at `index` (0-11 by day, 12-23 by night) of a day's hours
 * ends.
 */
export function hourEnd(day: PlanetaryDay & { kind: "hours" }, index: number) {
  const minutes =
    index < 12 ? day.meta.dayHourInMinutes : day.meta.nightHourInMinutes;
  // A night without an end has no hours in `day.hours` to ask about.
  if (minutes === null) throw new RangeError(`No night hour ${index}`);
  return new Date(day.hours[index].date.getTime() + minutes * 60_000);
}

/**
 * The planet's hours at the place that begin after now, over about a week.
 *
 * The solar days are SunCalc's nearest to now and the six after, plus the one
 * before, whose night may still be running (after solar midnight, the nearest
 * day is the coming one). Steps of exactly 24 hours land on consecutive solar
 * days at any longitude, so none repeats or is skipped. Days without hours
 * (polar night, midnight sun) and nights without an end contribute nothing.
 */
export function upcomingHoursForPlanetAtLocation(
  planet: string,
  geo: Coordinates,
) {
  const now = new Date();
  const hours = [] as { from: Date; to: Date }[];
  for (let d = -1; d < 7; d++) {
    const day = calcPlanetaryHoursForDayAndLocation(
      new Date(now.getTime() + d * DAY_IN_MS),
      geo,
    );
    if (day.kind !== "hours") continue;
    day.hours.forEach((entry, i) => {
      if (entry.planet === planet && now < entry.date) {
        hours.push({ from: entry.date, to: hourEnd(day, i) });
      }
    });
  }

  return hours;
}

export const formatFromTo = (from: Date, to: Date) =>
  format(from, "ccc LLL do h:mm") + " - " + format(to, "h:mm aaa");

export const UpcomingHours = ({
  hours,
}: {
  hours: { from: Date; to: Date }[];
}) => {
  return (
    <ul>
      {hours.map(({ from, to }, i) => (
        <li key={i}>{formatFromTo(from, to)}</li>
      ))}
    </ul>
  );
};
