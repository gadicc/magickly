import { HALL_ROLES } from "@magick-components/gd/hall/vocabulary";
import { describe, expect, it } from "vitest";
import { gdHallArt } from "@/app/gd/hall/art";
import { hallView } from "./hallEdits";
import { hostAccepts } from "./hallHostRules";
import type { HallElement } from "./hallModel";
import {
  goesOnHost,
  HALL_PALETTE_GROUPS,
  type HallPaletteEntry,
  hallItemKinds,
  hallPalette,
  hallPaletteSections,
  insertFromPalette,
  itemKindLabel,
} from "./hallPalette";
import {
  byAttr,
  findNode,
  hallFromPug,
  neophyteHall,
  sequentialIds,
} from "./hallTestFixtures";

const palette = hallPalette(gdHallArt);
const entry = (key: string) =>
  palette.find((candidate) => candidate.key === key) as HallPaletteEntry;
const add = (hall: HallElement, key: string, selected?: string) => {
  const view = hallView(hall, gdHallArt);
  if (!view.resolved) throw new Error("no layout");
  const inserted = insertFromPalette(
    hall,
    view.resolved,
    entry(key),
    selected,
    sequentialIds("New"),
  );
  return { ...inserted, view: hallView(inserted.hall, gdHallArt) };
};

describe("the palette", () => {
  it("splits into one section per group, in the toolbar's order", () => {
    const sections = hallPaletteSections(palette);
    expect(sections.map(({ button }) => button)).toEqual([
      "Officer",
      "Furniture",
      "Banner",
      "Item",
      "Symbol",
      "Text",
    ]);
    // Every entry once, in its group, in the palette's order.
    expect(sections.flatMap(({ entries }) => entries)).toEqual(palette);
    for (const { group, entries } of sections)
      for (const { key, group: own } of entries) expect(own, key).toBe(group);
    // Each button's name covers what it offers: the marker is text in a
    // box, the Hebrew letter a symbol.
    expect(sections.at(-1)?.entries.map(({ key }) => key)).toEqual([
      "label",
      "marker",
    ]);
    expect(
      sections.find(({ group }) => group === "Symbols")?.entries.at(-1)?.key,
    ).toBe("hebrewLetter");
    expect(
      sections
        .find(({ group }) => group === "Officers")
        ?.entries.map(({ tag }) => tag),
    ).toEqual(Array(HALL_ROLES.size).fill("officer"));
    // A group without entries has no button.
    expect(
      hallPaletteSections(palette.filter(({ group }) => group !== "Items")).map(
        ({ group }) => group,
      ),
    ).not.toContain("Items");
    expect(HALL_PALETTE_GROUPS.size).toBe(6);
  });

  it("offers every officer, the furniture, banners, items and symbols", () => {
    const keys = palette.map((candidate) => candidate.key);
    for (const role of HALL_ROLES.keys())
      expect(keys).toContain(`officer:${role}`);
    for (const key of [
      "marker",
      "altar",
      "altar:white",
      "pillar:black",
      "pillar:white",
      "platform",
      "throne",
      "veil",
      "door",
      "banner:east",
      "banner:west",
      "hebrewLetter",
      "tarotKey",
      "tablet",
      "shewbread",
      "candlestick",
      "board:flamingSword",
      "board:minutumMundum",
      "board:gardenOfEden",
      "board:theFall",
      "card:pan",
      "card:devil",
      "card:death",
      "card:typhon",
      "kamea",
      "seal",
      "label",
    ])
      expect(keys).toContain(key);
    // The cards come labelled, as the Portal's diagram labels them.
    expect(
      palette.find((candidate) => candidate.key === "card:devil"),
    ).toMatchObject({
      label: "The Devil (card)",
      tag: "card",
      attrs: { kind: "devil", label: "Devil" },
    });
    // Every item the package draws.
    expect(hallItemKinds(gdHallArt)).toEqual([
      "brazier",
      "bread",
      "candle",
      "censer",
      "chalice",
      "cross",
      "cup",
      "fan",
      "gong",
      "lamp",
      "lantern",
      "lightning",
      "pantacle",
      "pentagram",
      "rose",
      "salt",
      "triangle",
    ]);
    // A tablet comes in the Golden Dawn's version, which goes unwritten.
    expect(
      palette.find((candidate) => candidate.key === "tablet"),
    ).toMatchObject({ tag: "tablet", attrs: { element: "earth" } });
    expect(
      palette.find((candidate) => candidate.key === "tablet")?.attrs,
    ).not.toHaveProperty("version");
    expect(new Set(keys).size).toBe(keys.length);
    expect(palette.map((candidate) => candidate.group)).toEqual(
      [...palette.map((candidate) => candidate.group)].sort(
        (a, b) =>
          [
            "Officers",
            "Furniture",
            "Banners",
            "Items",
            "Symbols",
            "Text",
          ].indexOf(a) -
          [
            "Officers",
            "Furniture",
            "Banners",
            "Items",
            "Symbols",
            "Text",
          ].indexOf(b),
      ),
    );
    expect(itemKindLabel("greekFiveSquares")).toBe("Greek five squares");
  });

  it("validates every component it adds", () => {
    for (const candidate of palette) {
      const { view, id } = add(neophyteHall(), candidate.key);
      const added = view.byId.get(id);
      expect(added, candidate.key).toBeDefined();
    }
  });
});

describe("goesOnHost", () => {
  it("puts on a host what it takes, and labels on any host", () => {
    expect(goesOnHost("item", "altar")).toBe(true);
    expect(goesOnHost("officer", "platform")).toBe(true);
    expect(goesOnHost("banner", "throne")).toBe(true);
    expect(goesOnHost("officer", "altar")).toBe(false);
    expect(goesOnHost("pillar", "altar")).toBe(false);
    expect(goesOnHost("item", "pillar")).toBe(false);
    expect(goesOnHost("label", "board")).toBe(true);
    expect(goesOnHost("label", "pillar")).toBe(false);
  });

  it("agrees with what a host takes by a drag or Stands on", () => {
    const tags = [...new Set(hallPalette(gdHallArt).map((e) => e.tag))];
    for (const host of ["altar", "platform", "throne", "board", "pillar"])
      for (const tag of tags.filter((tag) => tag !== "label"))
        expect(goesOnHost(tag, host), `${tag} on ${host}`).toBe(
          hostAccepts(host, tag),
        );
    // A tarot key with a platform selected goes on the floor beside it.
    expect(goesOnHost("tarotKey", "platform")).toBe(false);
    expect(goesOnHost("item", "board")).toBe(false);
  });
});

describe("insertFromPalette", () => {
  it("puts a tarot key beside a selected platform, which takes none", () => {
    const hall = hallFromPug("gdHall", "  floor", "    platform(x=8, y=12)");
    const platform = findNode(hall, (node) => node.tag === "platform");
    const { view, id } = add(hall, "tarotKey", platform?.id);
    const parent = view.index.byId.get(id)?.parentId;
    expect(view.index.byId.get(parent ?? "")?.node.tag).toBe("floor");
  });

  it("puts a new object at the floor's centre, clear of the altar", () => {
    const { hall, id, view } = add(neophyteHall(), "item:cup");
    expect(id).toBe("New0000000000001");
    const cup = view.byId.get(id);
    // The altar stands at the centre: a square South at a time.
    expect(cup?.node.attrs).toEqual({ kind: "cup", x: 10, y: 8 });
    expect(cup?.node.children).toEqual([]);
    expect(cup?.rowPath.slice(0, 1)).toEqual([1]);
    expect(hall.children).toHaveLength(3);
  });

  it("puts it beside the selection", () => {
    const hall = neophyteHall();
    const stolistes = byAttr(hall, "role", "stolistes");
    const { view, id } = add(hall, "officer:keryx", stolistes.id);
    expect(view.byId.get(id)?.node.attrs).toEqual({
      role: "keryx",
      x: 3,
      y: 8,
    });
  });

  it("puts an item on a selected altar, an officer on a platform", () => {
    const hall = neophyteHall();
    const altar = hallView(hall, gdHallArt).selectables.find(
      (candidate) => candidate.node.tag === "altar",
    );
    const onAltar = add(hall, "item:salt", altar?.id);
    expect(onAltar.view.index.byId.get(onAltar.id)?.parentId).toBe(altar?.id);
    expect(onAltar.view.byId.get(onAltar.id)?.node.attrs).toEqual({
      kind: "salt",
    });
    // An officer next to the altar, not on it.
    const beside = add(hall, "officer:hegemon", altar?.id);
    expect(beside.view.index.byId.get(beside.id)?.parentId).not.toBe(altar?.id);
    const platform = hallView(hall, gdHallArt).selectables.find(
      (candidate) => candidate.node.tag === "platform",
    );
    const seated = add(hall, "officer:hiereus", platform?.id);
    expect(seated.view.index.byId.get(seated.id)?.parentId).toBe(platform?.id);
  });

  it("puts the veil across the hall, whatever is selected", () => {
    const hall = neophyteHall();
    // A dais officer selected: the veil goes into the floor, not the row.
    const imperator = byAttr(hall, "role", "imperator");
    for (const selected of [undefined, imperator.id]) {
      const { view, id } = add(hall, "veil", selected);
      const veil = view.byId.get(id);
      expect(veil?.node.attrs).toEqual({ x: 8, y: -0.3 });
      expect(view.index.byId.get(veil?.node.id ?? "")?.parentId).toBe(
        findNode(hall, (node) => node.tag === "floor")?.id,
      );
      // The hall's width, within the walls.
      const object = veil?.object;
      expect(object?.cx).toBe(8);
      expect((object?.cx ?? 0) - (object?.width ?? 0) / 2).toBeCloseTo(0, 6);
      expect((object?.cx ?? 0) + (object?.width ?? 0) / 2).toBeCloseTo(16, 6);
    }
  });

  it("puts a door in the West wall", () => {
    const { view, id } = add(neophyteHall(), "door");
    expect(view.byId.get(id)).toMatchObject({
      node: { attrs: { side: "west", x: 8, width: 2 } },
    });
    expect(view.byId.get(id)?.door).toBeDefined();
  });

  it("makes a floor when the hall has none, before the caption", () => {
    const hall = hallFromPug("gdHall", '  caption(text="Empty")');
    const { hall: next, view, id } = add(hall, "altar");
    expect(next.children?.map((child) => (child as HallElement).tag)).toEqual([
      "floor",
      "caption",
    ]);
    expect(view.byId.get(id)?.node.attrs).toEqual({ x: 8, y: 8 });
    const bare = add(hallFromPug("gdHall"), "altar");
    expect(
      bare.hall.children?.map((child) => (child as HallElement).tag),
    ).toEqual(["floor"]);
  });

  it("gives up looking for space after eight squares", () => {
    const crowded = hallFromPug(
      "gdHall",
      "  floor",
      ...Array.from(
        { length: 9 },
        (_, index) => `    altar(x=${8 + index}, y=8)`,
      ),
    );
    const { view, id } = add(crowded, "item:cup");
    expect(view.byId.get(id)?.node.attrs).toMatchObject({ x: 8, y: 8 });
  });
});
