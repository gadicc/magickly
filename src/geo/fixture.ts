import type { Place } from "./place";

/**
 * A synthetic place for screenshots and browser checks: `/api/geo` answers
 * it in local development with `GEO_FIXTURE=1` (plan 072). Kept out of the
 * route module, which may export only route handlers and their config.
 */
export const FIXTURE_PLACE: Place = {
  name: "London",
  region: "England",
  country: "GB",
  latitude: 51.5085,
  longitude: -0.1257,
  timezone: "Europe/London",
};
