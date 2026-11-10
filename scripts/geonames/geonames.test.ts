import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { PlacesHeader } from "../../src/geo/server/placesFormat";
import { buildPlacesTsv, readSingleEntryZip } from "./geonames";

/** One `cities*.txt` line with GeoNames' 19 columns. */
function city(o: {
  id: number;
  name: string;
  ascii?: string;
  alternates?: string;
  lat?: string;
  lon?: string;
  code?: string;
  country?: string;
  admin1?: string;
  population: number;
  tz?: string;
}) {
  return [
    o.id,
    o.name,
    o.ascii ?? o.name,
    o.alternates ?? "",
    o.lat ?? "51.50853",
    o.lon ?? "-0.12574",
    "P",
    o.code ?? "PPL",
    o.country ?? "GB",
    "",
    o.admin1 ?? "ENG",
    "",
    "",
    "",
    o.population,
    "",
    "25",
    o.tz ?? "Europe/London",
    "2026-01-01",
  ].join("\t");
}

const admin1 =
  "GB.ENG\tEngland\tEngland\t6269131\nUA.12\tKyiv City\tKyiv City\t703447\n";
const cities = [
  city({
    id: 3,
    name: "Smalltown",
    population: 20_000,
    alternates: "Littleton,Smallburgh",
  }),
  city({
    id: 1,
    name: "Kyiv",
    country: "UA",
    admin1: "12",
    tz: "Europe/Kyiv",
    population: 2_800_000,
    alternates: "Kiev,KIEV,Kyjiw,Київ,Kyiv,Kie,Xxyiv,Kiew",
    lat: "50.45466",
    lon: "30.5238",
  }),
  city({
    id: 4,
    name: "Zürich (Kreis 1)",
    ascii: "Zuerich (Kreis 1)",
    code: "PPLX",
    population: 400_000,
    alternates: "Kreis Eins",
    country: "CH",
    admin1: "ZH",
    tz: "Europe/Zurich",
  }),
  city({
    id: 2,
    name: "Tieton",
    population: 20_000,
    lat: "-0.0001",
    lon: "0.00049",
  }),
].join("\n");

function parse(tsv: string) {
  const [header, ...rows] = tsv.slice(0, -1).split("\n");
  return {
    header: JSON.parse(header) as PlacesHeader,
    rows: rows.map((r) => r.split("\t")),
  };
}

describe("GeoNames places build", () => {
  const tsv = buildPlacesTsv(cities, admin1, "test");
  const { header, rows } = parse(tsv);

  it("orders by population, then geonameid", () => {
    expect(rows.map((r) => r[0])).toEqual([
      "Kyiv",
      "Zürich (Kreis 1)",
      "Tieton",
      "Smalltown",
    ]);
    expect(header.rows).toBe(4);
  });

  it("indexes regions and time zones in code-unit order", () => {
    expect(header.timezones).toEqual([
      "Europe/Kyiv",
      "Europe/London",
      "Europe/Zurich",
    ]);
    // A region missing from admin1 keeps its country with an empty name;
    // a letter code ("ENG") comes third, a numeric one ("12") not at all.
    expect(header.regions).toEqual([
      ["CH", ""],
      ["GB", "England", "ENG"],
      ["UA", "Kyiv City"],
    ]);
    const kyiv = rows[0];
    expect(header.regions[Number(kyiv[2])]).toEqual(["UA", "Kyiv City"]);
    expect(header.timezones[Number(kyiv[5])]).toBe("Europe/Kyiv");
  });

  it("writes coordinates to 3 decimals, ASCII names only when different", () => {
    expect(rows[0].slice(1, 5)).toEqual(["", "2", "50.455", "30.524"]);
    expect(rows[2].slice(3, 5)).toEqual(["0", "0"]);
    expect(rows[1][1]).toBe("Zuerich (Kreis 1)");
  });

  it("flags districts and gives them no alternates", () => {
    expect(rows[1].slice(6)).toEqual(["1", ""]);
    expect(rows[0][6]).toBe("");
  });

  it("keeps folded Latin alternates of 4+ letters for big places only", () => {
    // Not "Kie" (short), "Київ" (Cyrillic), "Kyiv" (its own name), "Xxyiv"
    // (GeoNames' "xx" junk), nor a second "kiev".
    expect(rows[0][7]).toBe("kiev|kyjiw|kiew");
    expect(rows[3][7]).toBe("");
  });

  it("is byte-identical whatever the input order", () => {
    const reversed = cities.split("\n").reverse().join("\r\n");
    expect(buildPlacesTsv(reversed, admin1, "test")).toBe(tsv);
  });

  it("refuses malformed rows", () => {
    expect(() =>
      buildPlacesTsv(
        city({ id: 9, name: "X", population: 1, lat: "91" }),
        admin1,
        "t",
      ),
    ).toThrow(/coordinates/);
    expect(() =>
      buildPlacesTsv(
        city({ id: 9, name: "X", population: 1, tz: "" }),
        admin1,
        "t",
      ),
    ).toThrow(/time zone/);
    expect(() => buildPlacesTsv("1\tX\tX", admin1, "t")).toThrow(/columns/);
  });
});

/** A zip with one deflated entry and a data descriptor, as GeoNames writes. */
function zipOf(name: string, data: Buffer, crc = crc32(data)) {
  const body = deflateRawSync(data);
  const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(0x0808, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);
  const centralOffset = local.length + nameBytes.length + body.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, nameBytes, body, central, nameBytes, end]);
}

describe("single-entry zip reader", () => {
  const text = Buffer.from("1\tLondon\n".repeat(100));

  it("inflates the one entry", () => {
    expect(readSingleEntryZip(zipOf("cities.txt", text), "cities.txt")).toEqual(
      text,
    );
  });

  it("refuses another entry name or a CRC mismatch", () => {
    expect(() =>
      readSingleEntryZip(zipOf("other.txt", text), "cities.txt"),
    ).toThrow(/entry is/);
    expect(() =>
      readSingleEntryZip(zipOf("cities.txt", text, 1234), "cities.txt"),
    ).toThrow(/CRC/);
  });
});
