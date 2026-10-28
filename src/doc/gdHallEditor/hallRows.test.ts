import { describe, expect, it } from "vitest";
import { gdHallArt } from "@/app/gd/halls/art";
import {
  hallView,
  moveNode,
  nudgeNode,
  rowDragPreview,
  setNodeAttr,
  stepInRow,
} from "./hallEdits";
import { objectRect } from "./hallGeometry";
import type { HallElement } from "./hallModel";
import {
  patchFreezingRow,
  reorderable,
  reorderIndex,
  reorderRowChild,
  rowHasPositions,
  rowPlace,
  spreadRowEvenly,
} from "./hallRows";
import { byAttr, hallFromPug, neophyteHall } from "./hallTestFixtures";

const view = (hall: HallElement) => hallView(hall, gdHallArt);
const id = (hall: HallElement, role: string) => byAttr(hall, "role", role).id;

/** The roles (or kinds) of a row's element children, in order. */
const order = (hall: HallElement, tag = "dais") =>
  (
    hall.children?.find(
      (child): child is HallElement =>
        child.kind === "element" && child.tag === tag,
    )?.children ?? []
  ).map((child) =>
    child.kind === "element"
      ? String(child.attrs.role ?? child.attrs.kind ?? child.tag)
      : `(${child.kind})`,
  );

/** Where each role is drawn along x. */
const xs = (hall: HallElement, roles: string[]) => {
  const laid = view(hall);
  return roles.map((role) => laid.byId.get(id(hall, role))?.object?.cx);
};

const DAIS = [
  "imperator",
  "cancellarius",
  "hierophant",
  "pastHierophant",
  "praemonstrator",
];

describe("rows: where a child stands", () => {
  it("finds a dais child's row, running along x", () => {
    const hall = neophyteHall();
    const place = rowPlace(view(hall), id(hall, "hierophant"));
    expect(place?.row.tag).toBe("dais");
    expect(place?.along).toBe("x");
    expect(place?.spread.map((entry) => entry.node.attrs.role)).toEqual(DAIS);
    expect(rowPlace(view(hall), id(hall, "hegemon"))).toBeUndefined();
    expect(reorderable(view(hall), id(hall, "hegemon"))).toBe(false);
  });

  it("runs a North or South banner row along y", () => {
    const hall = hallFromPug(
      "gdHall",
      '  banners(side="north")',
      '    hebrewLetter(letter="shin")',
      '    hebrewLetter(letter="tau")',
    );
    const laid = view(hall);
    const first = laid.selectables[0];
    const place = rowPlace(laid, first.id);
    expect(place?.along).toBe("y");
    // Alt+Down moves it later, along the wall.
    const next = stepInRow(laid, first.id, 1);
    expect(view(next).byId.get(first.id)?.object?.cy).toBeGreaterThan(
      first.object?.cy as number,
    );
  });

  it("spreads only children without a position along the row or `at`", () => {
    const hall = hallFromPug(
      "gdHall",
      "  dais",
      '    officer(role="imperator", x=2)',
      '    officer(role="hierophant", y=-1)',
      '    officer(role="cancellarius", at="east", x=1)',
      '    officer(role="praemonstrator")',
    );
    const laid = view(hall);
    expect(
      rowPlace(laid, id(hall, "hierophant"))?.spread.map(
        (entry) => entry.node.attrs.role,
      ),
    ).toEqual(["hierophant", "praemonstrator"]);
    expect(reorderable(laid, id(hall, "imperator"))).toBe(false);
    expect(reorderable(laid, id(hall, "cancellarius"))).toBe(false);
  });
});

describe("rows: reordering", () => {
  it("moves a child to any place, keeping its node and the spread", () => {
    const hall = neophyteHall();
    const laid = view(hall);
    const hierophant = byAttr(hall, "role", "hierophant");
    const first = reorderRowChild(laid, hierophant.id, 0);
    expect(order(first)).toEqual([
      "hierophant",
      "imperator",
      "cancellarius",
      "pastHierophant",
      "praemonstrator",
    ]);
    expect(byAttr(first, "role", "hierophant")).toBe(hierophant);
    // The spread is the same five places.
    expect(xs(first, ["hierophant", "imperator"])).toEqual(
      xs(hall, ["imperator", "cancellarius"]),
    );
    expect(order(reorderRowChild(laid, hierophant.id, 4)).at(-1)).toBe(
      "hierophant",
    );
    // Its own place, or beyond either end, clamped: the same hall.
    expect(reorderRowChild(laid, hierophant.id, 2)).toBe(hall);
    expect(order(reorderRowChild(laid, hierophant.id, 99)).at(-1)).toBe(
      "hierophant",
    );
    expect(reorderRowChild(laid, id(hall, "hegemon"), 0)).toBe(hall);
  });

  it("steps one place, and not past either end", () => {
    const hall = neophyteHall();
    const laid = view(hall);
    expect(
      order(stepInRow(laid, id(hall, "hierophant"), -1)).slice(0, 3),
    ).toEqual(["imperator", "hierophant", "cancellarius"]);
    expect(stepInRow(laid, id(hall, "imperator"), -1)).toBe(hall);
    expect(stepInRow(laid, id(hall, "praemonstrator"), 1)).toBe(hall);
    expect(stepInRow(laid, id(hall, "hegemon"), 1)).toBe(hall);
  });

  it("keeps other children and comments where they were", () => {
    const hall = hallFromPug(
      "gdHall",
      "  dais",
      '    officer(role="imperator")',
      "    //- the Chiefs",
      '    officer(role="cancellarius", x=15)',
      '    officer(role="hierophant")',
      '    officer(role="praemonstrator")',
    );
    const laid = view(hall);
    const next = reorderRowChild(laid, id(hall, "praemonstrator"), 0);
    expect(order(next)).toEqual([
      "praemonstrator",
      "imperator",
      "(annotation)",
      "cancellarius",
      "hierophant",
    ]);
    // After the last spread child, not at the end of the row.
    const last = reorderRowChild(laid, id(hall, "imperator"), 2);
    expect(order(last)).toEqual([
      "(annotation)",
      "cancellarius",
      "hierophant",
      "praemonstrator",
      "imperator",
    ]);
  });

  it("lands a dragged child after every sibling it passes", () => {
    const hall = neophyteHall();
    const laid = view(hall);
    const hierophant = id(hall, "hierophant");
    expect(reorderIndex(laid, hierophant, 0)).toBe(0);
    expect(reorderIndex(laid, hierophant, 8.5)).toBe(2);
    expect(reorderIndex(laid, hierophant, 11.3)).toBe(3);
    expect(reorderIndex(laid, hierophant, 20)).toBe(4);
    expect(reorderIndex(laid, id(hall, "hegemon"), 3)).toBe(0);
  });

  it("previews a reorder: the child under the pointer, the rest moved", () => {
    const hall = neophyteHall();
    const laid = view(hall);
    const hierophant = id(hall, "hierophant");
    const preview = rowDragPreview(
      laid,
      hierophant,
      { x: -5, y: 0.3 },
      gdHallArt,
    );
    if (!preview) throw new Error("no preview");
    expect(order(preview.hall).slice(0, 2)).toEqual([
      "imperator",
      "hierophant",
    ]);
    const drawn = view(preview.preview);
    expect(drawn.byId.get(hierophant)?.object?.cx).toBeCloseTo(3);
    // The Cancellarius has made room: it stands where the Hierophant was.
    expect(drawn.byId.get(id(hall, "cancellarius"))?.object?.cx).toBeCloseTo(8);
    const landed = view(preview.hall).byId.get(hierophant)?.object;
    expect(preview.slot).toEqual(landed && objectRect(landed));
    expect(
      rowDragPreview(laid, id(hall, "hegemon"), { x: 1, y: 0 }, gdHallArt),
    ).toBeUndefined();
  });
});

describe("rows: explicit positions", () => {
  it("freezes the spread siblings when one is given a position", () => {
    const hall = neophyteHall();
    const laid = view(hall);
    const next = setNodeAttr(laid, id(hall, "imperator"), "x", 3);
    expect(byAttr(next, "role", "imperator").attrs.x).toBe(3);
    // Nothing else moves; each sibling now says where it stands.
    expect(xs(next, DAIS.slice(1))).toEqual(xs(hall, DAIS.slice(1)));
    expect(byAttr(next, "role", "cancellarius").attrs.x).toBe(4.8);
    expect(byAttr(next, "role", "praemonstrator").attrs.x).toBe(14.4);
    // A position across the row, or removing one, freezes nothing.
    const across = setNodeAttr(laid, id(hall, "imperator"), "y", -2);
    expect(byAttr(across, "role", "cancellarius").attrs).not.toHaveProperty(
      "x",
    );
    expect(setNodeAttr(laid, id(hall, "imperator"), "x", undefined)).toBe(hall);
  });

  it("freezes for an arrow along the row, and with Alt places freely", () => {
    const hall = neophyteHall();
    const laid = view(hall);
    const nudged = nudgeNode(laid, id(hall, "hierophant"), { x: 0.5, y: 0 });
    expect(byAttr(nudged, "role", "hierophant").attrs.x).toBe(8.5);
    expect(byAttr(nudged, "role", "imperator").attrs.x).toBe(1.6);
    const down = nudgeNode(laid, id(hall, "hierophant"), { x: 0, y: 0.5 });
    expect(byAttr(down, "role", "imperator").attrs).not.toHaveProperty("x");
    const free = moveNode(
      laid,
      id(hall, "imperator"),
      { x: 0.33, y: 0 },
      false,
    );
    expect(byAttr(free, "role", "imperator").attrs.x).toBe(1.93);
    expect(xs(free, DAIS.slice(1))).toEqual(xs(hall, DAIS.slice(1)));
  });

  it("leaves siblings with their own position or `at` alone", () => {
    const hall = hallFromPug(
      "gdHall",
      "  dais",
      '    officer(role="imperator")',
      '    officer(role="cancellarius", at="east", x=1)',
      '    officer(role="hierophant", x=12)',
      '    officer(role="praemonstrator")',
    );
    const laid = view(hall);
    const next = patchFreezingRow(laid, id(hall, "imperator"), { x: 2 });
    expect(byAttr(next, "role", "cancellarius").attrs).toEqual({
      role: "cancellarius",
      at: "east",
      x: 1,
    });
    expect(byAttr(next, "role", "hierophant").attrs.x).toBe(12);
    expect(byAttr(next, "role", "praemonstrator").attrs.x).toBeTypeOf("number");
    // Off the floor's rows, a patch is only a patch.
    const floor = hallFromPug(
      "gdHall",
      "  floor",
      '    officer(role="hegemon", x=8, y=3)',
    );
    expect(
      byAttr(
        patchFreezingRow(view(floor), id(floor, "hegemon"), { x: 9 }),
        "role",
        "hegemon",
      ).attrs,
    ).toEqual({ role: "hegemon", x: 9, y: 3 });
  });

  it("spreads evenly again, keeping offsets from `at`", () => {
    const hall = hallFromPug(
      "gdHall",
      "  dais",
      '    officer(role="imperator", x=3, y=-1)',
      '    officer(role="cancellarius", at="east", x=1)',
      '    officer(role="hierophant", x=12)',
    );
    const laid = view(hall);
    expect(rowHasPositions(laid, id(hall, "imperator"))).toBe(true);
    const next = spreadRowEvenly(laid, id(hall, "hierophant"));
    expect(byAttr(next, "role", "imperator").attrs).toEqual({
      role: "imperator",
      y: -1,
    });
    expect(byAttr(next, "role", "cancellarius").attrs.x).toBe(1);
    expect(byAttr(next, "role", "hierophant").attrs).toEqual({
      role: "hierophant",
    });
    expect(rowHasPositions(view(next), id(hall, "imperator"))).toBe(false);
    expect(spreadRowEvenly(view(next), id(hall, "imperator"))).toBe(next);
    expect(spreadRowEvenly(laid, "missing")).toBe(hall);
  });
});
