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
