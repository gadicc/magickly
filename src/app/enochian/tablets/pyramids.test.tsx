// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  imageLinkNote,
  imageLinkOffered,
} from "../../../../tests/exportControls";
import Tablets, { downloadName } from "./tablets";

const PAGE = "/enochian/tablets";

beforeEach(() => window.history.replaceState(null, "", PAGE));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const choose = (combobox: string, name: RegExp | string) => {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: combobox }));
  fireEvent.click(screen.getByRole("option", { name }));
};
const pyramidsSwitch = () =>
  screen.queryByRole("switch", { name: "Draw as pyramids" });
/** The tablet's pyramids, not the Squares tab's large one. */
const squares = (container: HTMLElement) =>
  container.querySelectorAll("[data-pyramids] [data-pyramid]").length;

describe("/enochian/tablets drawn as pyramids (plan 095, decision 4)", () => {
  it("draws every square as a pyramid, with a key, and says so in the URL", async () => {
    const { container } = render(<Tablets />);
    expect(squares(container)).toBe(0);
    expect(imageLinkOffered()).toBe(true);
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    expect(squares(container)).toBe(156);
    expect(window.location.search).toBe("?pyramids=1");
    const key = screen.getByRole("list", { name: "The pyramids' colours" });
    expect(
      [...key.querySelectorAll("li")].map((item) => item.textContent),
    ).toEqual([
      "Fire",
      "Water",
      "Air",
      "Earth",
      "Spirit",
      "White, with no element: a Calvary square's lowest side, which carries its Sephirah",
    ]);
    // Until the image route has a slug of its own (decision 5).
    expect(imageLinkOffered()).toBe(false);
    expect(await imageLinkNote()).toBe(
      "No image link while the tablet is drawn as pyramids.",
    );
    choose("Tablet", "Tablet of Union");
    expect(squares(container)).toBe(20);
    // The params keep the order they were first written in.
    expect(window.location.search).toBe("?pyramids=1&tablet=union");
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    expect(squares(container)).toBe(0);
    expect(window.location.search).toBe("?tablet=union");
    expect(
      screen.queryByRole("list", { name: "The pyramids' colours" }),
    ).toBeNull();
  });

  it("rests the second letters while pyramids are drawn", () => {
    const { container } = render(<Tablets />);
    choose("Tablet", "Water");
    const second = screen.getByRole("switch", { name: "Second letters" });
    fireEvent.click(second);
    const corners = () => container.querySelectorAll("text[data-alt]").length;
    expect(corners()).toBeGreaterThan(10);
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    expect(corners()).toBe(0);
    expect((second as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByText(/^Second letters in/)).toBeNull();
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    expect(corners()).toBeGreaterThan(10);
    expect((second as HTMLInputElement).disabled).toBe(false);
  });

  it("is not offered in Dee's and Raphael's versions, and returns with the Golden Dawn's", () => {
    const { container } = render(<Tablets />);
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    choose("Version", "Dee's, 1584");
    expect(pyramidsSwitch()).toBeNull();
    expect(squares(container)).toBe(0);
    expect(window.location.search).toBe("?version=dee");
    choose("Version", "The Equinox's");
    expect(squares(container)).toBe(156);
    expect(window.location.search).toBe("?version=equinox&pyramids=1");
  });

  it("opens drawn as pyramids from a link, but not in Dee's version", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=fire&pyramids=1`);
    const first = render(<Tablets />);
    expect(squares(first.container)).toBe(156);
    expect((pyramidsSwitch() as HTMLInputElement).checked).toBe(true);
    cleanup();
    window.history.replaceState(null, "", `${PAGE}?version=dee&pyramids=1`);
    const second = render(<Tablets />);
    expect(squares(second.container)).toBe(0);
    expect(pyramidsSwitch()).toBeNull();
  });

  it("keeps the pyramids in a name's links to its squares", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=fire&pyramids=1`);
    render(<Tablets />);
    fireEvent.click(screen.getByRole("button", { name: /^Oip\b/ }));
    const links = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.includes("tab=squares"));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links)
      expect(link.getAttribute("href")).toMatch(/&pyramids=1$/);
  });

  it("keeps the pyramids in the address, which Share sends", () => {
    render(<Tablets />);
    choose("Tablet", "Air");
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    expect(window.location.href).toBe(
      `${window.location.origin}${PAGE}?tablet=air&pyramids=1`,
    );
  });

  it("names its downloads with -pyramids", () => {
    expect(
      downloadName("enochian-air-tablet", {
        alt: false,
        reversed: true,
        pyramids: true,
      }),
    ).toBe("enochian-air-tablet-pyramids");
    expect(
      downloadName("enochian-earth-tablet-regardie", {
        alt: false,
        reversed: false,
        pyramids: true,
        name: "king",
        regions: true,
      }),
    ).toBe("enochian-earth-tablet-regardie-pyramids-plain-king-regions");
  });
});
