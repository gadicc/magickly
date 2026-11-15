import { describe, expect, expectTypeOf, it } from "vitest";
import { hasGradeLamen, LAMEN_GRADES } from "../lamenGrades.ts";
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
  GradeLamenRole,
  HallColor,
  HallRole,
  HallStrictNode,
  HebrewLetterNode,
  ItemKind,
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
import { hallTagSpec } from "./spec.ts";
import type { HallNode } from "./types.ts";
import { validateHall } from "./validate.ts";
import {
  CORE_ITEM_KINDS,
  HALL_COLORS,
  HALL_ROLES,
  HALL_TAGS,
} from "./vocabulary.ts";

/*
 * The strict node types (plan 084, stage 1). The type assertions below
 * are checked by the package's `tsc` (`pnpm typecheck`), not by vitest:
 * each `@ts-expect-error` fails the check if its line compiles.
 */

/** The node, as written: only an object literal is checked for excess. */
const hall = (node: GdHallNode) => node;
const floor = (node: FloorNode) => node;

/** Every name a strict node's attributes take, across a union's members. */
type AttributeName<Node> = Node extends unknown
  ? Exclude<keyof Node, "type" | "children">
  : never;
type Tag = HallStrictNode["type"];
/** Each tag's attribute names, as a set of keys the types must match. */
type AttributeNames = {
  [T in Tag]: Record<AttributeName<Extract<HallStrictNode, { type: T }>>, true>;
};

const PLACED = {
  x: true,
  y: true,
  at: true,
  anchor: true,
  scale: true,
  label: true,
  labelPos: true,
} as const;

/** What the types say each tag takes; compared with the specs below. */
const ATTRIBUTES = {
  gdHall: {
    dais: true,
    wall: true,
    compass: true,
    padding: true,
    labelSize: true,
    margin: true,
    marginNorth: true,
    marginSouth: true,
    marginEast: true,
    marginWest: true,
  },
  dais: { spread: true },
  banners: { side: true, spread: true },
  floor: {},
  caption: { text: true },
  door: { side: true, x: true, y: true, width: true },
  officer: { ...PLACED, role: true, grade: true },
  lamen: { ...PLACED, role: true, grade: true },
  marker: { ...PLACED, text: true, shape: true },
  altar: { ...PLACED, kind: true },
  platform: { ...PLACED, w: true, h: true },
  throne: { ...PLACED, w: true, h: true },
  board: { ...PLACED, kind: true, w: true, h: true },
  pillar: { ...PLACED, kind: true, glow: true },
  banner: { ...PLACED, kind: true },
  veil: PLACED,
  shewbread: PLACED,
  candlestick: PLACED,
  hebrewLetter: { ...PLACED, letter: true },
  item: {
    ...PLACED,
    kind: true,
    form: true,
    dir: true,
    fill: true,
    stroke: true,
    light: true,
  },
  tarotKey: { ...PLACED, n: true },
  card: { ...PLACED, kind: true },
  tablet: {
    ...PLACED,
    element: true,
    version: true,
    reversed: true,
    alt: true,
  },
  kamea: { ...PLACED, planet: true },
  seal: { ...PLACED, planet: true },
  label: {
    text: true,
    pos: true,
    width: true,
    size: true,
    x: true,
    y: true,
    at: true,
    anchor: true,
  },
} satisfies AttributeNames;

const ITEM_KINDS = {
  cross: true,
  triangle: true,
  pentagram: true,
  lightning: true,
  lamp: true,
  lantern: true,
  pantacle: true,
  gong: true,
  brazier: true,
  candle: true,
  cup: true,
  chalice: true,
  censer: true,
  rose: true,
  salt: true,
  bread: true,
  fan: true,
} satisfies Record<ItemKind, true>;

/** The art's item kinds, and the tags it adds. */
const artKeys = [...DEFAULT_HALL_ART.keys()];
const artItemKinds = artKeys
  .filter((key) => key.startsWith("item:"))
  .map((key) => key.slice("item:".length));
const sorted = (names: Iterable<string>) => [...new Set(names)].sort();

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
  });

  it("take a hall with every tag, which validates clean", () => {
    const every = hall({
      type: "gdHall",
      wall: "gradient",
      dais: 5,
      children: [
        {
          type: "banners",
          children: [{ type: "hebrewLetter", letter: "shin", x: 3 }],
        },
        {
          type: "dais",
          children: [
            { type: "officer", role: "hierophant", label: "" },
            { type: "veil", x: 8, y: -0.3 },
          ],
        },
        {
          type: "floor",
          children: [
            { type: "pillar", kind: "black", x: 4, y: 3, glow: true },
            { type: "banner", kind: "east", x: 8, y: 2 },
            {
              type: "altar",
              at: "center",
              children: [
                { type: "item", kind: "cross", form: "calvary", fill: "gray" },
                { type: "item", kind: "lamp", light: "white", x: 0.5 },
                { type: "item", kind: "cup", x: -0.5, children: [] },
              ],
            },
            {
              type: "platform",
              x: 8,
              y: 14,
              w: 4,
              h: 3,
              children: [
                {
                  type: "officer",
                  role: "hiereus",
                  grade: "portal",
                  children: [{ type: "label", text: "West", children: [] }],
                },
              ],
            },
            { type: "throne", x: 13, y: 5 },
            { type: "lamen", role: "keryx", x: 3, y: 10 },
            // A blank key and a blank board are deliberate (R2).
            { type: "tarotKey", x: 2, y: 2 },
            { type: "tablet", x: 14, y: 2 },
            { type: "tablet", element: "air", version: "dee", x: 6, y: 6 },
            { type: "card", kind: "pan", x: 1.2, y: 5 },
            { type: "kamea", planet: "saturn", x: 12, y: 10 },
            { type: "seal", planet: "moon", x: 14, y: 10 },
            { type: "shewbread", x: 2, y: 8 },
            { type: "candlestick", x: 14, y: 8 },
            { type: "board", kind: "flamingSword", x: 2, y: 14 },
            { type: "board", w: 2, h: 1, x: 14, y: 14 },
            { type: "marker", text: "Candidate", x: 8, y: 11 },
            { type: "label", text: "Floor", at: "south", y: -1 },
            { type: "door", side: "north", y: 8, children: [] },
          ],
        },
        { type: "door", x: 8 },
        { type: "caption", text: "Every tag", children: [] },
      ],
    });
    const used = new Set<string>();
    const visit = (node: HallNode) => {
      used.add(node.type);
      node.children?.forEach(visit);
    };
    // A strict hall is a HallNode: no cast.
    const lenient: HallNode = every;
    visit(lenient);
    expect(sorted(used)).toEqual(sorted(Object.keys(ATTRIBUTES)));
    expect(validateHall(lenient, { art: DEFAULT_HALL_ART })).toEqual([]);
  });

  it("take any role without a grade", () => {
    const officer = (role: HallRole): OfficerNode => ({
      type: "officer",
      role,
    });
    const lamen = (role: HallRole): LamenNode => ({ type: "lamen", role });
    expect(officer("keryx").role).toBe("keryx");
    expect(lamen("hegemon").role).toBe("hegemon");
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
    // Wrong nesting: a caption, a label and a door hold nothing.
    const caption: CaptionNode = {
      type: "caption",
      text: "Hall",
      // @ts-expect-error
      children: [{ type: "label", text: "x" }],
    };
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
    // Wrong value: only the Hiereus and the Hegemon take a grade.
    const keryx: OfficerNode = {
      type: "officer",
      role: "keryx",
      // @ts-expect-error
      grade: "portal",
    };
    // @ts-expect-error
    const kerux: LamenNode = { type: "lamen", role: "keryx", grade: "portal" };
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
    // A North door does not read an x.
    // @ts-expect-error
    floor({ type: "floor", children: [{ type: "door", side: "north", x: 8 }] });
    // A board with a diagram takes no w or h.
    floor({
      type: "floor",
      // @ts-expect-error
      children: [{ type: "board", kind: "theFall", w: 2 }],
    });
    expect([caption, keryx, kerux]).toHaveLength(3);
  });

  it("require what a tag needs to draw what it names", () => {
    // @ts-expect-error: no role
    const officer: OfficerNode = { type: "officer", x: 8 };
    // @ts-expect-error: no kind
    const item: ItemNode = { type: "item" };
    // @ts-expect-error: no kind
    const card: CardNode = { type: "card" };
    // @ts-expect-error: no planet
    const kamea: KameaNode = { type: "kamea" };
    // @ts-expect-error: no planet
    const seal: SealNode = { type: "seal" };
    // @ts-expect-error: no letter
    const letter: HebrewLetterNode = { type: "hebrewLetter" };
    // @ts-expect-error: no text
    const marker: MarkerNode = { type: "marker" };
    // @ts-expect-error: no text
    const caption: CaptionNode = { type: "caption" };
    // @ts-expect-error: no text
    const label: LabelNode = { type: "label" };
    // @ts-expect-error: a North door's y
    const north: DoorNode = { type: "door", side: "north" };
    // @ts-expect-error: a West door's x (the West unless said)
    const west: DoorNode = { type: "door" };
    const nodes = [officer, item, card, kamea, seal, letter, marker];
    expect([...nodes, caption, label, north, west]).toHaveLength(11);
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
});

describe("the strict unions", () => {
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

    // The roles that take a grade are those with a grade's own lamen.
    const graded = {
      hiereus: true,
      hegemon: true,
    } satisfies Record<GradeLamenRole, true>;
    expect(
      Object.keys(roles)
        .filter((role) =>
          LAMEN_GRADES.some((grade) => hasGradeLamen(role, grade)),
        )
        .sort(),
    ).toEqual(Object.keys(graded).sort());
  });

  it("hold ItemKind to the item kinds the package draws", () => {
    expect(sorted(Object.keys(ITEM_KINDS))).toEqual(
      sorted([...CORE_ITEM_KINDS, ...artItemKinds]),
    );
  });

  it("hold the tags to the vocabulary's and the art's", () => {
    expect(sorted(Object.keys(ATTRIBUTES))).toEqual(
      sorted([
        ...HALL_TAGS.keys(),
        ...artKeys.filter((key) => !key.startsWith("item:")),
      ]),
    );
  });

  it("hold each tag's attributes to its spec and its art's", () => {
    for (const [tag, names] of Object.entries(ATTRIBUTES)) {
      const nodes: HallNode[] =
        tag === "item"
          ? artItemKinds.map((kind) => ({ type: "item", kind }))
          : [{ type: tag }];
      const spec = nodes.flatMap((node) => [
        ...(hallTagSpec(tag, DEFAULT_HALL_ART, node)?.attributes.keys() ?? []),
      ]);
      expect(sorted(Object.keys(names)), tag).toEqual(sorted(spec));
    }
  });
});
