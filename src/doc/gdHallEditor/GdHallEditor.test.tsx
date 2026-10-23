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
import { GdHallEditor, type GdHallEditorProps } from "./GdHallEditor";
import { parseNumberField } from "./HallProperties";
import { hallView } from "./hallEdits";
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
  options: {
    refuse?: boolean;
    history?: boolean;
    props?: Partial<GdHallEditorProps>;
  } = {},
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
        {...options.props}
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
    const touch = /^Tap to select, drag to move/;
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
    // The rest of the dais is frozen where it stood, in the same change.
    expect(byAttr(current(), "role", "cancellarius").attrs.x).toBe(4.8);
    expect(byAttr(current(), "role", "praemonstrator").attrs.x).toBe(14.4);
    // Emptied, the attribute goes and the row places it again: alone in
    // the spread now, at the row's middle.
    const typed = screen.getByRole("textbox", { name: /^x/ });
    fireEvent.change(typed, { target: { value: "" } });
    fireEvent.blur(typed);
    expect(imperator().attrs).not.toHaveProperty("x");
    expect(
      (screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement)
        .placeholder,
    ).toBe("8");
    // Spread evenly again: every explicit x in the dais goes, one change.
    const count = changes.length;
    fireEvent.click(
      screen.getByRole("button", { name: "Spread evenly again" }),
    );
    expect(changes).toHaveLength(count + 1);
    expect(byAttr(current(), "role", "cancellarius").attrs).not.toHaveProperty(
      "x",
    );
    expect(
      screen.queryByRole("button", { name: "Spread evenly again" }),
    ).toBeNull();
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

  it("offers a light's colour, and colours only to the items that draw them", () => {
    setup(
      hallFromPug(
        "gdHall",
        "  floor",
        '    item(kind="lamp", x=3, y=3)',
        '    item(kind="cross", x=6, y=6)',
        '    item(kind="cup", x=9, y=9, fill="red")',
        '    item(kind="lantern", x=12, y=12, fill="white")',
      ),
    );
    const surface = screen.getByRole("application");
    key(surface, "Tab");
    expect(screen.getByRole("combobox", { name: "Light colour" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Fill" })).toBeNull();
    key(surface, "Tab");
    expect(screen.queryByRole("combobox", { name: "Light colour" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Fill" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Stroke" })).toBeTruthy();
    // A fill already written is shown, so it can be emptied.
    key(surface, "Tab");
    expect(screen.getByRole("combobox", { name: "Fill" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Stroke" })).toBeNull();
    // A light's fill, from before `light`, says what it was.
    key(surface, "Tab");
    expect(
      screen.getByRole("combobox", { name: "Fill (old light colour)" }),
    ).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Light colour" })).toBeTruthy();
  });

  it("offers a board's width and height only without a diagram", () => {
    setup(
      hallFromPug(
        "gdHall",
        "  floor",
        '    board(kind="flamingSword", x=3, y=3)',
        "    board(x=8, y=3)",
        '    board(kind="theFall", x=13, y=3, w=4)',
      ),
    );
    const surface = screen.getByRole("application");
    // The diagram keeps its proportions: w and h would do nothing.
    key(surface, "Tab");
    expect(screen.queryByRole("textbox", { name: "Width" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Height" })).toBeNull();
    key(surface, "Tab");
    expect(screen.getByRole("textbox", { name: "Width" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Height" })).toBeTruthy();
    // A w already written is shown, so it can be emptied.
    key(surface, "Tab");
    expect(screen.getByRole("textbox", { name: "Width" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Height" })).toBeNull();
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
    expect(screen.getByText(/^Tap to select, drag to move/)).toBeTruthy();
    key(surface, "Tab");
    expect(document.querySelectorAll("[data-corner]")).toHaveLength(4);
    key(surface, "Tab");
    expect(selected()).toContain("Cup selected");
    expect(document.querySelector("[data-corner]")).toBeNull();
    expect(screen.getByRole("button", { name: "Larger" })).toBeTruthy();
  });
});

/** Where an object is drawn, in floor squares (its centre). */
function centre(hall: HallElement, id: string) {
  const object = hallView(hall, gdHallArt).byId.get(id)?.object;
  if (!object) throw new Error(`${id} is not drawn`);
  return { x: object.cx, y: object.cy };
}

/** The roles in the dais, in order. */
const daisOrder = (hall: HallElement) =>
  (
    (
      hall.children?.find(
        (child) => child.kind === "element" && child.tag === "dais",
      ) as HallElement | undefined
    )?.children ?? []
  ).map((child) => (child as HallElement).attrs.role);

describe("rows (owner's decision, 19 October 2026)", () => {
  it("reorders a dais officer by a drag, marking where it lands", () => {
    const { surface, changes, current } = setup();
    const hierophant = byAttr(current(), "role", "hierophant");
    const from = centre(current(), hierophant.id);
    pointer("pointerDown", surface, at(from.x, from.y));
    pointer("pointerMove", surface, at(from.x + 2, from.y + 0.3));
    pointer("pointerMove", surface, at(from.x + 3.6, from.y + 0.3));
    expect(document.querySelector("[data-hall-slot]")).toBeTruthy();
    expect(changes).toHaveLength(0);
    pointer("pointerUp", surface, at(from.x + 3.6, from.y + 0.3));
    expect(changes).toHaveLength(1);
    expect(document.querySelector("[data-hall-slot]")).toBeNull();
    expect(daisOrder(current())).toEqual([
      "imperator",
      "cancellarius",
      "pastHierophant",
      "hierophant",
      "praemonstrator",
    ]);
    expect(byAttr(current(), "role", "hierophant").attrs).toEqual({
      role: "hierophant",
    });
    expect(
      screen.getByText("Moved Hierophant to place 4 of 5 in its row"),
    ).toBeTruthy();
  });

  it("places one freely with Alt, freezing the rest of the row", () => {
    const { surface, changes, current } = setup();
    const before = current();
    const hierophant = byAttr(before, "role", "hierophant").id;
    const from = centre(before, hierophant);
    pointer("pointerDown", surface, at(from.x, from.y), { altKey: true });
    pointer("pointerMove", surface, at(from.x + 0.7, from.y), { altKey: true });
    expect(document.querySelector("[data-hall-slot]")).toBeNull();
    pointer("pointerUp", surface, at(from.x + 0.7, from.y), { altKey: true });
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "hierophant").attrs.x).toBe(8.7);
    const imperator = byAttr(before, "role", "imperator").id;
    expect(centre(current(), imperator)).toEqual(centre(before, imperator));
    expect(byAttr(current(), "role", "imperator").attrs.x).toBe(1.6);
  });

  it("moves a place with Alt and an arrow, or the panel's buttons", () => {
    const { surface, changes, current } = setup();
    for (let tab = 0; tab < 3; tab++) key(surface, "Tab");
    expect(selected()).toContain("Hierophant selected");
    expect(key(surface, "ArrowLeft", { altKey: true })).toBe(false);
    expect(daisOrder(current()).slice(0, 2)).toEqual([
      "imperator",
      "hierophant",
    ]);
    expect(changes).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Move left" }));
    expect(daisOrder(current())[0]).toBe("hierophant");
    expect(
      (screen.getByRole("button", { name: "Move left" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Move right" }));
    expect(daisOrder(current()).slice(0, 2)).toEqual([
      "imperator",
      "hierophant",
    ]);
    expect(changes).toHaveLength(3);
    expect(byAttr(current(), "role", "hierophant").attrs).toEqual({
      role: "hierophant",
    });
    // Without Alt, an arrow along the row places it and freezes the rest.
    key(surface, "ArrowRight");
    expect(byAttr(current(), "role", "hierophant").attrs.x).toBe(5.3);
    expect(byAttr(current(), "role", "imperator").attrs.x).toBe(1.6);
    expect(screen.queryByRole("button", { name: "Move left" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Spread evenly again" }),
    );
    expect(byAttr(current(), "role", "imperator").attrs).toEqual({
      role: "imperator",
    });
    expect(changes).toHaveLength(5);
  });
});

describe("hosts (owner's decision, 19 October 2026)", () => {
  it("drags a cup off the altar and back, highlighting the altar", () => {
    const { surface, changes, current } = setup();
    const cup = byAttr(current(), "kind", "cup").id;
    const from = centre(current(), cup);
    expect(from).toEqual({ x: 8, y: 9 });
    pointer("pointerDown", surface, at(8, 9));
    pointer("pointerMove", surface, at(7.6, 9.1));
    // Still on the altar (its box is 7 to 9): it would stay there.
    expect(document.querySelector("[data-hall-drop]")).toBeTruthy();
    pointer("pointerMove", surface, at(8, 11.5));
    expect(document.querySelector("[data-hall-drop]")).toBeNull();
    pointer("pointerUp", surface, at(8, 11.5));
    expect(changes).toHaveLength(1);
    expect(screen.getByText("Moved Cup to the floor")).toBeTruthy();
    expect(byAttr(current(), "kind", "cup").attrs).toEqual({
      kind: "cup",
      x: 8,
      y: 11.5,
    });
    expect(centre(current(), cup)).toEqual({ x: 8, y: 11.5 });
    pointer("pointerDown", surface, at(8, 11.5));
    pointer("pointerMove", surface, at(8.1, 8.6));
    expect(document.querySelector("[data-hall-drop]")).toBeTruthy();
    pointer("pointerUp", surface, at(8.1, 8.6));
    expect(changes).toHaveLength(2);
    expect(screen.getByText("Moved Cup onto the Altar")).toBeTruthy();
    expect(byAttr(current(), "kind", "cup").attrs).toEqual({
      kind: "cup",
      x: 0,
      y: 0.5,
    });
  });

  it("never stands an officer on the altar", () => {
    const { surface, current } = setup();
    pointer("pointerDown", surface, at(8, 3));
    pointer("pointerMove", surface, at(8, 8));
    expect(document.querySelector("[data-hall-drop]")).toBeNull();
    pointer("pointerUp", surface, at(8, 8));
    const floor = current().children?.find(
      (child) => child.kind === "element" && child.tag === "floor",
    ) as HallElement;
    expect(
      floor.children?.some(
        (child) => child.kind === "element" && child.attrs.role === "hegemon",
      ),
    ).toBe(true);
  });

  it("stands an object on a host from the panel", async () => {
    const { surface, changes, current } = setup();
    pointer("pointerDown", surface, at(8, 3));
    pointer("pointerUp", surface, at(8, 3));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Stands on" }));
    const listbox = await screen.findByRole("listbox");
    expect(
      within(listbox)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Floor", "Platform"]);
    fireEvent.click(within(listbox).getByRole("option", { name: "Platform" }));
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "hegemon").attrs).toMatchObject({
      x: 0,
      y: -11.5,
    });
    expect(centre(current(), byAttr(current(), "role", "hegemon").id)).toEqual({
      x: 8,
      y: 3,
    });
    expect(screen.getByText("Moved Hegemon onto the Platform")).toBeTruthy();
  });
});

describe("hosts that are always editing", () => {
  it("shows no Done, and Escape with nothing selected stays", () => {
    const { surface } = setup(neophyteHall(), true, {
      props: { onDone: undefined, historyButtons: false },
    });
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(key(surface, "Escape")).toBe(true);
    expect(screen.getByText(/Escape deselects\./)).toBeTruthy();
  });

  it("says what the host chose while locked", () => {
    setup(neophyteHall(), false, {
      props: { lockedNote: "Correct the source to edit the drawing." },
    });
    expect(
      screen.getByText("Correct the source to edit the drawing."),
    ).toBeTruthy();
  });

  it("starts at the warnings when asked", () => {
    setup(hallFromPug("gdHall", "  floor", "    unicorn(x=3, y=3)"), true, {
      props: { initialFocus: "warnings" },
    });
    expect(document.activeElement?.textContent).toBe(
      "⚠unknown tag unicorn; drawn as a placeholder",
    );
  });
});

describe("the panel's place (owner's decision, 20 October 2026)", () => {
  /** The editor's width, which the mocked layout reports for its root. */
  let width = 0;
  /** The docked panel's height, as the mocked layout reports it. */
  let panelHeight = 300;
  const observers: ((entries: ResizeObserverEntry[]) => void)[] = [];
  const disconnected = vi.fn();

  beforeEach(() => {
    width = 0;
    panelHeight = 300;
    observers.length = 0;
    disconnected.mockClear();
    localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        watched: Element[] = [];
        constructor(callback: (entries: ResizeObserverEntry[]) => void) {
          observers.push(callback);
        }
        observe(element: Element) {
          this.watched.push(element);
        }
        disconnect() {
          disconnected(this.watched);
        }
      },
    );
    const overlay = vi.mocked(Element.prototype.getBoundingClientRect);
    const drawn = overlay.getMockImplementation();
    overlay.mockImplementation(function (this: Element) {
      if (this.matches("[data-gd-hall-controls]"))
        return new DOMRect(0, 0, width, 900);
      if (this.matches("[data-hall-panel]"))
        return new DOMRect(0, 768 - panelHeight, width, panelHeight);
      return drawn ? drawn.call(this) : new DOMRect();
    });
  });

  afterEach(() => localStorage.clear());

  /** Gives the editor a new width, as the observer reports a border box. */
  const resize = (next: number) => {
    width = next;
    const root = document.querySelector("[data-gd-hall-controls]") as Element;
    const entry = {
      target: root,
      borderBoxSize: [{ inlineSize: next, blockSize: 900 }],
      contentRect: new DOMRect(0, 0, next, 900),
    } as unknown as ResizeObserverEntry;
    act(() => {
      for (const report of observers) report([entry]);
    });
  };
  /** The editor's body, which holds the drawing and the panel. */
  const body = () =>
    screen.getByRole("heading", { level: 3 }).closest("section")
      ?.parentElement as HTMLElement;
  const panel = () =>
    screen.getByRole("heading", { level: 3 }).closest("section") as HTMLElement;
  const toggle = () => screen.queryByRole("button", { name: /properties$/ });
  const fieldsOf = (button: HTMLElement) =>
    document.getElementById(
      button.getAttribute("aria-controls") ?? "",
    ) as HTMLElement;

  it("stands beside the drawing when the editor is wide enough", () => {
    width = 900;
    setup();
    expect(body().dataset.panel).toBe("beside");
    expect(panel().dataset.hallPanel).toBe("beside");
    expect(toggle()).toBeNull();
    // Beside down to 732 px: a 30rem drawing, the 15rem panel, the gap.
    resize(732);
    expect(body().dataset.panel).toBe("beside");
    resize(731);
    expect(body().dataset.panel).toBe("docked");
  });

  it("goes back beside only 16 px wider, so a scrollbar cannot flap it", () => {
    width = 731;
    setup();
    expect(body().dataset.panel).toBe("docked");
    resize(740);
    expect(body().dataset.panel).toBe("docked");
    resize(747);
    expect(body().dataset.panel).toBe("docked");
    resize(748);
    expect(body().dataset.panel).toBe("beside");
    // A scrollbar's 15 px taken and given back: beside, docked, docked.
    resize(733);
    expect(body().dataset.panel).toBe("beside");
    resize(718);
    expect(body().dataset.panel).toBe("docked");
    resize(733);
    expect(body().dataset.panel).toBe("docked");
  });

  it("docks at the screen's foot when it is not, and goes back beside", () => {
    width = 576;
    const { surface } = setup();
    expect(body().dataset.panel).toBe("docked");
    expect(panel().dataset.hallPanel).toBe("docked");
    const button = toggle() as HTMLElement;
    expect(button.textContent).toBe("Hide properties");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    // The keys and the live region work as before.
    key(surface, "Tab");
    expect(selected()).toBe("Imperator selected");
    expect(
      fieldsOf(button).contains(screen.getByRole("textbox", { name: /^x/ })),
    ).toBe(true);
    resize(1000);
    expect(body().dataset.panel).toBe("beside");
    expect(toggle()).toBeNull();
  });

  it("caps the dock by the height of the box it sticks in", () => {
    width = 576;
    setup();
    // No scrolling ancestor in this page: the window's height (jsdom 768).
    expect(body().style.getPropertyValue("--hall-dock-room")).toBe("768px");
  });

  it("stays below the drawing in a box too short to dock in", () => {
    const scrolled = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    vi.stubGlobal("innerHeight", 390);
    width = 576;
    const { surface } = setup(
      hallFromPug("gdHall", "  floor", '    pillar(kind="white", x=12, y=4)'),
    );
    expect(body().dataset.panel).toBe("docked");
    expect(body().dataset.dock).toBe("flow");
    // Nothing lies over the drawing, so a selection in view stays put.
    key(surface, "Tab");
    expect(scrolled).not.toHaveBeenCalled();
    width = 576;
    vi.stubGlobal("innerHeight", 768);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(body().dataset.dock).toBe("stuck");
  });

  it("lays one column until the editor has a width", () => {
    // Unmeasured, a beside layout would ask 748 px of any screen, and a
    // phone's browser would shrink the page to fit before measuring.
    setup();
    expect(body().dataset.panel).toBeUndefined();
    expect(panel().dataset.hallPanel).toBe("beside");
    expect(toggle()).toBeNull();
    resize(0);
    expect(body().dataset.panel).toBeUndefined();
    resize(358);
    expect(body().dataset.panel).toBe("docked");
  });

  it("stops observing when the editor goes", () => {
    width = 900;
    setup();
    const root = document.querySelector("[data-gd-hall-controls]");
    expect(disconnected).not.toHaveBeenCalled();
    cleanup();
    // The panel's own observer, which watched the editor itself (the
    // overlay's watches the drawing).
    expect(disconnected).toHaveBeenCalledWith([root]);
  });

  it("shows the hall's caption docked, the rest a click away", () => {
    width = 390;
    const { surface } = setup();
    expect(screen.getByRole("textbox", { name: "Caption" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Dais depth" })).toBeNull();
    const more = screen.getByRole("button", { name: "All hall settings" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(screen.getByRole("textbox", { name: "Dais depth" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Fewer hall settings" }),
    );
    expect(screen.queryByRole("textbox", { name: "Dais depth" })).toBeNull();
    // A selection shows its own fields at once.
    key(surface, "Tab");
    expect(screen.getByRole("textbox", { name: /^x/ })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "All hall settings" }),
    ).toBeNull();
    // Beside, every hall field shows as before.
    key(surface, "Escape");
    resize(900);
    expect(screen.getByRole("textbox", { name: "Dais depth" })).toBeTruthy();
  });

  it("hides to its title bar and shows again, kept for this viewer", () => {
    width = 390;
    const { surface } = setup();
    key(surface, "Tab");
    fireEvent.click(toggle() as HTMLElement);
    const button = toggle() as HTMLElement;
    expect(button.textContent).toBe("Show properties");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    const fields = fieldsOf(button);
    expect(fields.hidden).toBe(true);
    expect(panel().dataset.collapsed).toBe("true");
    // The title bar still says what is selected, as the selection moves.
    key(surface, "Tab");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toMatch(
      /^Cancellarius/,
    );
    expect(localStorage.getItem("magickli:gd-hall-panel-collapsed:v1")).toBe(
      "1",
    );
    // Beside the drawing it is never hidden.
    resize(900);
    expect(fields.hidden).toBe(false);
    expect(panel().dataset.collapsed).toBeUndefined();
    resize(390);
    expect(fields.hidden).toBe(true);
    // Another hall, or the next visit, opens it as this viewer left it.
    cleanup();
    setup();
    expect(toggle()?.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle() as HTMLElement);
    expect(toggle()?.getAttribute("aria-expanded")).toBe("true");
    expect(
      localStorage.getItem("magickli:gd-hall-panel-collapsed:v1"),
    ).toBeNull();
  });

  it("follows the choice made in another editor or another tab", () => {
    width = 390;
    setup();
    const second = render(
      <GdHallEditor
        hall={neophyteHall()}
        art={gdHallArt}
        onChange={() => {}}
      />,
    );
    const toggles = () =>
      screen.getAllByRole("button", { name: /properties$/ });
    expect(toggles()).toHaveLength(2);
    fireEvent.click(toggles()[0]);
    expect(toggles().map((button) => button.textContent)).toEqual([
      "Show properties",
      "Show properties",
    ]);
    second.unmount();
    // Another tab shows it again.
    localStorage.removeItem("magickli:gd-hall-panel-collapsed:v1");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "magickli:gd-hall-panel-collapsed:v1",
          newValue: null,
        }),
      );
    });
    expect(toggle()?.textContent).toBe("Hide properties");
  });

  it("keeps a value typed before it was hidden, for a save to write", () => {
    width = 390;
    const { surface, changes, current } = setup();
    key(surface, "Tab");
    const x = screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement;
    act(() => x.focus());
    fireEvent.change(x, { target: { value: "3" } });
    fireEvent.click(toggle() as HTMLElement);
    expect(x.isConnected).toBe(true);
    act(() => {
      expect(flushPendingEdits()).toBe(true);
    });
    expect(changes).toHaveLength(1);
    expect(byAttr(current(), "role", "imperator").attrs.x).toBe(3);
  });

  it("opens rather than hide a field that holds the focus as it docks", () => {
    localStorage.setItem("magickli:gd-hall-panel-collapsed:v1", "1");
    width = 1440;
    const { surface } = setup();
    key(surface, "Tab");
    const x = screen.getByRole("textbox", { name: /^x/ }) as HTMLInputElement;
    act(() => x.focus());
    resize(1024 - 450);
    expect(body().dataset.panel).toBe("docked");
    expect(fieldsOf(toggle() as HTMLElement).hidden).toBe(false);
    expect(document.activeElement).toBe(x);
    // Leaving the field keeps it open in this editor until it is hidden.
    act(() => surface.focus());
    expect(fieldsOf(toggle() as HTMLElement).hidden).toBe(false);
    fireEvent.click(toggle() as HTMLElement);
    expect(fieldsOf(toggle() as HTMLElement).hidden).toBe(true);
  });

  it("gives the Hide button's focus to a field when the dock goes", () => {
    width = 576;
    const { surface } = setup();
    key(surface, "Tab");
    act(() => (toggle() as HTMLElement).focus());
    resize(1440);
    expect(toggle()).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: /^x/ }),
    );
  });

  it("gives All hall settings' focus to the caption when the dock goes", () => {
    width = 576;
    setup();
    act(() =>
      screen.getByRole("button", { name: "All hall settings" }).focus(),
    );
    resize(1440);
    expect(
      screen.queryByRole("button", { name: "All hall settings" }),
    ).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Caption" }),
    );
  });

  it("follows the focus out of a field even without a blur", () => {
    width = 1440;
    const { surface } = setup();
    const dais = screen.getByRole("textbox", { name: "Dais depth" });
    act(() => dais.focus());
    // Docked with a hall field focused: the hall's fields stay.
    resize(576);
    expect(screen.getByRole("textbox", { name: "Dais depth" })).toBe(dais);
    // The focus leaves with no blur event, as Firefox leaves a field that
    // is removed; the next render reads where it went.
    const swallow = (event: Event) => event.stopImmediatePropagation();
    dais.addEventListener("blur", swallow, { capture: true });
    dais.addEventListener("focusout", swallow, { capture: true });
    act(() => surface.focus());
    key(surface, "Tab");
    key(surface, "Escape");
    expect(screen.queryByRole("textbox", { name: "Dais depth" })).toBeNull();
  });

  it("follows the viewer's choice again once it has been beside", () => {
    localStorage.setItem("magickli:gd-hall-panel-collapsed:v1", "1");
    width = 1440;
    const { surface } = setup();
    key(surface, "Tab");
    const x = () =>
      document.querySelector('input[data-hall-field="x"]') as HTMLElement;
    act(() => x().focus());
    resize(576);
    expect(fieldsOf(toggle() as HTMLElement).hidden).toBe(false);
    resize(1440);
    act(() => surface.focus());
    resize(576);
    expect(fieldsOf(toggle() as HTMLElement).hidden).toBe(true);
  });

  it("gives it to the drawing when no field can take it", () => {
    width = 576;
    const { surface } = setup(neophyteHall(), false);
    act(() => (toggle() as HTMLElement).focus());
    resize(1440);
    expect(document.activeElement).toBe(surface);
  });

  describe("a selection made by a key", () => {
    /** A hall whose pillar stands low, under a docked panel's top. */
    const low = () =>
      hallFromPug(
        "gdHall",
        "  floor",
        '    pillar(kind="black", x=4, y=2)',
        '    pillar(kind="white", x=12, y=15)',
      );

    it("is scrolled clear of the dock, and a pointer's is not", () => {
      const scrolled = vi
        .spyOn(window, "scrollBy")
        .mockImplementation(() => {});
      width = 576;
      const { surface } = setup(low());
      key(surface, "Tab");
      // The black pillar, high on the floor: in view already.
      expect(scrolled).not.toHaveBeenCalled();
      key(surface, "Tab");
      // The white pillar's foot lies below 768 − 300 − 12 px.
      expect(scrolled).toHaveBeenCalledTimes(1);
      const [{ top }] = scrolled.mock.calls[0] as unknown as [ScrollToOptions];
      expect(top).toBeGreaterThan(0);
      // A nudge scrolls again; a click on the drawing does not.
      key(surface, "ArrowDown");
      expect(scrolled).toHaveBeenCalledTimes(2);
      key(surface, "Escape");
      pointer("pointerDown", surface, at(12, 15));
      pointer("pointerUp", surface, at(12, 15));
      expect(selected()).toContain("selected");
      expect(scrolled).toHaveBeenCalledTimes(2);
    });

    it("forgets a key that changed nothing before a pointer's selection", () => {
      const scrolled = vi
        .spyOn(window, "scrollBy")
        .mockImplementation(() => {});
      width = 576;
      const { surface } = setup(low());
      key(surface, "Tab");
      // Smaller than the least scale: nothing changes, nothing renders.
      for (let i = 0; i < 40; i++) key(surface, "-");
      const count = scrolled.mock.calls.length;
      key(surface, "-");
      expect(scrolled.mock.calls.length).toBe(count);
      // The low pillar, picked by the pointer under the dock: no jump.
      pointer("pointerDown", surface, at(12, 15));
      pointer("pointerUp", surface, at(12, 15));
      expect(selected()).toBe("White pillar selected");
      expect(scrolled.mock.calls.length).toBe(count);
    });

    it("reveals what the panel's buttons move or add", () => {
      const scrolled = vi
        .spyOn(window, "scrollBy")
        .mockImplementation(() => {});
      width = 576;
      const { surface } = setup(low());
      key(surface, "Tab");
      key(surface, "Tab");
      // The low pillar, scrolled clear (the mocked scroll moves nothing,
      // so it stays under the dock for what follows).
      expect(scrolled).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: "Larger" }));
      expect(scrolled).toHaveBeenCalledTimes(2);
      fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
      expect(scrolled).toHaveBeenCalledTimes(3);
      fireEvent.click(screen.getByRole("button", { name: "Smaller" }));
      expect(scrolled).toHaveBeenCalledTimes(4);
    });

    it("needs no scroll beside the drawing, with no dock below", () => {
      const scrolled = vi
        .spyOn(window, "scrollBy")
        .mockImplementation(() => {});
      width = 900;
      const { surface } = setup(low());
      key(surface, "Tab");
      key(surface, "Tab");
      expect(scrolled).not.toHaveBeenCalled();
    });
  });
});
