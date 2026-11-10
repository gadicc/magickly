// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { EnochianKey } from "magick-data/enochian/keys";
import { afterEach, describe, expect, it } from "vitest";
import { pageKey } from "./keyPage";
import Keys from "./keys";

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
