// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gdHallArt } from "@/app/gd/hall/art";
import { flushPendingEdits } from "../pendingEdits";
import { GdHallEditor } from "./GdHallEditor";
import { parseNumberField } from "./HallProperties";
import type { HallElement } from "./hallModel";
import {
  byAttr,
  findNode,
  hallFromPug,
  neophyteHall,
  sequentialIds,
} from "./hallTestFixtures";

/** The editor's overlay, which carries the drawing's view box. */
const OVERLAY = "[role=application] > svg[aria-hidden]";
/** Pixels per square the mocked layout draws the hall at. */
const PX = 30;

beforeEach(() => {
  // jsdom has no PointerEvent; React reads these fields from it.
  if (typeof window.PointerEvent === "undefined") {
    class PointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    vi.stubGlobal("PointerEvent", PointerEvent);
  }
});

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  // The overlay draws the hall's view box at PX pixels per square, from
  // the page's top left corner.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const box =
        this instanceof SVGSVGElement && this.matches(OVERLAY)
          ? this.getAttribute("viewBox")?.split(" ").map(Number)
          : undefined;
      if (!box) return new DOMRect();
      return new DOMRect(0, 0, (box[2] / 100) * PX, (box[3] / 100) * PX);
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

interface Harness {
  changes: HallElement[];
  done: ReturnType<typeof vi.fn>;
  undo: ReturnType<typeof vi.fn>;
  redo: ReturnType<typeof vi.fn>;
  current: () => HallElement;
  surface: HTMLElement;
  /** Gives the editor a hall from elsewhere (a source sync, the other panel). */
  replace: (hall: HallElement) => void;
  /** Locks or unlocks the host. */
  lock: (locked: boolean) => void;
  /** Makes the host refuse changes, or take them again. */
  refuse: (refusing: boolean) => void;
}

function setup(
  initial: HallElement = neophyteHall(),
  editable = true,
  options: { refuse?: boolean; history?: boolean } = {},
): Harness {
  const harness = {
    changes: [] as HallElement[],
    done: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
  };
  let latest = initial;
  const past: HallElement[] = [];
  let replace: (hall: HallElement) => void = () => {};
  let refusing = !!options.refuse;
  let lock: (locked: boolean) => void = () => {};
  function Host() {
    const [hall, setHall] = useState(initial);
    const [unlocked, setUnlocked] = useState(editable);
    latest = hall;
    replace = setHall;
    lock = (locked) => setUnlocked(!locked);
    return (
      <GdHallEditor
        hall={hall}
        art={gdHallArt}
        editable={unlocked}
        createId={sequentialIds("New")}
        onChange={(next) => {
          harness.changes.push(next);
          if (refusing) return false;
          past.push(hall);
          setHall(next);
        }}
        onDone={harness.done}
        onUndo={() => {
          harness.undo();
          const previous = past.pop();
          if (options.history && previous) setHall(previous);
        }}
        onRedo={harness.redo}
      />
    );
  }
  render(<Host />);
  return {
    ...harness,
    current: () => latest,
    surface: screen.getByRole("application"),
    replace: (hall) => act(() => replace(hall)),
    lock: (locked) => act(() => lock(locked)),
    refuse: (next) => {
      refusing = next;
    },
  };
}

/** The view box origin in squares, as the overlay states it. */
function origin() {
  const svg = document.querySelector(OVERLAY) as SVGSVGElement;
  const [x, y] = (svg.getAttribute("viewBox") as string).split(" ").map(Number);
  return { x: x / 100, y: y / 100 };
}

/** The client point of a floor point, in squares. */
function at(x: number, y: number) {
  const o = origin();
  return { clientX: (x - o.x) * PX, clientY: (y - o.y) * PX };
}

const key = (
  surface: HTMLElement,
  name: string,
  init: KeyboardEventInit = {},
) => fireEvent.keyDown(surface, { key: name, ...init });
/** What the drawing's description says is selected. */
const selected = () => {
  const ids = screen
    .getByRole("application")
    .getAttribute("aria-describedby")
    ?.split(" ");
  return document.getElementById(ids?.[0] ?? "")?.textContent;
};

describe("entering and the keyboard", () => {
  it("starts with the drawing focused and nothing selected", () => {
    const { surface } = setup();
    expect(document.activeElement).toBe(surface);
    expect(selected()).toBe("Nothing selected");
    expect(screen.getByRole("heading", { name: /^Hall/ })).toBeTruthy();
  });

  it("cycles objects with Tab, and lets Tab leave at either end", () => {
    const { surface } = setup(
      hallFromPug(
        "gdHall",
        "  floor",
        '    pillar(kind="black", x=4, y=3)',
        '    pillar(kind="white", x=12, y=3)',
      ),
    );
    // Shift+Tab with nothing selected leaves the drawing.
    expect(key(surface, "Tab", { shiftKey: true })).toBe(true);
    expect(key(surface, "Tab")).toBe(false);
    expect(selected()).toContain("Black pillar selected");
    expect(key(surface, "Tab")).toBe(false);
    expect(selected()).toContain("White pillar selected");
    // Past the last, Tab is the browser's again; the selection stays.
    expect(key(surface, "Tab")).toBe(true);
    expect(selected()).toContain("White pillar selected");
    expect(key(surface, "Tab", { shiftKey: true })).toBe(false);
    expect(selected()).toContain("Black pillar selected");
    expect(key(surface, "Tab", { shiftKey: true })).toBe(true);
  });

  it("clears the selection with Escape, then leaves", () => {
    const { surface, done } = setup();
    key(surface, "Tab");
    key(surface, "Escape");
    expect(selected()).toBe("Nothing selected");
    expect(done).not.toHaveBeenCalled();
    key(surface, "Escape");
    expect(done).toHaveBeenCalledOnce();
  });

  it("nudges, scales, duplicates and deletes, one change each", () => {
    const hall = hallFromPug(
      "gdHall",
      "  floor",
      '    pillar(kind="black", x=4, y=3)',
    );
    const { surface, changes, current } = setup(hall);
    key(surface, "Tab");
    key(surface, "ArrowRight");
    key(surface, "ArrowDown", { shiftKey: true });
    key(surface, "ArrowLeft");
    key(surface, "ArrowUp");
    expect(changes).toHaveLength(4);
    const pillar = () => byAttr(current(), "kind", "black");
    expect(pillar().attrs).toMatchObject({ x: 4, y: 3.5 });
    key(surface, "+");
    key(surface, "=");
    key(surface, "-");
    expect(pillar().attrs.scale).toBe(1.1);
    expect(changes).toHaveLength(7);
    expect(screen.getByText("Scaled Black pillar to 1.1")).toBeTruthy();
    key(surface, "d", { ctrlKey: true });
    expect(changes).toHaveLength(8);
    expect(selected()).toContain("Black pillar selected");
    const floor = current().children?.[0] as HallElement;
    expect(floor.children).toHaveLength(2);
    expect((floor.children?.[1] as HallElement).id).toBe("New0000000000001");
    key(surface, "Delete");
    expect(changes).toHaveLength(9);
    expect((current().children?.[0] as HallElement).children).toHaveLength(1);
    expect(selected()).toBe("Nothing selected");
    // Without a selection, keys do nothing.
    key(surface, "ArrowRight");
    key(surface, "Backspace");
    expect(changes).toHaveLength(9);
  });

  it("hands undo and redo to the host", () => {
    const { surface, undo, redo } = setup();
    key(surface, "z", { ctrlKey: true });
    key(surface, "Z", { metaKey: true, shiftKey: true });
    key(surface, "y", { ctrlKey: true });
    expect(undo).toHaveBeenCalledOnce();
    expect(redo).toHaveBeenCalledTimes(2);
  });

  it("leaves keys typed in the panel to the panel", () => {
    const { changes } = setup();
    key(screen.getByRole("application"), "Tab");
    const x = screen.getByRole("textbox", { name: /^x/ });
    fireEvent.keyDown(x, { key: "Delete" });
    fireEvent.keyDown(x, { key: "Escape" });
    expect(changes).toHaveLength(0);
    expect(selected()).toContain("Imperator selected");
  });
});

const pointer = (
  type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
  target: Element,
  point: { clientX: number; clientY: number },
  init: Record<string, unknown> = {},
) =>
  fireEvent[type](target, {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    ...point,
    ...init,
  });

describe("the pointer", () => {
  it("selects by a click and moves by a drag, one change per drag", () => {
    const { surface, changes, current } = setup();
    pointer("pointerDown", surface, at(8, 3));
    pointer("pointerUp", surface, at(8, 3));
    expect(selected()).toContain("Hegemon selected");
    expect(changes).toHaveLength(0);
    pointer("pointerDown", surface, at(8, 3));
    pointer("pointerMove", surface, at(8.6, 3.1));
    pointer("pointerMove", surface, at(9.1, 3.1));
    // The preview shows where it will go before anything is written.
    expect(
      (screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement).value,
    ).toBe("9");
    expect(changes).toHaveLength(0);
    pointer("pointerUp", surface, at(9.3, 3.1));
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "hegemon").attrs).toMatchObject({
      x: 9.5,
      y: 3,
    });
    expect(screen.getByText("Moved Hegemon to x 9.5, y 3")).toBeTruthy();
  });

  it("does not snap with Alt, and writes nothing for a cancelled drag", () => {
    const { surface, changes, current } = setup();
    pointer("pointerDown", surface, at(8, 3), { altKey: true });
    pointer("pointerMove", surface, at(8.3, 3), { altKey: true });
    pointer("pointerUp", surface, at(8.33, 3), { altKey: true });
    expect(byAttr(current(), "role", "hegemon").attrs.x).toBe(8.33);
    pointer("pointerDown", surface, at(8.33, 3));
    pointer("pointerMove", surface, at(10, 3));
    pointer("pointerCancel", surface, at(10, 3));
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "hegemon").attrs.x).toBe(8.33);
  });

  it("clears the selection on empty floor", () => {
    const { surface } = setup();
    pointer("pointerDown", surface, at(8, 3));
    pointer("pointerUp", surface, at(8, 3));
    pointer("pointerDown", surface, at(6, 11));
    pointer("pointerUp", surface, at(6, 11));
    expect(selected()).toBe("Nothing selected");
  });

  it("scales by a corner handle", () => {
    const { surface, changes, current } = setup(
      hallFromPug("gdHall", "  floor", '    pillar(kind="black", x=4, y=3)'),
    );
    pointer("pointerDown", surface, at(4, 3));
    pointer("pointerUp", surface, at(4, 3));
    const handle = document.querySelector('[data-corner="se"]') as Element;
    expect(handle).toBeTruthy();
    pointer("pointerDown", handle, at(5.2, 4.2));
    pointer("pointerMove", surface, at(5.8, 4.8));
    pointer("pointerUp", surface, at(6.4, 5.4));
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "kind", "black").attrs.scale).toBe(2);
  });

  it("ignores other buttons and other pointers", () => {
    const { surface, changes } = setup();
    pointer("pointerDown", surface, at(8, 3), { button: 2 });
    expect(selected()).toBe("Nothing selected");
    pointer("pointerDown", surface, at(8, 3));
    pointer("pointerMove", surface, at(10, 3), { pointerId: 2 });
    pointer("pointerUp", surface, at(10, 3), { pointerId: 2 });
    pointer("pointerUp", surface, at(8, 3));
    expect(changes).toHaveLength(0);
  });
});

describe("focus, touch and announcements", () => {
  it("keeps the author's place when the editor arrives late", () => {
    const elsewhere = document.createElement("input");
    document.body.append(elsewhere);
    try {
      elsewhere.focus();
      const { surface } = setup();
      expect(document.activeElement).toBe(elsewhere);
      expect(surface).not.toBe(document.activeElement);
    } finally {
      elsewhere.remove();
    }
  });

  it("follows a pointer that becomes, or stops being, coarse", () => {
    const listeners = new Set<() => void>();
    const query = {
      matches: false,
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        listeners.delete(listener),
    };
    vi.stubGlobal("matchMedia", () => query);
    setup();
    const touch =
      "Tap to select, drag to move, drag a corner to scale; the panel edits the rest.";
    expect(screen.queryByText(touch)).toBeNull();
    query.matches = true;
    act(() => {
      for (const listener of listeners) listener();
    });
    expect(screen.getByText(touch)).toBeTruthy();
    cleanup();
    expect(listeners.size).toBe(0);
  });

  it("names the drawing once, and announces each selection", () => {
    const { surface } = setup();
    key(surface, "Tab");
    expect(surface.getAttribute("aria-label")).toBe("Temple hall editor");
    expect(selected()).toBe("Imperator selected");
    expect(screen.getByText("Selected Imperator")).toBeTruthy();
  });
});

describe("a gesture and the hall it writes", () => {
  /** Presses on the Hegemon and drags it a square South, not released. */
  const dragHegemon = (surface: HTMLElement) => {
    pointer("pointerDown", surface, at(8, 3));
    pointer("pointerMove", surface, at(9, 3));
  };

  it("keeps a field's value written as the press begins", () => {
    const { surface, changes, current } = setup();
    pointer("pointerDown", surface, at(4, 3));
    pointer("pointerUp", surface, at(4, 3));
    const label = screen.getByRole("textbox", { name: /^Label$/ });
    act(() => label.focus());
    fireEvent.change(label, { target: { value: "Jachin" } });
    // The press leaves the field, which writes it; the drag builds on it.
    dragHegemon(surface);
    expect(changes).toHaveLength(1);
    pointer("pointerUp", surface, at(9, 3));
    expect(changes).toHaveLength(2);
    expect(byAttr(current(), "kind", "black").attrs.label).toBe("Jachin");
    expect(byAttr(current(), "role", "hegemon").attrs.x).toBe(9);
  });

  it("builds a drag on a position typed as it begins", () => {
    const { surface, current } = setup();
    pointer("pointerDown", surface, at(8, 3));
    pointer("pointerUp", surface, at(8, 3));
    const x = screen.getByRole("textbox", { name: /^x/ });
    act(() => x.focus());
    fireEvent.change(x, { target: { value: "10" } });
    dragHegemon(surface);
    pointer("pointerUp", surface, at(9, 3));
    // A square South of the typed 10, not of where the press began.
    expect(byAttr(current(), "role", "hegemon").attrs.x).toBe(11);
  });

  it("ends a drag without writing it on undo", () => {
    const { surface, changes, current } = setup(neophyteHall(), true, {
      history: true,
    });
    pointer("pointerDown", surface, at(4, 3));
    pointer("pointerUp", surface, at(4, 3));
    key(surface, "ArrowRight");
    expect(byAttr(current(), "kind", "black").attrs.x).toBe(4.5);
    dragHegemon(surface);
    expect(key(surface, "z", { ctrlKey: true })).toBe(false);
    expect(byAttr(current(), "kind", "black").attrs.x).toBe(4);
    pointer("pointerMove", surface, at(10, 3));
    pointer("pointerUp", surface, at(10, 3));
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "kind", "black").attrs.x).toBe(4);
    expect(byAttr(current(), "role", "hegemon").attrs.x).toBe(8);
  });

  it("ends a drag on redo, Delete and Escape", () => {
    const { surface, changes, current, redo } = setup();
    dragHegemon(surface);
    key(surface, "y", { ctrlKey: true });
    expect(redo).toHaveBeenCalledOnce();
    pointer("pointerUp", surface, at(10, 3));
    expect(changes).toHaveLength(0);
    // Escape ends the drag and keeps the selection.
    dragHegemon(surface);
    expect(key(surface, "Escape")).toBe(false);
    expect(selected()).toContain("Hegemon selected");
    // The preview is gone: the field shows where it stands.
    expect(
      (screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement).value,
    ).toBe("8");
    pointer("pointerUp", surface, at(10, 3));
    expect(changes).toHaveLength(0);
    // Delete ends it and deletes; the release does not bring it back.
    dragHegemon(surface);
    key(surface, "Delete");
    expect(changes).toHaveLength(1);
    pointer("pointerMove", surface, at(10, 3));
    pointer("pointerUp", surface, at(10, 3));
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "hegemon")).toBeUndefined();
  });

  it("holds other keys until the pointer is released", () => {
    const { surface, changes, current } = setup();
    dragHegemon(surface);
    expect(key(surface, "ArrowRight")).toBe(false);
    expect(key(surface, "+")).toBe(false);
    expect(key(surface, "Tab")).toBe(false);
    expect(key(surface, "Shift", { shiftKey: true })).toBe(true);
    expect(changes).toHaveLength(0);
    pointer("pointerUp", surface, at(9, 3));
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "hegemon").attrs).toMatchObject({
      x: 9,
    });
    expect(byAttr(current(), "role", "hegemon").attrs).not.toHaveProperty(
      "scale",
    );
  });

  it("ends a drag when the host gives another hall", () => {
    const { surface, changes, current, replace } = setup();
    dragHegemon(surface);
    const elsewhere = neophyteHall();
    byAttr(elsewhere, "kind", "black").attrs.label = "From the source";
    replace(elsewhere);
    pointer("pointerUp", surface, at(10, 3));
    expect(changes).toHaveLength(0);
    expect(current()).toBe(elsewhere);
  });

  it("ends a drag when the host locks", () => {
    const { surface, changes, lock } = setup();
    dragHegemon(surface);
    lock(true);
    lock(false);
    pointer("pointerUp", surface, at(10, 3));
    expect(changes).toHaveLength(0);
  });

  it("ends a drag whose node the hall no longer has", () => {
    const { surface, changes, replace } = setup();
    dragHegemon(surface);
    // The same hall again (not an echo of one sent) without the Hegemon:
    // the drag ends, and so would a frame drawn on it.
    const without = neophyteHall();
    const floor = without.children?.find(
      (child): child is HallElement =>
        child.kind === "element" && child.tag === "floor",
    ) as HallElement;
    floor.children = floor.children?.filter(
      (child) => child.kind !== "element" || child.attrs.role !== "hegemon",
    );
    replace(without);
    pointer("pointerMove", surface, at(11, 3));
    pointer("pointerUp", surface, at(11, 3));
    expect(changes).toHaveLength(0);
  });

  it("lets one pointer drag at a time", () => {
    const { surface, changes, current } = setup();
    pointer("pointerDown", surface, at(8, 3));
    pointer("pointerDown", surface, at(4, 3), { pointerId: 2 });
    pointer("pointerMove", surface, at(4, 6), { pointerId: 2 });
    pointer("pointerUp", surface, at(4, 6), { pointerId: 2 });
    expect(selected()).toContain("Hegemon selected");
    pointer("pointerMove", surface, at(9, 3));
    pointer("pointerUp", surface, at(9, 3));
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "hegemon").attrs.x).toBe(9);
    expect(byAttr(current(), "kind", "black").attrs).toEqual(
      byAttr(neophyteHall(), "kind", "black").attrs,
    );
  });

  it("holds the drawing's view box during a drag", () => {
    const { surface, current } = setup();
    const viewBox = () =>
      document.querySelector(OVERLAY)?.getAttribute("viewBox");
    const before = viewBox();
    const start = at(8, 3);
    pointer("pointerDown", surface, start);
    // Far past the South wall, which would grow the drawing.
    const far = { clientX: start.clientX + 15 * PX, clientY: start.clientY };
    pointer("pointerMove", surface, far);
    expect(viewBox()).toBe(before);
    const frame = surface.querySelector("svg[role=img]") as SVGElement;
    expect(frame.style.width).not.toBe("100%");
    pointer("pointerUp", surface, far);
    expect(byAttr(current(), "role", "hegemon").attrs.x).toBe(23);
    // Released, the drawing takes its new extent.
    expect(viewBox()).not.toBe(before);
    expect(frame.style.width).toBe("100%");
  });
});

describe("the properties panel", () => {
  it("writes a typed value when the field is left, refusing bad ones", () => {
    const { changes, current } = setup();
    key(screen.getByRole("application"), "Tab");
    const x = screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement;
    fireEvent.change(x, { target: { value: "abc" } });
    fireEvent.blur(x);
    expect(screen.getByText("Not a number")).toBeTruthy();
    fireEvent.change(x, { target: { value: "99" } });
    fireEvent.blur(x);
    expect(screen.getByText("Between -48 and 64")).toBeTruthy();
    expect(changes).toHaveLength(0);
    fireEvent.change(x, { target: { value: "2.345" } });
    fireEvent.keyDown(x, { key: "Enter" });
    fireEvent.blur(x);
    expect(changes).toHaveLength(1);
    const imperator = () => byAttr(current(), "role", "imperator");
    expect(imperator().attrs.x).toBe(2.35);
    // Emptied, the attribute goes and the row places it again.
    const typed = screen.getByRole("textbox", { name: /^x/ });
    fireEvent.change(typed, { target: { value: "" } });
    fireEvent.blur(typed);
    expect(imperator().attrs).not.toHaveProperty("x");
    expect(
      (screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement)
        .placeholder,
    ).toBe("1.6");
  });

  it("writes text, switches and choices", async () => {
    const { changes, current } = setup();
    const surface = screen.getByRole("application");
    for (let tab = 0; tab < 7; tab++) key(surface, "Tab");
    expect(selected()).toContain("Black pillar selected");
    const label = screen.getByRole("textbox", { name: "Label" });
    fireEvent.change(label, { target: { value: "Boaz" } });
    fireEvent.blur(label);
    expect(byAttr(current(), "kind", "black").attrs.label).toBe("Boaz");
    // Switched off, a flag that defaults to off goes from the source.
    fireEvent.click(screen.getByRole("switch", { name: "Glow" }));
    expect(byAttr(current(), "kind", "black").attrs).not.toHaveProperty("glow");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Kind" }));
    fireEvent.click(await screen.findByRole("option", { name: "white" }));
    expect(
      findNode(current(), (node) => node.attrs.label === "Boaz")?.attrs.kind,
    ).toBe("white");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Kind" }));
    fireEvent.click(await screen.findByRole("option", { name: "Default" }));
    expect(
      findNode(current(), (node) => node.attrs.label === "Boaz")?.attrs,
    ).not.toHaveProperty("kind");
    expect(changes).toHaveLength(4);
    fireEvent.click(screen.getByRole("switch", { name: "Glow" }));
    expect(
      findNode(current(), (node) => node.attrs.label === "Boaz")?.attrs.glow,
    ).toBe(true);
  });

  it("states a one-sided bound as one", () => {
    expect(parseNumberField("-1", { kind: "number", min: 0 })).toEqual({
      error: "At least 0",
    });
    expect(parseNumberField("5", { kind: "number", max: 4 })).toEqual({
      error: "At most 4",
    });
    expect(parseNumberField("3", { kind: "number", min: 0 })).toEqual({
      value: 3,
    });
  });

  it("offers roles and item kinds by name, keeping unknown ones", async () => {
    setup(
      hallFromPug(
        "gdHall",
        "  floor",
        '    officer(role="warden", x=3, y=3)',
        '    item(kind="cross", x=6, y=6)',
      ),
    );
    const surface = screen.getByRole("application");
    key(surface, "Tab");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Role" }));
    const listbox = await screen.findByRole("listbox");
    expect(
      within(listbox).getByRole("option", { name: "warden" }),
    ).toBeTruthy();
    expect(
      within(listbox).getByRole("option", { name: "Past Hierophant" }),
    ).toBeTruthy();
    fireEvent.keyDown(listbox, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    key(surface, "Tab");
    // A cross takes a form; a triangle's direction is not offered.
    expect(screen.getByRole("combobox", { name: "Form" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Dir" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Kind" }).textContent).toBe(
      "Cross",
    );
  });

  it("edits the hall itself when nothing is selected", () => {
    const { current } = setup(hallFromPug("gdHall", "  floor"));
    const caption = screen.getByRole("textbox", { name: "Caption" });
    fireEvent.change(caption, { target: { value: "My temple" } });
    fireEvent.blur(caption);
    expect(current().children?.[1]).toMatchObject({
      tag: "caption",
      attrs: { text: "My temple" },
    });
    const again = screen.getByRole("textbox", { name: "Caption" });
    fireEvent.change(again, { target: { value: "Ours" } });
    fireEvent.blur(again);
    expect((current().children?.[1] as HallElement).attrs.text).toBe("Ours");
    fireEvent.change(again, { target: { value: "" } });
    fireEvent.blur(again);
    expect(current().children).toHaveLength(1);
    fireEvent.click(screen.getByRole("switch", { name: "Compass" }));
    expect(current().attrs.compass).toBe(false);
    // On again is its default: the attribute goes.
    fireEvent.click(screen.getByRole("switch", { name: "Compass" }));
    expect(current().attrs).not.toHaveProperty("compass");
    const dais = screen.getByRole("textbox", { name: "Dais depth" });
    fireEvent.change(dais, { target: { value: "5" } });
    fireEvent.blur(dais);
    expect(current().attrs.dais).toBe(5);
  });

  it("duplicates, deletes and scales from buttons", () => {
    const { changes, current } = setup(
      hallFromPug("gdHall", "  floor", '    pillar(kind="black", x=4, y=3)'),
    );
    key(screen.getByRole("application"), "Tab");
    fireEvent.click(screen.getByRole("button", { name: "Larger" }));
    fireEvent.click(screen.getByRole("button", { name: "Smaller" }));
    expect(byAttr(current(), "kind", "black").attrs.scale).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect((current().children?.[0] as HallElement).children).toHaveLength(2);
    expect(document.activeElement).toBe(screen.getByRole("application"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect((current().children?.[0] as HallElement).children).toHaveLength(1);
    expect(changes).toHaveLength(4);
  });
});

describe("the palette and the warnings", () => {
  it("adds a component, selected, with the drawing focused", async () => {
    const { changes, current } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cup" }));
    expect(changes).toHaveLength(1);
    const cup = findNode(current(), (node) => node.id === "New0000000000001");
    expect(cup).toMatchObject({ tag: "item", attrs: { kind: "cup" } });
    await waitFor(() => expect(selected()).toContain("Cup selected"));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("application")),
    );
  });

  it("lists the hall's warnings, selecting what one names", () => {
    setup(
      hallFromPug(
        "gdHall",
        "  floor",
        "    unicorn(x=3, y=3)",
        "    item(x=5, y=5)",
      ),
    );
    const warnings = within(
      screen.getByRole("region", { name: "Hall warnings" }),
    ).getAllByRole("button");
    expect(warnings.map((warning) => warning.textContent)).toEqual([
      "⚠unknown tag unicorn; drawn as a placeholder",
      "✕item: no kind",
    ]);
    fireEvent.click(warnings[0]);
    expect(selected()).toContain("Unicorn selected");
    expect(document.activeElement).toBe(screen.getByRole("application"));
  });

  it("counts warnings past twenty", () => {
    setup(
      hallFromPug(
        "gdHall",
        "  floor",
        ...Array.from(
          { length: 23 },
          (_, n) => `    unicorn(x=${n % 16}, y=3)`,
        ),
      ),
    );
    expect(
      screen.getByText("3 more warnings, listed in the source view."),
    ).toBeTruthy();
  });
});

describe("while the host takes no changes", () => {
  it("shows the hall without editing it", () => {
    const { surface, changes, undo, redo } = setup(neophyteHall(), false);
    expect(surface.getAttribute("aria-disabled")).toBe("true");
    expect(
      screen.getByText(
        "The hall cannot be edited while the ritual is updating.",
      ),
    ).toBeTruthy();
    key(surface, "Tab");
    key(surface, "ArrowRight");
    fireEvent.pointerDown(surface, { ...at(8, 3), pointerId: 1, button: 0 });
    expect(changes).toHaveLength(0);
    // Nor are undo and redo handed to the host, whose history it is.
    expect(key(surface, "z", { ctrlKey: true })).toBe(false);
    expect(key(surface, "y", { ctrlKey: true })).toBe(false);
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
    expect(document.querySelector("[data-corner]")).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Add" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe("a hall that cannot be drawn", () => {
  it("offers nothing to select", () => {
    setup({ kind: "element", id: "x", tag: "gdHall", attrs: {} });
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector(OVERLAY)).toBeNull();
  });
});

describe("the host's replies", () => {
  it("drops a selection that an undo takes away", () => {
    const { surface } = setup(neophyteHall(), true, { history: true });
    key(surface, "Tab");
    key(surface, "d", { ctrlKey: true });
    expect(selected()).toContain("Imperator selected");
    key(surface, "z", { ctrlKey: true });
    expect(selected()).toBe("Nothing selected");
  });

  it("keeps the hall as it was when the host refuses a change", () => {
    const { surface, changes, current } = setup(neophyteHall(), true, {
      refuse: true,
    });
    key(surface, "Tab");
    key(surface, "ArrowRight");
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "imperator").attrs).not.toHaveProperty(
      "x",
    );
    expect(screen.queryByText(/^Moved/)).toBeNull();
    expect(
      (screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement).value,
    ).toBe("");
    // The author is told, once visibly and once in the live region.
    const refused = "That change was not made; the hall is as it was.";
    expect(screen.getAllByText(refused)).toHaveLength(2);
  });

  it("says a field's value was not written, and clears the note", () => {
    const { surface, changes, current, refuse } = setup(neophyteHall(), true, {
      refuse: true,
    });
    key(surface, "Tab");
    const x = screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement;
    act(() => x.focus());
    fireEvent.change(x, { target: { value: "3" } });
    act(() => x.blur());
    expect(changes).toHaveLength(1);
    // The field shows the hall's value again, and why.
    expect(x.value).toBe("");
    expect(screen.getByText("Not written")).toBeTruthy();
    expect(document.querySelector("[data-hall-notice]")).toBeTruthy();
    refuse(false);
    key(surface, "ArrowRight");
    expect(byAttr(current(), "role", "imperator").attrs.x).toBe(2.1);
    expect(document.querySelector("[data-hall-notice]")).toBeNull();
  });
});

describe("a value still being typed", () => {
  it("is written when a save asks", () => {
    const { surface, changes, current, lock } = setup();
    key(surface, "Tab");
    const x = screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement;
    act(() => x.focus());
    fireEvent.change(x, { target: { value: "3" } });
    // Nothing is written while the host is locked.
    lock(true);
    expect(flushPendingEdits()).toBe(false);
    expect(changes).toHaveLength(0);
    lock(false);
    // Ctrl+S does not leave the field: the save writes it first.
    act(() => {
      expect(flushPendingEdits()).toBe(true);
    });
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "imperator").attrs.x).toBe(3);
    expect(document.activeElement).toBe(x);
    act(() => {
      expect(flushPendingEdits()).toBe(false);
    });
  });

  it("is written once the host unlocks, the field having lost the focus", () => {
    const { surface, changes, current, lock } = setup();
    key(surface, "Tab");
    const x = screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement;
    act(() => x.focus());
    fireEvent.change(x, { target: { value: "3" } });
    // Chromium disables the field without a blur and drops its focus
    // (jsdom keeps it there).
    lock(true);
    vi.spyOn(document, "activeElement", "get").mockReturnValue(document.body);
    expect(changes).toHaveLength(0);
    expect(x.value).toBe("3");
    lock(false);
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "imperator").attrs.x).toBe(3);
  });

  it("stops being offered once the editor goes", () => {
    const { surface, changes } = setup();
    key(surface, "Tab");
    const x = screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement;
    act(() => x.focus());
    fireEvent.change(x, { target: { value: "3" } });
    cleanup();
    expect(flushPendingEdits()).toBe(false);
    expect(changes).toHaveLength(0);
  });
});

describe("drawing and frames", () => {
  it("sizes handles from the drawing's width", () => {
    let report: (() => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          report = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const { surface } = setup(
      hallFromPug("gdHall", "  floor", '    pillar(kind="black", x=4, y=3)'),
    );
    key(surface, "Tab");
    const size = () =>
      (document.querySelector('[data-corner="se"]') as HTMLElement).style.width;
    const before = size();
    // Drawn larger: the handles keep their pixels, so a smaller share.
    vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(
      () => new DOMRect(0, 0, 1900, 2500),
    );
    act(() => report?.());
    expect(Number.parseFloat(size())).toBeLessThan(Number.parseFloat(before));
  });

  it("lays out once a frame, and drops a frame left at the end", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const { surface, changes, current } = setup();
    const press = (
      type: "pointerDown" | "pointerMove" | "pointerUp",
      x: number,
    ) => fireEvent[type](surface, { ...at(x, 3), pointerId: 1, button: 0 });
    press("pointerDown", 8);
    // Under the threshold: not a drag yet.
    fireEvent.pointerMove(surface, {
      clientX: at(8, 3).clientX + 1,
      clientY: at(8, 3).clientY,
      pointerId: 1,
    });
    expect(frames).toHaveLength(0);
    press("pointerMove", 9);
    press("pointerMove", 10);
    expect(frames).toHaveLength(1);
    act(() => frames[0](0));
    press("pointerMove", 11);
    expect(frames).toHaveLength(2);
    press("pointerUp", 11);
    expect(cancel).toHaveBeenCalledOnce();
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "hegemon").attrs.x).toBe(11);
    // A frame still pending when the editor goes is cancelled.
    press("pointerDown", 11);
    press("pointerMove", 13);
    cleanup();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("releases the pointer it captured", () => {
    const release = vi.fn();
    Object.assign(HTMLElement.prototype, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => true,
      releasePointerCapture: release,
    });
    try {
      const { surface } = setup();
      fireEvent.pointerDown(surface, { ...at(8, 3), pointerId: 1, button: 0 });
      fireEvent.pointerUp(surface, { ...at(8, 3), pointerId: 1, button: 0 });
      expect(release).toHaveBeenCalledWith(1);
    } finally {
      for (const name of [
        "setPointerCapture",
        "hasPointerCapture",
        "releasePointerCapture",
      ])
        delete (HTMLElement.prototype as unknown as Record<string, unknown>)[
          name
        ];
    }
  });

  it("ignores the pointer while the drawing has no size", () => {
    const { surface, changes } = setup();
    vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(
      () => new DOMRect(),
    );
    fireEvent.pointerDown(surface, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 10, clientY: 10, pointerId: 1 });
    expect(selected()).toBe("Nothing selected");
    expect(changes).toHaveLength(0);
  });
});

describe("on a touch screen", () => {
  it("keeps finger-sized handles off small objects", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(pointer: coarse)",
    }));
    const { surface } = setup(
      hallFromPug(
        "gdHall",
        "  floor",
        '    pillar(kind="black", x=4, y=3)',
        '    item(kind="cup", x=8, y=8)',
      ),
    );
    expect(
      screen.getByText(
        "Tap to select, drag to move, drag a corner to scale; the panel edits the rest.",
      ),
    ).toBeTruthy();
    key(surface, "Tab");
    expect(document.querySelectorAll("[data-corner]")).toHaveLength(4);
    key(surface, "Tab");
    expect(selected()).toContain("Cup selected");
    expect(document.querySelector("[data-corner]")).toBeNull();
    expect(screen.getByRole("button", { name: "Larger" })).toBeTruthy();
  });
});
