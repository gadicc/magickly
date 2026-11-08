import { describe, expect, it } from "vitest";
import {
  type CatalogRitual,
  chooseTab,
  compareRituals,
  hashTemple,
  parseCatalog,
  ritualGrade,
  templeHash,
  templeNames,
  templeRituals,
  templeTabs,
} from "./templeHalls";

const ritual = (
  title: string,
  templeSlug = "example",
  hallCount = 1,
  id = title,
): CatalogRitual => ({
  id,
  title,
  templeSlug,
  templeName: `${templeSlug} name`,
  hallCount,
});

describe("ritualGrade", () => {
  it.each([
    ["0=0 Neophyte", 0],
    ["Zelator 1=10 (sample)", 1],
    ["1 = 10", 1],
    ["1°=10□ Zelator", 1],
    ["Theoricus 2 ° = 9 □", 2],
    ["Philosophus 4=7", 4],
    ["Adeptus Minor 5=6 (sample)", 5],
    ["10=1 Ipsissimus", 10],
    ["The Portal Ritual", 4.5],
    ["portal", 4.5],
  ])("reads %s as %s", (title, grade) => {
    expect(ritualGrade(title)).toBe(grade);
  });

  it.each([
    "Equinox Ceremony",
    "Portals of the mind",
    "Teleportal",
    "Year 2026",
    "a = b",
  ])("finds no grade in %s", (title) => {
    expect(ritualGrade(title)).toBeNull();
  });
});

describe("compareRituals", () => {
  it("puts grades first, numerically, Portal between 4 and 5, then titles", () => {
    const titles = [
      "Equinox Ceremony",
      "Adeptus Minor 5=6",
      "10=1 Ipsissimus",
      "Portal",
      "2=9 Theoricus",
      "0=0 Neophyte",
      "Banishing",
      "4=7 Philosophus",
      "1 = 10 Zelator",
    ];
    expect(
      titles
        .map((title) => ({ title }))
        .sort(compareRituals)
        .map((entry) => entry.title),
    ).toEqual([
      "0=0 Neophyte",
      "1 = 10 Zelator",
      "2=9 Theoricus",
      "4=7 Philosophus",
      "Portal",
      "Adeptus Minor 5=6",
      "10=1 Ipsissimus",
      "Banishing",
      "Equinox Ceremony",
    ]);
  });

  it("orders rituals of one grade by title", () => {
    expect(
      compareRituals({ title: "0=0 Opening" }, { title: "0=0 Closing" }),
    ).toBeGreaterThan(0);
  });
});

describe("parseCatalog", () => {
  it("reads the catalog's rituals", () => {
    expect(
      parseCatalog({
        rituals: [
          {
            id: "a",
            title: "A",
            templeSlug: "t",
            updatedAt: "2026-11-08T00:00:00.000Z",
            hallCount: 2,
          },
        ],
      }),
    ).toEqual([
      { id: "a", title: "A", templeSlug: "t", templeName: "t", hallCount: 2 },
    ]);
    expect(
      parseCatalog({
        rituals: [
          {
            id: "a",
            title: "A",
            templeSlug: "t",
            templeName: "Temple T",
            hallCount: 0,
          },
        ],
      })?.[0].templeName,
    ).toBe("Temple T");
    expect(parseCatalog({ rituals: [] })).toEqual([]);
  });

  it.each([
    null,
    [],
    {},
    { rituals: {} },
    { rituals: [null] },
    { rituals: [{ id: 1, title: "A", templeSlug: "t", hallCount: 1 }] },
    { rituals: [{ id: "a", title: "A", templeSlug: "", hallCount: 1 }] },
    { rituals: [{ id: "a", title: "A", templeSlug: "t", hallCount: -1 }] },
    { rituals: [{ id: "a", title: "A", templeSlug: "t", hallCount: 1.5 }] },
    { rituals: [{ id: "a", title: 2, templeSlug: "t", hallCount: 1 }] },
  ])("refuses %j", (value) => {
    expect(parseCatalog(value)).toBeNull();
  });
});

describe("temple tabs", () => {
  const catalog = [
    ritual("0=0", "zeta"),
    ritual("Equinox", "alpha-temple"),
    ritual("No halls", "empty", 0),
    ritual("1=10", "zeta"),
  ];

  it("lists temples with halls, by label", () => {
    expect(templeTabs(catalog)).toEqual(["alpha-temple", "zeta"]);
  });

  it("lists a temple's rituals with halls in order", () => {
    expect(
      templeRituals(
        [...catalog, ritual("Banishing", "zeta"), ritual("2=9", "zeta", 0)],
        "zeta",
      ).map((entry) => entry.title),
    ).toEqual(["0=0", "1=10", "Banishing"]);
  });

  it("names each temple, sorting the tabs by name", () => {
    expect(templeNames(catalog).get("zeta")).toBe("zeta name");
    expect(
      templeTabs([
        { ...ritual("A", "a"), templeName: "Zion" },
        { ...ritual("B", "b"), templeName: "Amen" },
      ]),
    ).toEqual(["b", "a"]);
  });

  it("reads and writes the hash", () => {
    expect(hashTemple(templeHash("a b+c&d"))).toBe("a b+c&d");
    expect(templeHash("example")).toBe("#temple=example");
    expect(hashTemple("")).toBeNull();
    expect(hashTemple("#hall-2")).toBeNull();
    expect(hashTemple("#temple=")).toBeNull();
    expect(hashTemple("temple=x")).toBeNull();
  });
});

describe("chooseTab", () => {
  const temples = ["alpha", "beta"];

  it("opens the hash's temple first", () => {
    expect(
      chooseTab({ temples, hash: "beta", remembered: { slug: "alpha" } }),
    ).toEqual({
      tab: "beta",
      forget: false,
    });
  });

  it("then the remembered temple", () => {
    expect(
      chooseTab({ temples, hash: "gone", remembered: { slug: "alpha" } }),
    ).toEqual({
      tab: "alpha",
      forget: false,
    });
  });

  it("forgets a remembered temple with no tab, then opens the only temple", () => {
    expect(
      chooseTab({
        temples: ["alpha"],
        hash: null,
        remembered: { slug: "gone" },
      }),
    ).toEqual({ tab: "alpha", forget: true });
  });

  it("opens a remembered Standard before the only temple", () => {
    expect(
      chooseTab({
        temples: ["alpha"],
        hash: null,
        remembered: { standard: true },
      }),
    ).toEqual({ tab: null, forget: false });
    expect(
      chooseTab({
        temples: ["alpha"],
        hash: "alpha",
        remembered: { standard: true },
      }),
    ).toEqual({ tab: "alpha", forget: false });
  });

  it("else opens Standard", () => {
    expect(chooseTab({ temples, hash: null, remembered: null })).toEqual({
      tab: null,
      forget: false,
    });
    expect(chooseTab({ temples: [], hash: "x", remembered: null })).toEqual({
      tab: null,
      forget: false,
    });
  });
});
