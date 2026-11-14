// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dictionary from "./dictionary";

// The preview's chunk fails to load, as in an old tab after a deploy.
let tries = 0;
vi.mock("./SentencePreview", () => {
  tries++;
  throw new Error("Loading chunk SentencePreview failed");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const type = (text: string) =>
  fireEvent.change(screen.getByRole("combobox", { hidden: true }), {
    target: { value: text },
  });

describe("the translator's preview when its code fails to load", () => {
  it("shows nothing, and the dictionary goes on working", async () => {
    // React reports the caught error; it is expected here.
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.history.replaceState(null, "", "/enochian/dictionary");
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = render(<Dictionary uses={{}} />);
    type("the light of");
    await waitFor(() => expect(tries).toBeGreaterThan(0));
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: /^As a sentence/ }),
      ).toBeNull(),
    );
    expect(
      container.querySelector('[aria-live="polite"]')?.textContent,
    ).toMatch(/words found$/);
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    // The next query imports the chunk again, and still breaks nothing.
    const first = tries;
    type("the light of God");
    await waitFor(() => expect(tries).toBe(first + 1));
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: /^As a sentence/ }),
      ).toBeNull(),
    );
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
});
