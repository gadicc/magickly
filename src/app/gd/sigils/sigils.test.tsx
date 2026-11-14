// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sigils from "./sigils";

// The optimiser's WASM is not needed to draw the letter centres.
vi.mock("magick-components/gd/roseSigilOptimizer", () => ({
  optimizeSigilPoints: () => new Promise(() => {}),
}));

afterEach(cleanup);

/** Where the rose draws a letter, as "x,y". */
const labelAt = (container: HTMLElement, letter: string) => {
  const text = [...container.querySelectorAll("svg text")].find(
    (each) => each.textContent === letter,
  );
  return `${text?.getAttribute("x")},${text?.getAttribute("y")}`;
};

const choose = (name: RegExp | string) => {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Version" }));
  fireEvent.click(screen.getByRole("option", { name }));
};

describe("/gd/sigils' versions", () => {
  it("offers both roses, the Golden Dawn's by default, with its note", () => {
    render(<Sigils initial={{ text: "כתר", rose: true, version: "gd" }} />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Version" }));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Golden Dawn (Equinox 1910) (default)", "Regardie 1939"]);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(
      screen.getByRole("heading", { name: "Golden Dawn (Equinox 1910)" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /The Equinox, vol\. I no\. 3/ })
        .getAttribute("href"),
    ).toBe(
      "https://archive.org/details/crowley-equinox_202110/The%20Equinox%20Vol.%201%2C%20No.%203/page/n220",
    );
  });

  it("draws Regardie's rose, its note and links when chosen", () => {
    const { container } = render(
      <Sigils initial={{ text: "כתר", rose: true, version: "gd" }} />,
    );
    const kaph = labelAt(container, "כ");
    const tav = labelAt(container, "ת");
    choose("Regardie 1939");
    expect(labelAt(container, "כ")).toBe(tav);
    expect(labelAt(container, "ת")).toBe(kaph);
    expect(screen.getByRole("heading", { name: "Regardie 1939" })).toBeTruthy();
    const link = screen.getAllByRole("link", {
      name: "Open SVG image link",
    })[0];
    expect(link.getAttribute("href")).toContain("version=regardie1939");
    choose(/Golden Dawn/);
    expect(labelAt(container, "כ")).toBe(kaph);
    expect(
      screen
        .getAllByRole("link", { name: "Open SVG image link" })[0]
        .getAttribute("href"),
    ).not.toContain("version=");
  });

  it("opens in a shared link's version", () => {
    const { container } = render(
      <Sigils initial={{ text: "כתר", rose: true, version: "regardie1939" }} />,
    );
    expect(screen.getByRole("heading", { name: "Regardie 1939" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Version" }).textContent).toBe(
      "Regardie 1939",
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
