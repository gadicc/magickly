/**
 * The format of `places.tsv`, shared by the script that writes it
 * (`scripts/geonames/build.ts`) and the search that reads it
 * (`places.ts`). Pure and free of `server-only` so the build script can
 * import it; nothing here holds the data itself.
 *
 * The file is one JSON header line, then one tab-separated line per place
 * in descending population order (the order is the ranking, so there is
 * no population column):
 *
 * ```
 * {"format":2,...,"rows":N,"timezones":[...],"regions":[["GB","England","ENG"],["UA","Kyiv City"],...]}
 * name  ascii  region  latitude  longitude  timezone  district  alternates
 * ```
 *
 * - `ascii`: GeoNames' ASCII name, empty when it equals `name`.
 * - `region`, `timezone`: indexes into the header's lists.
 * - `latitude`, `longitude`: degrees rounded to 3 decimals (~100 m).
 * - `district`: `1` for a section of a city (GeoNames `PPLX`), else empty.
 * - `alternates`: `|`-separated, already folded (`foldPlaceName`).
 */

/** Bumped whenever a column or the header changes meaning. */
export const PLACES_FORMAT = 2;

/** The JSON header on the file's first line. */
export interface PlacesHeader {
  format: typeof PLACES_FORMAT;
  /** Which GeoNames files, from when. */
  source: string;
  /** Licence and a pointer to what was changed. */
  license: string;
  /** Number of place lines that follow. */
  rows: number;
  /** IANA time zones, indexed by the timezone column. */
  timezones: string[];
  /**
   * `[country code, first-level region name or ""]`, indexed by the region
   * column, with the region's code third when it is letters (GeoNames'
   * admin1 code: "TX", "DC", "ENG"; not Canada's "08").
   */
  regions: ([string, string] | [string, string, string])[];
}

/**
 * Lower case, without accents or repeated spaces, so "São Paulo", "sao
 * paulo" and "SAO  PAULO" compare equal. The build folds the alternates
 * with this and the search folds names and queries with it, so the two
 * must stay one function.
 */
export function foldPlaceName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
