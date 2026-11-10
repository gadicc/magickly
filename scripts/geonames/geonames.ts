/**
 * The pure half of the GeoNames build (plan 072): reading the zip and
 * turning GeoNames' tables into `src/geo/server/places.tsv`. No I/O, so
 * it is tested directly; `build.ts` does the downloading and writing.
 */
import { crc32, inflateRawSync } from "node:zlib";
import {
  foldPlaceName,
  PLACES_FORMAT,
  type PlacesHeader,
} from "../../src/geo/server/placesFormat";

/**
 * Places this populous keep their Latin-script alternate names (Kiev,
 * Bombay, Peking, München); smaller ones keep only their own names. The
 * spike measured 1,951 places and about 410 KB for this.
 */
export const ALTERNATES_MIN_POPULATION = 300_000;
/** Shorter alternates are mostly codes and abbreviations ("NYC", "LA"). */
const ALTERNATE_MIN_LENGTH = 4;
/**
 * Alternates beginning "xx" are transliteration junk ("Xxslo" for Oslo,
 * "Xxttawa" for Ottawa), not names anyone types.
 */
const JUNK_ALTERNATE = /^xx/;
/**
 * First-level region codes that are letters ("US.TX", "GB.ENG") are what
 * people type after a comma ("paris, tx"); numeric ones ("CA.08") are not.
 */
const LETTER_CODE = /^[A-Za-z]+$/;
const LATIN = /^[\p{Script=Latin}\s'’.-]+$/u;

/**
 * The one file in a zip archive, inflated. GeoNames' zips hold a single
 * deflated entry written with a data descriptor (sizes are zero in the
 * local header), so the sizes come from the central directory. Anything
 * else (more entries, another method, Zip64, a CRC mismatch) is refused:
 * the bytes are pinned by SHA-256 before this runs, so a surprise means
 * the pin or this reader is wrong.
 */
export function readSingleEntryZip(zip: Buffer, expectedName: string): Buffer {
  const fail = (why: string): never => {
    throw new Error(`${expectedName}: unexpected zip (${why})`);
  };
  let eocd = -1;
  for (
    let i = zip.length - 22;
    i >= Math.max(0, zip.length - 22 - 65535);
    i--
  ) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail("no end of central directory");
  if (zip.readUInt16LE(eocd + 10) !== 1) fail("not exactly one entry");
  const central = zip.readUInt32LE(eocd + 16);
  if (zip.readUInt32LE(central) !== 0x02014b50) fail("bad central directory");
  const method = zip.readUInt16LE(central + 10);
  const crc = zip.readUInt32LE(central + 16);
  const compressedSize = zip.readUInt32LE(central + 20);
  const size = zip.readUInt32LE(central + 24);
  const nameLength = zip.readUInt16LE(central + 28);
  const local = zip.readUInt32LE(central + 42);
  const name = zip.toString("utf8", central + 46, central + 46 + nameLength);
  if (name !== expectedName) fail(`entry is ${JSON.stringify(name)}`);
  if (method !== 8) fail(`method ${method}, not deflate`);
  if (compressedSize === 0xffffffff || size === 0xffffffff) fail("Zip64");
  if (zip.readUInt32LE(local) !== 0x04034b50) fail("bad local header");
  const start =
    local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const data = inflateRawSync(zip.subarray(start, start + compressedSize));
  if (data.length !== size || crc32(data) !== crc) fail("size or CRC");
  return data;
}

/** `admin1CodesASCII.txt` as "GB.ENG" → "England" (its UTF-8 name column). */
export function parseAdmin1(text: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const [code, name] = line.replace(/\r$/, "").split("\t");
    if (!code || name === undefined) {
      throw new Error(`admin1: bad line ${JSON.stringify(line)}`);
    }
    names.set(code, name);
  }
  return names;
}

interface City {
  id: number;
  name: string;
  ascii: string;
  alternates: string[];
  latitude: number;
  longitude: number;
  district: boolean;
  country: string;
  region: string;
  /** The region's letter code ("TX"), or "" for a numeric or unknown one. */
  regionCode: string;
  population: number;
  timezone: string;
}

const COUNTRY = /^[A-Z]{2}$/;
const TIMEZONE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+$|^UTC$/;

/** One line of GeoNames' `cities*.txt`, checked; throws on anything odd. */
function parseCity(line: string, admin1: Map<string, string>): City {
  const c = line.replace(/\r$/, "").split("\t");
  const region = admin1.get(`${c[8]}.${c[10]}`);
  const bad = (why: string): never => {
    throw new Error(`cities: ${why} in ${JSON.stringify(line.slice(0, 120))}`);
  };
  if (c.length !== 19) bad(`${c.length} columns`);
  const city: City = {
    id: Number(c[0]),
    name: c[1].trim(),
    ascii: c[2].trim(),
    alternates: c[3] ? c[3].split(",") : [],
    latitude: Number(c[4]),
    longitude: Number(c[5]),
    district: c[7] === "PPLX",
    country: c[8],
    region: region ?? "",
    regionCode: region !== undefined && LETTER_CODE.test(c[10]) ? c[10] : "",
    population: Number(c[14]),
    timezone: c[17],
  };
  if (!Number.isSafeInteger(city.id)) bad("geonameid");
  if (!city.name) bad("empty name");
  if (!COUNTRY.test(city.country)) bad("country code");
  if (!TIMEZONE.test(city.timezone)) bad("time zone");
  if (!Number.isFinite(city.population) || city.population < 0) {
    bad("population");
  }
  if (
    !Number.isFinite(city.latitude) ||
    !Number.isFinite(city.longitude) ||
    Math.abs(city.latitude) > 90 ||
    Math.abs(city.longitude) > 180
  ) {
    bad("coordinates");
  }
  return city;
}

/** Shortest decimal for 3 places: 51.50853 → "51.509", -0.0001 → "0". */
function coordinate(value: number): string {
  return String(Number(value.toFixed(3)));
}

/** Code-unit order, so the output does not depend on the ICU in use. */
function byCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The places file from GeoNames' cities table and region names. The same
 * input always gives byte-identical output: cities sort by population,
 * then geonameid; time zones and regions sort by code units; nothing
 * depends on the date, locale or input order.
 */
export function buildPlacesTsv(
  citiesText: string,
  admin1Text: string,
  source: string,
): string {
  const admin1 = parseAdmin1(admin1Text);
  const cities = citiesText
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => parseCity(line, admin1))
    .sort((a, b) => b.population - a.population || a.id - b.id);

  const timezones = [...new Set(cities.map((c) => c.timezone))].sort(
    byCodeUnits,
  );
  const regionKey = (c: City) =>
    [c.country, c.region, ...(c.regionCode ? [c.regionCode] : [])].join("\t");
  const regionKeys = [...new Set(cities.map(regionKey))].sort(byCodeUnits);
  const timezoneIndex = new Map(timezones.map((tz, i) => [tz, i]));
  const regionIndex = new Map(regionKeys.map((key, i) => [key, i]));

  const lines = cities.map((c) => {
    const own = new Set([foldPlaceName(c.name), foldPlaceName(c.ascii)]);
    // Districts never get alternates: "Kreis 1" under Zürich's other names
    // would only crowd the city itself.
    const alternates =
      c.population >= ALTERNATES_MIN_POPULATION && !c.district
        ? [
            ...new Set(
              c.alternates
                .filter(
                  (a) => a.length >= ALTERNATE_MIN_LENGTH && LATIN.test(a),
                )
                .map(foldPlaceName),
            ),
          ].filter((a) => a && !own.has(a) && !JUNK_ALTERNATE.test(a))
        : [];
    return [
      c.name,
      c.ascii === c.name ? "" : c.ascii,
      regionIndex.get(regionKey(c)),
      coordinate(c.latitude),
      coordinate(c.longitude),
      timezoneIndex.get(c.timezone),
      c.district ? "1" : "",
      alternates.join("|"),
    ].join("\t");
  });

  const header: PlacesHeader = {
    format: PLACES_FORMAT,
    source,
    license:
      "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), GeoNames (https://www.geonames.org/); modified: see README.md",
    rows: lines.length,
    timezones,
    regions: regionKeys.map(
      (key) => key.split("\t") as PlacesHeader["regions"][number],
    ),
  };
  return `${JSON.stringify(header)}\n${lines.join("\n")}\n`;
}
