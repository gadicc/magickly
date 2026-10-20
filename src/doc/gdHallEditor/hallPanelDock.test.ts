// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOCK_MIN_ROOM,
  dockSticks,
  entryWidth,
  PANEL_BESIDE_HYSTERESIS,
  PANEL_BESIDE_MIN_WIDTH,
  PANEL_COLLAPSED_KEY,
  panelPlaceFor,
  readPanelCollapsed,
  revealDelta,
  scrollingAncestor,
  useHallPanelDock,
  usePanelCollapsed,
  windowRoom,
  writePanelCollapsed,
} from "./hallPanelDock";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("panelPlaceFor", () => {
  it("puts the panel beside the drawing from 732px, docked below that", () => {
    expect(PANEL_BESIDE_MIN_WIDTH).toBe(732);
    expect(panelPlaceFor(732)).toBe("beside");
    expect(panelPlaceFor(1400)).toBe("beside");
    expect(panelPlaceFor(731.5)).toBe("docked");
    expect(panelPlaceFor(358)).toBe("docked");
  });

  it("keeps a docked panel docked until 16px wider", () => {
    expect(PANEL_BESIDE_HYSTERESIS).toBe(16);
    expect(panelPlaceFor(747, "docked")).toBe("docked");
    expect(panelPlaceFor(748, "docked")).toBe("beside");
    expect(panelPlaceFor(732, "beside")).toBe("beside");
    expect(panelPlaceFor(731, "beside")).toBe("docked");
  });

  it("does not know for an editor without a width", () => {
    expect(panelPlaceFor(0)).toBeUndefined();
    expect(panelPlaceFor(Number.NaN)).toBeUndefined();
    expect(panelPlaceFor(-1, "docked")).toBeUndefined();
  });
});

describe("dockSticks", () => {
  it("docks over the drawing in a box at least 400px tall", () => {
    expect(DOCK_MIN_ROOM).toBe(400);
    expect(dockSticks(400)).toBe(true);
    expect(dockSticks(undefined)).toBe(true);
    expect(dockSticks(399)).toBe(false);
    expect(dockSticks(183)).toBe(false);
  });
});

describe("entryWidth", () => {
  const entry = (fields: object) =>
    ({ contentRect: new DOMRect(0, 0, 700, 10), ...fields }) as never;
  it("reads the border box, as a list or (older browsers) one size", () => {
    expect(entryWidth(entry({ borderBoxSize: [{ inlineSize: 742 }] }))).toBe(
      742,
    );
    expect(entryWidth(entry({ borderBoxSize: { inlineSize: 741 } }))).toBe(741);
  });
  it("falls back to the content box", () => {
    expect(entryWidth(entry({}))).toBe(700);
    expect(entryWidth(entry({ borderBoxSize: [] }))).toBe(700);
  });
});

describe("revealDelta", () => {
  const port = { top: 100, bottom: 500 };
  it("scrolls only as far as needed, down or up", () => {
    expect(revealDelta({ top: 200, bottom: 300 }, port)).toBe(0);
    expect(revealDelta({ top: 450, bottom: 560 }, port)).toBe(60);
    expect(revealDelta({ top: 40, bottom: 140 }, port)).toBe(-60);
  });
  it("shows an item taller than the box from its top", () => {
    expect(revealDelta({ top: 300, bottom: 900 }, port)).toBe(200);
  });
});

describe("scrollingAncestor", () => {
  it("finds the box that scrolls, or the page", () => {
    const outer = document.createElement("div");
    outer.style.overflowY = "auto";
    const inner = document.createElement("div");
    const leaf = document.createElement("span");
    inner.append(leaf);
    outer.append(inner);
    document.body.append(outer);
    expect(scrollingAncestor(leaf)).toBe(outer);
    expect(scrollingAncestor(outer)).toBeNull();
    expect(scrollingAncestor(null)).toBeNull();
  });
});

describe("useHallPanelDock", () => {
  it("measures the box it sticks in, and stops observing when it goes", () => {
    const observed: Element[] = [];
    const disconnect = vi.fn();
    let report: (entries: ResizeObserverEntry[]) => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: typeof report) {
          report = callback;
        }
        observe(element: Element) {
          observed.push(element);
        }
        disconnect() {
          disconnect();
        }
      },
    );
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    Object.defineProperty(scroller, "clientHeight", {
      value: 560,
      configurable: true,
    });
    const editor = document.createElement("div");
    vi.spyOn(editor, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 600, 900),
    );
    scroller.append(editor);
    document.body.append(scroller);
    const ref = { current: editor };
    const { result, unmount } = renderHook(() => useHallPanelDock(ref));
    expect(result.current).toEqual({ place: "docked", room: 560 });
    expect(observed).toEqual([editor, scroller]);
    Object.defineProperty(scroller, "clientHeight", { value: 400 });
    act(() =>
      report([
        { target: scroller } as never,
        {
          target: editor,
          borderBoxSize: [{ inlineSize: 760 }],
          contentRect: new DOMRect(),
        } as never,
      ]),
    );
    expect(result.current).toEqual({ place: "beside", room: 400 });
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("measures the window without a scrolling box, and its resizes", () => {
    const editor = document.createElement("div");
    vi.spyOn(editor, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 1000, 900),
    );
    document.body.append(editor);
    const removed = vi.spyOn(window, "removeEventListener");
    const ref = { current: editor };
    const { result, unmount } = renderHook(() => useHallPanelDock(ref));
    expect(result.current).toEqual({
      place: "beside",
      room: window.innerHeight,
    });
    vi.stubGlobal("innerHeight", 390);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current.room).toBe(390);
    unmount();
    expect(removed).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("does nothing without an editor", () => {
    const { result } = renderHook(() => useHallPanelDock({ current: null }));
    expect(result.current).toEqual({ place: undefined, room: undefined });
  });

  it("knows no place until the editor has a width", () => {
    const editor = document.createElement("div");
    document.body.append(editor);
    const ref = { current: editor };
    const { result } = renderHook(() => useHallPanelDock(ref));
    expect(result.current.place).toBeUndefined();
  });

  it("reads the window's room from the layout viewport, then visualViewport", () => {
    // A page wider than a phone made innerHeight twice the screen's.
    vi.stubGlobal("innerHeight", 1619);
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 844,
      configurable: true,
    });
    const viewport = new EventTarget();
    vi.stubGlobal("visualViewport", viewport);
    const editor = document.createElement("div");
    vi.spyOn(editor, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 358, 900),
    );
    document.body.append(editor);
    const ref = { current: editor };
    const { result, unmount } = renderHook(() => useHallPanelDock(ref));
    expect(result.current).toEqual({ place: "docked", room: 844 });
    expect(windowRoom()).toBe(844);
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 375,
      configurable: true,
    });
    act(() => {
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(result.current.room).toBe(375);
    unmount();
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 0,
      configurable: true,
    });
    // An unlaid document: the window's inner height stands in.
    expect(windowRoom()).toBe(1619);
  });
});

describe("the viewer's choice to hide the docked panel", () => {
  it("is kept in this browser, and nothing is kept for a shown panel", () => {
    expect(readPanelCollapsed()).toBe(false);
    expect(writePanelCollapsed(true)).toBe(true);
    expect(localStorage.getItem(PANEL_COLLAPSED_KEY)).toBe("1");
    expect(readPanelCollapsed()).toBe(true);
    writePanelCollapsed(false);
    expect(localStorage.getItem(PANEL_COLLAPSED_KEY)).toBeNull();
    expect(readPanelCollapsed()).toBe(false);
  });

  it("is shown when drawn on the server", () => {
    localStorage.setItem(PANEL_COLLAPSED_KEY, "1");
    const Probe = () => String(usePanelCollapsed()[0]);
    expect(renderToString(createElement(Probe))).toBe("false");
  });

  it("reads anything else as shown", () => {
    localStorage.setItem(PANEL_COLLAPSED_KEY, "true");
    expect(readPanelCollapsed()).toBe(false);
  });

  it("is shared by every editor in the page and by other tabs", () => {
    const first = renderHook(() => usePanelCollapsed());
    const second = renderHook(() => usePanelCollapsed());
    act(() => first.result.current[1](true));
    expect(second.result.current[0]).toBe(true);
    localStorage.removeItem(PANEL_COLLAPSED_KEY);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "unrelated", newValue: "1" }),
      );
    });
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: PANEL_COLLAPSED_KEY }),
      );
    });
    expect(first.result.current[0]).toBe(false);
    expect(second.result.current[0]).toBe(false);
    first.unmount();
    second.unmount();
  });

  it("lasts for the editor where storage is blocked or full", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(readPanelCollapsed()).toBe(false);
    expect(writePanelCollapsed(true)).toBe(false);
    expect(writePanelCollapsed(false)).toBe(false);
    const { result } = renderHook(() => usePanelCollapsed());
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });
});
