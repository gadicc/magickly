// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { TabletHighlights } from "magick-components/enochian/Tablet";
import { afterEach, describe, expect, it, vi } from "vitest";
import Tablets from "./tablets";
import type { Tablet3DProps } from "./three/Tablet3D";

// The 3D view itself stands in as a stub that keeps its latest props.
const view = vi.hoisted(() => ({ props: null as Tablet3DProps | null }));
vi.mock("./Tablet3DLoader", async (original) => ({
  ...(await original<typeof import("./Tablet3DLoader")>()),
  default: (props: Tablet3DProps) => {
    view.props = props;
    return <div data-testid="view3d" />;
  },
}));

const PAGE = "/enochian/tablets";
const at = (query: string) => {
  window.history.replaceState(null, "", `${PAGE}${query}`);
  return render(<Tablets />);
};
const toggle = (name: string) =>
  screen.queryByRole("switch", { name }) as HTMLInputElement | null;
const search = () => new URLSearchParams(window.location.search);
const LINE =
  "The 3D view has no reading-order numbers, regions or sigil. Turn 3D off to export the drawing.";
const NO_WEBGL =
  "This browser cannot show the 3D view, so the tablet is drawn flat.";

afterEach(() => {
  cleanup();
  view.props = null;
  window.history.replaceState(null, "", PAGE);
});

describe("the tablets page's In 3D switch (plan 101, stage 4)", () => {
  it("shows only with pyramids, straight after them", () => {
    at("?tablet=fire");
    expect(toggle("In 3D")).toBeNull();
    cleanup();
    at("?tablet=fire&pyramids=1");
    const switches = screen
      .getAllByRole("switch")
      .map((each) => each.closest("label")?.textContent);
    expect(switches.indexOf("In 3D")).toBe(
      switches.indexOf("Draw as pyramids") + 1,
    );
  });

  it("writes 3d=1 and puts the 3D view in the drawing's place", () => {
    const { container } = at("?tablet=fire&pyramids=1");
    expect(container.querySelector("[data-pyramid]")).not.toBeNull();
    fireEvent.click(toggle("In 3D") as HTMLInputElement);
    expect(search().get("3d")).toBe("1");
    expect(screen.getByTestId("view3d")).toBeTruthy();
    expect(container.querySelector("[data-pyramid]")).toBeNull();
    expect(screen.getByText(LINE)).toBeTruthy();
    fireEvent.click(toggle("In 3D") as HTMLInputElement);
    expect(search().has("3d")).toBe(false);
    expect(screen.queryByTestId("view3d")).toBeNull();
  });

  it("drops 3d with the pyramids and restores it with them", () => {
    at("?tablet=fire&pyramids=1&3d=1");
    fireEvent.click(toggle("Draw as pyramids") as HTMLInputElement);
    expect(search().has("3d")).toBe(false);
    expect(toggle("In 3D")).toBeNull();
    fireEvent.click(toggle("Draw as pyramids") as HTMLInputElement);
    expect(search().get("3d")).toBe("1");
    expect(screen.getByTestId("view3d")).toBeTruthy();
  });

  it("rests what the 3D view cannot draw, and hides the export box", () => {
    at("?tablet=fire&pyramids=1&symbols=1&3d=1");
    expect(toggle("Symbols on the sides")?.disabled).toBe(true);
    expect(toggle("Stand the symbols upright")?.disabled).toBe(true);
    expect(toggle("Second letters")?.disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "enochian" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(toggle("Reversed letters")?.disabled).toBe(false);
    expect(screen.queryAllByRole("button", { name: /^Save/ })).toHaveLength(0);
    // Reversed letters stay live, through the view's mirroring.
    expect(view.props?.mirrorReversed).toBe(true);
    fireEvent.click(toggle("Reversed letters") as HTMLInputElement);
    expect(view.props?.mirrorReversed).toBe(false);
  });

  it("gives the view the drawing's highlights, gated as on the flat drawing", () => {
    at("?tablet=fire&pyramids=1&3d=1");
    // Names: any square chooses.
    expect(view.props?.highlights?.anySquare).toBe(true);
    // Differences: only the outlined squares.
    fireEvent.click(screen.getByRole("tab", { name: "Differences" }));
    const differences = view.props?.highlights as TabletHighlights;
    expect(differences.anySquare).toBeFalsy();
    expect(differences.squares.length).toBeGreaterThan(0);
    // A click the view passes on selects the square, as on the flat one.
    const [square] = differences.squares;
    act(() => differences.onSelect?.(square));
    expect(view.props?.highlights?.selected).toEqual(square);
  });

  it("turns itself off where the view cannot be shown, until tried again", () => {
    at("?tablet=fire&pyramids=1&3d=1");
    act(() => view.props?.unavailable("webgl"));
    expect(toggle("In 3D")?.checked).toBe(false);
    expect(search().has("3d")).toBe(false);
    expect(screen.getByText(NO_WEBGL)).toBeTruthy();
    expect(screen.queryByTestId("view3d")).toBeNull();
    fireEvent.click(toggle("In 3D") as HTMLInputElement);
    expect(screen.queryByText(NO_WEBGL)).toBeNull();
    expect(screen.getByTestId("view3d")).toBeTruthy();
  });
});
