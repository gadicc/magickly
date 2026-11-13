// @vitest-environment jsdom
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RitualRow } from "@/doc/ritualHalls";
import type { DocNode } from "@/schemas";
import { DocView } from "./DocRender";

// The drawing names its hall by caption, so a test can tell the halls apart
// wherever they are drawn: in the ritual, the sheet or the viewer.
vi.mock("@/doc/ritualBlocks/GdHallDrawing", () => ({
  default: ({ hall }: { hall: RitualRow }) => (
    <span
      data-drawn={String(
        hall.children?.find((child) => child.type === "caption")?.text ?? "",
      )}
    />
  ),
}));

// Every hall is twice as wide as it is tall, so a 400×300 surface fits it
// at 368×184, 16 px from the sides and 58 px from the top.
vi.mock("magick-components/gd/hall/aspect", () => ({
  estimateHallAspect: () => 2,
}));

const hall = (caption: string): RitualRow => ({
  type: "gdHall",
  children: [{ type: "caption", text: caption }],
});
const title = (text: string): RitualRow => ({ type: "title", text });
const note = (...children: RitualRow[]): RitualRow => ({
  type: "note",
  children,
});
const summary = (heading: string, ...children: RitualRow[]): RitualRow => ({
  type: "summary",
  summary: heading,
  children,
});
const doc = (...children: RitualRow[]) => ({ children }) as unknown as DocNode;

const threeHalls = () =>
  doc(
    note(hall("Before")),
    title("Opening"),
    note(text("Text")),
    title("Advancement"),
    summary("Details", note(hall("Hidden"))),
    title("Closing"),
    note(hall("Last")),
  );
function text(value: string): RitualRow {
  return { type: "text", value };
}

beforeEach(() => {
  history.replaceState(null, "", "/doc/test");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openSpeedDial() {
  fireEvent.click(
    screen.getByRole("button", { name: "SpeedDial basic example" }),
  );
}
const action = (name: string) => screen.queryByRole("menuitem", { name });

describe("the Halls action", () => {
  it("is absent from a ritual with no halls", () => {
    render(<DocView doc={doc(title("Opening"))} searchParams={null} />);
    openSpeedDial();
    expect(action("Table of Contents")).not.toBeNull();
    expect(action("Halls")).toBeNull();
  });

  it("is absent with hall navigation off", () => {
    render(
      <DocView doc={threeHalls()} searchParams={null} hallNavigation={false} />,
    );
    openSpeedDial();
    expect(action("Table of Contents")).not.toBeNull();
    expect(action("Halls")).toBeNull();
  });

  it("sits between Jump to Next and Table of Contents", () => {
    render(<DocView doc={threeHalls()} searchParams={null} />);
    openSpeedDial();
    const names = screen
      .getAllByRole("menuitem")
      .map((item) => item.getAttribute("aria-label"));
    expect(names).toEqual([
      "Jump to Next",
      "Halls",
      "Table of Contents",
      "Zoom In/Out",
    ]);
  });

  it("opens the only hall's viewer directly", async () => {
    render(
      <DocView
        doc={doc(title("Opening"), note(hall("Zelator Temple 1")))}
        searchParams={null}
      />,
    );
    openSpeedDial();
    fireEvent.click(action("Halls") as HTMLElement);
    const viewer = await screen.findByRole("dialog", {
      name: "Zelator Temple 1",
    });
    expect(within(viewer).getByText("Opening")).toBeTruthy();
    expect(within(viewer).getByText("1 of 1")).toBeTruthy();
    expect(screen.queryByText("Halls in this ritual")).toBeNull();
    // The viewer's drawing has no id: the ritual's is the only hall-1.
    expect(document.querySelectorAll("#hall-1")).toHaveLength(1);
    expect(
      (
        within(viewer).getByRole("button", {
          name: "Previous hall",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        within(viewer).getByRole("button", {
          name: "Next hall",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

describe("a hall in the address", () => {
  // jsdom has no scrollIntoView: each test records which figures scroll.
  let scrolled: string[] = [];
  beforeEach(() => {
    scrolled = [];
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value(this: Element) {
        scrolled.push(this.id);
      },
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  });
  /** A reader whose ritual arrives later, as the private one does. */
  function Later({ docs }: { docs: DocNode[] }) {
    const [index, setIndex] = React.useState<number | null>(null);
    React.useEffect(() => {
      void Promise.resolve().then(() => setIndex(0));
    }, []);
    return index === null ? (
      <p>Loading</p>
    ) : (
      <>
        <button type="button" onClick={() => setIndex(index + 1)}>
          Reload
        </button>
        <DocView
          doc={docs[Math.min(index, docs.length - 1)]}
          searchParams={null}
        />
      </>
    );
  }

  it("goes to it once when the ritual first appears, opening its details", async () => {
    history.replaceState(null, "", "/doc/test#hall-2");
    render(<Later docs={[threeHalls(), threeHalls()]} />);
    expect(screen.getByText("Loading")).toBeTruthy();
    await waitFor(() => expect(scrolled).toEqual(["hall-2"]));
    const details = document
      .getElementById("hall-2")
      ?.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(true);
    // A later render, even of a new copy, leaves the reader where it is.
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await new Promise((done) => setTimeout(done, 10));
    expect(scrolled).toEqual(["hall-2"]);
  });

  it("drops the hash it honoured, so a remounted reader stays put", async () => {
    history.replaceState({ router: 1 }, "", "/doc/test?x=1#hall-2");
    render(<DocView doc={threeHalls()} searchParams={null} />);
    await waitFor(() => expect(scrolled).toEqual(["hall-2"]));
    expect(location.hash).toBe("");
    expect(location.pathname + location.search).toBe("/doc/test?x=1");
    expect(history.state).toEqual({ router: 1 });
    // The private reader unmounts and remounts its view on every re-show.
    cleanup();
    render(<DocView doc={threeHalls()} searchParams={null} />);
    await new Promise((done) => setTimeout(done, 10));
    expect(scrolled).toEqual(["hall-2"]);
  });

  it("ignores a hash naming no hall", async () => {
    for (const hash of ["#hall-9", "#hall-0", "#Opening"]) {
      history.replaceState(null, "", `/doc/test${hash}`);
      render(<Later docs={[threeHalls()]} />);
      await screen.findByRole("button", { name: "Reload" });
      cleanup();
    }
    expect(scrolled).toEqual([]);
  });

  it("does nothing with hall navigation off", async () => {
    history.replaceState(null, "", "/doc/test#hall-1");
    render(
      <DocView doc={threeHalls()} searchParams={null} hallNavigation={false} />,
    );
    await new Promise((done) => setTimeout(done, 10));
    expect(scrolled).toEqual([]);
  });
});

describe("the sheet and the viewer", () => {
  async function openSheet() {
    render(<DocView doc={threeHalls()} searchParams={null} />);
    openSpeedDial();
    fireEvent.click(action("Halls") as HTMLElement);
    return screen.findByRole("dialog", { name: "Halls in this ritual" });
  }

  it("lists every hall with its drawing, name and context", async () => {
    const sheet = await openSheet();
    const items = within(sheet).getAllByRole("button");
    expect(items.map((item) => item.textContent)).toEqual([
      "BeforeOpening",
      "HiddenAdvancement",
      "LastClosing",
    ]);
    await waitFor(() =>
      expect(
        [...sheet.querySelectorAll("[data-drawn]")].map((drawn) =>
          drawn.getAttribute("data-drawn"),
        ),
      ).toEqual(["Before", "Hidden", "Last"]),
    );
    expect(sheet.querySelector("[id^='hall-']")).toBeNull();
  });

  it("opens the hall picked, and steps through the others", async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByText("Hidden"));
    let viewer = await screen.findByRole("dialog", { name: "Hidden" });
    expect(within(viewer).getByText("2 of 3")).toBeTruthy();
    expect(within(viewer).getByText("Advancement")).toBeTruthy();

    fireEvent.click(within(viewer).getByRole("button", { name: "Next hall" }));
    viewer = await screen.findByRole("dialog", { name: "Last" });
    expect(within(viewer).getByText("3 of 3")).toBeTruthy();
    expect(
      (
        within(viewer).getByRole("button", {
          name: "Next hall",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(
      within(viewer).getByRole("button", { name: "Previous hall" }),
    );
    fireEvent.click(
      within(viewer).getByRole("button", { name: "Previous hall" }),
    );
    viewer = await screen.findByRole("dialog", { name: "Before" });
    expect(within(viewer).getByText("1 of 3")).toBeTruthy();
    expect(
      (
        within(viewer).getByRole("button", {
          name: "Previous hall",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("closes back to the sheet", async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByText("Last"));
    const viewer = await screen.findByRole("dialog", { name: "Last" });
    fireEvent.click(within(viewer).getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Last" })).toBeNull(),
    );
    expect(
      screen.getByRole("dialog", { name: "Halls in this ritual" }),
    ).toBeTruthy();
  });

  it("closes on Escape", async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByText("Last"));
    const viewer = await screen.findByRole("dialog", { name: "Last" });
    fireEvent.keyDown(viewer, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Last" })).toBeNull(),
    );
    expect(sheet.isConnected).toBe(true);
    expect(screen.getByRole("dialog", { name: "Halls in this ritual" })).toBe(
      sheet,
    );
  });

  it("moves focus to the other arrow when one is disabled, and announces the hall", async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByText("Hidden"));
    const viewer = await screen.findByRole("dialog", { name: "Hidden" });
    const live = within(viewer).getByText("2 of 3").closest("[aria-live]");
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.getAttribute("aria-atomic")).toBe("true");
    expect(live?.textContent).toContain("Hidden");
    const next = within(viewer).getByRole("button", { name: "Next hall" });
    next.focus();
    fireEvent.click(next);
    await screen.findByRole("dialog", { name: "Last" });
    expect(document.activeElement).toBe(
      within(viewer).getByRole("button", { name: "Previous hall" }),
    );
    const previous = document.activeElement as HTMLElement;
    fireEvent.click(previous);
    fireEvent.click(previous);
    await screen.findByRole("dialog", { name: "Before" });
    expect(document.activeElement).toBe(next);
  });

  it("goes to the hall in the ritual, opening its details and arming Jump Back", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(window, "pageYOffset", "get").mockReturnValue(321);
    const sheet = await openSheet();
    const details = document
      .getElementById("hall-2")
      ?.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    fireEvent.click(within(sheet).getByText("Hidden"));
    const viewer = await screen.findByRole("dialog", { name: "Hidden" });
    fireEvent.click(
      within(viewer).getByRole("button", { name: "Go to it in the ritual" }),
    );
    expect(location.hash).toBe("#hall-2");
    expect(details.open).toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    openSpeedDial();
    const back = action("Jump Back") as HTMLElement;
    expect(action("Jump to Next")).toBeNull();
    fireEvent.click(back);
    expect(scrollTo).toHaveBeenCalledWith(0, 321);
  });

  it("arms Jump Back from the top of the page, and focuses the hall", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(window, "pageYOffset", "get").mockReturnValue(0);
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByText("Last"));
    const viewer = await screen.findByRole("dialog", { name: "Last" });
    fireEvent.click(
      within(viewer).getByRole("button", { name: "Go to it in the ritual" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const figure = document.getElementById("hall-3") as HTMLElement;
    await waitFor(() => expect(document.activeElement).toBe(figure));
    expect(figure.tabIndex).toBe(-1);
    openSpeedDial();
    fireEvent.click(action("Jump Back") as HTMLElement);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    openSpeedDial();
    expect(action("Jump to Next")).not.toBeNull();
  });
});

describe("zooming the viewer", () => {
  it("zooms with the keys and the buttons, and resets for another hall", async () => {
    render(<DocView doc={threeHalls()} searchParams={null} />);
    openSpeedDial();
    fireEvent.click(action("Halls") as HTMLElement);
    const sheet = await screen.findByRole("dialog", {
      name: "Halls in this ritual",
    });
    fireEvent.click(within(sheet).getByText("Before"));
    const viewer = await screen.findByRole("dialog", { name: "Before" });
    const surface = within(viewer).getByRole("group", { name: "Hall drawing" });
    const button = (name: string) =>
      within(viewer).getByRole("button", { name }) as HTMLButtonElement;
    expect(getComputedStyle(surface).touchAction).toBe("none");
    expect(button("Zoom out").disabled).toBe(true);
    expect(button("Reset zoom").disabled).toBe(true);
    // The buttons are named once, by their labels alone.
    expect(button("Zoom in").getAttribute("aria-describedby")).toBeNull();
    // Composing text or an event already handled is not the viewer's.
    fireEvent.keyDown(viewer, { key: "+", isComposing: true });
    const handled = createEvent.keyDown(viewer, { key: "+", cancelable: true });
    handled.preventDefault();
    fireEvent(viewer, handled);
    expect(surface.dataset.scale).toBe("1");

    fireEvent.keyDown(viewer, { key: "+" });
    expect(surface.dataset.scale).toBe("1.5");
    expect(within(viewer).getByText("Zoom 150%")).toBeTruthy();
    expect(button("Zoom out").disabled).toBe(false);
    fireEvent.keyDown(viewer, { key: "=" });
    expect(surface.dataset.scale).toBe("2.25");
    fireEvent.keyDown(viewer, { key: "-" });
    expect(surface.dataset.scale).toBe("1.5");
    fireEvent.keyDown(viewer, { key: "0" });
    expect(surface.dataset.scale).toBe("1");
    // Modified keys are the browser's.
    fireEvent.keyDown(viewer, { key: "+", ctrlKey: true });
    fireEvent.keyDown(viewer, { key: "a" });
    expect(surface.dataset.scale).toBe("1");

    for (let i = 0; i < 6; i++) fireEvent.click(button("Zoom in"));
    expect(surface.dataset.scale).toBe("6");
    expect(button("Zoom in").disabled).toBe(true);
    fireEvent.click(button("Zoom out"));
    expect(surface.dataset.scale).toBe("4");
    fireEvent.click(button("Reset zoom"));
    expect(surface.dataset.scale).toBe("1");

    fireEvent.click(button("Zoom in"));
    fireEvent.click(button("Next hall"));
    const next = await screen.findByRole("dialog", { name: "Hidden" });
    expect(
      within(next).getByRole("group", { name: "Hall drawing" }).dataset.scale,
    ).toBe("1");

    // At 1×, ← and → step through the halls; ↑ is left alone.
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    await screen.findByRole("dialog", { name: "Last" });
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    await screen.findByRole("dialog", { name: "Hidden" });
    const up = createEvent.keyDown(document.body, {
      key: "ArrowUp",
      cancelable: true,
    });
    fireEvent(document.body, up);
    expect(up.defaultPrevented).toBe(false);
  });

  it("takes no keys while closed", async () => {
    render(<DocView doc={threeHalls()} searchParams={null} />);
    const event = createEvent.keyDown(document.body, {
      key: "+",
      cancelable: true,
    });
    fireEvent(document.body, event);
    expect(event.defaultPrevented).toBe(false);
    openSpeedDial();
    fireEvent.click(action("Halls") as HTMLElement);
    const sheet = await screen.findByRole("dialog", {
      name: "Halls in this ritual",
    });
    fireEvent.click(within(sheet).getByText("Before"));
    const viewer = await screen.findByRole("dialog", { name: "Before" });
    fireEvent.click(within(viewer).getByRole("button", { name: "Close" }));
    // Even while it fades out.
    const closing = createEvent.keyDown(document.body, {
      key: "+",
      cancelable: true,
    });
    fireEvent(document.body, closing);
    expect(closing.defaultPrevented).toBe(false);
  });
});

describe("gestures on the viewer", () => {
  // jsdom lays nothing out: give the surface a size to pan within.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 400,
      height: 300,
      right: 400,
      bottom: 300,
      toJSON: () => ({}),
    } as DOMRect);
  });

  async function viewer(name = "Before") {
    render(<DocView doc={threeHalls()} searchParams={null} />);
    openSpeedDial();
    fireEvent.click(action("Halls") as HTMLElement);
    const sheet = await screen.findByRole("dialog", {
      name: "Halls in this ritual",
    });
    fireEvent.click(within(sheet).getByText(name));
    const dialog = await screen.findByRole("dialog", { name });
    return within(dialog).getByRole("group", { name: "Hall drawing" });
  }
  const touch = (
    type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
    target: Element,
    pointerId: number,
    clientX: number,
    clientY: number,
    timeStamp?: number,
  ) => {
    const init = { pointerId, clientX, clientY, pointerType: "touch" };
    const event = createEvent[type](target, init);
    if (timeStamp !== undefined)
      Object.defineProperty(event, "timeStamp", { value: timeStamp });
    fireEvent(target, event);
  };
  const content = (surface: HTMLElement) =>
    (
      surface.querySelector(
        '[data-testid="hall-pan-zoom-content"]',
      ) as HTMLElement
    ).style.transform;

  it("swipes to the next and previous hall at 1×", async () => {
    const surface = await viewer("Hidden");
    touch("pointerDown", surface, 1, 300, 100);
    touch("pointerMove", surface, 1, 200, 110);
    touch("pointerUp", surface, 1, 200, 110);
    const last = await screen.findByRole("dialog", { name: "Last" });
    const lastSurface = within(last).getByRole("group", {
      name: "Hall drawing",
    });
    touch("pointerDown", lastSurface, 1, 100, 100);
    touch("pointerMove", lastSurface, 1, 250, 100);
    touch("pointerUp", lastSurface, 1, 250, 100);
    expect(await screen.findByRole("dialog", { name: "Hidden" })).toBeTruthy();
  });

  it("does not swipe past the last hall, nor on a cancelled move", async () => {
    const surface = await viewer("Last");
    touch("pointerDown", surface, 1, 300, 100);
    touch("pointerMove", surface, 1, 100, 100);
    touch("pointerUp", surface, 1, 100, 100);
    touch("pointerDown", surface, 1, 100, 100);
    touch("pointerMove", surface, 1, 300, 100);
    touch("pointerCancel", surface, 1, 300, 100);
    expect(screen.getByRole("dialog", { name: "Last" })).toBeTruthy();
  });

  it("pinches to zoom, pans with a drag when zoomed, and resets on a double tap", async () => {
    const surface = await viewer();
    touch("pointerDown", surface, 1, 150, 150);
    touch("pointerDown", surface, 2, 250, 150);
    touch("pointerMove", surface, 1, 100, 150);
    touch("pointerMove", surface, 2, 300, 150);
    expect(surface.dataset.scale).toBe("2");
    expect(content(surface)).toBe("translate(-200px, -150px) scale(2)");
    // One finger lifts; the other drags on, and no swipe follows.
    touch("pointerUp", surface, 2, 300, 150);
    touch("pointerMove", surface, 1, 150, 150);
    touch("pointerUp", surface, 1, 150, 150);
    expect(content(surface)).toBe("translate(-150px, -150px) scale(2)");
    expect(screen.getByRole("dialog", { name: "Before" })).toBeTruthy();

    // Zoomed, a sideways drag pans rather than swipes.
    touch("pointerDown", surface, 3, 300, 100);
    touch("pointerMove", surface, 3, 200, 100);
    touch("pointerUp", surface, 3, 200, 100);
    expect(content(surface)).toBe("translate(-250px, -150px) scale(2)");
    expect(screen.getByRole("dialog", { name: "Before" })).toBeTruthy();

    touch("pointerDown", surface, 4, 100, 100, 1000);
    touch("pointerUp", surface, 4, 100, 100, 1000);
    expect(surface.dataset.scale).toBe("2");
    touch("pointerDown", surface, 5, 102, 101, 1200);
    touch("pointerUp", surface, 5, 102, 101, 1200);
    expect(surface.dataset.scale).toBe("1");
    expect(content(surface)).toBe("translate(0px, 0px) scale(1)");
  });

  it("refits when the surface is resized", async () => {
    let resized: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const surface = await viewer();
    fireEvent.keyDown(surface, { key: "+" });
    fireEvent.keyDown(surface, { key: "+" });
    expect(content(surface)).toBe("translate(-250px, -187.5px) scale(2.25)");
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
    } as DOMRect);
    act(() => resized());
    // The drawing (now 136×68 at 32, 16) still covers the smaller surface.
    expect(content(surface)).toBe("translate(-178px, -89px) scale(2.25)");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(disconnect).toHaveBeenCalled());
  });

  it("leaves taps on its buttons to the buttons", async () => {
    const surface = await viewer();
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    touch("pointerDown", zoomIn, 1, 300, 100);
    touch("pointerUp", zoomIn, 1, 300, 100);
    fireEvent.click(zoomIn);
    touch("pointerDown", surface, 2, 300, 100);
    touch("pointerUp", surface, 2, 300, 100);
    expect(surface.dataset.scale).toBe("1.5");
  });

  it("zooms with Ctrl+wheel only, about the pointer, and announces when it settles", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const surface = await viewer();
      fireEvent.wheel(surface, { deltaY: -100 });
      expect(surface.dataset.scale).toBe("1");
      const wheel = (deltaY: number, deltaMode = 0) => {
        const event = new WheelEvent("wheel", {
          deltaY,
          deltaMode,
          clientX: 100,
          clientY: 150,
          ctrlKey: true,
          cancelable: true,
        });
        act(() => {
          surface.dispatchEvent(event);
        });
        return event;
      };
      expect(wheel(-100).defaultPrevented).toBe(true);
      const scale = Number(surface.dataset.scale);
      expect(scale).toBeCloseTo(Math.exp(1 / 3));
      // The point under the pointer stays there.
      const [x, y] = (content(surface).match(/-?[\d.]+/g) ?? []).map(Number);
      expect(100 - x).toBeCloseTo(100 * scale);
      expect(150 - y).toBeCloseTo(150 * scale);
      // Announced once the wheel rests, not on every event.
      expect(screen.getByText("Zoom 100%")).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(screen.getByText(`Zoom ${Math.round(scale * 100)}%`)).toBeTruthy();
      // A wheel counting in lines or pages zooms one step at most.
      wheel(-10, 1);
      expect(Number(surface.dataset.scale)).toBeCloseTo(scale * 1.5);
      wheel(1, 2);
      expect(Number(surface.dataset.scale)).toBeCloseTo(scale);
    } finally {
      vi.useRealTimers();
    }
  });

  it("pans with the arrow keys when zoomed", async () => {
    const surface = await viewer();
    fireEvent.keyDown(surface, { key: "+" });
    expect(content(surface)).toBe("translate(-100px, -75px) scale(1.5)");
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    expect(content(surface)).toBe("translate(-148px, -75px) scale(1.5)");
    fireEvent.keyDown(surface, { key: "ArrowLeft" });
    fireEvent.keyDown(surface, { key: "ArrowLeft" });
    expect(content(surface)).toBe("translate(-52px, -75px) scale(1.5)");
    // Vertically the drawing is smaller than the surface: it stays centred.
    fireEvent.keyDown(surface, { key: "ArrowDown" });
    fireEvent.keyDown(surface, { key: "ArrowUp" });
    expect(content(surface)).toBe("translate(-52px, -75px) scale(1.5)");
    expect(screen.getByRole("dialog", { name: "Before" })).toBeTruthy();
  });

  it("cannot pan the drawing out of view", async () => {
    const surface = await viewer();
    for (let i = 0; i < 5; i++) fireEvent.keyDown(surface, { key: "+" });
    expect(surface.dataset.scale).toBe("6");
    touch("pointerDown", surface, 1, 200, 150);
    touch("pointerMove", surface, 1, 2000, 2000);
    touch("pointerUp", surface, 1, 2000, 2000);
    // The drawing's top-left corner (16, 58) reaches the surface's, no further.
    expect(content(surface)).toBe("translate(-96px, -348px) scale(6)");
    touch("pointerDown", surface, 2, 200, 150);
    touch("pointerMove", surface, 2, -3000, -3000);
    touch("pointerUp", surface, 2, -3000, -3000);
    // Its bottom-right corner (384, 242) meets the surface's (400, 300).
    expect(content(surface)).toBe("translate(-1904px, -1152px) scale(6)");
  });

  it("goes on from a pinch's latest view when a third finger lands, and ends on a cancel", async () => {
    const surface = await viewer();
    touch("pointerDown", surface, 1, 150, 150);
    touch("pointerDown", surface, 2, 250, 150);
    touch("pointerMove", surface, 1, 100, 150);
    touch("pointerMove", surface, 2, 300, 150);
    // A third finger starts a new phase from the view just computed.
    touch("pointerDown", surface, 3, 200, 200);
    touch("pointerMove", surface, 3, 210, 200);
    expect(surface.dataset.scale).toBe("2");
    touch("pointerMove", surface, 1, 50, 150);
    touch("pointerMove", surface, 2, 350, 150);
    expect(surface.dataset.scale).toBe("3");
    touch("pointerCancel", surface, 1, 50, 150);
    touch("pointerCancel", surface, 2, 350, 150);
    touch("pointerCancel", surface, 3, 210, 200);
    expect(surface.dataset.scale).toBe("3");
    expect(screen.getByText("Zoom 300%")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Before" })).toBeTruthy();
  });

  it("ignores a mouse's other buttons and pointers it did not see begin", async () => {
    const surface = await viewer();
    fireEvent(
      surface,
      createEvent.pointerDown(surface, {
        pointerId: 1,
        pointerType: "mouse",
        button: 2,
        clientX: 300,
        clientY: 100,
      }),
    );
    touch("pointerMove", surface, 1, 100, 100);
    touch("pointerUp", surface, 1, 100, 100);
    expect(screen.getByRole("dialog", { name: "Before" })).toBeTruthy();
  });
});

describe("the Table of Contents", () => {
  it("lists each hall under its title and goes to it", () => {
    render(<DocView doc={threeHalls()} searchParams={null} />);
    openSpeedDial();
    fireEvent.click(action("Table of Contents") as HTMLElement);
    const items = screen
      .getAllByRole("menuitem")
      .filter((item) => item.closest("#toc"))
      .map((item) => item.textContent);
    expect(items).toEqual([
      "Opening",
      "Before",
      "Advancement",
      "Hidden",
      "Closing",
      "Last",
    ]);
    const details = document
      .getElementById("hall-2")
      ?.closest("details") as HTMLDetailsElement;
    fireEvent.click(screen.getByRole("menuitem", { name: "Hidden" }));
    expect(location.hash).toBe("#hall-2");
    expect(details.open).toBe(true);
  });

  it("still jumps to titles", () => {
    render(<DocView doc={threeHalls()} searchParams={null} />);
    openSpeedDial();
    fireEvent.click(action("Table of Contents") as HTMLElement);
    fireEvent.click(screen.getByRole("menuitem", { name: "Advancement" }));
    expect(location.hash).toBe("#Advancement");
  });
});
