import {
  CITY_HEADER_NAME,
  COUNTRY_HEADER_NAME,
  LATITUDE_HEADER_NAME,
  LONGITUDE_HEADER_NAME,
} from "@vercel/functions/headers";
import { type Place, toPlace, UNNAMED_PLACE } from "./place";

/** `@vercel/functions` has no constant for this one. */
export const TIMEZONE_HEADER_NAME = "x-vercel-ip-timezone";

/** A plain decimal, as Vercel sends: no exponent, hex or empty string. */
const DECIMAL = /^-?\d+(?:\.\d+)?$/;

function coordinate(headers: Headers, name: string): number | undefined {
  const value = headers.get(name)?.trim();
  return value && DECIMAL.test(value) ? Number(value) : undefined;
}

/** The city, decoded from RFC 3986, or undefined when it doesn't decode. */
function city(headers: Headers): string | undefined {
  const raw = headers.get(CITY_HEADER_NAME);
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw).trim() || undefined;
  } catch {
    return undefined;
  }
}

/** The country's English name ("United Kingdom"), when Intl knows it. */
function countryName(country: string): string | undefined {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(country);
    return name && name !== country ? name : undefined;
  } catch {
    return undefined;
  }
}

/** The zone when this runtime knows it as an IANA name, else undefined. */
function timezone(headers: Headers): string | undefined {
  const value = headers.get(TIMEZONE_HEADER_NAME)?.trim();
  if (!value) return undefined;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
}

/**
 * The visitor's place from Vercel's IP geolocation headers (plan 072), or
 * null without usable coordinates. Read directly rather than through
 * `geolocation()`, which has no time zone and throws on a badly encoded
 * city.
 *
 * - Latitude and longitude are required; `toPlace` checks their range.
 * - A city that fails to decode is dropped, not shown with escapes. The
 *   coordinates are still good, so the place keeps them and is named
 *   after the country ("United Kingdom"), or `UNNAMED_PLACE` without one.
 * - `x-vercel-ip-country-region` is left out: it is a code ("ENG"), and
 *   `Place.region` is a name.
 */
export function placeFromVercelHeaders(headers: Headers): Place | null {
  const latitude = coordinate(headers, LATITUDE_HEADER_NAME);
  const longitude = coordinate(headers, LONGITUDE_HEADER_NAME);
  if (latitude === undefined || longitude === undefined) return null;

  const country = headers.get(COUNTRY_HEADER_NAME)?.trim().toUpperCase();
  const validCountry = country && /^[A-Z]{2}$/.test(country) ? country : "";
  const name =
    city(headers) ??
    (validCountry ? countryName(validCountry) : undefined) ??
    UNNAMED_PLACE;

  return toPlace({
    name,
    country: validCountry || undefined,
    latitude,
    longitude,
    timezone: timezone(headers),
  });
}
