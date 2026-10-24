// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Tablets, { downloadName } from "./tablets";

afterEach(cleanup);

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
  it("offers the four Watchtowers by name and draws each", () => {
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
      ).toEqual(["Earth", "Air", "Water", "Fire"]);
      fireEvent.click(screen.getByRole("option", { name }));
      const letters = drawn(container);
      expect(letters, name).toHaveLength(156);
      expect(letters.slice(0, 4).join(""), name).toBe(first);
    }
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
    const shown = { alt: false, reversed: true, showSquares: false };
    expect(downloadName("enochian-fire-tablet-dee", shown)).toBe(
      "enochian-fire-tablet-dee",
    );
    expect(
      downloadName("enochian-fire-tablet-dee", {
        alt: true,
        reversed: false,
        showSquares: true,
      }),
    ).toBe("enochian-fire-tablet-dee-second-letters-plain-differences");
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

  it("outlines the squares where the sources differ, and explains one", () => {
    const { container } = render(<Tablets />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Tablet" }));
    fireEvent.click(screen.getByRole("option", { name: "Water" }));
    const outlined = () => container.querySelectorAll("[data-square]");
    expect(outlined()).toHaveLength(0);
    fireEvent.click(
      screen.getByRole("switch", { name: "Show where the sources differ" }),
    );
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
    fireEvent.click(
      screen.getByRole("switch", { name: "Show where the sources differ" }),
    );
    const levels = [...container.querySelectorAll("h2, h3, h4")].map(
      (heading) => Number(heading.tagName[1]),
    );
    expect(levels[0]).toBe(2);
    for (let i = 1; i < levels.length; i++)
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    expect(
      container
        .querySelector("#tablet-squares")
        ?.closest("section")
        ?.parentElement?.querySelector("h2")?.textContent,
    ).toBe("The Earth tablet");
  });

  it("offers no image link while the outlines are drawn", () => {
    render(<Tablets />);
    expect(
      screen.getAllByRole("link", { name: "Open SVG image link" }).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("switch", { name: "Show where the sources differ" }),
    );
    expect(
      screen.queryAllByRole("link", { name: "Open SVG image link" }),
    ).toHaveLength(0);
    expect(
      screen.getByText("No image link while differences are shown."),
    ).toBeTruthy();
  });
});
