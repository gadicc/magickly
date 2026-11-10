import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createPlaceIndex, MAX_QUERY_LENGTH, searchPlaces } from "./places";

vi.mock("server-only", () => ({}));

const fixture = readFileSync(
  new URL("./places.fixture.tsv", import.meta.url),
  "utf8",
);
const index = createPlaceIndex(fixture);
const names = (q: string, limit?: number) =>
  index
    .search(q, limit)
    .map((p) => (p.region ? `${p.name}, ${p.region}` : p.name));

describe("place search over a small fixture", () => {
  it("gives nothing for a query under two characters", () => {
    for (const q of ["", " ", "l", "  l  ", "l, gb", ", london"]) {
      expect(index.search(q)).toEqual([]);
    }
  });

  it("answers Places with region, country and time zone", () => {
    expect(index.search("london")[0]).toEqual({
      name: "London",
      region: "England",
      country: "GB",
      latitude: 51.509,
      longitude: -0.126,
      timezone: "Europe/London",
    });
    // A place with no first-level region has no region key at all.
    expect(index.search("kowloon")).toEqual([
      expect.not.objectContaining({ region: expect.anything() }),
    ]);
  });

  it("ranks exact names first, then prefixes, each by population", () => {
    expect(names("london")).toEqual(["London, England", "London, Ontario"]);
    expect(names("lon")).toEqual(["London, England", "London, Ontario"]);
    expect(names("spring")).toEqual(["Springfield, Illinois"]);
  });

  it("folds case and accents both ways", () => {
    expect(names("sao")).toEqual(["São Paulo, São Paulo"]);
    expect(names("SÃO   PAULO")).toEqual(["São Paulo, São Paulo"]);
    expect(names("zurich")[0]).toBe("Zürich, Zurich");
    expect(names("zürich")[0]).toBe("Zürich, Zurich");
    // The ASCII name GeoNames gives is a key too.
    expect(names("zuerich")[0]).toBe("Zürich, Zurich");
  });

  it("finds old and other-language names", () => {
    expect(names("kiev")).toEqual(["Kyiv, Kyiv City"]);
    expect(names("bombay")).toEqual(["Mumbai, Maharashtra"]);
  });

  it("ranks an exact alternate with name prefixes, above a word match", () => {
    expect(names("münchen")).toEqual([
      "Munich, Bavaria",
      "Ottobrunn bei München, Bavaria",
    ]);
  });

  it("ranks an alternate's prefix after every name match", () => {
    // "lutetia" is Paris's alternate; Lutsk is smaller but a name prefix.
    expect(names("lut")).toEqual(["Lutsk, Volyn", "Paris, Île-de-France"]);
    expect(names("bom")).toEqual(["Mumbai, Maharashtra"]);
  });

  it("puts districts after every other match", () => {
    expect(names("zurich")).toEqual([
      "Zürich, Zurich",
      "Zürich (Kreis 11), Zurich",
    ]);
    expect(names("paris")).toEqual([
      "Paris, Île-de-France",
      "Paris, Texas",
      "Paris 15 Vaugirard, Île-de-France",
    ]);
  });

  it("narrows by country code, country name or region after a comma", () => {
    expect(names("paris, texas")).toEqual(["Paris, Texas"]);
    expect(names("paris, us")).toEqual(["Paris, Texas"]);
    expect(names("paris, united st")).toEqual(["Paris, Texas"]);
    expect(names("paris,fr")).toEqual([
      "Paris, Île-de-France",
      "Paris 15 Vaugirard, Île-de-France",
    ]);
    expect(names("paris, ile")).toHaveLength(2);
    expect(names("london, canada")).toEqual(["London, Ontario"]);
    expect(names("london, ontario")).toEqual(["London, Ontario"]);
    expect(names("springfield, il")).toEqual(["Springfield, Illinois"]);
    expect(names("london, nowhere")).toEqual([]);
  });

  it("narrows by a region's letter code, exactly", () => {
    expect(names("paris, tx")).toEqual(["Paris, Texas"]);
    expect(names("PARIS, TX")).toEqual(["Paris, Texas"]);
    expect(names("washington, dc")).toEqual([
      "Washington, District of Columbia",
    ]);
    expect(names("london, eng")).toEqual(["London, England"]);
    expect(names("springfield, il")).toEqual(["Springfield, Illinois"]);
    // A code is matched whole: neither longer nor a different region's.
    expect(names("washington, dcx")).toEqual([]);
    expect(names("london, tx")).toEqual([]);
  });

  it("requires every term, so a picker label finds its own place", () => {
    expect(names("Springfield, Illinois, United States")).toEqual([
      "Springfield, Illinois",
    ]);
    expect(names("London, England, Canada")).toEqual([]);
  });

  it("cuts the query at 64 characters", () => {
    // Without the cut, the final ", texas" would reject London, Ontario.
    const q = `london, canada${",".repeat(MAX_QUERY_LENGTH - 14)}, texas`;
    expect(names(q)).toEqual(["London, Ontario"]);
  });

  it("returns at most `limit` places, at least one", () => {
    expect(names("paris", 1)).toEqual(["Paris, Île-de-France"]);
    expect(names("paris", 0)).toHaveLength(1);
    expect(names("paris", Number.NaN)).toHaveLength(3);
  });

  it("returns copies, so callers can't change the index", () => {
    const [london] = index.search("london");
    london.name = "Changed";
    expect(index.search("london")[0].name).toBe("London");
  });

  it("refuses a file in another format or with missing rows", () => {
    const [header, ...rows] = fixture.split("\n");
    const other = { ...JSON.parse(header), format: 1 };
    expect(() =>
      createPlaceIndex([JSON.stringify(other), ...rows].join("\n")),
    ).toThrow(/format/);
    expect(() =>
      createPlaceIndex([header, ...rows.slice(1)].join("\n")),
    ).toThrow(/rows/);
  });
});

describe("place search over the committed GeoNames file", () => {
  const first = (q: string) => {
    const [place] = searchPlaces(q);
    return place && `${place.name}, ${place.region}, ${place.country}`;
  };

  it("finds big places by name, old name and accentless name", () => {
    expect(first("London")).toBe("London, England, GB");
    expect(first("Kiev")).toBe("Kyiv, Kyiv City, UA");
    expect(first("Bombay")).toBe("Mumbai, Maharashtra, IN");
    expect(first("sao")).toBe("São Paulo, São Paulo, BR");
    expect(first("paris, texas")).toBe("Paris, Texas, US");
    expect(first("münchen")).toBe("Munich, Bavaria, DE");
  });

  it("knows US state and other letter codes after a comma", () => {
    expect(first("paris, tx")).toBe("Paris, Texas, US");
    expect(first("washington, dc")).toBe(
      "Washington, District of Columbia, US",
    );
    expect(first("springfield, il")).toBe("Springfield, Illinois, US");
    expect(first("belfast, nir")).toBe("Belfast, Northern Ireland, GB");
    // Exactly, not by prefix: "ni" is Nicaragua, not Northern Ireland.
    expect(searchPlaces("belfast, ni")).toEqual([]);
  });

  it('drops GeoNames\' "xx" alternates', () => {
    expect(searchPlaces("xx").map((p) => p.name)).not.toContain("Oslo");
    expect(searchPlaces("xxslo")).toEqual([]);
    expect(first("oslo")).toBe("Oslo, Oslo, NO");
  });

  it("knows UK, USA and UAE after a comma", () => {
    expect(first("london, uk")).toBe("London, England, GB");
    expect(first("paris, usa")).toBe("Paris, Texas, US");
    expect(first("dubai, uae")).toBe("Dubai, Dubai, AE");
  });

  it("puts Zürich before its Kreis districts", () => {
    const zurich = searchPlaces("zurich").map((p) => p.name);
    expect(zurich[0]).toBe("Zürich");
    const firstDistrict = zurich.findIndex((n) => n.includes("Kreis"));
    expect(firstDistrict).toBeGreaterThan(0);
    expect(zurich.slice(firstDistrict).every((n) => n.includes("Kreis"))).toBe(
      true,
    );
  });
});
