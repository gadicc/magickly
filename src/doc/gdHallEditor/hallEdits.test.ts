import { describe, expect, it } from "vitest";
import { gdHallArt } from "@/app/gd/hall/art";
import {
  deleteNode,
  dragScaleNode,
  duplicateNode,
  hallNodeName,
  hallView,
  moveNode,
  nudgeNode,
  scalable,
  scaleNode,
  selectableForPath,
  setNodeAttr,
  stepScaleNode,
} from "./hallEdits";
import type { HallElement } from "./hallModel";
import {
  byAttr,
  hallFromPug,
  neophyteHall,
  sequentialIds,
} from "./hallTestFixtures";

const view = (hall = neophyteHall()) => hallView(hall, gdHallArt);
const node = (tag: string, attrs: HallElement["attrs"] = {}): HallElement => ({
  kind: "element",
  id: "Aaaaaaaaaaaaaaa1",
  tag,
  attrs,
});

describe("hallView", () => {
  it("lists objects and doors in document order, by ID", () => {
    const hall = neophyteHall();
    const { selectables, byId } = view(hall);
    const names = selectables.map((entry) => hallNodeName(entry.node));
    expect(names.slice(0, 7)).toEqual([
      "Imperator",
      "Cancellarius",
      "Hierophant",
      "Past Hierophant",
      "Praemonstrator",
      "Banner of the East",
      "Black pillar",
    ]);
    expect(names).toContain("Door (west)");
    // The altar's items follow the altar.
    const altar = names.indexOf("Altar");
    expect(names.slice(altar + 1, altar + 3)).toEqual(["Cross", "Triangle"]);
    expect(names).toHaveLength(25);
    const door = selectables.find((entry) => entry.door);
    expect(door?.rowPath).toEqual([1, 10]);
    expect(byId.get(byAttr(hall, "role", "hegemon").id)?.object?.cx).toBe(8);
  });

  it("selects nothing in a hall that is not valid source", () => {
    const broken = view({ kind: "element", id: "x", tag: "gdHall", attrs: {} });
    expect(broken.row).toBeNull();
    expect(broken.resolved).toBeNull();
    expect(broken.selectables).toEqual([]);
  });
});

describe("hallNodeName", () => {
  it("names nodes by what they are", () => {
    expect(hallNodeName(node("officer", { role: "pastHierophant" }))).toBe(
      "Past Hierophant",
    );
    expect(hallNodeName(node("officer"))).toBe("Officer");
    expect(hallNodeName(node("lamen"))).toBe("Lamen");
    expect(hallNodeName(node("item", { kind: "lightning" }))).toBe("Lightning");
    expect(hallNodeName(node("item"))).toBe("Item");
    expect(hallNodeName(node("label", { text: " Here " }))).toBe("Here");
    expect(hallNodeName(node("label"))).toBe("Label");
    expect(hallNodeName(node("marker", { text: 7 }))).toBe("7");
    expect(hallNodeName(node("marker", { text: "" }))).toBe("Marker");
    expect(hallNodeName(node("pillar"))).toBe("Pillar");
    expect(hallNodeName(node("banner"))).toBe("Banner");
    expect(hallNodeName(node("hebrewLetter", { letter: "shin" }))).toBe(
      "Hebrew letter shin",
    );
    expect(hallNodeName(node("tarotKey", { n: 21 }))).toBe("Tarot key 21");
    expect(hallNodeName(node("tablet", { element: "earth" }))).toBe(
      "Earth tablet",
    );
    expect(hallNodeName(node("tablet"))).toBe("Tablet");
    expect(hallNodeName(node("door", { side: "north" }))).toBe("Door (north)");
    expect(hallNodeName(node("shewbread"))).toBe("Shewbread");
    expect(hallNodeName(node("kamea", { planet: "moon" }))).toBe(
      "Kamea of Luna",
    );
    expect(hallNodeName(node("seal", { planet: "sun" }))).toBe("Seals of Sol");
    expect(hallNodeName(node("kamea", { planet: "constructor" }))).toBe(
      "Kamea",
    );
    expect(hallNodeName(node("seal"))).toBe("Seals");
    expect(hallNodeName(node("unicorn"))).toBe("Unicorn");
    expect(hallNodeName(node("label", { text: "x".repeat(50) }))).toBe(
      `${"x".repeat(40)}…`,
    );
  });
});

describe("gestures", () => {
  it("moves a node by a drag, snapped, keeping its ID", () => {
    const hall = neophyteHall();
    const hegemon = byAttr(hall, "role", "hegemon");
    const next = moveNode(view(hall), hegemon.id, { x: 1.2, y: -0.7 }, true);
    expect(byAttr(next, "role", "hegemon")).toMatchObject({
      id: hegemon.id,
      attrs: { x: 9, y: 2.5 },
    });
    expect(moveNode(view(hall), "missing", { x: 1, y: 1 }, true)).toBe(hall);
  });

  it("reorders a spread row child, or places it with Alt", () => {
    const hall = neophyteHall();
    const hierophant = byAttr(hall, "role", "hierophant");
    const before = view(hall);
    // Not past a neighbour's centre: nothing changes.
    expect(moveNode(before, hierophant.id, { x: 0.6, y: 0 }, true)).toBe(hall);
    // Past the Past Hierophant's: it takes its place, nothing written.
    const next = moveNode(before, hierophant.id, { x: 3.5, y: 0.4 }, true);
    expect(byAttr(next, "role", "hierophant").attrs).toEqual({
      role: "hierophant",
    });
    const dais = next.children?.find(
      (child): child is HallElement =>
        child.kind === "element" && child.tag === "dais",
    );
    expect(
      dais?.children?.map((child) => (child as HallElement).attrs.role),
    ).toEqual([
      "imperator",
      "cancellarius",
      "pastHierophant",
      "hierophant",
      "praemonstrator",
    ]);
    expect(view(next).byId.get(hierophant.id)?.object?.cx).toBeCloseTo(11.2);
    // With Alt it stands where it is put; the others are frozen in place.
    const placed = moveNode(before, hierophant.id, { x: 0.6, y: 0 }, false);
    expect(byAttr(placed, "role", "hierophant").attrs).toEqual({
      role: "hierophant",
      x: 8.6,
    });
    const after = view(placed);
    for (const role of ["imperator", "cancellarius", "pastHierophant"]) {
      const id = byAttr(hall, "role", role).id;
      expect(after.byId.get(id)?.object?.cx).toBe(
        before.byId.get(id)?.object?.cx,
      );
      expect(byAttr(placed, "role", role).attrs.x).toBe(
        before.byId.get(id)?.object?.cx,
      );
    }
  });

  it("moves a door along its wall only", () => {
    const hall = neophyteHall();
    const door = view(hall).selectables.find((entry) => entry.door);
    if (!door) throw new Error("no door");
    const next = moveNode(view(hall), door.id, { x: -2, y: 3 }, true);
    expect(view(next).byId.get(door.id)?.node.attrs).toEqual({
      x: 12,
      width: 2,
    });
    expect(nudgeNode(view(hall), door.id, { x: 0, y: 1 })).toBe(hall);
    expect(
      view(nudgeNode(view(hall), door.id, { x: 0.5, y: 0 })).byId.get(door.id)
        ?.node.attrs.x,
    ).toBe(14.5);
  });

  it("nudges by units of the node's own frame", () => {
    const hall = neophyteHall();
    const cross = byAttr(hall, "kind", "cross");
    const next = nudgeNode(view(hall), cross.id, { x: 0.5, y: -1 });
    expect(byAttr(next, "kind", "cross").attrs).toEqual({
      kind: "cross",
      x: 0.5,
      y: -1.4,
    });
    expect(nudgeNode(view(hall), "missing", { x: 1, y: 0 })).toBe(hall);
  });

  it("scales by handle, by step and by value, never free text", () => {
    const hall = hallFromPug(
      "gdHall",
      "  floor",
      '    pillar(kind="black", x=4, y=3)',
      '    label(text="Here", x=8, y=8)',
    );
    const v = view(hall);
    const [pillar, label] = v.selectables;
    const dragged = dragScaleNode(v, pillar.id, { x: 5, y: 3 }, { x: 6, y: 3 });
    expect(view(dragged).byId.get(pillar.id)?.node.attrs.scale).toBe(2);
    const stepped = stepScaleNode(v, pillar.id, false);
    expect(view(stepped).byId.get(pillar.id)?.node.attrs.scale).toBe(0.91);
    expect(scaleNode(v, pillar.id, 1)).toBe(hall);
    expect(scalable(label)).toBe(false);
    expect(scaleNode(v, label.id, 2)).toBe(hall);
    expect(stepScaleNode(v, "missing", true)).toBe(hall);
    expect(dragScaleNode(v, "missing", { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(
      hall,
    );
  });

  it("deletes and duplicates, the copy offset and with fresh IDs", () => {
    const hall = neophyteHall();
    const v = view(hall);
    const hegemon = byAttr(hall, "role", "hegemon");
    expect(view(deleteNode(v, hegemon.id)).byId.has(hegemon.id)).toBe(false);
    const copy = duplicateNode(v, hegemon.id, sequentialIds());
    expect(copy?.id).toBe("Test000000000001");
    expect(
      view(copy?.hall as HallElement).byId.get(copy?.id as string)?.node,
    ).toMatchObject({ attrs: { role: "hegemon", x: 8.5, y: 3.5 } });
    // A row child's copy stands by itself; the row keeps its spread.
    const hierophant = byAttr(hall, "role", "hierophant");
    const rowCopy = duplicateNode(v, hierophant.id, sequentialIds());
    const after = view(rowCopy?.hall as HallElement);
    const copied = after.byId.get(rowCopy?.id as string);
    expect(copied?.node.attrs.x).toBe(8.5);
    expect(after.byId.get(hierophant.id)?.object?.cx).toBe(8);
    // A door's copy moves along its wall.
    const door = v.selectables.find((entry) => entry.door);
    const doorCopy = duplicateNode(v, door?.id as string, sequentialIds());
    expect(
      view(doorCopy?.hall as HallElement).byId.get(doorCopy?.id as string)?.node
        .attrs,
    ).toEqual({ x: 14.5, width: 2 });
    expect(duplicateNode(v, "missing", sequentialIds())).toBeNull();
  });

  it("sets and removes attributes from the panel", () => {
    const hall = neophyteHall();
    const hegemon = byAttr(hall, "role", "hegemon");
    const set = setNodeAttr(view(hall), hegemon.id, "label", "Guide");
    expect(byAttr(set, "role", "hegemon").attrs.label).toBe("Guide");
    const removed = setNodeAttr(view(set), hegemon.id, "label", undefined);
    expect(byAttr(removed, "role", "hegemon").attrs).not.toHaveProperty(
      "label",
    );
    const root = setNodeAttr(view(hall), hall.id, "dais", 5);
    expect(root.attrs.dais).toBe(5);
  });
});

describe("selectableForPath", () => {
  it("finds the object a diagnostic names, or its drawn ancestor", () => {
    const hall = hallFromPug(
      "gdHall",
      "  floor",
      "    altar",
      '      label(text="On the altar")',
      "  caption",
    );
    const v = view(hall);
    const altar = v.selectables[0];
    expect(selectableForPath(v, [0, 0])).toBe(altar);
    expect(selectableForPath(v, [0, 0, 0])).toBe(altar);
    expect(selectableForPath(v, [1])).toBeUndefined();
    expect(selectableForPath(v, [])).toBeUndefined();
  });
});
