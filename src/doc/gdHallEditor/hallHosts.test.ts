import { describe, expect, it } from "vitest";
import { gdHallArt } from "@/app/gd/hall/art";
import { hallView, moveNode } from "./hallEdits";
import {
  compatibleHosts,
  dropTarget,
  hostAccepts,
  reparentable,
  reparentNode,
  standOptions,
  standsOn,
  standValue,
} from "./hallHosts";
import type { HallElement } from "./hallModel";
import {
  byAttr,
  findNode,
  hallFromPug,
  neophyteHall,
  sequentialIds,
} from "./hallTestFixtures";

const view = (hall: HallElement) => hallView(hall, gdHallArt);

/** Where a node is drawn: centre and size, in floor squares. */
function drawn(hall: HallElement, id: string) {
  const object = view(hall).byId.get(id)?.object;
  if (!object) throw new Error(`${id} is not drawn`);
  return {
    cx: object.cx,
    cy: object.cy,
    width: object.width,
    height: object.height,
  };
}

/** Expects a node drawn where it was, within 0.01 square. */
function expectInPlace(before: HallElement, after: HallElement, id: string) {
  const a = drawn(before, id);
  const b = drawn(after, id);
  for (const key of ["cx", "cy", "width", "height"] as const)
    expect(Math.abs(a[key] - b[key]), key).toBeLessThanOrEqual(0.01);
}

const parentTag = (hall: HallElement, id: string) =>
  findNode(hall, (node) =>
    (node.children ?? []).some(
      (child) => child.kind === "element" && child.id === id,
    ),
  )?.tag;

describe("hosts: what stands where", () => {
  it("follows the owner's table", () => {
    for (const tag of ["item", "tarotKey", "marker"])
      expect(hostAccepts("altar", tag), tag).toBe(true);
    for (const tag of ["officer", "banner", "hebrewLetter", "label"])
      expect(hostAccepts("altar", tag), tag).toBe(false);
    for (const host of ["platform", "throne"])
      for (const tag of ["officer", "banner", "hebrewLetter", "item", "marker"])
        expect(hostAccepts(host, tag), `${host} ${tag}`).toBe(true);
    expect(hostAccepts("platform", "tarotKey")).toBe(false);
    expect(hostAccepts("board", "marker")).toBe(true);
    expect(hostAccepts("board", "item")).toBe(false);
    // Labels go nowhere: under a host a label labels the host.
    for (const host of ["altar", "platform", "throne", "board"])
      expect(hostAccepts(host, "label"), host).toBe(false);
    expect(hostAccepts("pillar", "item")).toBe(false);
  });

  it("moves objects on the floor and on hosts, never in rows", () => {
    const hall = neophyteHall();
    const laid = view(hall);
    expect(reparentable(laid, byAttr(hall, "role", "hegemon").id)).toBe(true);
    expect(reparentable(laid, byAttr(hall, "role", "hiereus").id)).toBe(true);
    expect(reparentable(laid, byAttr(hall, "kind", "cup").id)).toBe(true);
    expect(reparentable(laid, byAttr(hall, "role", "imperator").id)).toBe(
      false,
    );
    expect(reparentable(laid, byAttr(hall, "kind", "black").id)).toBe(false);
    expect(
      reparentable(laid, findNode(hall, (n) => n.tag === "altar")!.id),
    ).toBe(false);
    expect(reparentable(laid, "missing")).toBe(false);
  });

  it("leaves doors, missing nodes and labels where they are", () => {
    const hall = neophyteHall();
    const laid = view(hall);
    const door = laid.selectables.find((entry) => entry.door);
    expect(door && reparentable(laid, door.id)).toBe(false);
    expect(compatibleHosts(laid, "missing")).toEqual([]);
    const label = hallFromPug(
      "gdHall",
      "  floor",
      '    label(text="Here", x=2, y=2)',
      "    altar(x=2, y=2)",
    );
    expect(reparentable(view(label), byAttr(label, "text", "Here").id)).toBe(
      false,
    );
  });

  it("lists hosts topmost first, never inside the object itself", () => {
    const hall = hallFromPug(
      "gdHall",
      "  floor",
      "    altar(x=8, y=8, scale=2)",
      '      board(kind="flamingSword", w=1, h=1)',
      '    marker(text="Lamp", x=2, y=2)',
      "    platform(x=8, y=14, w=4, h=3)",
    );
    const marker = byAttr(hall, "text", "Lamp").id;
    expect(
      compatibleHosts(view(hall), marker).map((entry) => entry.node.tag),
    ).toEqual(["platform", "board", "altar"]);
  });
});

describe("hosts: where a drop lands", () => {
  const hall = hallFromPug(
    "gdHall",
    "  floor",
    "    altar(x=8, y=8, scale=2)",
    '      board(kind="flamingSword", w=1, h=1)',
    '      item(kind="cup", at="west")',
    '    marker(text="Lamp", x=2, y=2)',
    '    item(kind="rose", x=3, y=3)',
    '    officer(role="hegemon", x=8, y=3)',
  );
  const laid = view(hall);
  const marker = byAttr(hall, "text", "Lamp").id;
  const rose = byAttr(hall, "kind", "rose").id;
  const cup = byAttr(hall, "kind", "cup").id;
  const board = findNode(hall, (node) => node.tag === "board")!.id;
  const altar = findNode(hall, (node) => node.tag === "altar")!.id;

  it("lands on the topmost host that takes it", () => {
    // The board (1 square on a scale-2 altar: 2 squares) sits on the
    // altar's centre: a marker there lands on the board, an item on the
    // altar beneath it, which the board does not take.
    expect(dropTarget(laid, marker, { x: 8.2, y: 8.2 })).toEqual({
      kind: "host",
      id: board,
    });
    expect(dropTarget(laid, rose, { x: 8.2, y: 8.2 })).toEqual({
      kind: "host",
      id: altar,
    });
    expect(dropTarget(laid, rose, { x: 8, y: 9.8 })).toEqual({
      kind: "host",
      id: altar,
    });
    // An officer never stands on an altar.
    const hegemon = byAttr(hall, "role", "hegemon").id;
    expect(dropTarget(laid, hegemon, { x: 8, y: 8 })).toEqual({
      kind: "floor",
    });
  });

  it("stays on its host while on it, and goes to the floor off it", () => {
    expect(dropTarget(laid, cup, { x: 9, y: 9 })).toEqual({
      kind: "host",
      id: altar,
    });
    expect(standsOn(laid, cup, { kind: "host", id: altar })).toBe(true);
    expect(dropTarget(laid, cup, { x: 8, y: 13 })).toEqual({ kind: "floor" });
    expect(standsOn(laid, cup, { kind: "floor" })).toBe(false);
    expect(dropTarget(laid, rose, { x: 1, y: 1 })).toEqual({ kind: "floor" });
    expect(standsOn(laid, rose, { kind: "floor" })).toBe(true);
    // Rows never change.
    const dais = hallFromPug(
      "gdHall",
      "  dais",
      '    officer(role="imperator")',
    );
    expect(
      dropTarget(view(dais), byAttr(dais, "role", "imperator").id, {
        x: 8,
        y: -2,
      }),
    ).toBeUndefined();
  });
});

describe("hosts: an object its host does not take", () => {
  it("stays on that host while on it, and leaves it for the floor", () => {
    // Source may put an officer on an altar; a drag keeps it there while
    // it is over the altar, and never puts it back.
    const hall = hallFromPug(
      "gdHall",
      "  floor",
      "    altar(x=8, y=8)",
      '      officer(role="hegemon")',
    );
    const laid = view(hall);
    const hegemon = byAttr(hall, "role", "hegemon").id;
    const altar = findNode(hall, (node) => node.tag === "altar")!.id;
    expect(dropTarget(laid, hegemon, { x: 8.5, y: 8.5 })).toEqual({
      kind: "host",
      id: altar,
    });
    expect(dropTarget(laid, hegemon, { x: 12, y: 8 })).toEqual({
      kind: "floor",
    });
    expect(standOptions(laid, hegemon).map((option) => option.label)).toEqual([
      "Floor",
    ]);
  });
});

describe("hosts: moving onto and off them", () => {
  const createId = sequentialIds("Host");

  it("puts a cup back on the floor where it is drawn, and back again", () => {
    const hall = neophyteHall();
    const cup = byAttr(hall, "kind", "cup").id;
    const off = reparentNode(view(hall), cup, { kind: "floor" }, createId);
    expectInPlace(hall, off, cup);
    expect(parentTag(off, cup)).toBe("floor");
    // `at` gives way to x and y; the scale is the kind's default, unwritten.
    expect(byAttr(off, "kind", "cup").attrs).toEqual({
      kind: "cup",
      x: 8,
      y: 9,
    });
    // At the end of the floor: drawn on top.
    const floor = findNode(off, (node) => node.tag === "floor");
    expect((floor?.children?.at(-1) as HallElement).id).toBe(cup);
    const altar = findNode(off, (node) => node.tag === "altar")!.id;
    const back = reparentNode(
      view(off),
      cup,
      { kind: "host", id: altar },
      createId,
    );
    expectInPlace(hall, back, cup);
    expect(parentTag(back, cup)).toBe("altar");
    expect(byAttr(back, "kind", "cup").attrs).toEqual({
      kind: "cup",
      x: 0,
      y: 1,
    });
    expect(
      reparentNode(view(back), cup, { kind: "host", id: altar }, createId),
    ).toBe(back);
  });

  it("converts through scaled and nested hosts, scale included", () => {
    const hall = hallFromPug(
      "gdHall",
      "  floor",
      "    altar(x=8, y=8, scale=2)",
      '      board(kind="flamingSword", w=1.5, h=1.5, scale=1.5, x=0.25)',
      '        marker(text="Sword", x=0.2, y=-0.1, anchor="north")',
      '    marker(text="Lamp", x=3.3, y=2.7, scale=0.9)',
      '    item(kind="cup", x=10.2, y=8.6)',
    );
    const sword = byAttr(hall, "text", "Sword").id;
    const lamp = byAttr(hall, "text", "Lamp").id;
    const cup = byAttr(hall, "kind", "cup").id;
    const board = findNode(hall, (node) => node.tag === "board")!.id;
    const altar = findNode(hall, (node) => node.tag === "altar")!.id;
    // Off a board on a scale-2 altar (a unit of 3 squares) to the floor.
    const off = reparentNode(view(hall), sword, { kind: "floor" }, createId);
    expectInPlace(hall, off, sword);
    expect(byAttr(off, "text", "Sword").attrs).toMatchObject({
      anchor: "north",
      scale: 1.8,
    });
    // From the floor onto that board.
    const on = reparentNode(
      view(hall),
      lamp,
      { kind: "host", id: board },
      createId,
    );
    expectInPlace(hall, on, lamp);
    expect(byAttr(on, "text", "Lamp").attrs.scale).toBe(0.3);
    expect(parentTag(on, lamp)).toBe("board");
    // An item onto the scaled altar: its default scale halves.
    const item = reparentNode(
      view(hall),
      cup,
      { kind: "host", id: altar },
      createId,
    );
    expectInPlace(hall, item, cup);
    expect(byAttr(item, "kind", "cup").attrs.scale).toBe(0.175);
    // The board does not take items, nor an item its own host's frame.
    expect(
      reparentNode(view(hall), cup, { kind: "host", id: board }, createId),
    ).toBe(hall);
  });

  it("gives an item of a kind the art lacks items' default scale", () => {
    const hall = hallFromPug(
      "gdHall",
      "  floor",
      "    altar(x=8, y=8, scale=2)",
      '      item(kind="goblet")',
    );
    const goblet = byAttr(hall, "kind", "goblet").id;
    const off = reparentNode(view(hall), goblet, { kind: "floor" }, createId);
    expectInPlace(hall, off, goblet);
    expect(byAttr(off, "kind", "goblet").attrs.scale).toBe(0.8);
    const altar = findNode(off, (node) => node.tag === "altar")!.id;
    const back = reparentNode(
      view(off),
      goblet,
      { kind: "host", id: altar },
      createId,
    );
    // Back to items' default of 0.4: no scale written.
    expect(byAttr(back, "kind", "goblet").attrs).toEqual({
      kind: "goblet",
      x: 0,
      y: 0,
    });
  });

  it("stands an officer on a platform and back on the floor", () => {
    const hall = neophyteHall();
    const hegemon = byAttr(hall, "role", "hegemon").id;
    const platform = findNode(hall, (node) => node.tag === "platform")!.id;
    const on = reparentNode(
      view(hall),
      hegemon,
      { kind: "host", id: platform },
      createId,
    );
    expectInPlace(hall, on, hegemon);
    expect(parentTag(on, hegemon)).toBe("platform");
    expect(byAttr(on, "role", "hegemon").attrs).toEqual({
      role: "hegemon",
      labelPos: "top",
      x: 0,
      y: -11.5,
    });
    const hiereus = byAttr(hall, "role", "hiereus").id;
    const off = reparentNode(view(hall), hiereus, { kind: "floor" }, createId);
    expectInPlace(hall, off, hiereus);
    expect(byAttr(off, "role", "hiereus").attrs).toMatchObject({
      x: 8,
      y: 14.5,
    });
  });

  it("makes a floor for an object leaving a host in a hall without one", () => {
    const hall = hallFromPug(
      "gdHall",
      "  dais",
      "    altar",
      '      item(kind="cup")',
      '  caption(text="Small")',
    );
    const cup = byAttr(hall, "kind", "cup").id;
    // A host in a row is still a host: its items may leave it.
    expect(reparentable(view(hall), cup)).toBe(true);
    const off = reparentNode(view(hall), cup, { kind: "floor" }, createId);
    expectInPlace(hall, off, cup);
    expect(off.children?.map((child) => (child as HallElement).tag)).toEqual([
      "dais",
      "floor",
      "caption",
    ]);
  });

  it("drags an item off and onto the altar through moveNode's result", () => {
    const hall = neophyteHall();
    const cup = byAttr(hall, "kind", "cup").id;
    const moved = moveNode(view(hall), cup, { x: 0, y: 3 }, true);
    const laid = view(moved);
    const object = laid.byId.get(cup)?.object;
    if (!object) throw new Error("no cup");
    const target = dropTarget(laid, cup, { x: object.cx, y: object.cy });
    expect(target).toEqual({ kind: "floor" });
    if (!target) return;
    const off = reparentNode(laid, cup, target, createId);
    expectInPlace(moved, off, cup);
  });
});

describe("hosts: the panel's Stands on", () => {
  it("offers the floor and each host that takes the object", () => {
    const hall = hallFromPug(
      "gdHall",
      "  floor",
      "    altar(x=4, y=8)",
      "    altar(x=12, y=8)",
      "    throne(x=8, y=14)",
      '    item(kind="cup", x=8, y=4)',
      '    officer(role="hegemon", x=8, y=3)',
    );
    const laid = view(hall);
    const cup = byAttr(hall, "kind", "cup").id;
    expect(standOptions(laid, cup).map((option) => option.label)).toEqual([
      "Floor",
      "Altar (x 4, y 8)",
      "Altar (x 12, y 8)",
      "Throne",
    ]);
    expect(standValue(laid, cup)).toBe("floor");
    const hegemon = byAttr(hall, "role", "hegemon").id;
    expect(standOptions(laid, hegemon).map((option) => option.label)).toEqual([
      "Floor",
      "Throne",
    ]);
    const throne = findNode(hall, (node) => node.tag === "throne")!.id;
    const on = reparentNode(
      laid,
      hegemon,
      { kind: "host", id: throne },
      () => "Unused0000000001",
    );
    expect(standValue(view(on), hegemon)).toBe(throne);
    expect(standOptions(laid, byAttr(hall, "kind", "cup").id)).toHaveLength(4);
    expect(standValue(laid, "missing")).toBeUndefined();
  });
});
