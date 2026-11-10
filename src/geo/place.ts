/**
 * A place the planetary hours, the moon and the geomancy reading are
 * computed for (plan 072). It comes from the visitor's IP (`/api/geo`),
 * a search of the GeoNames cities (`/api/places`), or the device's own
 * position, and is shared by the server routes and the browser.
 */
export interface Place {
  /** City or town, or "Your location" for the device's position. */
  name: string;
  /** First-level subdivision's name ("England", "Texas"), when known. */
  region?: string;
  /** ISO 3166-1 alpha-2 country code ("GB"), when known. */
  country?: string;
  /** Degrees, -90 to 90. */
  latitude: number;
  /** Degrees, -180 to 180. */
  longitude: number;
  /** IANA time zone ("Europe/London"), when known. */
  timezone?: string;
}

const COUNTRY = /^[A-Z]{2}$/;

function optionalText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text && text.length <= max ? text : undefined;
}

/**
 * The value as a `Place`, or null when it is not one: coordinates must be
 * finite numbers in range and the name a non-empty string. Optional fields
 * that are malformed are dropped rather than failing the place. Used on
 * anything that crosses a boundary: stored JSON, another server's answer.
 */
export function toPlace(value: unknown): Place | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const name = optionalText(v.name, 200);
  const { latitude, longitude } = v;
  if (
    !name ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  const place: Place = { name, latitude, longitude };
  const region = optionalText(v.region, 200);
  if (region) place.region = region;
  if (typeof v.country === "string" && COUNTRY.test(v.country)) {
    place.country = v.country;
  }
  const timezone = optionalText(v.timezone, 64);
  if (timezone) place.timezone = timezone;
  return place;
}
