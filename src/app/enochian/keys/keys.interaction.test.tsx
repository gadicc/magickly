// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { EnochianKey } from "magick-data/enochian/keys";
import { afterEach, describe, expect, it } from "vitest";
import { pageKey } from "./keyPage";
import Keys, { readAnchor } from "./keys";

afterEach(cleanup);

const KEY: EnochianKey = {
  key: 4,
  sources: [{ work: "casaubon1659", page: 109 }],
  checked: { works: [], covered: [], notCovered: ["x"] },
  rows: [
    { english: "I have set", readings: { casaubon1659: { word: "OTHIL" } } },
  ],
};

describe("the word panel", () => {
  it("opens on a word, says so politely, and closes on Escape", () => {
    const { container } = render(
      <Keys
        keys={[pageKey(KEY)]}
        aethyrs={[]}
        entries={{ entries: {}, parts: {} }}
      />,
    );
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Key 4" }));
    fireEvent.click(screen.getByRole("button", { name: "I have set" }));
    expect(live?.textContent).toBe("OTHIL: I have set. Escape closes.");
    expect(screen.getByText("Not in the dictionary.")).toBeTruthy();
    // Not a dialog: the page stays as it was around it.
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Not in the dictionary.")).toBeNull();
    expect(live?.textContent).toBe("");
  });
});

describe("links into the page (plan 074, decision 9)", () => {
  it("reads a link's hash", () => {
    expect(readAnchor("#key-7")).toEqual({ key: 7 });
    expect(readAnchor("#key-7-word-12")).toEqual({ key: 7, row: 12 });
    expect(readAnchor("#aethyr-3-word-4")).toEqual({
      key: 19,
      aethyr: 3,
      row: 4,
    });
    expect(readAnchor("#key-4-header")).toBeNull();
    expect(readAnchor("")).toBeNull();
  });

  it("opens the Key and selects the word a link names", () => {
    window.history.replaceState(null, "", "/enochian/keys#key-4-word-1");
    // jsdom lays nothing out.
    Element.prototype.scrollIntoView = () => {};
    const { container } = render(
      <Keys
        keys={[pageKey(KEY)]}
        aethyrs={[]}
        entries={{ entries: {}, parts: {} }}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: "Key 4" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "OTHIL: I have set. Escape closes.",
    );
    window.history.replaceState(null, "", "/");
  });
});
