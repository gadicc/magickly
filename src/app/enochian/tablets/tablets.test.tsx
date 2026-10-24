// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Tablets from "./tablets";

afterEach(cleanup);

/** The tablet the page draws: its 156 letters, top row first. */
const drawn = (container: HTMLElement) => {
  const page = [...container.querySelectorAll("svg")].find(
    (svg) => svg.getAttribute("viewBox") === "-105 0 210 297",
  );
  return [...(page?.querySelectorAll("text") ?? [])].map(
    (text) => text.textContent,
  );
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
      "Dee's, 1584",
      "The Golden Dawn's",
      "Squares with two letters",
      "The Tablet of Union",
    ])
      expect(screen.getByRole("heading", { name })).toBeTruthy();
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
    expect(outlined()).toHaveLength(23);
    const list = screen.getByRole("list", {
      name: "Squares where the sources differ",
    });
    expect(list.querySelectorAll("button")).toHaveLength(23);
    // From the list, by keyboard or pointer.
    const square = screen.getByRole("button", { name: "Row 5, square 12" });
    fireEvent.click(square);
    expect(square.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("y and l over N and h")).toBeTruthy();
    // Only a one-line summary is announced; the note is outside it.
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe(
      "Row 5, square 12. Regardie, 1940: y and l over N and h. The Equinox, 1912: N, reversed. Greer's edition: N, reversed. Dee's record, 1584: N, reversed; first written y and l; high doubt. Raphael's table, 1587: n, reversed; medium doubt",
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
