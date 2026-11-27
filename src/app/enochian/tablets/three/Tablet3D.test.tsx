// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import enochianTablets, { tabletVersion } from "magick-data/enochian/tablets";
import type { PerspectiveCamera, Scene } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import Tablet3D from "./Tablet3D";

// A viewer without a GPU where a test asks for one; jsdom has no WebGL, so
// the real one fails as a browser without it does.
const stub = vi.hoisted(() => ({
  on: false,
  made: 0,
  rasters: 0,
  scene: null as Scene | null,
  camera: null as PerspectiveCamera | null,
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
      box.append(canvas);
      return {
        renderer: {
          domElement: canvas,
          capabilities: { getMaxAnisotropy: () => 16 },
        },
        frames: 0,
        invalidate: stub.invalidate,
        dispose: stub.dispose,
      };
    },
  };
});
vi.mock("./tabletObject", async (original) => ({
  ...(await original<typeof import("./tabletObject")>()),
  rasteriseSheet: async () => {
    stub.rasters += 1;
    return document.createElement("canvas");
  },
}));

const view = (tablet: "fire" | "earth") => {
  const each = tabletVersion(enochianTablets[tablet], "gd");
  if (!each) throw new Error(`no ${tablet} tablet`);
  return each;
};

afterEach(() => {
  cleanup();
  stub.on = false;
  stub.made = 0;
  stub.rasters = 0;
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
    const canvas = box.querySelector("canvas") as HTMLCanvasElement;
    const click = () => {
      const at = {
        pointerType: "mouse",
        pointerId: 1,
        button: 0,
        bubbles: true,
      };
      fireEvent(
        canvas,
        new PointerEvent("pointerdown", { ...at, clientX: 100, clientY: 100 }),
      );
      fireEvent(
        canvas,
        new PointerEvent("pointerup", { ...at, clientX: 100, clientY: 100 }),
      );
    };
    // The Differences tab's way: an unoutlined square is not chosen.
    click();
    expect(onSelect).not.toHaveBeenCalled();
    // The Names tab's: any square is, the one under the middle of the view.
    rerender(
      <Tablet3D
        {...props}
        highlights={{ squares: [], anySquare: true, onSelect }}
      />,
    );
    click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    const [square] = onSelect.mock.calls[0];
    expect(Object.keys(square).sort()).toEqual(["column", "row"]);
    expect(Math.abs(square.row - 6.5)).toBeLessThan(1);
    expect(Math.abs(square.column - 5.5)).toBeLessThan(1);
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
    const press = { pointerType: "mouse", pointerId: 1, button: 0 };
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
});
