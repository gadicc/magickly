// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FOCUS_MIN_SCALE } from "@/doc/hallPanZoom";
import { MIRRORED_PAGES } from "./mirroredPages";
import SourceDialog from "./SourceDialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * A window `width` wide: jsdom lays nothing out and has no media queries,
 * so the pan and zoom surface measures `width` by 700 (about what is left
 * of an 844 px phone under the bar and over the caption) and width queries
 * match `width`.
 */
function screenOf(width: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width,
    height: 700,
    right: width,
    bottom: 700,
    toJSON: () => ({}),
  } as DOMRect);
  vi.stubGlobal("matchMedia", (query: string) => {
    const max = /max-width:\s*([\d.]+)px/.exec(query);
    const min = /min-width:\s*([\d.]+)px/.exec(query);
    return {
      matches:
        (!max || width <= Number(max[1])) && (!min || width >= Number(min[1])),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  });
}

function open(page: keyof typeof MIRRORED_PAGES) {
  const mirrored = MIRRORED_PAGES[page];
  render(<SourceDialog page={mirrored} open onClose={() => {}} />);
  return screen.getByRole("group", {
    name: `${mirrored.label}, the printed page`,
  });
}

describe("SourceDialog's first view", () => {
  it("opens zoomed on the outline on a phone, and resets to the page", () => {
    screenOf(390);
    const surface = open("heydon13");
    // Zoomed from the first render, with no fitted frame before it.
    expect(surface.getAttribute("data-scale")).toBe(String(FOCUS_MIN_SCALE));
    expect(screen.queryByText("Pinch or Ctrl+scroll to zoom")).toBeNull();
    expect(screen.getByText("Zoom 300%")).toBeTruthy();
    const out = screen.getByRole("button", { name: "Zoom out" });
    expect(out.hasAttribute("disabled")).toBe(false);

    // It zooms out freely, and the reset shows the whole page.
    fireEvent.click(out);
    expect(Number(surface.getAttribute("data-scale"))).toBeCloseTo(2);
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(surface.getAttribute("data-scale")).toBe("1");
    expect(screen.getByText("Pinch or Ctrl+scroll to zoom")).toBeTruthy();
  });

  it("opens Agrippa's line zoomed on a phone too", () => {
    screenOf(390);
    expect(open("agrippa149").getAttribute("data-scale")).toBe(
      String(FOCUS_MIN_SCALE),
    );
  });

  it("fits the whole page on a wide screen", () => {
    screenOf(1280);
    const surface = open("heydon13");
    expect(surface.getAttribute("data-scale")).toBe("1");
    expect(screen.getByTestId("hall-pan-zoom-content").style.transform).toBe(
      "translate(0px, 0px) scale(1)",
    );
    expect(screen.getByText("Pinch or Ctrl+scroll to zoom")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Zoom out" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
