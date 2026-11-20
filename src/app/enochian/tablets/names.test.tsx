// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import tablets from "magick-data/enochian/tablets";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";
import { tabletNameLinks } from "./nameLinks";
import { differingSquares } from "./squareReadings";
import Tablets from "./tablets";

// Imported on the server only; the tests read it directly.
vi.mock("server-only", () => ({}));

const PAGE = "/enochian/tablets";
const LINKS = tabletNameLinks();

beforeEach(() => window.history.replaceState(null, "", PAGE));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The grid's drawing, inside the tablet's page. */
const grid = (container: HTMLElement) =>
  container.querySelector('svg[viewBox="0 0 244 264"]') as SVGSVGElement;

/** A square's ground on the grid, by row and column from 0. */
const squareOn = (container: HTMLElement, row: number, column: number) =>
  grid(container).querySelector(
    `rect[x="${column * 20 + 2}"][y="${row * 20 + 2}"]`,
  ) as Element;

/** A name's own button in the list, by the start of its text. */
const nameButton = (name: RegExp | string) => {
  const found = screen
    .getAllByRole("button", {
      name: typeof name === "string" ? new RegExp(`^${name}`) : name,
    })
    .filter((button) => button.dataset.nameId);
  expect(found).toHaveLength(1);
  return found[0] as HTMLElement;
};

/** The headings of the Names tab's groups. */
const groupHeadings = () =>
  within(screen.getByRole("tabpanel"))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

const live = (container: HTMLElement) =>
  container.querySelector('[role="tabpanel"] [aria-live="polite"]')
    ?.textContent;

const choose = (combobox: string, name: RegExp | string) => {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: combobox }));
  fireEvent.click(screen.getByRole("option", { name }));
};

describe("/enochian/tablets' tabs", () => {
  it("opens on Names with nothing highlighted, and the image link offered", () => {
    const { container } = render(<Tablets links={LINKS} />);
    const names = screen.getByRole("tab", { name: "Names" });
    expect(names.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
      names.id,
    );
    expect(container.querySelector("[data-highlight]")).toBeNull();
    expect(container.querySelector("[data-square]")).toBeNull();
    expect(container.querySelector("[data-regions]")).toBeNull();
    expect(
      screen.getAllByRole("link", { name: "Open SVG image link" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { level: 2, name: "Names on the tablet" }),
    ).toBeTruthy();
  });

  it("shows one tab's drawing at a time", () => {
    const { container } = render(<Tablets links={LINKS} />);
    fireEvent.click(nameButton("Laidrom"));
    expect(container.querySelector('[data-highlight="name"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Differences" }));
    expect(container.querySelector("[data-highlight]")).toBeNull();
    expect(container.querySelectorAll("[data-square]").length).toBeGreaterThan(
      10,
    );
    expect(screen.queryByRole("heading", { name: "Names on the tablet" })).toBe(
      null,
    );
    // Back on Names the name is still chosen, and the outlines gone.
    fireEvent.click(screen.getByRole("tab", { name: "Names" }));
    expect(container.querySelector("[data-square]")).toBeNull();
    expect(container.querySelector('[data-highlight="name"]')).toBeTruthy();
  });
});

describe("/enochian/tablets' names", () => {
  it("lists them as the tablet is built, the Great Cross open", () => {
    render(<Tablets links={LINKS} />);
    expect(groupHeadings()).toEqual([
      "The Great Cross",
      "Air of Earth",
      "Water of Earth",
      "Earth of Earth",
      "Fire of Earth",
    ]);
    const cross = screen.getByRole("list", { name: "The Great Cross" });
    expect(
      within(cross)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([
      "Mor, A holy name",
      "Dial, A holy name",
      "Hctga, A holy name",
      "Iczhihal, The King, of the Sun",
      "Laidrom, A Senior, of Mars",
      "Aczinor, A Senior, of Jupiter",
      "Lzinopo, A Senior, of the Moon",
      "Alhctga, A Senior, of Venus",
      "Ahmlicv, A Senior, of Mercury",
      "Liiansa, A Senior, of Saturn",
    ]);
    // Heard as the name, then its role.
    expect(
      screen.getByRole("button", { name: "Laidrom, A Senior, of Mars" }).dataset
        .nameId,
    ).toBe("senior-row-left");
    // A quarter opens to its seven names, then the five with a letter of
    // the Tablet of Union.
    expect(screen.queryByRole("list", { name: "Air of Earth" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Air of Earth" }));
    expect(
      within(screen.getByRole("list", { name: "Air of Earth" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([
      "Angpoi, The name that calls",
      "Unnax, The name that commands",
      "Boza, The Kerubic name",
      "Aira, A servient angel",
      "Ormn, A servient angel",
      "Rsni, A servient angel",
      "Iznr, A servient angel",
      "Nboza, A Kerubic archangel",
      "Aaira, A servient angel with its Union letter",
      "Aormn, A servient angel with its Union letter",
      "Arsni, A servient angel with its Union letter",
      "Aiznr, A servient angel with its Union letter",
    ]);
  });

  it("names Dee's by their places, his King with two spellings", () => {
    render(<Tablets links={LINKS} />);
    choose("Tablet", "Air");
    choose("Version", "Dee's, 1584");
    expect(groupHeadings()).toEqual([
      "The Great Cross",
      "The top left quarter",
      "The top right quarter",
      "The bottom left quarter",
      "The bottom right quarter",
    ]);
    expect(nameButton(/^Bataiva or Bataivh/).textContent).toBe(
      "Bataiva or Bataivh, The King",
    );
    expect(nameButton(/A Senior, row 7 leftward/)).toBeTruthy();
    expect(screen.getAllByText("A name of God")).toHaveLength(3);
  });

  it("shows Dee's empty Fire squares in the names that cross them", () => {
    render(<Tablets links={LINKS} />);
    choose("Tablet", "Fire");
    choose("Version", "Dee's, 1584");
    for (const group of [
      "The top left quarter",
      "The top right quarter",
      "The bottom left quarter",
      "The bottom right quarter",
    ])
      fireEvent.click(screen.getByRole("button", { name: group }));
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.textContent?.includes("?")).length,
    ).toBe(2);
  });

  it("previews a name on hover and focus, and lets it go", () => {
    const { container } = render(<Tablets links={LINKS} />);
    const button = nameButton("Laidrom");
    fireEvent.mouseEnter(button);
    const preview = () => container.querySelector('[data-highlight="preview"]');
    expect(preview()).toBeTruthy();
    expect(preview()?.querySelectorAll("[data-start]")).toHaveLength(1);
    fireEvent.mouseLeave(button);
    expect(preview()).toBeNull();
    fireEvent.focus(button);
    expect(preview()).toBeTruthy();
    fireEvent.blur(button);
    expect(preview()).toBeNull();
    // A preview is no choice: the image link stays.
    fireEvent.mouseEnter(button);
    expect(
      screen.getAllByRole("link", { name: "Open SVG image link" }).length,
    ).toBeGreaterThan(0);
  });

  it("pins a chosen name, says its squares, and lets it go when chosen again", () => {
    const { container } = render(<Tablets links={LINKS} />);
    const button = nameButton("Laidrom");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    const chosen = container.querySelector('[data-highlight="name"]');
    expect(chosen?.querySelectorAll("rect")).toHaveLength(7);
    expect(live(container)).toBe("Laidrom, a Senior: row 7, squares 7 to 1");
    // The image link waits until nothing is drawn over the tablet.
    expect(
      screen.queryAllByRole("link", { name: "Open SVG image link" }),
    ).toHaveLength(0);
    expect(
      screen.getByText(
        "No image link while a name, a square or the regions are shown.",
      ),
    ).toBeTruthy();
    // Its detail, under it in the list.
    const item = button.closest("li") as HTMLElement;
    expect(item.textContent).toContain("This version's letters:");
    expect(item.textContent).toMatch(/Mars/);
    const entry = within(item).getByRole("link", {
      name: "LAIDROM in the dictionary",
    });
    expect(entry.getAttribute("href")).toBe("/enochian/dictionary?w=LAIDROM");
    // Its rule's source, linked to its page.
    expect(
      within(item)
        .getAllByRole("link", { name: /p\.277/ })[0]
        .getAttribute("href"),
    ).toBe(
      "https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n269",
    );
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector('[data-highlight="name"]')).toBeNull();
    expect(live(container)).toBe("");
  });

  it("says each kind of name in its own words", () => {
    const { container } = render(<Tablets links={LINKS} />);
    const said = (name: string) => {
      fireEvent.click(nameButton(name));
      return live(container);
    };
    expect(said("Dial")).toBe("Dial, a holy name: row 7, squares 4 to 7");
    expect(said("Aczinor")).toBe("Aczinor, a Senior: column 6, rows 7 to 1");
    expect(said("Iczhihal")).toBe(
      "Iczhihal, the King: row 7, square 5; row 6, squares 6 and 7; row 7, square 8; row 8, squares 7 and 6; then row 7, squares 6 and 7",
    );
    fireEvent.click(screen.getByRole("button", { name: "Air of Earth" }));
    expect(said("Angpoi")).toBe(
      "Angpoi, the name that calls: column 3, rows 1 to 6",
    );
    expect(said("Unnax")).toBe(
      "Unnax, the name that commands: row 2, squares 1 to 5",
    );
    expect(said("Boza")).toBe(
      "Boza, the Kerubic name: row 1, squares 1, 2, 4 and 5",
    );
    // The Kerubic name's rotations.
    expect(
      (nameButton("Boza").closest("li") as HTMLElement).textContent,
    ).toContain("Rotations: Boza, Ozab, Zabo, Aboz");
    expect(said("Ormn")).toBe(
      "Ormn, a servient angel: row 4, squares 1, 2, 4 and 5",
    );
  });

  it("numbers the chosen name's squares only where they are big enough", () => {
    const width = vi
      .spyOn(SVGSVGElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 300 } as DOMRect);
    const { container, unmount } = render(<Tablets links={LINKS} />);
    fireEvent.click(nameButton("Laidrom"));
    // 300px wide: squares of about 22px, no numbers.
    expect(container.querySelector("[data-order]")).toBeNull();
    unmount();
    width.mockReturnValue({ width: 600 } as DOMRect);
    const wide = render(<Tablets links={LINKS} />).container;
    fireEvent.click(nameButton("Laidrom"));
    expect(
      [...wide.querySelectorAll("[data-order]")].map((each) =>
        each.getAttribute("data-order"),
      ),
    ).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  });

  it("offers the other names through its squares, and moves focus to the one chosen", () => {
    const { container } = render(<Tablets links={LINKS} />);
    fireEvent.click(nameButton("Mor"));
    const item = nameButton("Mor").closest("li") as HTMLElement;
    const others = within(item)
      .getAllByRole("button")
      .slice(1)
      .map((button) => button.textContent);
    expect(others).toEqual(["Laidrom · A Senior, of Mars"]);
    fireEvent.click(within(item).getByRole("button", { name: /^Laidrom/ }));
    const laidrom = nameButton("Laidrom, A Senior");
    expect(laidrom.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(laidrom);
    expect(live(container)).toMatch(/^Laidrom/);
  });

  it("brings a name chosen in the list on screen, only when its squares are not all showing", () => {
    const scrollBy = vi.fn();
    vi.stubGlobal("scrollBy", scrollBy);
    // Each square 20px tall, its rows laid out from `top`: row 7 is 120px
    // below row 1, as on a page whose grid is far above the screen.
    let top = -1000;
    const own = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.tagName !== "rect" || !this.getAttribute("y"))
          return own.call(this);
        const y = top + (Number(this.getAttribute("y")) - 2);
        return { top: y, bottom: y + 20, height: 20 } as DOMRect;
      },
    );
    render(<Tablets links={LINKS} />);
    // Laidrom's row, 20px tall, centred in the 704px below the app bar
    // (56px in jsdom, and 8px): its top to 64 + 342.
    fireEvent.click(nameButton("Laidrom"));
    expect(scrollBy).toHaveBeenLastCalledWith({
      top: -1000 + 120 - (64 + 342),
      behavior: "smooth",
    });
    // At once for a reader who asked for less motion; and a column of
    // seven squares, 140px, centred too.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: /prefers-reduced-motion: reduce/.test(query),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
    fireEvent.click(nameButton("Aczinor"));
    expect(scrollBy).toHaveBeenLastCalledWith({
      top: -1000 - (64 + 282),
      behavior: "instant",
    });
    // Partly under the app bar: brought down.
    top = -60;
    fireEvent.click(nameButton("Mor"));
    expect(scrollBy).toHaveBeenLastCalledWith({
      top: -60 + 120 - (64 + 342),
      behavior: "instant",
    });
    // All showing: left where it is.
    top = 100;
    fireEvent.click(nameButton("Laidrom"));
    expect(scrollBy).toHaveBeenCalledTimes(3);
  });

  it("leaves the page where it is while the tablet is stuck in place, and allows for a hidden app bar", () => {
    const scrollBy = vi.fn();
    vi.stubGlobal("scrollBy", scrollBy);
    // Row 1 at the screen's top, row 7 at 120px.
    let top = 0;
    const own = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.tagName !== "rect" || !this.getAttribute("y"))
          return own.call(this);
        const y = top + (Number(this.getAttribute("y")) - 2);
        return { top: y, bottom: y + 20, height: 20 } as DOMRect;
      },
    );
    const { container } = render(<Tablets links={LINKS} />);
    const box = grid(container).closest("[class*='tablet']") as HTMLElement;
    // Stuck (the phone's grid under the bar, or beside the panel): Aczinor
    // runs up to row 1, under where the bar would be, and nothing moves.
    box.style.position = "sticky";
    fireEvent.click(nameButton("Aczinor"));
    expect(scrollBy).not.toHaveBeenCalled();
    box.style.position = "";
    // Scrolling with the page, the bar hidden: row 1 at 10px is showing.
    top = 10;
    document.documentElement.setAttribute("data-app-bar-hidden", "");
    onTestFinished(() =>
      document.documentElement.removeAttribute("data-app-bar-hidden"),
    );
    fireEvent.click(nameButton("Laidrom"));
    fireEvent.click(nameButton("Aczinor"));
    expect(scrollBy).not.toHaveBeenCalled();
    // The bar shown: row 1 is under it, so the column is brought down,
    // allowing for the bar.
    document.documentElement.removeAttribute("data-app-bar-hidden");
    fireEvent.click(nameButton("Laidrom"));
    fireEvent.click(nameButton("Aczinor"));
    expect(scrollBy).toHaveBeenLastCalledWith({
      top: 10 - (64 + 282),
      behavior: "smooth",
    });
  });
});

describe("/enochian/tablets' squares in the Names tab", () => {
  it("pins the name of a square that lies in one, and brings it into view", () => {
    const scrollIntoView = vi.fn();
    const own = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    onTestFinished(() => {
      Element.prototype.scrollIntoView = own;
    });
    const { container } = render(<Tablets links={LINKS} />);
    // Row 3, square 1: Aira's, and its archangel Aaira's on the same
    // squares, which Aira's detail offers; so Aira is pinned at once.
    fireEvent.click(squareOn(container, 2, 0));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(
      nameButton("Aira, A servient angel").closest("li"),
    );
    expect(container.querySelector("[data-square-choice]")).toBeNull();
    // Not again when the tab is opened again.
    fireEvent.click(screen.getByRole("tab", { name: "Differences" }));
    fireEvent.click(screen.getByRole("tab", { name: "Names" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // Its group opens, and the name is pinned.
    const aira = nameButton("Aira, A servient angel");
    expect(aira.getAttribute("aria-pressed")).toBe("true");
    expect(live(container)).toBe(
      "Aira, a servient angel: row 3, squares 1, 2, 4 and 5",
    );
    // Again lets it go.
    fireEvent.click(squareOn(container, 2, 0));
    expect(aira.getAttribute("aria-pressed")).toBe("false");
    // A top row's square pins the Kerubic name, not its archangel.
    fireEvent.click(squareOn(container, 0, 1));
    expect(
      nameButton("Boza, The Kerubic name").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(container.querySelector("[data-square-choice]")).toBeNull();
  });

  it("offers a name's archangel first in its detail, and reaches it", () => {
    const { container } = render(<Tablets links={LINKS} />);
    fireEvent.click(squareOn(container, 2, 0));
    const item = nameButton("Aira, A servient angel").closest(
      "li",
    ) as HTMLElement;
    const others = within(item)
      .getAllByRole("button")
      .slice(1)
      .map((button) => button.textContent);
    expect(others[0]).toBe("Aaira · A servient angel with its Union letter");
    fireEvent.click(within(item).getByRole("button", { name: /^Aaira · / }));
    const aaira = nameButton("Aaira, A servient angel with its Union letter");
    expect(aaira.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(aaira);
    expect(live(container)).toBe(
      "Aaira, a servient angel with its Union letter: A from the Tablet of Union, row 3, square 2; then row 3, squares 1, 2, 4 and 5",
    );
    // And back: the archangel's detail offers the name it is built on.
    const back = within(aaira.closest("li") as HTMLElement).getByRole(
      "button",
      { name: /^Aira · / },
    );
    fireEvent.click(back);
    expect(
      nameButton("Aira, A servient angel").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("lists the names through a square that lies in several", () => {
    const { container } = render(<Tablets links={LINKS} />);
    fireEvent.click(squareOn(container, 6, 5));
    expect(live(container)).toBe(
      "Row 7, square 6: in 6 names. Choose one below.",
    );
    const choice = container.querySelector(
      "[data-square-choice]",
    ) as HTMLElement;
    expect(choice.textContent).toMatch(/^The names through row 7, square 6/);
    const offered = within(choice)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(offered).toEqual([
      "Dial · A holy name",
      "Iczhihal · The King, of the Sun",
      "Laidrom · A Senior, of Mars",
      "Aczinor · A Senior, of Jupiter",
      "Alhctga · A Senior, of Venus",
      "Ahmlicv · A Senior, of Mercury",
      "Clear the square",
    ]);
    // The square is drawn chosen.
    expect(container.querySelector('[data-square="6,5"]')).toBeTruthy();
    fireEvent.click(within(choice).getByRole("button", { name: /^Alhctga/ }));
    expect(container.querySelector("[data-square-choice]")).toBeNull();
    expect(nameButton("Alhctga, A Senior").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(document.activeElement).toBe(nameButton("Alhctga, A Senior"));
    // Clearing the square leaves nothing chosen there.
    fireEvent.click(squareOn(container, 6, 6));
    fireEvent.click(screen.getByRole("button", { name: "Clear the square" }));
    expect(container.querySelector("[data-square-choice]")).toBeNull();
  });
});

describe("/enochian/tablets' regions", () => {
  it("tints them with a key, and offers no image link while they show", () => {
    const { container } = render(<Tablets links={LINKS} />);
    expect(screen.queryByRole("list", { name: "The regions' key" })).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Show the regions" }));
    expect(container.querySelector('[data-regions="tints"]')).toBeTruthy();
    expect(container.querySelector('[data-region="topRow"]')).toBeTruthy();
    expect(
      within(screen.getByRole("list", { name: "The regions' key" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "The Great Cross",
      "The Calvary crosses",
      "The top rows, hatched",
      "The servient squares, left plain",
    ]);
    expect(
      screen.queryAllByRole("link", { name: "Open SVG image link" }),
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole("switch", { name: "Show the regions" }));
    expect(container.querySelector("[data-regions]")).toBeNull();
  });
});

describe("/enochian/tablets' names by keyboard", () => {
  it("reaches every name and group as a native button", () => {
    render(<Tablets links={LINKS} />);
    for (const group of [
      "Air of Earth",
      "Water of Earth",
      "Earth of Earth",
      "Fire of Earth",
    ])
      fireEvent.click(screen.getByRole("button", { name: group }));
    const names = screen
      .getAllByRole("button")
      .filter((button) => button.dataset.nameId);
    // 58 names in the Golden Dawn's version, each a native button with its
    // state, none taken out of the tab order.
    expect(names).toHaveLength(58);
    for (const button of names) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(button.getAttribute("tabindex")).not.toBe("-1");
    }
  });
});

describe("/enochian/tablets' names across tablets and versions", () => {
  it("keeps the chosen name's place when the tablet changes", () => {
    const { container } = render(<Tablets links={LINKS} />);
    fireEvent.click(nameButton("Mor"));
    act(() => {
      window.history.replaceState(null, "", `${PAGE}?tablet=fire`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(nameButton("Oip, A holy name").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(live(container)).toBe("Oip, a holy name: row 7, squares 1 to 3");
    expect(window.location.search).toBe("?tablet=fire");
  });

  it("links a name to the dictionary only where it has a headword", () => {
    render(<Tablets links={LINKS} />);
    fireEvent.click(nameButton("Laidrom"));
    expect(
      screen
        .getByRole("link", { name: "LAIDROM in the dictionary" })
        .getAttribute("href"),
    ).toBe("/enochian/dictionary?w=LAIDROM");
    cleanup();
    // A map without Laidrom: no link for it, Mor's still there.
    const { "senior-row-left": _, ...rest } = LINKS.earth ?? {};
    render(<Tablets links={{ ...LINKS, earth: rest }} />);
    fireEvent.click(nameButton("Laidrom"));
    expect(screen.queryByRole("link", { name: /in the dictionary/ })).toBe(
      null,
    );
    fireEvent.click(nameButton("Mor"));
    expect(
      screen.getByRole("link", { name: "MOR in the dictionary" }),
    ).toBeTruthy();
  });
});

describe("/enochian/tablets' Tablet of Union", () => {
  /** The Union's drawing, its own page. */
  const unionSvg = (container: HTMLElement) =>
    container.querySelector('svg[viewBox="0 0 124 104"]') as SVGSVGElement;

  it("lists its four lines and its column, and draws a chosen one", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=union`);
    const { container } = render(<Tablets links={LINKS} />);
    expect(groupHeadings()).toEqual(["The Tablet of Union"]);
    expect(
      within(screen.getByRole("list", { name: "The Tablet of Union" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([
      "Exarp, The line of Air",
      "Hcoma, The line of Water",
      "Nanta, The line of Earth",
      "Bitom, The line of Fire",
      "Ehnb, The first column",
    ]);
    // No regions on the Union.
    expect(screen.queryByRole("switch", { name: "Show the regions" })).toBe(
      null,
    );
    fireEvent.click(nameButton("Nanta"));
    expect(live(container)).toBe(
      "Nanta, the line of Earth: row 3, squares 1 to 5",
    );
    const chosen = unionSvg(container).querySelector('[data-highlight="name"]');
    expect(chosen?.querySelectorAll("rect")).toHaveLength(5);
    const item = nameButton("Nanta").closest("li") as HTMLElement;
    expect(
      within(item).getByRole("link", { name: "NANTA in the dictionary" }),
    ).toBeTruthy();
    expect(item.textContent).toMatch(/BITOM of Fire/);
    fireEvent.click(nameButton("Ehnb"));
    expect(live(container)).toBe(
      "Ehnb, the first column: column 1, rows 1 to 4",
    );
    expect(screen.queryByRole("link", { name: /in the dictionary/ })).toBe(
      null,
    );
    // A square on the Union chooses its names: E is in two.
    fireEvent.click(unionSvg(container).querySelector('rect[x="12"][y="12"]')!);
    expect(live(container)).toBe(
      "Row 1, square 1: in 2 names. Choose one below.",
    );
    fireEvent.click(unionSvg(container).querySelector('rect[x="52"][y="32"]')!);
    expect(nameButton("Hcoma").getAttribute("aria-pressed")).toBe("true");
  });

  it("says its letters agree in every Golden Dawn source", () => {
    // What the message says, held to the readings: three sources, no
    // square differing or marked.
    expect(Object.keys(tablets.union.readings)).toEqual([
      "regardie1940",
      "equinox1912",
      "greer",
    ]);
    expect(differingSquares("union")).toEqual([]);
    window.history.replaceState(null, "", `${PAGE}?tablet=union`);
    const { container } = render(<Tablets links={LINKS} />);
    fireEvent.click(screen.getByRole("tab", { name: "Differences" }));
    expect(screen.getByRole("tabpanel").textContent).toMatch(
      /reads the same in all three Golden Dawn sources/,
    );
    expect(container.querySelector("[data-square]")).toBeNull();
    expect(
      within(screen.getByRole("tabpanel")).queryAllByRole("listitem"),
    ).toHaveLength(0);
  });

  it("says there is none in Dee's and Raphael's versions, rather than drawing an empty page", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=union&version=dee`);
    const { container } = render(<Tablets links={LINKS} />);
    expect(unionSvg(container)).toBeNull();
    expect(container.querySelector("[data-missing]")).toBeNull();
    expect(screen.getByRole("note").textContent).toMatch(
      /^Dee's tables of 1584 have no Tablet of Union/,
    );
    // No tabs and no downloads for a drawing that is not there.
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("button", { name: "Download SVG" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Show the Golden Dawn's version" }),
    );
    expect(window.location.search).toBe("?tablet=union");
    expect(unionSvg(container)).toBeTruthy();
    cleanup();
    window.history.replaceState(
      null,
      "",
      `${PAGE}?tablet=union&version=raphael`,
    );
    render(<Tablets links={LINKS} />);
    expect(screen.getByRole("note").textContent).toMatch(
      /^Raphael's table of 1587 has no Tablet of Union/,
    );
  });

  it("shows a Kerubic archangel on its Watchtower, its Union letter in words", () => {
    const width = vi
      .spyOn(SVGSVGElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 600 } as DOMRect);
    onTestFinished(() => width.mockRestore());
    const { container } = render(<Tablets links={LINKS} />);
    fireEvent.click(screen.getByRole("button", { name: "Earth of Earth" }));
    fireEvent.click(nameButton("Nrcnc"));
    expect(live(container)).toBe(
      "Nrcnc, a Kerubic archangel: N from the Tablet of Union, row 3, square 1; then row 8, squares 1, 2, 4 and 5",
    );
    // The Watchtower's four squares, numbered from 2: the first letter is
    // the Union's.
    expect(
      [...grid(container).querySelectorAll("[data-order]")].map((each) =>
        each.getAttribute("data-order"),
      ),
    ).toEqual(["2", "3", "4", "5"]);
    const item = nameButton("Nrcnc").closest("li") as HTMLElement;
    // The sources' spelling beside the rule's, and the dictionary's own.
    expect(item.textContent).toContain("NROAM:");
    expect(item.textContent).toContain("The dictionary's spelling: POCNC");
    expect(item.textContent).toContain("Rotations: Nrcnc, Ncncr, Nncrc, Ncrcn");
    expect(
      within(item).getByRole("link", { name: "NOCNC in the dictionary" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fire of Earth" }));
    fireEvent.click(nameButton("Nismt"));
    const fire = nameButton("Nismt").closest("li") as HTMLElement;
    expect(fire.textContent).toContain("NAAOM:");
    expect(fire.textContent).toContain("AISMT:");
  });

  it("names the Union in its downloads", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=union`);
    render(<Tablets links={LINKS} />);
    expect(
      screen
        .getAllByRole("link", { name: "Open SVG image link" })[0]
        .getAttribute("href"),
    ).toContain("id=union");
  });
});
