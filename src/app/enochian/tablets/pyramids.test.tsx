// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { componentImageFilename } from "@/render/componentImageUrl";
import {
  copiedImageLink,
  imageLinkNote,
  imageLinkOffered,
} from "../../../../tests/exportControls";
import Tablets, { downloadName } from "./tablets";

// The downloads' file names, without saving anything.
const runtime = vi.hoisted(() => ({ downloadBlob: vi.fn() }));
vi.mock("@/export/exportRuntime", async (original) => ({
  ...(await original<typeof import("@/export/exportRuntime")>()),
  downloadBlob: runtime.downloadBlob,
}));

const PAGE = "/enochian/tablets";

beforeEach(() => {
  window.history.replaceState(null, "", PAGE);
  runtime.downloadBlob.mockClear();
});
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
/** The image links that Link copies, SVG and PNG. */
const imageHrefs = async () => [
  await copiedImageLink(0, "SVG"),
  await copiedImageLink(0, "PNG"),
];

/** The name the SVG download is saved as, once the button is free. */
const downloaded = async () => {
  const button = screen.getAllByRole("button", { name: "Save SVG" })[0];
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  const calls = runtime.downloadBlob.mock.calls.length;
  fireEvent.click(button);
  expect(runtime.downloadBlob).toHaveBeenCalledTimes(calls + 1);
  return runtime.downloadBlob.mock.lastCall?.[1];
};

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
    // The pyramids' own image (decision 5), the Golden Dawn's Earth.
    expect(await imageHrefs()).toEqual([
      "/api/render/enochian-tablet-pyramids",
      "/api/render/enochian-tablet-pyramids?fmt=png",
    ]);
    choose("Tablet", "Tablet of Union");
    expect(squares(container)).toBe(20);
    expect(await imageHrefs()).toEqual([
      "/api/render/enochian-tablet-pyramids?id=union",
      "/api/render/enochian-tablet-pyramids?fmt=png&id=union",
    ]);
    // The params keep the order they were first written in.
    expect(window.location.search).toBe("?pyramids=1&tablet=union");
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    expect(squares(container)).toBe(0);
    expect(window.location.search).toBe("?tablet=union");
    expect(
      screen.queryByRole("list", { name: "The pyramids' colours" }),
    ).toBeNull();
    // Flat again, the flat image.
    expect(await imageHrefs()).toEqual([
      "/api/render/enochian-tablet?id=union",
      "/api/render/enochian-tablet?fmt=png&id=union",
    ]);
  });

  it("links the pyramids' image in the tablet, version and font shown", async () => {
    render(<Tablets />);
    choose("Tablet", "Air");
    choose("Version", "The Equinox's");
    fireEvent.click(screen.getByRole("button", { name: "enochian" }));
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    expect(await imageHrefs()).toEqual([
      "/api/render/enochian-tablet-pyramids?id=air&font=enochian&version=equinox",
      "/api/render/enochian-tablet-pyramids?fmt=png&id=air&font=enochian&version=equinox",
    ]);
    // Withheld, as for the flat tablet, while the reversed letters are
    // plain.
    fireEvent.click(screen.getByRole("switch", { name: "Reversed letters" }));
    expect(imageLinkOffered()).toBe(false);
    expect(await imageLinkNote()).toBe(
      "No image link with second letters shown or reversed letters plain.",
    );
  });

  it("withholds the pyramids' image while a name or the regions are shown", async () => {
    const withheld =
      "No image link while a name, a square or the regions are shown.";
    window.history.replaceState(null, "", `${PAGE}?tablet=fire&pyramids=1`);
    const first = render(<Tablets />);
    expect(imageLinkOffered()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /^Oip\b/ }));
    expect(squares(first.container)).toBe(156);
    expect(imageLinkOffered()).toBe(false);
    expect(await imageLinkNote()).toBe(withheld);
    cleanup();
    window.history.replaceState(null, "", `${PAGE}?tablet=fire&pyramids=1`);
    const second = render(<Tablets />);
    fireEvent.click(screen.getByRole("switch", { name: "Show the regions" }));
    expect(squares(second.container)).toBe(156);
    expect(imageLinkOffered()).toBe(false);
    expect(await imageLinkNote()).toBe(withheld);
    fireEvent.click(screen.getByRole("switch", { name: "Show the regions" }));
    expect(await imageHrefs()).toEqual([
      "/api/render/enochian-tablet-pyramids?id=fire",
      "/api/render/enochian-tablet-pyramids?fmt=png&id=fire",
    ]);
  });

  it("names its download as the pyramids' image, -pyramids once", async () => {
    render(<Tablets />);
    choose("Tablet", "Air");
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    expect(await downloaded()).toBe("enochian-air-tablet-pyramids.svg");
  });

  it("links the flat image in Dee's version with the pyramids remembered", async () => {
    render(<Tablets />);
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    choose("Version", "Dee's, 1584");
    expect(window.location.search).toBe("?version=dee");
    expect(await imageHrefs()).toEqual([
      "/api/render/enochian-tablet?version=dee",
      "/api/render/enochian-tablet?fmt=png&version=dee",
    ]);
    expect(await downloaded()).toBe("enochian-earth-tablet-dee.svg");
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

  it("names its downloads with -pyramids, as the pyramids' image is named", () => {
    const air = componentImageFilename({
      slug: "enochian-tablet-pyramids",
      props: { id: "air", font: "latin", version: "gd", symbols: "none" },
    });
    expect(air).toBe("enochian-air-tablet-pyramids");
    expect(downloadName(air, { alt: false, reversed: true })).toBe(
      "enochian-air-tablet-pyramids",
    );
    // After the version and the glyphs, which the flat image's name has.
    const earth = componentImageFilename({
      slug: "enochian-tablet-pyramids",
      props: {
        id: "earth",
        font: "enochian",
        version: "regardie",
        symbols: "none",
      },
    });
    expect(earth).toBe("enochian-earth-tablet-regardie-glyphs-pyramids");
    expect(
      downloadName(earth, {
        alt: false,
        reversed: false,
        name: "king",
        regions: true,
      }),
    ).toBe("enochian-earth-tablet-regardie-glyphs-pyramids-plain-king-regions");
  });
});

describe("/enochian/tablets with the pyramids' symbols (plan 095, Symbols on the sides)", () => {
  const symbolsSwitch = () =>
    screen.queryByRole("switch", { name: "Symbols on the sides" });
  const uprightSwitch = () =>
    screen.queryByRole("switch", { name: "Stand the symbols upright" });
  /** The tablet's marks, and how many face out (turned). */
  const marks = (container: HTMLElement) => {
    const all = [
      ...container.querySelectorAll("[data-pyramids] [data-symbol]"),
    ];
    return {
      count: all.length,
      turned: all.filter((mark) =>
        mark.getAttribute("transform")?.includes("rotate("),
      ).length,
    };
  };
  /** The tablet's flat tops' width, a share of the 20-unit square. */
  const topWidth = (container: HTMLElement) =>
    container
      .querySelector("[data-pyramids] [data-top]")
      ?.getAttribute("width");

  it("draws each side's symbol facing out, or upright, and says so in the URL and the image", async () => {
    const { container } = render(<Tablets />);
    expect(symbolsSwitch()).toBeNull();
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    expect(marks(container).count).toBe(0);
    expect(uprightSwitch()).toBeNull();
    fireEvent.click(symbolsSwitch() as HTMLElement);
    expect(marks(container)).toEqual({ count: 624, turned: 624 });
    expect(topWidth(container)).toBe("6.667");
    expect(window.location.search).toBe("?pyramids=1&symbols=1");
    expect(await imageHrefs()).toEqual([
      "/api/render/enochian-tablet-pyramids?symbols=outward",
      "/api/render/enochian-tablet-pyramids?fmt=png&symbols=outward",
    ]);
    expect(await downloaded()).toBe(
      "enochian-earth-tablet-pyramids-symbols.svg",
    );
    fireEvent.click(uprightSwitch() as HTMLElement);
    expect(marks(container)).toEqual({ count: 624, turned: 0 });
    expect(window.location.search).toBe("?pyramids=1&symbols=1&upright=1");
    // Once the save has let the buttons go.
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("button", { name: "Copy SVG image link" })[0]
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(await imageHrefs()).toEqual([
      "/api/render/enochian-tablet-pyramids?symbols=upright",
      "/api/render/enochian-tablet-pyramids?fmt=png&symbols=upright",
    ]);
    expect(await downloaded()).toBe(
      "enochian-earth-tablet-pyramids-symbols-upright.svg",
    );
    // Off again: the half top, and no switch to stand them.
    fireEvent.click(symbolsSwitch() as HTMLElement);
    expect(marks(container).count).toBe(0);
    expect(topWidth(container)).toBe("10");
    expect(uprightSwitch()).toBeNull();
    expect(window.location.search).toBe("?pyramids=1");
  });

  it("remembers the symbols while the pyramids are off, and in Dee's version", () => {
    const { container } = render(<Tablets />);
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    fireEvent.click(symbolsSwitch() as HTMLElement);
    fireEvent.click(uprightSwitch() as HTMLElement);
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    expect(symbolsSwitch()).toBeNull();
    expect(uprightSwitch()).toBeNull();
    expect(window.location.search).toBe("");
    fireEvent.click(pyramidsSwitch() as HTMLElement);
    expect(marks(container)).toEqual({ count: 624, turned: 0 });
    expect(window.location.search).toBe("?pyramids=1&symbols=1&upright=1");
    choose("Version", "Dee's, 1584");
    expect(marks(container).count).toBe(0);
    expect(window.location.search).toBe("?version=dee");
    choose("Version", "The Equinox's");
    expect(marks(container)).toEqual({ count: 624, turned: 0 });
    expect(window.location.search).toBe(
      "?version=equinox&pyramids=1&symbols=1&upright=1",
    );
    expect((uprightSwitch() as HTMLInputElement).checked).toBe(true);
  });

  it("opens with the symbols from a link, only with the switches they hang on", () => {
    window.history.replaceState(
      null,
      "",
      `${PAGE}?tablet=union&pyramids=1&symbols=1&upright=1`,
    );
    const first = render(<Tablets />);
    expect(marks(first.container)).toEqual({ count: 80, turned: 0 });
    expect((symbolsSwitch() as HTMLInputElement).checked).toBe(true);
    expect((uprightSwitch() as HTMLInputElement).checked).toBe(true);
    cleanup();
    window.history.replaceState(null, "", `${PAGE}?symbols=1&upright=1`);
    const second = render(<Tablets />);
    expect(squares(second.container)).toBe(0);
    expect(symbolsSwitch()).toBeNull();
    cleanup();
    window.history.replaceState(null, "", `${PAGE}?pyramids=1&upright=1`);
    const third = render(<Tablets />);
    expect(marks(third.container).count).toBe(0);
    expect((symbolsSwitch() as HTMLInputElement).checked).toBe(false);
    expect(uprightSwitch()).toBeNull();
  });

  it("keeps the symbols in a name's links to its squares", () => {
    window.history.replaceState(
      null,
      "",
      `${PAGE}?tablet=fire&pyramids=1&symbols=1&upright=1`,
    );
    render(<Tablets />);
    fireEvent.click(screen.getByRole("button", { name: /^Oip\b/ }));
    const links = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.includes("tab=squares"));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links)
      expect(link.getAttribute("href")).toMatch(
        /&pyramids=1&symbols=1&upright=1$/,
      );
  });

  it("names its downloads as the symbols' image is named", () => {
    const fire = componentImageFilename({
      slug: "enochian-tablet-pyramids",
      props: {
        id: "fire",
        font: "enochian",
        version: "equinox",
        symbols: "upright",
      },
    });
    expect(fire).toBe(
      "enochian-fire-tablet-equinox-glyphs-pyramids-symbols-upright",
    );
    expect(
      downloadName(fire, { alt: false, reversed: false, regions: true }),
    ).toBe(
      "enochian-fire-tablet-equinox-glyphs-pyramids-symbols-upright-plain-regions",
    );
  });
});
