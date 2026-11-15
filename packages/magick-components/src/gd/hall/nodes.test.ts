import { describe, expect, expectTypeOf, it } from "vitest";
import { DEFAULT_HALL_ART } from "./art/index.ts";
import type {
  AltarNode,
  BannerNode,
  BannersNode,
  BoardNode,
  CandlestickNode,
  CaptionNode,
  CardNode,
  DaisNode,
  DoorNode,
  FloorNode,
  GdHallNode,
  HallColor,
  HallRole,
  HallStrictNode,
  HebrewLetterNode,
  ItemNode,
  KameaNode,
  LabelNode,
  LamenNode,
  MarkerNode,
  OfficerNode,
  PillarNode,
  PlatformNode,
  SealNode,
  ShewbreadNode,
  TabletNode,
  TarotKeyNode,
  ThroneNode,
  VeilNode,
} from "./nodes.ts";
import type { HallNode } from "./types.ts";
import { validateHall } from "./validate.ts";
import { HALL_COLORS, HALL_ROLES } from "./vocabulary.ts";

/*
 * The strict node types (plan 084, stage 1). The type assertions below
 * are checked by the package's `tsc` (`pnpm typecheck`), not by vitest:
 * each `@ts-expect-error` fails the check if its line compiles.
 */

/** The node, as written: only an object literal is checked for excess. */
const hall = (node: GdHallNode) => node;
const floor = (node: FloorNode) => node;

describe("the strict node types", () => {
  it("are each a HallNode", () => {
    expectTypeOf<GdHallNode>().toExtend<HallNode>();
    expectTypeOf<DaisNode>().toExtend<HallNode>();
    expectTypeOf<BannersNode>().toExtend<HallNode>();
    expectTypeOf<FloorNode>().toExtend<HallNode>();
    expectTypeOf<CaptionNode>().toExtend<HallNode>();
    expectTypeOf<DoorNode>().toExtend<HallNode>();
    expectTypeOf<OfficerNode>().toExtend<HallNode>();
    expectTypeOf<LamenNode>().toExtend<HallNode>();
    expectTypeOf<MarkerNode>().toExtend<HallNode>();
    expectTypeOf<AltarNode>().toExtend<HallNode>();
    expectTypeOf<PlatformNode>().toExtend<HallNode>();
    expectTypeOf<ThroneNode>().toExtend<HallNode>();
    expectTypeOf<BoardNode>().toExtend<HallNode>();
    expectTypeOf<PillarNode>().toExtend<HallNode>();
    expectTypeOf<BannerNode>().toExtend<HallNode>();
    expectTypeOf<VeilNode>().toExtend<HallNode>();
    expectTypeOf<ShewbreadNode>().toExtend<HallNode>();
    expectTypeOf<CandlestickNode>().toExtend<HallNode>();
    expectTypeOf<HebrewLetterNode>().toExtend<HallNode>();
    expectTypeOf<ItemNode>().toExtend<HallNode>();
    expectTypeOf<TarotKeyNode>().toExtend<HallNode>();
    expectTypeOf<CardNode>().toExtend<HallNode>();
    expectTypeOf<TabletNode>().toExtend<HallNode>();
    expectTypeOf<KameaNode>().toExtend<HallNode>();
    expectTypeOf<SealNode>().toExtend<HallNode>();
    expectTypeOf<LabelNode>().toExtend<HallNode>();
    expectTypeOf<HallStrictNode>().toExtend<HallNode>();
    // One type per tag: the 26 tags of the vocabulary and the art.
    expectTypeOf<HallStrictNode["type"]>().toEqualTypeOf<
      | "gdHall"
      | "dais"
      | "banners"
      | "floor"
      | "caption"
      | "door"
      | "officer"
      | "lamen"
      | "marker"
      | "altar"
      | "platform"
      | "throne"
      | "board"
      | "pillar"
      | "banner"
      | "veil"
      | "shewbread"
      | "candlestick"
      | "hebrewLetter"
      | "item"
      | "tarotKey"
      | "card"
      | "tablet"
      | "kamea"
      | "seal"
      | "label"
    >();
  });

  it("take a well-formed hall, which validates clean", () => {
    const neophyte = hall({
      type: "gdHall",
      wall: "gradient",
      children: [
        {
          type: "dais",
          children: [{ type: "officer", role: "hierophant", label: "" }],
        },
        {
          type: "floor",
          children: [
            { type: "pillar", kind: "black", x: 4, y: 3 },
            {
              type: "altar",
              at: "center",
              children: [
                { type: "item", kind: "cross", form: "calvary", fill: "gray" },
                { type: "item", kind: "lamp", light: "white", x: 0.5 },
                { type: "item", kind: "cup", x: -0.5 },
              ],
            },
            {
              type: "officer",
              role: "hiereus",
              grade: "portal",
              x: 8,
              y: 14,
              children: [{ type: "label", text: "West" }],
            },
            // A blank key and a blank board are deliberate (R2).
            { type: "tarotKey", x: 2, y: 2 },
            { type: "tablet", x: 14, y: 2 },
            { type: "board", kind: "flamingSword", x: 2, y: 14 },
            { type: "board", w: 2, h: 1, x: 14, y: 14 },
            { type: "marker", text: "Candidate", x: 8, y: 12 },
            { type: "label", text: "Floor", at: "south", y: -1 },
            { type: "door", side: "north", y: 8 },
          ],
        },
        { type: "door", x: 8 },
        { type: "caption", text: "Neophyte" },
      ],
    });
    // A strict hall is a HallNode: no cast.
    const lenient: HallNode = neophyte;
    expect(validateHall(lenient, { art: DEFAULT_HALL_ART })).toEqual([]);
  });

  it("refuse what the vocabulary refuses", () => {
    // Wrong nesting: a caption stands in gdHall, not in the floor.
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "caption", text: "Hall" }] });
    // Wrong nesting: an officer holds only labels.
    floor({
      type: "floor",
      children: [
        {
          type: "officer",
          role: "hegemon",
          // @ts-expect-error
          children: [{ type: "item", kind: "cup" }],
        },
      ],
    });
    // Wrong nesting: a placeable belongs in the floor or a row.
    // @ts-expect-error
    hall({ type: "gdHall", children: [{ type: "pillar" }] });
    // Wrong value: an officer's role is one of HALL_ROLES.
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "officer", role: "hegemen" }] });
    // Wrong value: an unknown item kind.
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "item", kind: "cupp" }] });
    // Wrong value: a light burns red, yellow or white.
    floor({
      type: "floor",
      // @ts-expect-error
      children: [{ type: "item", kind: "lamp", light: "green" }],
    });
    // Missing required value: an officer's role.
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "officer", x: 8 }] });
    // Missing required value: an item's kind, a card's kind, a kamea's
    // planet, a letter, a marker's, caption's and label's text.
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "item" }] });
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "card" }] });
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "kamea" }] });
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "hebrewLetter" }] });
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "marker" }] });
    // @ts-expect-error
    hall({ type: "gdHall", children: [{ type: "caption" }] });
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "label" }] });
    // `centre` is `center` in a strict hall.
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "altar", at: "centre" }] });
    // `grey` is `gray` in a strict hall.
    floor({
      type: "floor",
      // @ts-expect-error
      children: [{ type: "item", kind: "cross", fill: "grey" }],
    });
    // A cross's form on a cup.
    floor({
      type: "floor",
      // @ts-expect-error
      children: [{ type: "item", kind: "cup", form: "calvary" }],
    });
    // A light on a cross.
    floor({
      type: "floor",
      // @ts-expect-error
      children: [{ type: "item", kind: "cross", light: "red" }],
    });
    // A door on the North wall needs its y, and does not read an x.
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "door", side: "north" }] });
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "door", side: "north", x: 8 }] });
    // A door on the West wall (the default) stands at its x.
    // @ts-expect-error
    hall({ type: "gdHall", children: [{ type: "door" }] });
    // A board with a diagram takes no w or h.
    floor({
      type: "floor",
      // @ts-expect-error
      children: [{ type: "board", kind: "theFall", w: 2 }],
    });
  });

  it("check only object literals for excess, as TypeScript does", () => {
    // Not fresh, so not checked for a kind's excess attributes: a cup
    // with a cross's form still assigns, and the form is ignored.
    const written = { type: "item", kind: "cup", form: "calvary" } as const;
    const cup: ItemNode = written;
    expect(
      validateHall({
        type: "gdHall",
        children: [floor({ type: "floor", children: [cup] })],
      }),
    ).toEqual([]);
  });

  it("hold HallRole and HallColor to the vocabulary's maps", () => {
    // A Record over each union names every member once, no more.
    const roles = {
      imperator: true,
      cancellarius: true,
      praemonstrator: true,
      hierophant: true,
      pastHierophant: true,
      hiereus: true,
      hegemon: true,
      keryx: true,
      stolistes: true,
      dadouchos: true,
      sentinel: true,
      chiefAdept: true,
      secondAdept: true,
      thirdAdept: true,
    } satisfies Record<HallRole, true>;
    const colors = {
      none: true,
      white: true,
      black: true,
      red: true,
      blue: true,
      yellow: true,
      gold: true,
      green: true,
      gray: true,
    } satisfies Record<HallColor, true>;
    expect(Object.keys(roles).sort()).toEqual([...HALL_ROLES.keys()].sort());
    expect(Object.keys(colors).sort()).toEqual([...HALL_COLORS.keys()].sort());
  });
});
