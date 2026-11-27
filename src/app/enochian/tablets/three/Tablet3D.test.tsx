// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import enochianTablets, { tabletVersion } from "magick-data/enochian/tablets";
import type { Scene } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import Tablet3D from "./Tablet3D";

// A viewer without a GPU where a test asks for one; jsdom has no WebGL, so
// the real one fails as a browser without it does.
const stub = vi.hoisted(() => ({
  on: false,
  made: 0,
  scene: null as Scene | null,
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
  rasteriseSheet: async () => document.createElement("canvas"),
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
    // Another tablet: drawn again in the same renderer.
    await act(async () => {
      rerender(<Tablet3D view={view("earth")} {...props} />);
    });
    await waitFor(() => expect(stub.scene?.children[0]).not.toBe(first));
    expect(stub.scene?.children).toHaveLength(1);
    expect(stub.made).toBe(1);
    expect(props.unavailable).not.toHaveBeenCalled();
    unmount();
    expect(stub.dispose).toHaveBeenCalled();
    expect(stub.scene?.children).toHaveLength(0);
  });
});
