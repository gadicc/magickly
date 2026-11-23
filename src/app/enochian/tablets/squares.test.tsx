// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { tabletPyramids } from "magick-data/enochian/tabletPyramids";
import tablets, { tabletVersion } from "magick-data/enochian/tablets";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";
import {
  imageLinkNote,
  imageLinkOffered,
} from "../../../../tests/exportControls";
import { LOADED_TEST_TIMEOUT } from "../../../../tests/loadBudget";
import { tabletNameLinks } from "./nameLinks";
import Tablets from "./tablets";

// Each test renders the tablets' page with every name (names.test.tsx).
vi.setConfig({
  testTimeout: LOADED_TEST_TIMEOUT,
  hookTimeout: LOADED_TEST_TIMEOUT,
});

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

/** A square's ground on a Watchtower's grid, by row and column from 0. */
const squareOn = (container: HTMLElement, row: number, column: number) =>
  container
    .querySelector('svg[viewBox="0 0 244 264"]')
    ?.querySelector(
      `rect[x="${column * 20 + 2}"][y="${row * 20 + 2}"]`,
    ) as Element;

/** A square's ground on the Tablet of Union. */
const unionSquare = (container: HTMLElement, row: number, column: number) =>
  container
    .querySelector('svg[viewBox="0 0 124 104"]')
    ?.querySelector(
      `rect[x="${column * 20 + 12}"][y="${row * 20 + 12}"]`,
    ) as Element;

const openSquares = () =>
  fireEvent.click(screen.getByRole("tab", { name: "Squares" }));

const panel = () => screen.getByRole("tabpanel");

/** The detail's heading, if a square is shown. */
const detailHeading = () =>
  within(panel()).queryByRole("heading", { level: 3 });

/** The four sides in words. */
const sides = (container: HTMLElement) =>
  [...(container.querySelector("[data-sides]")?.children ?? [])].map(
    (item) => item.textContent,
  );

const live = (container: HTMLElement) =>
  container.querySelector('[role="tabpanel"] [aria-live="polite"]')
    ?.textContent;

const choose = (combobox: string, name: RegExp | string) => {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: combobox }));
  fireEvent.click(screen.getByRole("option", { name }));
};

/** Chooses a square with the picker, counting from 1. */
const pick = (row: number, square: number) => {
  fireEvent.change(screen.getByRole("combobox", { name: "Row" }), {
    target: { value: String(row - 1) },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Square" }), {
    target: { value: String(square - 1) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
};

describe("/enochian/tablets' Squares tab", () => {
  it("is a third tab, which the URL names and restores", () => {
    render(<Tablets links={LINKS} />);
    expect(screen.getAllByRole("tab").map((each) => each.textContent)).toEqual([
      "Names",
      "Differences",
      "Squares",
    ]);
    openSquares();
    expect(
      screen
        .getByRole("tab", { name: "Squares" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(panel().getAttribute("aria-labelledby")).toBe("tablet-tab-squares");
    expect(window.location.search).toBe("?tab=squares");
    expect(
      screen.getByRole("heading", { level: 2, name: "Squares as pyramids" }),
    ).toBeTruthy();
    expect(detailHeading()).toBeNull();
    // Names again leaves the tab out, as the default.
    fireEvent.click(screen.getByRole("tab", { name: "Names" }));
    expect(window.location.search).toBe("");
    cleanup();

    window.history.replaceState(
      null,
      "",
      `${PAGE}?tablet=air&tab=squares&square=3,1`,
    );
    const { container } = render(<Tablets links={LINKS} />);
    expect(
      screen
        .getByRole("tab", { name: "Squares" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(detailHeading()?.textContent).toBe("Row 3, square 1");
    expect(container.querySelector('[data-square="2,0"]')).toBeTruthy();
  });

  it("keeps the tab and square as other choices change, and lets the square go with the tablet", () => {
    render(<Tablets links={LINKS} />);
    openSquares();
    pick(3, 1);
    expect(window.location.search).toBe("?tab=squares&square=3,1");
    choose("Version", "The Equinox's");
    expect(window.location.search).toBe(
      "?tab=squares&square=3,1&version=equinox",
    );
    expect(detailHeading()?.textContent).toBe("Row 3, square 1");
    choose("Tablet", "Water");
    expect(window.location.search).toBe(
      "?tab=squares&version=equinox&tablet=water",
    );
    expect(detailHeading()).toBeNull();
  });

  it("writes the square only while the Squares tab is open", () => {
    render(<Tablets links={LINKS} />);
    openSquares();
    pick(3, 1);
    expect(window.location.search).toBe("?tab=squares&square=3,1");
    fireEvent.click(screen.getByRole("tab", { name: "Differences" }));
    // The address Share sends.
    expect(window.location.href).toBe(
      `${window.location.origin}${PAGE}?tab=differences`,
    );
    // Kept for the Squares tab, and written again there.
    openSquares();
    expect(window.location.search).toBe("?tab=squares&square=3,1");
    expect(detailHeading()?.textContent).toBe("Row 3, square 1");
  });

  it("keeps the tab and the square in the address, which Share sends", () => {
    render(<Tablets links={LINKS} />);
    openSquares();
    pick(7, 6);
    expect(window.location.href).toBe(
      `${window.location.origin}${PAGE}?tab=squares&square=7,6`,
    );
  });

  it("follows a URL changed under it, and keeps the tab where it names none", () => {
    render(<Tablets links={LINKS} />);
    const visit = (search: string) =>
      act(() => {
        window.history.replaceState(null, "", `${PAGE}${search}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
    visit("?tab=squares&square=1,1");
    expect(detailHeading()?.textContent).toBe("Row 1, square 1");
    visit("?tablet=fire");
    expect(
      screen
        .getByRole("tab", { name: "Squares" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(detailHeading()).toBeNull();
  });
});

describe("/enochian/tablets' squares, tapped", () => {
  it("opens a square's pyramid in the Squares tab, and lets it go on a second tap", async () => {
    const scrollIntoView = vi.fn();
    const own = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    onTestFinished(() => {
      Element.prototype.scrollIntoView = own;
    });
    const { container } = render(<Tablets links={LINKS} />);
    openSquares();
    fireEvent.click(squareOn(container, 2, 0));
    expect(detailHeading()?.textContent).toBe("Row 3, square 1");
    expect(window.location.search).toBe("?tab=squares&square=3,1");
    expect(live(container)).toBe(
      "Row 3, square 1: A servient square of Air of Earth: its column under Vau of the Name, its rank under He",
    );
    expect(container.querySelector('[data-square="2,0"]')).toBeTruthy();
    expect(container.querySelector('[data-pyramid="2,0"]')).toBeTruthy();
    // Brought into view, and the focus left where it was.
    expect(scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
    // The image link waits, and the download says the square.
    expect(imageLinkOffered()).toBe(false);
    expect(await imageLinkNote()).toBe(
      "No image link while a square is shown.",
    );
    // The outlined square, tapped again, lets it go.
    fireEvent.click(container.querySelector('[data-square="2,0"]') as Element);
    expect(detailHeading()).toBeNull();
    expect(window.location.search).toBe("?tab=squares");
    expect(live(container)).toBe("");
  });

  it("keeps the Names tab's tap: a square's name pinned, no pyramid", () => {
    const { container } = render(<Tablets links={LINKS} />);
    fireEvent.click(squareOn(container, 2, 0));
    expect(container.querySelector("[data-pyramid-detail]")).toBeNull();
    expect(
      screen
        .getAllByRole("button", { name: /^Aira, A servient angel$/ })[0]
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(window.location.search).toBe("");
  });

  it("opens the Tablet of Union's squares", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=union`);
    const { container } = render(<Tablets links={LINKS} />);
    openSquares();
    fireEvent.click(unionSquare(container, 0, 0));
    expect(detailHeading()?.textContent).toBe("Row 1, square 1");
    expect(window.location.search).toBe("?tablet=union&tab=squares&square=1,1");
    expect(panel().textContent).toContain(
      "On the Tablet of Union, in the line of Air, column 1",
    );
    expect(sides(container)).toEqual([
      "Left, side 1: Spirit, with Ace of Swords",
      "Top, side 2: Spirit",
      "Right, side 3: Air",
      "Bottom, side 4: Spirit",
    ]);
    // No god or sphinx off the servient squares.
    expect(container.querySelector("[data-coptic]")).toBeNull();
    expect(container.querySelector("[data-sphinx]")).toBeNull();
  });
});

describe("/enochian/tablets' square picker", () => {
  it("chooses a square by row and square, and takes the focus to its detail", () => {
    render(<Tablets links={LINKS} />);
    openSquares();
    const rows = within(screen.getByRole("combobox", { name: "Row" }))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(rows).toHaveLength(13);
    expect(
      within(screen.getByRole("combobox", { name: "Square" })).getAllByRole(
        "option",
      ),
    ).toHaveLength(12);
    pick(7, 6);
    const heading = detailHeading();
    expect(heading?.textContent).toBe("Row 7, square 6");
    expect(document.activeElement).toBe(heading);
    // The picker shows a square chosen on the tablet.
    cleanup();
    const { container } = render(<Tablets links={LINKS} />);
    openSquares();
    fireEvent.click(squareOn(container, 11, 9));
    expect(
      (screen.getByRole("combobox", { name: "Row" }) as HTMLSelectElement)
        .value,
    ).toBe("11");
    expect(
      (screen.getByRole("combobox", { name: "Square" }) as HTMLSelectElement)
        .value,
    ).toBe("9");
  });

  it("never offers a square off a new tablet's grid", () => {
    render(<Tablets links={LINKS} />);
    openSquares();
    pick(13, 12);
    expect(window.location.search).toBe("?tab=squares&square=13,12");
    choose("Tablet", "Tablet of Union");
    const select = (name: string) =>
      (screen.getByRole("combobox", { name }) as HTMLSelectElement).value;
    expect([select("Row"), select("Square")]).toEqual(["0", "0"]);
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(window.location.search).toBe("?tab=squares&tablet=union&square=1,1");
    expect(detailHeading()?.textContent).toBe("Row 1, square 1");
  });

  it("says a square chosen on the tablet aloud, and one chosen by keyboard by its heading only", () => {
    const { container } = render(<Tablets links={LINKS} />);
    openSquares();
    fireEvent.click(squareOn(container, 2, 0));
    expect(live(container)).toMatch(/^Row 3, square 1: /);
    pick(7, 6);
    expect(document.activeElement).toBe(detailHeading());
    expect(live(container)).toBe("");
  });

  it("offers the Union's four rows and five squares", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=union&tab=squares`);
    render(<Tablets links={LINKS} />);
    expect(
      within(screen.getByRole("combobox", { name: "Row" })).getAllByRole(
        "option",
      ),
    ).toHaveLength(4);
    expect(
      within(screen.getByRole("combobox", { name: "Square" })).getAllByRole(
        "option",
      ),
    ).toHaveLength(5);
  });
});

describe("/enochian/tablets' names, to their squares", () => {
  it("lists a chosen name's squares, which open the Squares tab with the focus on the detail", () => {
    const { container } = render(<Tablets links={LINKS} />);
    const laidrom = screen
      .getAllByRole("button", { name: /^Laidrom/ })
      .filter((button) => button.dataset.nameId)[0] as HTMLElement;
    fireEvent.click(laidrom);
    const item = laidrom.closest("li") as HTMLElement;
    const links = within(item)
      .getAllByRole("link")
      .filter((link) => /^Row \d+, square \d+$/.test(link.textContent ?? ""));
    // In reading order: Laidrom reads leftward.
    expect(links.map((link) => link.textContent)).toEqual([
      "Row 7, square 7",
      "Row 7, square 6",
      "Row 7, square 5",
      "Row 7, square 4",
      "Row 7, square 3",
      "Row 7, square 2",
      "Row 7, square 1",
    ]);
    // A link a reader can open elsewhere, at the same view.
    expect(links[2]?.getAttribute("href")).toBe("?tab=squares&square=7,5");
    fireEvent.click(links[2] as HTMLElement);
    expect(
      screen
        .getByRole("tab", { name: "Squares" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    const heading = detailHeading();
    expect(heading?.textContent).toBe("Row 7, square 5");
    expect(document.activeElement).toBe(heading);
    expect(window.location.search).toBe("?tab=squares&square=7,5");
    expect(container.querySelector('[data-square="6,4"]')).toBeTruthy();
  });

  it("adds a history entry, so Back returns to the name", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    render(<Tablets links={LINKS} />);
    const laidrom = () =>
      screen
        .getAllByRole("button", { name: /^Laidrom/ })
        .filter((button) => button.dataset.nameId)[0] as HTMLElement;
    fireEvent.click(laidrom());
    fireEvent.click(
      within(laidrom().closest("li") as HTMLElement).getByRole("link", {
        name: "Row 7, square 5",
      }),
    );
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("?tab=squares&square=7,5");
    await act(async () => {
      const back = new Promise((resolve) =>
        window.addEventListener("popstate", resolve, { once: true }),
      );
      window.history.back();
      await back;
    });
    expect(window.location.search).toBe("");
    expect(
      screen.getByRole("tab", { name: "Names" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(laidrom().getAttribute("aria-pressed")).toBe("true");
    // And Forward to the square again.
    await act(async () => {
      const forward = new Promise((resolve) =>
        window.addEventListener("popstate", resolve, { once: true }),
      );
      window.history.forward();
      await forward;
    });
    expect(detailHeading()?.textContent).toBe("Row 7, square 5");
  });

  it("offers none in Dee's version, which has no pyramids", () => {
    window.history.replaceState(null, "", `${PAGE}?version=dee`);
    render(<Tablets links={LINKS} />);
    const button = screen
      .getAllByRole("button", { name: /^Laidrom/ })
      .filter((each) => each.dataset.nameId)[0] as HTMLElement;
    fireEvent.click(button);
    expect(screen.queryByText("Its squares as pyramids:")).toBeNull();
  });
});

describe("/enochian/tablets' pyramids in Dee's and Raphael's versions", () => {
  it("says their tables carry no elements, and shows no detail", () => {
    for (const version of ["dee", "raphael"]) {
      window.history.replaceState(
        null,
        "",
        `${PAGE}?version=${version}&tab=squares&square=3,1`,
      );
      // The square is dropped from the URL's choice.
      const { container } = render(<Tablets links={LINKS} />);
      expect(
        container.querySelector("[data-no-pyramids]")?.textContent,
      ).toMatch(/^Dee's and Raphael's tables carry no elements/);
      expect(screen.queryByRole("combobox", { name: "Row" })).toBeNull();
      expect(detailHeading()).toBeNull();
      fireEvent.click(squareOn(container, 2, 0));
      expect(detailHeading()).toBeNull();
      expect(container.querySelector("[data-square]")).toBeNull();
      // And a way to the Golden Dawn's.
      fireEvent.click(
        screen.getByRole("button", { name: "Show the Golden Dawn's version" }),
      );
      expect(window.location.search).toBe("?tab=squares");
      expect(screen.getByRole("combobox", { name: "Row" })).toBeTruthy();
      cleanup();
    }
  });

  it("lets a square go when the version changes to one without", () => {
    render(<Tablets links={LINKS} />);
    openSquares();
    pick(3, 1);
    choose("Version", "Dee's, 1584");
    expect(window.location.search).toBe("?tab=squares&version=dee");
    choose("Version", /^The Golden Dawn's/);
    expect(detailHeading()).toBeNull();
  });
});

/** The first servient square, of the four Watchtowers, with a god. */
function found(god: string) {
  for (const tablet of ["earth", "air", "water", "fire"] as const) {
    const view = tabletVersion(tablets[tablet], "gd");
    const square = view
      ? tabletPyramids(view).find((each) => each.godFormId === god)
      : undefined;
    if (square) return [tablet, square] as const;
  }
  throw new Error(`No square of ${god}`);
}

describe("/enochian/tablets' square detail", () => {
  /** Opens a square of a tablet's Squares tab, counting from 1. */
  const open = (search: string) => {
    window.history.replaceState(null, "", `${PAGE}?tab=squares&${search}`);
    return render(<Tablets links={LINKS} />).container;
  };

  it("gives a Great Cross square its block and sides, in words", () => {
    // Earth's Linea Spiritus Sancti, its first square: the block of He
    // final, Earth's own letter, so Taurus, the kerubic sign of Earth,
    // its first decan (Mercury's) and the Five of Pentacles.
    const container = open("square=7,1");
    expect(panel().textContent).toContain(
      "On the Great Cross, in a block of three squares under He final of the Name",
    );
    expect(sides(container)).toEqual([
      "Left, side 1: Earth, with decan 1 of Taurus and Five of Pentacles",
      "Top, side 2: Spirit",
      "Right, side 3: Air, with Mercury",
      "Bottom, side 4: Earth",
    ]);
    // The sign and the planet drawn as text, not emoji.
    const symbols = [
      ...(container.querySelectorAll("[data-pyramid] [data-side] text") ?? []),
    ].map((text) => text.textContent);
    expect(symbols).toEqual(["♉︎", "☿︎"]);
    // The letter on the flat top: the version's.
    expect(container.querySelector("[data-pyramid] > text")?.textContent).toBe(
      "M",
    );
    expect(
      within(panel()).getByRole("heading", { name: "The rule it follows" }),
    ).toBeTruthy();
    // The rule's witnesses, linked by leaf.
    expect(
      within(panel())
        .getAllByRole("link", { name: "p.285" })[0]
        ?.getAttribute("href"),
    ).toBe(
      "https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n277/mode/1up",
    );
    expect(
      within(panel())
        .getAllByRole("link", { name: "Plate IV" })[0]
        ?.getAttribute("href"),
    ).toBe(
      "https://archive.org/details/crowley-equinox_202110/The%20Equinox%20Vol.%201%2C%20No.%207/page/n242/mode/1up",
    );
  });

  it("gives a Calvary square its Sephirah and the dispute over the bar", () => {
    // The bar's leftmost square of Air of Earth: Binah in the Golden
    // Dawn's version, after vol. 4's diagram and vol. 1's badge.
    let container = open("square=2,1");
    expect(panel().textContent).toContain(
      "On the Calvary cross of Air of Earth",
    );
    expect(sides(container)).toEqual([
      "Left, side 1: Earth",
      "Top, side 2: Spirit",
      "Right, side 3: Air",
      "Bottom, side 4: white, with the Sephirah Binah (3), the Moon, Three of Swords, The High Priestess (trump 2), and the letter Gimel",
    ]);
    expect(panel().textContent).toContain("Its Sephirah is Binah (3).");
    expect(container.querySelector("[data-dispute]")?.textContent).toBe(
      "The order of the bar is disputed. This version follows vol. 4's diagram and vol. 1's badge; the Equinox's plates put Gevurah (5) here.",
    );
    cleanup();
    // Another bar square: Chesed here, Chochmah on the plates; vol. 4's
    // worked square is not this one, so it is not named.
    container = open("square=2,4");
    expect(container.querySelector("[data-dispute]")?.textContent).toBe(
      "The order of the bar is disputed. This version follows vol. 4's diagram and vol. 1's badge; the Equinox's plates put Chochmah (2) here.",
    );
    cleanup();
    // The O of OMEBB, the one square vol. 4 works out on a bar: Water
    // tablet, Water angle, the bar's leftmost square.
    container = open("tablet=water&square=2,8");
    expect(container.querySelector("[data-dispute]")?.textContent).toBe(
      "The order of the bar is disputed. This version follows vol. 4's diagram and vol. 1's badge; the Equinox's plates put Gevurah (5) here, and so does vol. 4's own worked example of this square, the O of OMEBB.",
    );
    expect(panel().textContent).toContain("Vol. 4 works the O of OMEBB");
    cleanup();
    // The Equinox's version takes its plates' order, and shows the other.
    container = open("version=equinox&square=2,1");
    expect(panel().textContent).toContain("Its Sephirah is Gevurah (5).");
    expect(container.querySelector("[data-dispute]")?.textContent).toBe(
      "The order of the bar is disputed. This version follows the Equinox's plates; vol. 4's diagram and vol. 1's badge put Binah (3) here.",
    );
    cleanup();
    // Where the bar crosses the column, and on the column, all agree.
    container = open("square=2,3");
    expect(container.querySelector("[data-dispute]")?.textContent).toBe(
      "The order of the bar is disputed, but every witness puts Tiferet (6) here, where the bar crosses the column.",
    );
    cleanup();
    container = open("square=1,3");
    expect(container.querySelector("[data-dispute]")?.textContent).toBe(
      "Every witness puts Keter (1) here: only the order of the bar is disputed.",
    );
    // Why, once, behind a disclosure, without saying again what the
    // square's sentence says; in the data's spellings.
    const why = container.querySelector("[data-dispute-why]") as HTMLElement;
    expect(why.tagName).toBe("DETAILS");
    expect(why.querySelector("summary")?.textContent).toBe(
      "Why the bar's order is disputed",
    );
    expect(why.textContent).toContain(
      "have Binah, Gevurah, Tiferet, Chesed and Chochmah from the left",
    );
    expect(
      why.textContent?.replace("Why the bar's order is disputed", ""),
    ).not.toMatch(/disputed|This version|follows its own/);
    const detail = panel().textContent ?? "";
    expect(detail.split("as the Order draws the Tree")).toHaveLength(2);
    expect(detail).not.toMatch(
      /\b(Kether|Geburah|Tiphareth|Chokmah|Malkuth)\b/,
    );
  });

  it("gives a Kerubic square its letter, court card and Kerub", () => {
    const container = open("square=1,1");
    expect(panel().textContent).toContain(
      "A Kerubic square of Air of Earth, under Vau of the Name",
    );
    expect(sides(container)).toEqual([
      "Left, side 1: Air, with Prince of Swords",
      "Top, side 2: Earth",
      "Right, side 3: Air, with the Man and Aquarius",
      "Bottom, side 4: Air",
    ]);
  });

  it("gives a servient square its angels, god and sphinx", () => {
    const container = open("square=3,1");
    expect(panel().textContent).toContain(
      "A servient square of Air of Earth: its column under Vau of the Name, its rank under He",
    );
    expect(sides(container)).toEqual([
      "Left, side 1: Earth, with Aquarius",
      "Top, side 2: Air, with The Star (trump 17)",
      "Right, side 3: Air, with Tristitia",
      "Bottom, side 4: Water, with the letter Tsadi",
    ]);
    const text = panel().textContent ?? "";
    expect(text).toContain(
      "Its angel is Aira: the servient name of its row, read from this square.",
    );
    expect(text).toContain(
      "Its great angel is Aaira, with A of the Tablet of Union before it.",
    );
    expect(text).toContain(
      "Air on two sides, Earth and Water on one each: the god is Tmoumathph, a Child of Horus.",
    );
    expect(text).toContain(
      "Tmoumathph's station in the Neophyte grade: An invisible station in the south-east, a Child of Horus.",
    );
    const coptic = container.querySelector("[data-coptic]");
    expect(coptic?.getAttribute("lang")).toBe("cop");
    expect(coptic?.textContent).toBe("Ϯⲙⲧⲙⲁⲑⲫ");
    // Our reading of the doubled element, labelled.
    expect(text).toContain(
      "That every other doubling follows the same reading is ours.",
    );
    expect(
      [...(container.querySelector("[data-sphinx]")?.children ?? [])].map(
        (item) => item.textContent,
      ),
    ).toEqual([
      "Head and neck, from the top side: the Man.",
      "Body and forelimbs, from the left and right sides: the Bull and the Man; the source does not say which gives which.",
      "Hind limbs and tail, from the bottom side: the Eagle.",
      "It is winged, since the Eagle or the Man is among its Kerubs.",
      "No tendency is stated: two of its sides are active and two passive.",
    ]);
    // The geomantic figure drawn as dots, the letter in Hebrew.
    expect(
      container.querySelectorAll('[data-pyramid] [data-side="3"] circle'),
    ).toHaveLength(7);
    expect(
      container.querySelector('[data-pyramid] [data-side="4"] text')
        ?.textContent,
    ).toBe("צ");
  });

  it("gives a god's sign, and vol. 3's reading where it differs", () => {
    // A servient square whose god is Sothis: Fire and Water two each.
    const [tablet, sothis] = found("sothis");
    const container = open(
      `tablet=${tablet}&square=${sothis.row + 1},${sothis.column + 1}`,
    );
    const text = panel().textContent ?? "";
    expect(text).toContain(
      "Two sides of Water and two of Fire: the god is Sothis.",
    );
    expect(text).toContain(
      "Vol. 3 differs: The Z documents make the Kerub of Water",
    );
    expect(container.querySelector("[data-coptic]")?.textContent).toBe("Ϣⲏⲱⲉⲅ");
    expect(text).toContain(
      "Our reading of the Coptic: The first letter is read as shai",
    );
    expect(
      within(panel()).getByRole("link", { name: "p.102" }).getAttribute("href"),
    ).toBe(
      "https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol3-1939/page/n94/mode/1up",
    );
    // Osiris carries the table's sign, sou.
    cleanup();
    const [other, osiris] = found("osiris");
    const again = open(
      `tablet=${other}&square=${osiris.row + 1},${osiris.column + 1}`,
    );
    expect(again.querySelector("[data-coptic]")?.textContent).toBe(
      "Ⲏϣⲱⲱⲣⲓ (ⲋ)",
    );
    expect(panel().textContent).toContain("The table adds ⲋ to the name");
    // The sign in the Coptic face, as the name is.
    const sou = again.querySelector("[data-sou]");
    expect(sou?.textContent).toBe("ⲋ");
    expect(sou?.getAttribute("lang")).toBe("cop");
    expect(sou?.className).toBe(
      again.querySelector("[data-coptic]")?.className,
    );
  });

  it("gives a sphinx its tendency where its sides lean one way", () => {
    const earth = tabletVersion(tablets.earth, "gd");
    const active = (element?: string) =>
      element === "fire" || element === "air";
    const male = earth
      ? tabletPyramids(earth).find(
          (each) =>
            each.region === "servient" &&
            each.sides.filter((side) => active(side.elementId)).length === 3,
        )
      : undefined;
    expect(male).toBeTruthy();
    const container = open(
      `square=${(male?.row ?? 0) + 1},${(male?.column ?? 0) + 1}`,
    );
    expect(container.querySelector("[data-sphinx]")?.textContent).toContain(
      "Its tendency is male: 3 of its sides are active, Fire or Air.",
    );
  });
});

describe("/enochian/tablets' pyramid symbols", () => {
  /** Each side's symbol's transform, sides 1 to 4. */
  const turns = (container: HTMLElement) =>
    [...container.querySelectorAll("[data-pyramid] [data-side] > g")].map(
      (group) =>
        /rotate\((-?\d+)\)/.exec(group.getAttribute("transform") ?? "")?.[1] ??
        "0",
    );
  const orientation = (container: HTMLElement) =>
    container.querySelector("[data-orientation] p")?.textContent;

  it("stands them upright, and turns them outward for the session", () => {
    window.history.replaceState(null, "", `${PAGE}?tab=squares&square=3,1`);
    const { container } = render(<Tablets links={LINKS} />);
    const svg = () => container.querySelector("[data-pyramid]");
    expect(svg()?.getAttribute("data-symbols")).toBe("upright");
    expect(turns(container)).toEqual(["0", "0", "0", "0"]);
    expect(orientation(container)).toBe(
      "Each side is drawn in its element's colour, with its symbol in the complementary colour, upright so that it can be read; the Order painted the symbols facing outward. The top holds the square's letter, a.",
    );
    // Cited to the page that says so.
    expect(
      within(container.querySelector("[data-orientation]") as HTMLElement)
        .getByRole("link", { name: "p.295" })
        .getAttribute("href"),
    ).toBe(
      "https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n287/mode/1up",
    );
    // A switch, by keyboard as by pointer.
    const outward = screen.getByRole("switch", {
      name: "Face the symbols outward, as the Order painted them",
    });
    expect(outward.tagName).toBe("INPUT");
    fireEvent.click(outward);
    expect(svg()?.getAttribute("data-symbols")).toBe("outward");
    expect(turns(container)).toEqual(["-90", "0", "90", "180"]);
    expect(orientation(container)).toBe(
      "Each side is drawn in its element's colour, with its symbol in the complementary colour, facing outward, as the Order painted them. The top holds the square's letter, a.",
    );
    // Kept for another square, and across the tabs.
    fireEvent.click(squareOn(container, 6, 0));
    expect(svg()?.getAttribute("data-symbols")).toBe("outward");
    fireEvent.click(screen.getByRole("tab", { name: "Names" }));
    openSquares();
    expect(svg()?.getAttribute("data-symbols")).toBe("outward");
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Face the symbols outward, as the Order painted them",
      }),
    );
    expect(svg()?.getAttribute("data-symbols")).toBe("upright");
  });
});
