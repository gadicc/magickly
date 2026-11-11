/**
 * The planet that rules each day of the week and its first hour, from
 * Sunday, as `Date#getDay()` counts them. The planetary hours start from it.
 */
export const dayRulers = [
  "sol",
  "luna",
  "mars",
  "mercury",
  "jupiter",
  "venus",
  "saturn",
] as const;

const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  timeZone: "UTC",
});

/**
 * The day of the week a planet rules, "Sunday" for `sol`, or undefined for
 * any but the seven.
 */
export function dayOf(planetId: string) {
  const day = (dayRulers as readonly string[]).indexOf(planetId);
  // 4 January 1970 was a Sunday.
  return day < 0 ? undefined : WEEKDAY.format(Date.UTC(1970, 0, 4 + day));
}
