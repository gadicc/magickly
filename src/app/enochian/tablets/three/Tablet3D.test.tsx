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
import enochianTablets, { tabletVersion } from "magick-data/enochian/tablets";
import { type PerspectiveCamera, type Scene, Vector3 } from "three";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { PYRAMID_HEIGHT } from "./pyramidGeometry";
import Tablet3D from "./Tablet3D";

// A viewer without a GPU where a test asks for one; jsdom has no WebGL, so
// the real one fails as a browser without it does.
const stub = vi.hoisted(() => ({
  on: false,
  made: 0,
  rasters: 0,
  scene: null as Scene | null,
  camera: null as PerspectiveCamera | null,
  canvas: null as HTMLCanvasElement | null,
  // When the mark sheet comes: at once, unless a test holds it back.
  sheet: Promise.resolve() as Promise<unknown>,
  // A renderer made, whose use then throws.
  brokenAfterContext: false,
  invalidate: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("@/three/viewer", async (original) => {
  const viewer = await original<typeof import("@/three/viewer")>();
  return {
    ...viewer,
    createViewer: (
      box: HTMLElement,
      options: Parameters<typeof viewer.createViewer>[1],
    ) => {
      if (!stub.on) return viewer.createViewer(box, options);
      stub.made += 1;
      stub.scene = options.scene;
      stub.camera = options.camera;
      const canvas = document.createElement("canvas");
      // jsdom lays nothing out: the canvas fills its box.
      canvas.getBoundingClientRect = () =>
        (canvas.parentElement as HTMLElement).getBoundingClientRect();
      box.append(canvas);
      stub.canvas = canvas;
      return {
        renderer: {
          domElement: canvas,
          capabilities: {
            getMaxAnisotropy: () => {
              if (stub.brokenAfterContext) throw new Error("lost already");
              return 16;
            },
          },
        },
        frames: 0,
        invalidate: stub.invalidate,
        dispose: stub.dispose,
        moveTo: (into: HTMLElement) => into.append(canvas),
      };
    },
  };
});
vi.mock("./tabletObject", async (original) => ({
  ...(await original<typeof import("./tabletObject")>()),
  rasteriseSheet: async () => {
    stub.rasters += 1;
    await stub.sheet;
    return document.createElement("canvas");
  },
}));

const view = (tablet: "fire" | "earth" | "union") => {
  const each = tabletVersion(enochianTablets[tablet], "gd");
  if (!each) throw new Error(`no ${tablet} tablet`);
  return each;
};

/** A point in the scene where it lands in a 200 px box, as a client point. */
const onScreen = (point: Vector3) => {
  const at = point.project(stub.camera as PerspectiveCamera);
  return { x: ((at.x + 1) / 2) * 200, y: ((1 - at.y) / 2) * 200 };
};

/** A mouse's press, release and click at a client point in the box. */
function clickAt(box: HTMLElement, { x, y }: { x: number; y: number }) {
  const canvas = box.querySelector("canvas") as HTMLCanvasElement;
  const at = { pointerType: "mouse", pointerId: 1, button: 0, bubbles: true };
  fireEvent(
    canvas,
    new PointerEvent("pointerdown", { ...at, clientX: x, clientY: y }),
  );
  fireEvent(
    canvas,
    new PointerEvent("pointerup", { ...at, clientX: x, clientY: y }),
  );
  fireEvent(
    canvas,
    new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }),
  );
}

afterEach(() => {
  cleanup();
  stub.on = false;
  stub.made = 0;
  stub.rasters = 0;
  stub.sheet = Promise.resolve();
  stub.brokenAfterContext = false;
  stub.invalidate.mockClear();
  stub.dispose.mockClear();
  vi.restoreAllMocks();
});

describe("the 3D view (plan 101)", () => {
  it("says it cannot be shown where WebGL cannot be made", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const unavailable = vi.fn();
    render(
      <Tablet3D
        view={view("fire")}
        mirrorReversed
        label="The Fire tablet as pyramids, in 3D"
        unavailable={unavailable}
      />,
    );
    expect(unavailable).toHaveBeenCalledWith("webgl");
  });

  it("lets go of a renderer it made when setting it up fails", () => {
    stub.on = true;
    stub.brokenAfterContext = true;
    const unavailable = vi.fn();
    render(
      <Tablet3D
        view={view("fire")}
        mirrorReversed
        label="The Fire tablet as pyramids, in 3D"
        unavailable={unavailable}
      />,
    );
    expect(stub.dispose).toHaveBeenCalledTimes(1);
    expect(unavailable).toHaveBeenCalledWith("webgl");
  });

  it("draws flat, rather than loading for ever, when building the tablet fails", async () => {
    stub.on = true;
    const fire = view("fire");
    // A letter the sheet has no cell for: the model throws.
    const broken = {
      ...fire,
      grid: fire.grid.map((row, at) =>
        at === 0 ? ["Q", ...row.slice(1)] : row,
      ),
    };
    const unavailable = vi.fn();
    render(
      <Tablet3D
        view={broken}
        mirrorReversed
        label="The Fire tablet as pyramids, in 3D"
        unavailable={unavailable}
      />,
    );
    await waitFor(() => expect(unavailable).toHaveBeenCalledWith("load"));
  });

  it("chooses the square a click lands on, as the highlights allow, and tints it", async () => {
    stub.on = true;
    const onSelect = vi.fn();
    const props = {
      view: view("fire"),
      mirrorReversed: true,
      label: "The Fire tablet as pyramids, in 3D",
      unavailable: vi.fn(),
    };
    const { rerender } = render(
      <Tablet3D {...props} highlights={{ squares: [], onSelect }} />,
    );
    await waitFor(() =>
      expect(screen.queryByText("Loading the 3D view…")).toBeNull(),
    );
    const box = screen.getByRole("group");
    box.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
    // Straight above the middle of a square's top.
    const over = ({ row, column }: { row: number; column: number }) =>
      onScreen(new Vector3(column + 0.5 - 6, PYRAMID_HEIGHT, row + 0.5 - 6.5));
    // The Differences tab's way: an unoutlined square is not chosen.
    clickAt(box, over({ row: 6, column: 6 }));
    expect(onSelect).not.toHaveBeenCalled();
    // The Names tab's: any square is, the one under the click, near each
    // corner too, so that a flipped axis would choose the wrong one.
    rerender(
      <Tablet3D
        {...props}
        highlights={{ squares: [], anySquare: true, onSelect }}
      />,
    );
    for (const square of [
      { row: 6, column: 6 },
      { row: 0, column: 0 },
      { row: 0, column: 11 },
      { row: 12, column: 0 },
      { row: 12, column: 11 },
    ]) {
      clickAt(box, over(square));
      expect(onSelect).toHaveBeenLastCalledWith(square);
    }
    const square = { row: 6, column: 6 };
    // Its highlight is a change, and draws; the same again does not.
    stub.invalidate.mockClear();
    rerender(
      <Tablet3D
        {...props}
        highlights={{ squares: [square], selected: square, onSelect }}
      />,
    );
    expect(stub.invalidate).toHaveBeenCalledTimes(1);
    rerender(
      <Tablet3D
        {...props}
        highlights={{ squares: [square], selected: square, onSelect }}
      />,
    );
    expect(stub.invalidate).toHaveBeenCalledTimes(1);
  });

  it("chooses on the Tablet of Union, its 5 by 4 squares", async () => {
    stub.on = true;
    const onSelect = vi.fn();
    render(
      <Tablet3D
        view={view("union")}
        mirrorReversed
        label="The Tablet of Union as pyramids, in 3D"
        unavailable={vi.fn()}
        highlights={{ squares: [], anySquare: true, onSelect }}
      />,
    );
    await waitFor(() =>
      expect(screen.queryByText("Loading the 3D view…")).toBeNull(),
    );
    const box = screen.getByRole("group");
    box.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
    for (const square of [
      { row: 0, column: 4 },
      { row: 3, column: 0 },
    ]) {
      clickAt(
        box,
        onScreen(
          new Vector3(
            square.column + 0.5 - 2.5,
            PYRAMID_HEIGHT,
            square.row + 0.5 - 2,
          ),
        ),
      );
      expect(onSelect).toHaveBeenLastCalledWith(square);
    }
  });

  it("draws the tablet in one renderer, a focusable view with a name", async () => {
    stub.on = true;
    const props = {
      mirrorReversed: true,
      label: "The Fire tablet as pyramids, in 3D",
      unavailable: vi.fn(),
    };
    const { rerender, unmount } = render(
      <Tablet3D view={view("fire")} {...props} />,
    );
    const box = screen.getByRole("group", { name: props.label });
    expect(box.getAttribute("aria-roledescription")).toBe("3D view");
    expect(box.tabIndex).toBe(0);
    expect(box.querySelector("canvas")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(screen.getByText("Loading the 3D view…")).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText("Loading the 3D view…")).toBeNull(),
    );
    expect(stub.invalidate).toHaveBeenCalled();
    const [first] = stub.scene?.children ?? [];
    expect(first).toBeDefined();
    // The reader turns it; another tablet is drawn in the same renderer,
    // from the same sheet, turned as it was.
    const canvas = box.querySelector("canvas") as HTMLCanvasElement;
    box.getBoundingClientRect = () => ({ width: 200, height: 100 }) as DOMRect;
    const press = { pointerType: "mouse", pointerId: 1, button: 0, buttons: 1 };
    fireEvent(
      canvas,
      new PointerEvent("pointerdown", {
        ...press,
        bubbles: true,
        clientX: 10,
        clientY: 10,
      }),
    );
    fireEvent(
      canvas,
      new PointerEvent("pointermove", {
        ...press,
        bubbles: true,
        clientX: 60,
        clientY: 10,
      }),
    );
    fireEvent(
      canvas,
      new PointerEvent("pointerup", {
        ...press,
        bubbles: true,
        clientX: 60,
        clientY: 10,
      }),
    );
    const turned = stub.camera?.position.clone();
    expect(turned?.x).not.toBeCloseTo(0);
    await act(async () => {
      rerender(<Tablet3D view={view("earth")} {...props} />);
    });
    await waitFor(() => expect(stub.scene?.children[0]).not.toBe(first));
    expect(stub.scene?.children).toHaveLength(1);
    expect(stub.made).toBe(1);
    expect(stub.rasters).toBe(1);
    expect(stub.camera?.position.x).toBeCloseTo(turned?.x ?? 0);
    expect(props.unavailable).not.toHaveBeenCalled();
    unmount();
    expect(stub.dispose).toHaveBeenCalled();
    expect(stub.scene?.children).toHaveLength(0);
  });

  describe("the full window", () => {
    const props = {
      mirrorReversed: true,
      label: "The Fire tablet as pyramids, in 3D",
      unavailable: vi.fn(),
    };
    const drawn = async () => {
      render(<Tablet3D view={view("fire")} {...props} />);
      await waitFor(() =>
        expect(screen.queryByText("Loading the 3D view…")).toBeNull(),
      );
    };
    const dialog = () => screen.queryByRole("dialog", { name: props.label });
    /** The history entry a Back or a Forward lands on. */
    const land = (state: object) =>
      act(() => {
        window.history.replaceState(state, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
    /** A touch, on the canvas, from one point to another. */
    const touch = (
      canvas: HTMLCanvasElement,
      from: [number, number],
      to: [number, number],
    ) => {
      const at = {
        pointerType: "touch",
        pointerId: 7,
        button: 0,
        bubbles: true,
      };
      fireEvent(
        canvas,
        new PointerEvent("pointerdown", {
          ...at,
          clientX: from[0],
          clientY: from[1],
        }),
      );
      fireEvent(
        canvas,
        new PointerEvent("pointermove", {
          ...at,
          clientX: to[0],
          clientY: to[1],
        }),
      );
      fireEvent(
        canvas,
        new PointerEvent("pointerup", {
          ...at,
          clientX: to[0],
          clientY: to[1],
        }),
      );
      fireEvent(
        canvas,
        new MouseEvent("click", {
          bubbles: true,
          clientX: to[0],
          clientY: to[1],
        }),
      );
    };
    afterEach(() => window.history.replaceState(null, "", "/"));

    it("opens with a history entry, takes the canvas, and goes back to close", async () => {
      stub.on = true;
      window.history.replaceState({ tabletsTab: "squares" }, "", "/");
      await drawn();
      const canvas = stub.canvas;
      const button = screen.getByRole("button", { name: "Full screen" });
      button.focus();
      const push = vi.spyOn(window.history, "pushState");
      fireEvent.click(button);
      // Its entry keeps the page's own state.
      expect(push).toHaveBeenCalledTimes(1);
      expect(window.history.state).toMatchObject({
        tabletsTab: "squares",
        tablet3dFull: true,
      });
      const window3d = dialog() as HTMLElement;
      expect(window3d).not.toBeNull();
      // The same canvas, moved: one renderer, one context.
      expect(window3d.querySelectorAll("canvas")).toHaveLength(1);
      expect(window3d.querySelector("canvas")).toBe(canvas);
      expect(stub.made).toBe(1);
      // Focus is on the view itself, so its keys work at once.
      expect(document.activeElement).toBe(
        within(window3d).getByRole("group", { name: props.label }),
      );
      // Its touch turns the tablet there, and the page does not scroll.
      expect((canvas as HTMLCanvasElement).style.touchAction).toBe("none");
      // Close goes back; Back closes it, and the canvas returns.
      const back = vi.spyOn(window.history, "back").mockImplementation(() => {
        window.history.replaceState({ tabletsTab: "squares" }, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      fireEvent.click(within(window3d).getByRole("button", { name: "Close" }));
      expect(back).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(dialog()).toBeNull());
      const inline = screen.getByRole("group", { name: props.label });
      expect(canvas?.parentElement).toBe(inline);
      expect(canvas?.style.touchAction).toBe("pan-y pinch-zoom");
      expect(document.activeElement).toBe(button);
      expect(stub.made).toBe(1);
    });

    it("goes back on Esc, and opens again on Forward", async () => {
      stub.on = true;
      await drawn();
      fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
      const back = vi
        .spyOn(window.history, "back")
        .mockImplementation(() => {});
      fireEvent.keyDown(dialog() as HTMLElement, { key: "Escape" });
      expect(back).toHaveBeenCalledTimes(1);
      land({});
      await waitFor(() => expect(dialog()).toBeNull());
      // Focus is back on the button, as Safari would not leave it.
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Full screen" }),
      );
      // Forward: the canvas moves in again, and turns by touch there.
      land({ tablet3dFull: true });
      expect(dialog()?.querySelector("canvas")).toBe(stub.canvas);
      expect(stub.canvas?.style.touchAction).toBe("none");
    });

    it("goes back once, however often it is closed before Back lands", async () => {
      stub.on = true;
      await drawn();
      fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
      const back = vi
        .spyOn(window.history, "back")
        .mockImplementation(() => {});
      const closeButton = within(dialog() as HTMLElement).getByRole("button", {
        name: "Close",
      });
      fireEvent.click(closeButton);
      fireEvent.click(closeButton);
      fireEvent.keyDown(dialog() as HTMLElement, { key: "Escape" });
      expect(back).toHaveBeenCalledTimes(1);
      land({});
      await waitFor(() => expect(dialog()).toBeNull());
      // Opened again, it closes again.
      fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
      fireEvent.click(
        within(dialog() as HTMLElement).getByRole("button", { name: "Close" }),
      );
      expect(back).toHaveBeenCalledTimes(2);
    });

    it("turns by touch in a window opened before the sheet came, and picks nothing", async () => {
      stub.on = true;
      let release = () => {};
      stub.sheet = new Promise<void>((resolve) => {
        release = resolve;
      });
      const onSelect = vi.fn();
      render(
        <Tablet3D
          view={view("fire")}
          {...props}
          highlights={{ squares: [], anySquare: true, onSelect }}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
      const window3d = dialog() as HTMLElement;
      await act(async () => release());
      await waitFor(() =>
        expect(screen.queryByText("Loading the 3D view…")).toBeNull(),
      );
      const canvas = stub.canvas as HTMLCanvasElement;
      expect(canvas.parentElement?.closest("[role=dialog]")).toBe(window3d);
      expect(canvas.style.touchAction).toBe("none");
      (canvas.parentElement as HTMLElement).getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
      const camera = stub.camera as PerspectiveCamera;
      const from = camera.position.clone();
      touch(canvas, [50, 100], [150, 100]);
      expect(camera.position.distanceTo(from)).toBeGreaterThan(0.1);
      touch(canvas, [100, 100], [100, 100]);
      expect(onSelect).not.toHaveBeenCalled();
      expect(window.history.state).toMatchObject({ tablet3dFull: true });
    });

    it("lets go of an entry a reload left open", async () => {
      stub.on = true;
      window.history.replaceState(
        { tabletsTab: "names", tablet3dFull: true },
        "",
        "/",
      );
      await drawn();
      expect(dialog()).toBeNull();
      expect(window.history.state).toMatchObject({
        tabletsTab: "names",
        tablet3dFull: false,
      });
    });

    it("turns and zooms by key, one frame a key, leaving others alone", async () => {
      stub.on = true;
      await drawn();
      const view3d = screen.getByRole("group", { name: props.label });
      expect(
        document.getElementById(
          view3d.getAttribute("aria-describedby") as string,
        )?.textContent,
      ).toMatch(/arrow keys turn/);
      const camera = stub.camera as PerspectiveCamera;
      const from = camera.position.clone();
      for (const key of ["ArrowLeft", "ArrowUp", "+", "=", "-", "0"]) {
        stub.invalidate.mockClear();
        const event = fireEvent.keyDown(view3d, { key });
        expect(event).toBe(false);
        expect(stub.invalidate).toHaveBeenCalledTimes(1);
      }
      // 0 brought it home.
      expect(camera.position.distanceTo(from)).toBeLessThan(1e-9);
      stub.invalidate.mockClear();
      for (const init of [
        { key: "Tab" },
        { key: "ArrowLeft", ctrlKey: true },
        { key: "+", metaKey: true },
        { key: "0", altKey: true },
      ])
        expect(fireEvent.keyDown(view3d, init)).toBe(true);
      expect(stub.invalidate).not.toHaveBeenCalled();
    });

    describe("in the browser's full screen", () => {
      let screenElement: Element | null = null;
      // As a browser does: the change comes after the call returns.
      const exit = vi.fn(async () => {
        screenElement = null;
        queueMicrotask(() =>
          document.dispatchEvent(new Event("fullscreenchange")),
        );
      });
      /** The browser leaving the full screen by itself. */
      const leave = () =>
        act(async () => {
          screenElement = null;
          document.dispatchEvent(new Event("fullscreenchange"));
        });
      const request = vi.fn(async function (this: Element) {
        screenElement = this;
      });
      const offer = (enabled: boolean, fails = false) => {
        Object.defineProperty(document, "fullscreenEnabled", {
          configurable: true,
          get: () => enabled,
        });
        Object.defineProperty(document, "fullscreenElement", {
          configurable: true,
          get: () => screenElement,
        });
        document.exitFullscreen = exit;
        HTMLElement.prototype.requestFullscreen = fails
          ? vi.fn(() => Promise.reject(new Error("refused")))
          : request;
      };
      const opened = async () => {
        stub.on = true;
        await drawn();
        fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
        return vi.spyOn(window.history, "back").mockImplementation(() => {
          land({});
        });
      };
      afterEach(() => {
        screenElement = null;
        exit.mockClear();
        request.mockClear();
        offer(false);
      });
      afterAll(() => {
        for (const name of [
          "fullscreenEnabled",
          "fullscreenElement",
          "exitFullscreen",
        ])
          Reflect.deleteProperty(document, name);
        Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
      });
      /** Opened, with Back mocked to land nowhere until a test says so. */
      const held = async () => {
        offer(true);
        stub.on = true;
        await drawn();
        fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
        return vi.spyOn(window.history, "back").mockImplementation(() => {});
      };
      const closeButton = () =>
        within(dialog() as HTMLElement).getByRole("button", { name: "Close" });

      it("asks for it within the click itself", async () => {
        offer(true);
        stub.on = true;
        await drawn();
        fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
        expect(request).toHaveBeenCalledTimes(1);
      });

      for (const [first, by] of [
        ["Close", () => fireEvent.click(closeButton())],
        [
          "Esc",
          () => fireEvent.keyDown(dialog() as HTMLElement, { key: "Escape" }),
        ],
      ] as const)
        it(`goes back once when ${first} and the browser's leaving race`, async () => {
          const back = await held();
          by();
          await leave();
          land({});
          await waitFor(() => expect(dialog()).toBeNull());
          expect(back).toHaveBeenCalledTimes(1);
        });

      it("goes back once when the browser's leaving comes before Esc", async () => {
        const back = await held();
        await leave();
        fireEvent.keyDown(dialog() as HTMLElement, { key: "Escape" });
        land({});
        await waitFor(() => expect(dialog()).toBeNull());
        expect(back).toHaveBeenCalledTimes(1);
      });

      it("leaves it, and neutralises its entry, when the view goes", async () => {
        await held();
        cleanup();
        expect(exit).toHaveBeenCalledTimes(1);
        expect(window.history.state).toMatchObject({ tablet3dFull: false });
      });

      it("does not ask for it again when Forward reopens the window", async () => {
        offer(true);
        await opened();
        land({});
        await waitFor(() => expect(dialog()).toBeNull());
        request.mockClear();
        land({ tablet3dFull: true });
        expect(dialog()).not.toBeNull();
        expect(request).not.toHaveBeenCalled();
      });

      it("closes, and gives focus back, where it was refused", async () => {
        offer(true, true);
        const back = await opened();
        await act(async () => {});
        fireEvent.click(closeButton());
        await waitFor(() => expect(dialog()).toBeNull());
        expect(back).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: "Full screen" }),
        );
      });

      it("asks for it on the dialog in the same click", async () => {
        offer(true);
        await opened();
        expect(request).toHaveBeenCalledTimes(1);
        expect(screenElement).toBe(dialog());
      });

      it("closes the view, going back once, when the browser leaves it", async () => {
        offer(true);
        const back = await opened();
        await act(async () => {
          screenElement = null;
          document.dispatchEvent(new Event("fullscreenchange"));
        });
        expect(back).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(dialog()).toBeNull());
        expect(exit).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: "Full screen" }),
        );
      });

      it("leaves it on Close, going back once", async () => {
        offer(true);
        const back = await opened();
        fireEvent.click(
          within(dialog() as HTMLElement).getByRole("button", {
            name: "Close",
          }),
        );
        await waitFor(() => expect(dialog()).toBeNull());
        expect(exit).toHaveBeenCalledTimes(1);
        // Its change, the window gone, goes back no further.
        expect(back).toHaveBeenCalledTimes(1);
        // And focus is back on the button, once out of the full screen.
        await waitFor(() =>
          expect(document.activeElement).toBe(
            screen.getByRole("button", { name: "Full screen" }),
          ),
        );
      });

      it("leaves it when Back closes the view", async () => {
        offer(true);
        await opened();
        land({});
        await waitFor(() => expect(dialog()).toBeNull());
        expect(exit).toHaveBeenCalledTimes(1);
      });

      it("fills the window instead where it is not offered or is refused", async () => {
        offer(false);
        await opened();
        expect(request).not.toHaveBeenCalled();
        expect(dialog()).not.toBeNull();
        cleanup();
        offer(true, true);
        await opened();
        await act(async () => {});
        expect(dialog()).not.toBeNull();
        expect(screenElement).toBeNull();
      });
    });
  });
});
