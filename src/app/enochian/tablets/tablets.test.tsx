// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { componentImageFilename } from "@/render/componentImageUrl";
import Tablets, { downloadName } from "./tablets";

const PAGE = "/enochian/tablets";

beforeEach(() => window.history.replaceState(null, "", PAGE));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * A screen that matches these media queries, as MUI's `useMediaQuery`
 * and the page's reduced-motion check read them; jsdom has no
 * `matchMedia`, so the page is otherwise the narrow one.
 */
const screenMatching = (...matching: RegExp[]) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matching.some((pattern) => pattern.test(query)),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
const WIDE = /min-width:\s*900px/;

/** Opens the Differences tab, where the squares the sources differ in are. */
const openDifferences = () =>
  fireEvent.click(screen.getByRole("tab", { name: "Differences" }));
const STILL = /prefers-reduced-motion: reduce/;

/**
 * A screen that starts narrow or wide and can cross the `md` breakpoint,
 * telling `useMediaQuery` as a browser would.
 */
function resizableScreen(wide: boolean) {
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return WIDE.test(query) && wide;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: () => false,
  }));
  return (next: boolean) =>
    act(() => {
      wide = next;
      for (const listener of listeners) listener();
    });
}

/** The tablet the page draws: its 156 letters, top row first. */
const drawn = (container: HTMLElement) => {
  const page = [...container.querySelectorAll("svg")].find(
    (svg) => svg.getAttribute("viewBox") === "-105 0 210 297",
  );
  // The letters, not a note where Dee's tables have no sigil.
  return [...(page?.querySelectorAll("text") ?? [])]
    .filter((text) => !text.closest("[data-sigil-note]"))
    .map((text) => text.textContent);
};

describe("/enochian/tablets", () => {
  it("offers the four Watchtowers and the Union by name and draws each", () => {
    const { container } = render(<Tablets />);
    expect(drawn(container).slice(0, 4).join("")).toBe("bOaZ");
    const expected = {
      Earth: "bOaZ",
      Air: "rZil",
      Water: "TaOA",
      Fire: "donp",
    };
    for (const [name, first] of Object.entries(expected)) {
      fireEvent.mouseDown(screen.getByRole("combobox", { name: "Tablet" }));
      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["Earth", "Air", "Water", "Fire", "Tablet of Union"]);
      fireEvent.click(screen.getByRole("option", { name }));
      const letters = drawn(container);
      expect(letters, name).toHaveLength(156);
      expect(letters.slice(0, 4).join(""), name).toBe(first);
    }
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Tablet" }));
    fireEvent.click(screen.getByRole("option", { name: "Tablet of Union" }));
    expect(window.location.search).toBe("?tablet=union");
    const union = container.querySelector('svg[viewBox="0 0 124 104"]');
    expect(
      [...(union?.querySelectorAll("text") ?? [])]
        .map((text) => text.textContent)
        .join(""),
    ).toBe("EXARPHCOMANANTABITOM");
    expect(
      screen.getByRole("heading", { level: 2, name: "The Tablet of Union" }),
    ).toBeDefined();
  });
});

describe("/enochian/tablets' versions", () => {
  const choose = (combobox: string, name: RegExp | string) => {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: combobox }));
    fireEvent.click(screen.getByRole("option", { name }));
  };

  it("offers every version, the Golden Dawn's by default", () => {
    const { container } = render(<Tablets />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Version" }));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual([
      "The Golden Dawn's (default)",
      "Regardie's print",
      "The Equinox's",
      "Dee's, 1584",
      "Raphael's, 1587",
    ]);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    // Earth's eighth row: the Golden Dawn's, then Dee's and Raphael's.
    const row8 = () => drawn(container).slice(84, 96).join("");
    expect(row8()).toBe("RCanchiisomt");
    choose("Version", "Dee's, 1584");
    expect(row8()).toBe("ROcanchiasom");
    choose("Version", "Raphael's, 1587");
    expect(row8()).toBe("ocanchiasomt");
    expect(
      screen.getByRole("heading", { level: 2, name: "Raphael's, 1587" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/thus reformed by Raphael|reformed by Raphael/),
    ).toBeTruthy();
  });

  it("draws Dee's empty Fire squares blank, his letters and no sigil", () => {
    const { container } = render(<Tablets />);
    choose("Tablet", "Fire");
    choose("Version", "Dee's, 1584");
    expect(drawn(container)).toHaveLength(154);
    expect(container.innerHTML).not.toContain('viewBox="-100 -100 200 200"');
    expect(container.querySelector("[data-sigil-note]")?.textContent).toMatch(
      /^No sigil: Dee's tables carry none\./,
    );
    expect(
      container.querySelector('svg[role="img"]')?.getAttribute("aria-label"),
    ).toBe("Enochian Watchtower of Fire, Dee's table of 1584");
  });

  it("says how the version differs from each other, counted from the readings", () => {
    render(<Tablets />);
    choose("Version", "Dee's, 1584");
    for (const name of [
      "From the Golden Dawn's",
      "From Regardie's print",
      "From the Equinox's",
      "From Raphael's, 1587",
    ])
      expect(screen.getByRole("heading", { level: 4, name })).toBeTruthy();
    const raphael = screen
      .getByRole("heading", { level: 4, name: "From Raphael's, 1587" })
      .closest("section") as HTMLElement;
    expect(raphael.textContent).toMatch(
      /In the Earth tablet, \d+ squares differ: 13 in letter/,
    );
    expect(raphael.textContent).toMatch(/Row 8, square 1: R here, o there/);
  });

  it("mirrors reversed letters and draws second letters as asked", () => {
    const { container } = render(<Tablets />);
    choose("Tablet", "Water");
    const mirrored = () =>
      container.querySelectorAll('text[transform*="scale(-1 1)"]').length;
    const corners = () => container.querySelectorAll("text[data-alt]").length;
    expect(mirrored()).toBe(2);
    expect(corners()).toBe(0);
    expect(
      screen.getAllByRole("link", { name: "Open SVG image link" }).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("switch", { name: "Reversed letters" }));
    expect(mirrored()).toBe(0);
    expect(screen.queryByText(/^Second letters in/)).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Second letters" }));
    expect(corners()).toBeGreaterThan(10);
    // In words too, for readers who cannot see the corners.
    expect(
      screen.getByText(`Second letters in ${corners()} squares`),
    ).toBeTruthy();
    expect(screen.getByText("Row 5, square 12: y, l, h")).toBeTruthy();
    expect(
      screen.queryAllByRole("link", { name: "Open SVG image link" }),
    ).toHaveLength(0);
    expect(
      screen.getByText(
        "No image link with second letters shown or reversed letters plain.",
      ),
    ).toBeTruthy();
  });

  it("names downloads for what is drawn", () => {
    const shown = { alt: false, reversed: true };
    expect(downloadName("enochian-fire-tablet-dee", shown)).toBe(
      "enochian-fire-tablet-dee",
    );
    expect(
      downloadName("enochian-fire-tablet-dee", {
        alt: true,
        reversed: false,
        differences: true,
        square: { row: 4, column: 11 },
      }),
    ).toBe(
      "enochian-fire-tablet-dee-second-letters-plain-differences-row5-square12",
    );
    expect(
      downloadName("enochian-earth-tablet", {
        ...shown,
        name: "senior-row-left",
        regions: true,
      }),
    ).toBe("enochian-earth-tablet-senior-row-left-regions");
    expect(
      downloadName("enochian-earth-tablet", {
        ...shown,
        square: { row: 6, column: 5 },
      }),
    ).toBe("enochian-earth-tablet-row7-square6");
    // The Tablet of Union's image names it, and a chosen line's id follows.
    const union = componentImageFilename({
      slug: "enochian-tablet",
      props: { id: "union", font: "latin", version: "equinox" },
    });
    expect(union).toBe("enochian-union-tablet-equinox");
    expect(downloadName(union, { ...shown, name: "union-row-3" })).toBe(
      "enochian-union-tablet-equinox-union-row-3",
    );
  });

  it("links the image in the version shown", () => {
    render(<Tablets />);
    choose("Tablet", "Air");
    choose("Version", "The Equinox's");
    const link = screen.getAllByRole("link", {
      name: "Open SVG image link",
    })[0];
    expect(link.getAttribute("href")).toContain("id=air&version=equinox");
  });
});

describe("/enochian/tablets' notes", () => {
  it("says where each tablet comes from, and about the versions", () => {
    render(<Tablets />);
    expect(
      screen.getByRole("heading", { name: "The Earth tablet" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "About these tablets" }),
    ).toBeTruthy();
    for (const name of [
      "The Golden Dawn's",
      "Squares with two letters",
      "Two empty squares in Fire",
      "The Tablet of Union",
    ])
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    expect(screen.getByText(/for those who work from Dee alone/)).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Tablet" }));
    fireEvent.click(screen.getByRole("option", { name: "Fire" }));
    expect(
      screen.getByRole("heading", { name: "The Fire tablet" }),
    ).toBeTruthy();
    // The sources link to their scans.
    const link = screen.getAllByRole("link", { name: /p\.273/ })[0];
    expect(link.getAttribute("href")).toBe(
      "https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n265",
    );
  });

  it("links Plate X for the Air sigil's form where Regardie's colours draw it", () => {
    render(<Tablets />);
    // The source lists name the plate in full: "The Equinox, vol. I no. 7…".
    const plateX = () =>
      screen.queryAllByRole("link", {
        name: "The Equinox I(7) (1912), Plate X",
      });
    const url =
      "https://archive.org/details/crowley-equinox_202110/The%20Equinox%20Vol.%201%2C%20No.%207/page/n256";
    // Earth's sigil is not drawn after the plate.
    expect(plateX()).toEqual([]);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Tablet" }));
    fireEvent.click(screen.getByRole("option", { name: "Air" }));
    for (const version of ["The Golden Dawn's (default)", "Regardie's print"]) {
      fireEvent.mouseDown(screen.getByRole("combobox", { name: "Version" }));
      fireEvent.click(screen.getByRole("option", { name: version }));
      const links = plateX();
      expect(
        links.map((link) => link.textContent),
        version,
      ).toEqual(["The Equinox I(7) (1912), Plate X"]);
      expect(links[0].getAttribute("href")).toBe(`${url}/mode/1up`);
      expect(links[0].closest("p")?.textContent).toBe(
        "The Air sigil's form is drawn after The Equinox I(7) (1912), Plate X.",
      );
    }
    // The Equinox's own version cites the plate among its sources instead.
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Version" }));
    fireEvent.click(screen.getByRole("option", { name: "The Equinox's" }));
    expect(plateX()).toEqual([]);
    expect(
      screen
        .getAllByRole("link", { name: /Plate X \(archive\.org leaf n256\)/ })
        .map((link) => link.getAttribute("href")),
    ).toContain(url);
  });

  it("outlines the squares where the sources differ, and explains one", () => {
    const { container } = render(<Tablets />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Tablet" }));
    fireEvent.click(screen.getByRole("option", { name: "Water" }));
    const outlined = () => container.querySelectorAll("[data-square]");
    expect(outlined()).toHaveLength(0);
    openDifferences();
    const list = screen.getByRole("list", {
      name: "Squares where the sources differ",
    });
    const count = list.querySelectorAll("button").length;
    expect(count).toBeGreaterThan(22);
    expect(outlined()).toHaveLength(count);
    // From the list, by keyboard or pointer.
    const square = screen.getByRole("button", { name: "Row 5, square 12" });
    fireEvent.click(square);
    expect(square.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("y and l over N and h")).toBeTruthy();
    expect(
      screen.getByText("N, reversed; first written y and l; high doubt"),
    ).toBeTruthy();
    // Only a one-line summary is announced; the note is outside it.
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe(
      "Row 5, square 12: The Golden Dawn's N, reversed; Regardie's print y; The Equinox's N, reversed; Dee's, 1584 N, reversed; Raphael's, 1587 n, reversed",
    );
    expect(live?.textContent).not.toMatch(/four letters here/);
    expect(screen.getByText(/four letters here/)).toBeTruthy();
    // From the tablet: its outline chooses the same.
    fireEvent.click(container.querySelector('[data-square="3,7"]') as Element);
    expect(
      screen
        .getByRole("button", { name: "Row 4, square 8" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText(/Regardie prints only i here/)).toBeTruthy();
    // A second tap on the tablet clears it, as the button does.
    fireEvent.click(container.querySelector('[data-square="3,7"]') as Element);
    expect(screen.queryByText(/Regardie prints only i here/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Row 4, square 8" }));
    fireEvent.click(screen.getByRole("button", { name: "Row 4, square 8" }));
    expect(screen.queryByText(/Regardie prints only i here/)).toBeNull();
    // A square with no note still says what each source has.
    fireEvent.click(screen.getByRole("button", { name: "Row 11, square 8" }));
    expect(screen.getAllByText("U").length).toBeGreaterThan(0);
  });
});

describe("/enochian/tablets while differences are shown", () => {
  it("keeps its headings in order", () => {
    const { container } = render(<Tablets />);
    openDifferences();
    const levels = [...container.querySelectorAll("h2, h3, h4")].map(
      (heading) => Number(heading.tagName[1]),
    );
    expect(levels[0]).toBe(2);
    for (let i = 1; i < levels.length; i++)
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    // In the tab's panel, beside or under the tablet, before its note.
    const heading = container.querySelector("#tablet-squares");
    expect(heading?.tagName).toBe("H2");
    expect(heading?.closest('[role="tabpanel"]')).toBeTruthy();
  });

  it("offers no image link while the outlines are drawn", () => {
    render(<Tablets />);
    expect(
      screen.getAllByRole("link", { name: "Open SVG image link" }).length,
    ).toBeGreaterThan(0);
    openDifferences();
    expect(
      screen.queryAllByRole("link", { name: "Open SVG image link" }),
    ).toHaveLength(0);
    expect(
      screen.getByText("No image link while differences are shown."),
    ).toBeTruthy();
  });
});

describe("/enochian/tablets' choices in its URL", () => {
  const choose = (combobox: string, name: RegExp | string) => {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: combobox }));
    fireEvent.click(screen.getByRole("option", { name }));
  };

  it("opens the tablet and version a link names", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=fire&version=dee`);
    const { container } = render(<Tablets />);
    expect(screen.getByRole("combobox", { name: "Tablet" }).textContent).toBe(
      "Fire",
    );
    expect(screen.getByRole("combobox", { name: "Version" }).textContent).toBe(
      "Dee's, 1584",
    );
    expect(drawn(container)).toHaveLength(154);
  });

  it("falls back to the defaults for values it does not know", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=Union&version=x`);
    const { container } = render(<Tablets />);
    expect(drawn(container).slice(0, 4).join("")).toBe("bOaZ");
    expect(screen.getByRole("combobox", { name: "Version" }).textContent).toBe(
      "The Golden Dawn's (default)",
    );
  });

  it("replaces the URL as the choices change, leaving out the defaults", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    render(<Tablets />);
    choose("Tablet", "Air");
    expect(window.location.search).toBe("?tablet=air");
    choose("Version", "The Equinox's");
    expect(window.location.search).toBe("?tablet=air&version=equinox");
    choose("Tablet", "Earth");
    expect(window.location.search).toBe("?version=equinox");
    choose("Version", /^The Golden Dawn's/);
    expect(window.location.pathname + window.location.search).toBe(PAGE);
    expect(pushState).not.toHaveBeenCalled();
  });

  it("follows the URL when it changes under it", () => {
    const { container } = render(<Tablets />);
    act(() => {
      window.history.replaceState(null, "", `${PAGE}?tablet=water`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(drawn(container).slice(0, 4).join("")).toBe("TaOA");
  });

  it("copies a page link that restores the choices", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<Tablets />);
    choose("Tablet", "Fire");
    choose("Version", "Raphael's, 1587");
    fireEvent.click(screen.getByRole("button", { name: "Copy page link" }));
    expect(await screen.findByText("Copied page link")).toBeTruthy();
    expect(writeText).toHaveBeenLastCalledWith(
      `${window.location.origin}${PAGE}?tablet=fire&version=raphael`,
    );
  });
});

describe("/enochian/tablets beside its panel on a wide screen", () => {
  it("puts the squares where the sources differ in the panel, under their own h2", () => {
    screenMatching(WIDE);
    const { container } = render(<Tablets />);
    openDifferences();
    const heading = container.querySelector("#tablet-squares");
    expect(heading?.tagName).toBe("H2");
    // Beside the tablet, before the tablet's note below both columns.
    const note = screen.getByRole("heading", { name: "The Earth tablet" });
    expect(
      (heading?.compareDocumentPosition(note) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      note.closest("section")?.querySelector("#tablet-squares"),
    ).toBeNull();
    const first = screen
      .getByRole("list", { name: "Squares where the sources differ" })
      .querySelector("button") as HTMLElement;
    fireEvent.click(first);
    expect(
      screen.getByRole("heading", { level: 3, name: first.textContent ?? "" }),
    ).toBeTruthy();
    const levels = [...container.querySelectorAll("h2, h3, h4")].map((each) =>
      Number(each.tagName[1]),
    );
    expect(levels[0]).toBe(2);
    for (let i = 1; i < levels.length; i++)
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });

  it("lists the second letters after the downloads, as on a phone before them", () => {
    const order = () => {
      fireEvent.click(screen.getByRole("switch", { name: "Second letters" }));
      const list = screen.getByText(/^Second letters in \d+ squares$/);
      const downloads = screen.getByRole("button", { name: "Download SVG" });
      const following =
        list.compareDocumentPosition(downloads) &
        Node.DOCUMENT_POSITION_FOLLOWING;
      cleanup();
      return following ? "before" : "after";
    };
    render(<Tablets />);
    expect(order()).toBe("before");
    screenMatching(WIDE);
    render(<Tablets />);
    expect(order()).toBe("after");
  });

  it("scrolls a square chosen on the tablet into view, at once under reduced motion", () => {
    const scrollIntoView = vi.fn();
    const own = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      for (const [matching, behavior] of [
        [[WIDE], "smooth"],
        [[WIDE, STILL], "instant"],
      ] as const) {
        screenMatching(...matching);
        const { container } = render(<Tablets />);
        openDifferences();
        fireEvent.click(container.querySelector("[data-square]") as Element);
        expect(scrollIntoView).toHaveBeenLastCalledWith({
          block: "nearest",
          behavior,
        });
        cleanup();
      }
    } finally {
      Element.prototype.scrollIntoView = own;
    }
  });
});

describe("/enochian/tablets across the breakpoint", () => {
  it("keeps the tab's list, and the focus in it, across the breakpoint", () => {
    const resize = resizableScreen(false);
    render(<Tablets />);
    openDifferences();
    const buttons = () =>
      [
        ...screen
          .getByRole("list", { name: "Squares where the sources differ" })
          .querySelectorAll("button"),
      ] as HTMLElement[];
    const third = buttons()[2];
    third.focus();
    resize(true);
    expect(document.querySelector("#tablet-squares")?.tagName).toBe("H2");
    expect(buttons()[2]).toBe(third);
    expect(document.activeElement).toBe(third);
    resize(false);
    expect(document.activeElement).toBe(third);
  });

  it("keeps the downloads, and their feedback, mounted", async () => {
    const resize = resizableScreen(false);
    const writeText = vi.fn(async (_text: string) => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<Tablets />);
    const before = screen.getByRole("button", { name: "Download SVG" });
    fireEvent.click(screen.getByRole("button", { name: "Copy page link" }));
    expect(await screen.findByText("Copied page link")).toBeTruthy();
    resize(true);
    expect(screen.getByRole("button", { name: "Download SVG" })).toBe(before);
    expect(screen.getByText("Copied page link")).toBeTruthy();
    resize(false);
    expect(screen.getByRole("button", { name: "Download SVG" })).toBe(before);
  });

  it("prerenders the default tablet and hydrates a shared link on a wide screen", async () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=fire&version=dee`);
    resizableScreen(true);
    const html = renderToString(<Tablets />);
    expect(html).toContain(">Earth<");
    expect(html).not.toContain(">Fire<");
    // React marks the joins in "The {name} tablet" with empty comments.
    expect(html.replaceAll("<!-- -->", "")).toContain("The Earth tablet");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <Tablets />, {
          onRecoverableError: (error) => recoverable.push(error),
        });
      });
      expect(recoverable).toEqual([]);
      expect(
        errors.mock.calls.filter((call) =>
          /hydrat|did not match/i.test(String(call[0])),
        ),
      ).toEqual([]);
      expect(screen.getByRole("combobox", { name: "Tablet" }).textContent).toBe(
        "Fire",
      );
      expect(
        screen.getByRole("combobox", { name: "Version" }).textContent,
      ).toBe("Dee's, 1584");
      expect(drawn(container)).toHaveLength(154);
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});

describe("/enochian/tablets' URL as it writes it", () => {
  const choose = (combobox: string, name: RegExp | string) => {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: combobox }));
    fireEvent.click(screen.getByRole("option", { name }));
  };

  it("keeps other params and the hash", () => {
    window.history.replaceState(null, "", `${PAGE}?ref=mail#tablet-about`);
    render(<Tablets />);
    choose("Tablet", "Water");
    expect(window.location.search).toBe("?ref=mail&tablet=water");
    expect(window.location.hash).toBe("#tablet-about");
    choose("Tablet", "Earth");
    expect(window.location.search).toBe("?ref=mail");
    expect(window.location.hash).toBe("#tablet-about");
  });

  it("drops a value it does not know when it writes another choice", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=foo`);
    render(<Tablets />);
    expect(window.location.search).toBe("?tablet=foo");
    choose("Version", "Dee's, 1584");
    expect(window.location.search).toBe("?version=dee");
  });
});

describe("/enochian/tablets' chosen square", () => {
  it("is cleared when the tablet changes, from the URL as from the select", () => {
    render(<Tablets />);
    openDifferences();
    const list = () =>
      screen.getByRole("list", { name: "Squares where the sources differ" });
    const first = list().querySelector("button") as HTMLElement;
    fireEvent.click(first);
    expect(first.getAttribute("aria-pressed")).toBe("true");
    const live = () =>
      document.querySelector('[aria-live="polite"]')?.textContent;
    expect(live()).not.toBe("");
    const navigate = (search: string) =>
      act(() => {
        window.history.replaceState(null, "", `${PAGE}${search}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
    navigate("?tablet=water");
    navigate("");
    expect(list().querySelector('[aria-pressed="true"]')).toBeNull();
    expect(live()).toBe("");
  });
});
