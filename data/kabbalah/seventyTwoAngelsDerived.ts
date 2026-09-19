import type { PlanetId } from "../astrology/Planets";
import type { ZodiacId } from "../astrology/Zodiac";

/**
 * Lenain's four cabalistic tables are arithmetic. The year begins at the first
 * degree of Aries on 20 March; each of the 72 genii takes five degrees of the
 * sphere, five days of the year and twenty minutes of the day; and the five
 * revolutions of 72 days cover 360 of the year's 365, the remaining five being
 * the epagomenal days, which have no genius.
 *
 * Deriving these rather than transcribing them is deliberate. The scan is
 * damaged enough that a wrong number can look right: the data read Vehuiah's
 * 31 May as 30 April for three years, because the OCR's "31 avril" was tidied
 * into a date that exists. See plan 031.
 */

/** A day of the year as `[month, day]`, both 1-based. */
export type MonthDay = [number, number];

export const ANGEL_COUNT = 72;

const DEGREES_EACH = 5;
const DAYS_EACH = 5;
const MINUTES_EACH = 20;
const ANGELS_PER_SIGN = 6;
const ANGELS_PER_CHOIR = 8;
const ANGELS_PER_DECADE = 2;

/** Lenain counts no leap years: five revolutions of 72 days, and five over. */
const DAYS_IN_YEAR = 365;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** 20 March, as a 0-based day of that year. */
const FIRST_DAY = 31 + 28 + 19;

const REVOLUTION_DAYS = 72;
const REVOLUTIONS = 5;

/** The zodiac from the first degree of Aries, as Lenain's sphere runs. */
const SIGNS: ZodiacId[] = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];

/** The decades descend the Chaldean order from Mars, and repeat every seven. */
const DECADE_PLANETS: PlanetId[] = [
  "mars",
  "sol",
  "venus",
  "mercury",
  "luna",
  "saturn",
  "jupiter",
];

function assertAngelNumber(no: number) {
  if (!Number.isInteger(no) || no < 1 || no > ANGEL_COUNT)
    throw new RangeError(`Not one of the 72 angels: ${no}`);
}

/** The 0-based day of a common year, wrapped into it. */
function wrapDay(day: number) {
  return ((day % DAYS_IN_YEAR) + DAYS_IN_YEAR) % DAYS_IN_YEAR;
}

/** A 0-based day of a common year as `[month, day]`. */
export function monthDayOf(dayOfYear: number): MonthDay {
  let day = wrapDay(dayOfYear);
  for (let month = 0; month < MONTH_LENGTHS.length; month++) {
    if (day < MONTH_LENGTHS[month]) return [month + 1, day + 1];
    day -= MONTH_LENGTHS[month];
  }
  /* c8 ignore next -- wrapDay keeps the loop in range */
  throw new RangeError(`Not a day of the year: ${dayOfYear}`);
}

/** `[month, day]` as a 0-based day of a common year. */
export function dayOfYearOf([month, day]: MonthDay) {
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new RangeError(`Not a month: ${month}`);
  if (!Number.isInteger(day) || day < 1 || day > MONTH_LENGTHS[month - 1])
    throw new RangeError(`Not a day of month ${month}: ${day}`);
  let dayOfYear = day - 1;
  for (let before = 0; before < month - 1; before++)
    dayOfYear += MONTH_LENGTHS[before];
  return dayOfYear;
}

/** The angel's five degrees of the sphere, 1-based and inclusive. */
export function degreesOf(no: number) {
  assertAngelNumber(no);
  return { from: (no - 1) * DEGREES_EACH + 1, to: no * DEGREES_EACH };
}

/**
 * The sign the angel's degrees fall in, and which of that sign's six
 * five-degree quinances they are.
 */
export function signOf(no: number) {
  assertAngelNumber(no);
  const withinSign = (no - 1) % ANGELS_PER_SIGN;
  return {
    zodiacId: SIGNS[Math.floor((no - 1) / ANGELS_PER_SIGN)],
    from: withinSign * DEGREES_EACH + 1,
    to: (withinSign + 1) * DEGREES_EACH,
    quinance: withinSign + 1,
  };
}

/**
 * The five days the angel governs, from Lenain's second table. `shiftDays`
 * moves the year's start off the tropical equinox, for a sidereal reading.
 */
export function governedDaysOf(no: number, shiftDays = 0) {
  assertAngelNumber(no);
  const first = FIRST_DAY + (no - 1) * DAYS_EACH + shiftDays;
  return {
    from: monthDayOf(first),
    to: monthDayOf(first + DAYS_EACH - 1),
  };
}

/** The five days the angel presides over, from Lenain's third table. */
export function presidingDaysOf(no: number): MonthDay[] {
  assertAngelNumber(no);
  const first = FIRST_DAY + (no - 1);
  return Array.from({ length: REVOLUTIONS }, (_, revolution) =>
    monthDayOf(first + revolution * REVOLUTION_DAYS),
  );
}

/**
 * The angel's twenty minutes of the day, from Lenain's fourth table, as
 * minutes after midnight.
 */
export function invocationOf(no: number) {
  assertAngelNumber(no);
  return { from: (no - 1) * MINUTES_EACH, to: no * MINUTES_EACH };
}

/** Which of the sacred calendar's 36 decades the angel falls in. */
export function decadeOf(no: number) {
  assertAngelNumber(no);
  return Math.ceil(no / ANGELS_PER_DECADE);
}

/** The planet ruling the angel's decade. */
export function planetOf(no: number) {
  return DECADE_PLANETS[(decadeOf(no) - 1) % DECADE_PLANETS.length];
}

/** Which of the nine choirs the angel belongs to, counting from the seraphim. */
export function choirOf(no: number) {
  assertAngelNumber(no);
  return Math.ceil(no / ANGELS_PER_CHOIR);
}
