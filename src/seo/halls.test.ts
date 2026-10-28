import { readdirSync } from "node:fs";
import path from "node:path";
import Data from "magick-data";
import { describe, expect, it } from "vitest";
import {
  GD_HALL_RESERVED_SLUGS,
  GD_HALL_SLUGS,
  GD_HALLS,
  gdHall,
} from "@/render/contracts/gdHall";
import {
  counted,
  gradeHalls,
  hallAlt,
  hallCardLabel,
  hallDescription,
  hallGroupName,
  hallGroups,
  hallPage,
  hallPages,
  hallPath,
  hallStations,
  listed,
  withArticle,
} from "./halls";

describe("the temple halls' search pages", () => {
  it("gives every hall a page under /gd/halls, in the presets' order", () => {
    expect(hallPages().map((page) => page.path)).toEqual(
      GD_HALL_SLUGS.map((slug) => `/gd/halls/${slug}`),
    );
    expect(hallPage("zelator-1")).toEqual({
      path: "/gd/halls/zelator-1",
      title: "Golden Dawn Zelator Temple, part 1 (1=10): floor plan",
      description:
        "Floor plan of the Golden Dawn Zelator Temple, part 1 (1=10): the officers' stations, the altar and the Earth tablet, after Regardie (1938). CC BY 4.0.",
    });
    expect(hallPage("zelator1")).toBeNull();
    expect(hallPage("toString")).toBeNull();
  });

  it("keeps the slugs clear of the static pages beside them", () => {
    // A static page under /gd/halls (the editor) would shadow a hall of
    // the same name, since Next matches static segments first. Only
    // folders that are routes count: not dynamic segments, private
    // folders (`_*`, the presets' `__snapshots__`), route groups or
    // parallel slots.
    const dir = path.join(process.cwd(), "src/app/gd/halls");
    const routes = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !/^[[_(@]/.test(entry.name))
      .map((entry) => entry.name);
    expect(routes).toContain("editor");
    // Every static page is reserved, so a new one must be reserved first.
    for (const route of routes) expect(GD_HALL_RESERVED_SLUGS).toContain(route);
    for (const slug of GD_HALL_SLUGS)
      expect(GD_HALL_RESERVED_SLUGS).not.toContain(slug);
  });

  it("describes each hall in a search snippet's length, each differently", () => {
    const descriptions = GD_HALLS.map((hall) => hallDescription(hall));
    for (const text of descriptions) {
      expect(text.length).toBeLessThanOrEqual(160);
      expect(text).toMatch(/after Regardie \(1938\)\. CC BY 4\.0\.$/);
    }
    expect(new Set(descriptions).size).toBe(descriptions.length);
    expect(hallDescription(gdHall("portal-2") as never)).toBe(
      "Floor plan of the Golden Dawn Portal Temple, part 2: the officers' stations, the altar and the four emblem cards, after Regardie (1938). CC BY 4.0.",
    );
    expect(hallDescription(gdHall("practicus-1") as never)).toContain(
      "the altar with Judgement (XX)",
    );
    expect(hallDescription(gdHall("philosophus-3") as never)).toContain(
      "the altar with the Tower (XVI)",
    );
    // A hall with no trump and nothing else to tell it by names its
    // altar's first items.
    expect(hallDescription(gdHall("neophyte") as never)).toContain(
      "the altar with the cross and the triangle,",
    );
  });

  it("writes alt text naming the officers and the altar, within 250 characters", () => {
    const alts = GD_HALLS.map((hall) => hallAlt(hall));
    for (const [index, text] of alts.entries()) {
      expect(text.length).toBeLessThanOrEqual(250);
      expect(text).toContain("East at the top");
      expect(text).toContain(GD_HALLS[index].grade);
    }
    expect(new Set(alts).size).toBe(alts.length);
    expect(hallAlt(gdHall("neophyte") as never)).toBe(
      "Floor plan of the Golden Dawn Neophyte Temple, East at the top, with the Hegemon, Stolistes, Dadouchos, Hiereus, Keryx, Sentinel, Hierophant, Past Hierophant and the three Chiefs; on the altar the cross, the triangle and the rose.",
    );
    expect(hallAlt(gdHall("portal-1") as never)).toBe(
      "Floor plan of the Golden Dawn Portal Temple, part 1, East at the top, with the Third Adept, Second Adept, Hegemon, Hiereus and Chief Adept; on the altar the cross.",
    );
  });

  it("groups the halls by grade and labels each the one way", () => {
    // The index, the rail and the select all show these (plan 062's
    // amendment), so they are pinned here once.
    expect(
      hallGroups().map((group) => [
        hallGroupName(group),
        group.halls.map(hallCardLabel),
      ]),
    ).toEqual([
      ["Neophyte 0=0", ["The hall"]],
      ["Zelator 1=10", ["Part 1", "Part 2"]],
      ["Theoricus 2=9", ["Part 1 · 32nd path", "Part 2 · In Yesod"]],
      [
        "Practicus 3=8",
        ["Part 1 · 31st path", "Part 2 · 30th path", "Part 3 · In Hod"],
      ],
      [
        "Philosophus 4=7",
        [
          "Part 1 · 29th path",
          "Part 2 · 28th path",
          "Part 3 · 27th path",
          "Part 4 · In Netzach",
        ],
      ],
      ["Portal", ["Part 1", "Part 2"]],
    ]);
    expect(
      hallGroups().flatMap((group) => group.halls.map((card) => card.hall)),
    ).toEqual([...GD_HALLS]);
  });

  it("finds each grade's halls by its magick-data id", () => {
    for (const hall of GD_HALLS)
      expect(Object.keys(Data.gdGrade)).toContain(hall.gradeId);
    expect(gradeHalls("portal").map(hallPath)).toEqual([
      "/gd/halls/portal-1",
      "/gd/halls/portal-2",
    ]);
    expect(gradeHalls("0=0").map((hall) => hall.slug)).toEqual(["neophyte"]);
    expect(gradeHalls("5=6")).toEqual([]);
  });

  it("words each station and counts each altar's items", () => {
    const stations = hallStations(gdHall("practicus-3") as never);
    expect(stations.officers).toEqual([
      { name: "Hiereus", where: "in the North" },
      { name: "Hegemon", where: "in the South" },
      { name: "Hierophant", where: "West of the altar" },
    ]);
    expect(stations.altars).toEqual([
      {
        name: "altar",
        where: "in the centre",
        items: ["cross", "cup", "triangle", "three red lamps"],
      },
    ]);
  });

  it("counts, lists and articles names", () => {
    expect(counted(["red lamp", "cup", "red lamp", "cross", "cross"])).toEqual([
      "two red lamps",
      "cup",
      "two crosses",
    ]);
    expect(counted(Array(9).fill("cup"))).toEqual(["9 cups"]);
    expect(listed([])).toBe("");
    expect(listed(["a"])).toBe("a");
    expect(listed(["a", "b", "c"])).toBe("a, b and c");
    expect(
      [
        "cross",
        "The Devil",
        "Death",
        "The Universe (XXI)",
        "three red lamps",
      ].map(withArticle),
    ).toEqual([
      "the cross",
      "the Devil",
      "Death",
      "the Universe (XXI)",
      "three red lamps",
    ]);
    expect(withArticle("Judgement (XX)")).toBe("Judgement (XX)");
  });

  it("shortens what does not fit, down to a count of officers", () => {
    const neophyte = gdHall("neophyte") as never;
    const crowd = Array.from({ length: 12 }, (_, i) => ({
      name: `Officer number ${i + 1} of the long names`,
      where: "in the centre",
    }));
    expect(
      hallAlt(neophyte, { officers: crowd, altars: [], furniture: [] }),
    ).toBe(
      "Floor plan of the Golden Dawn Neophyte Temple, East at the top, with 12 officers.",
    );
    const furniture = [
      { name: "Pan", where: "in the North" },
      { name: "The Devil", where: "in the North" },
      ...["Earth", "Air", "Water"].map((element) => ({
        name: `${element} tablet`,
        where: "by the North wall",
      })),
      ...Array.from({ length: 8 }, () => ({
        name: "Table of Shewbread",
        where: "in the North",
      })),
    ];
    // The cards by name when not all four, the tablets counted, as many as
    // fit, skipping what does not; nothing on the altar but the altar.
    const text = hallDescription(neophyte, {
      officers: [],
      altars: [],
      furniture,
    });
    expect(text).toBe(
      "Floor plan of the Golden Dawn Neophyte Temple (0=0): the officers' stations, the altar, the Table of Shewbread and Pan, after Regardie (1938). CC BY 4.0.",
    );
    expect(
      hallDescription(gdHall("portal-1") as never, {
        officers: [],
        altars: [],
        furniture: furniture.slice(0, 5),
      }),
    ).toBe(
      "Floor plan of the Golden Dawn Portal Temple, part 1: the officers' stations, the altar, Pan and the Devil, after Regardie (1938). CC BY 4.0.",
    );
  });
});
