import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Place } from "../place";
import {
  foldPlaceName,
  PLACES_FORMAT,
  type PlacesHeader,
} from "./placesFormat";

/**
 * Common names for a country that are neither its ISO code nor a prefix of
 * its English name, so "london, uk" and "paris, usa" narrow as people type
 * them.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  uk: "GB",
  usa: "US",
  uae: "AE",
};

/**
 * Read with `fs` rather than imported, so no bundler sees the data; the
 * route's `outputFileTracingIncludes` entry ships it with the function.
 */
const PLACES_FILE = join(process.cwd(), "src/geo/server/places.tsv");

/** Longer queries are cut; no place name needs more. */
export const MAX_QUERY_LENGTH = 64;
const MAX_LIMIT = 50;

interface Region {
  country: string;
  name: string;
  /** Folded region name, for "paris, texas". */
  folded: string;
  /** Folded English country name, for "paris, united states". */
  countryName: string;
  /** Lower-case letter code, for "paris, tx"; "" without one. */
  code: string;
}

interface Row {
  place: Place;
  region: number;
  /** Folded name and, when it differs, folded ASCII name. */
  keys: string[];
  alternates: string[];
  district: boolean;
}

/** The parsed places file and a search over it. */
export interface PlaceIndex {
  size: number;
  search(q: string, limit?: number): Place[];
}

/** Ranks, best first; a row takes the best that applies. */
const EXACT = 0;
const PREFIX = 1; // also an exact alternate name ("munchen" → Munich)
const WORD_PREFIX = 2; // "york" in "new york"
const ALTERNATE_PREFIX = 3;
const DISTRICT = 4; // any match on a city's district ("Zürich (Kreis 11)")

function regionsOf(header: PlacesHeader): Region[] {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const countryNames = new Map<string, string>();
  return header.regions.map(([country, name, code = ""]) => {
    let countryName = countryNames.get(country);
    if (countryName === undefined) {
      try {
        countryName = foldPlaceName(names.of(country) ?? country);
      } catch {
        countryName = country.toLowerCase();
      }
      countryNames.set(country, countryName);
    }
    return {
      country,
      name,
      folded: foldPlaceName(name),
      countryName,
      code: code.toLowerCase(),
    };
  });
}

/**
 * Parses a places file (format in `placesFormat.ts`). Throws on a header
 * it doesn't know or a row count that doesn't match, rather than serving
 * a half-read list.
 */
export function createPlaceIndex(text: string): PlaceIndex {
  const end = text.indexOf("\n");
  const header = JSON.parse(text.slice(0, end)) as PlacesHeader;
  if (
    header.format !== PLACES_FORMAT ||
    !Array.isArray(header.timezones) ||
    !Array.isArray(header.regions)
  ) {
    throw new Error("places: unknown file format");
  }
  const regions = regionsOf(header);
  const rows: Row[] = [];
  for (const line of text.slice(end + 1).split("\n")) {
    if (!line) continue;
    const [name, ascii, region, latitude, longitude, timezone, district, alts] =
      line.split("\t");
    const r = regions[Number(region)];
    const tz = header.timezones[Number(timezone)];
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!name || !r || !tz || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`places: bad row ${rows.length + 1}`);
    }
    const place: Place = {
      name,
      ...(r.name ? { region: r.name } : {}),
      country: r.country,
      latitude: lat,
      longitude: lon,
      timezone: tz,
    };
    const folded = foldPlaceName(name);
    const foldedAscii = ascii ? foldPlaceName(ascii) : folded;
    rows.push({
      place,
      region: Number(region),
      keys: foldedAscii === folded ? [folded] : [folded, foldedAscii],
      alternates: alts ? alts.split("|") : [],
      district: district === "1",
    });
  }
  if (rows.length !== header.rows) {
    throw new Error(`places: ${rows.length} rows, header says ${header.rows}`);
  }

  /** Which regions every "where" term after the first comma allows. */
  function allowedRegions(wheres: string[]): boolean[] | null {
    if (!wheres.length) return null;
    return regions.map((r) =>
      wheres.every(
        (w) =>
          r.country.toLowerCase() === w ||
          COUNTRY_ALIASES[w] === r.country ||
          // Exactly: "n" or "ni" is not Northern Ireland ("NIR").
          (r.code !== "" && r.code === w) ||
          r.countryName.startsWith(w) ||
          r.folded.startsWith(w),
      ),
    );
  }

  function rank(row: Row, q: string): number {
    if (row.keys.includes(q)) return EXACT;
    if (row.keys.some((k) => k.startsWith(q)) || row.alternates.includes(q)) {
      return PREFIX;
    }
    if (row.keys.some((k) => k.includes(` ${q}`) || k.includes(`-${q}`))) {
      return WORD_PREFIX;
    }
    if (row.alternates.some((a) => a.startsWith(q))) return ALTERNATE_PREFIX;
    return -1;
  }

  return {
    size: rows.length,
    search(q, limit = 8) {
      const text = q.trim().slice(0, MAX_QUERY_LENGTH);
      if (text.length < 2) return [];
      const [first, ...rest] = text.split(",");
      const name = foldPlaceName(first);
      if (name.length < 2) return [];
      const allowed = allowedRegions(
        rest.map(foldPlaceName).filter((w) => w !== ""),
      );
      const max = Number.isFinite(limit)
        ? Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT)
        : 8;

      // Rows are in population order, so each tier fills biggest first.
      const tiers: Place[][] = [[], [], [], [], []];
      for (const row of rows) {
        if (allowed && !allowed[row.region]) continue;
        let tier = rank(row, name);
        if (tier < 0) continue;
        if (row.district) tier = DISTRICT;
        if (tiers[tier].length < max) tiers[tier].push(row.place);
        // Nothing found later can outrank a full first tier.
        if (tiers[EXACT].length >= max) break;
      }
      // Copies, so a caller can't change the index.
      return tiers
        .flat()
        .slice(0, max)
        .map((place) => ({ ...place }));
    },
  };
}

let index: PlaceIndex | undefined;

/**
 * Up to `limit` GeoNames places (population 15,000 or more) matching `q`,
 * best first: exact name, then name prefix or exact old/other name
 * ("Kiev" → Kyiv), then a word of the name ("york" → New York), then an
 * old/other name's prefix, then city districts; within each, by
 * population. Case and accents are ignored both ways. Text after a comma
 * narrows by country code, English country name or region name, each
 * term by prefix ("paris, texas", "springfield, ill", "london, gb"), or by
 * a region's letter code, exactly ("paris, tx", "washington, dc"). A
 * query under 2 characters gives nothing; one over 64 is cut.
 *
 * The data file is read and parsed on the first call (~50 ms) and kept.
 */
export function searchPlaces(q: string, limit = 8): Place[] {
  index ??= createPlaceIndex(readFileSync(PLACES_FILE, "utf8"));
  return index.search(q, limit);
}
