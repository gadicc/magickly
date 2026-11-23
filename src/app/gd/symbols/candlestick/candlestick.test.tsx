// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { copiedImageLink } from "../../../../../tests/exportControls";
import Candlestick from "./candlestick";

afterEach(cleanup);

/** The church names the drawing writes, which only the 1909 figure has. */
const churches = (container: HTMLElement) =>
  [...container.querySelectorAll("svg text")]
    .map((text) => text.textContent)
    .filter((text) => /^[A-Z][a-z]+$/.test(text ?? ""));

describe("/gd/symbols/candlestick's versions", () => {
  it("draws the 1909 figure by default, with its note", async () => {
    const { container } = render(<Candlestick />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Version" }));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Equinox 1909 (default)", "Modern"]);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(churches(container)).toContain("Philadelphia");
    expect(screen.getByRole("heading", { name: "Equinox 1909" })).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /The Equinox, vol\. I no\. 2/ })
        .getAttribute("href"),
    ).toBe(
      "https://archive.org/details/crowley-equinox_202110/The%20Equinox%20Vol.%201%2C%20No.%202/page/n266",
    );
    expect(await copiedImageLink()).not.toContain("version=");
  });

  it("draws the modern arrangement when chosen, and links its image", async () => {
    const { container } = render(<Candlestick />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Version" }));
    fireEvent.click(screen.getByRole("option", { name: "Modern" }));
    expect(churches(container)).toEqual([]);
    expect(screen.getByRole("heading", { name: "Modern" })).toBeTruthy();
    // The modern order's source is cited by name, with no link.
    expect(screen.getByText(/Llewellyn, 2015 edition/).closest("a")).toBe(null);
    expect(await copiedImageLink()).toContain("version=modern");
  });
});
