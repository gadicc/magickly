// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dictionary from "./dictionary";

const PATH = "/enochian/dictionary";

beforeEach(() => {
  window.history.replaceState(null, "", PATH);
  // jsdom lays nothing out, so it has no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// An open sheet hides the rest of the page from assistive technology.
const latinBox = () => screen.getByRole("combobox", { hidden: true });
const optionWords = () =>
  screen
    .getAllByRole("option")
    .map((option) => option.querySelector(".dict-word")?.textContent ?? null);
const type = (text: string) =>
  fireEvent.change(latinBox(), { target: { value: text } });

describe("the dictionary page (plan 074)", () => {
  it("searches English and groups the results", async () => {
    render(<Dictionary uses={{ OLPIRT: 1 }} />);
    type("light");
    await waitFor(() => expect(screen.getByText("Means “light”")).toBeTruthy());
    expect(optionWords().slice(0, 2)).toEqual(["OLPIRT", "OLPRT"]);
    expect(screen.getByText("Meanings that mention “light”")).toBeTruthy();
    // The matched word is bold in the row.
    const first = screen.getAllByRole("option")[0];
    expect(first.querySelector("b")?.textContent).toBe("LIGHT");
    // Both boxes hold the one query.
    expect(screen.getByLabelText("Enochian, right to left")).toHaveProperty(
      "value",
      "light",
    );
  });

  it("caps a long group and shows the rest on request", async () => {
    render(<Dictionary uses={{}} />);
    type("light");
    const more = await screen.findByText(/^Show all \d+$/);
    const before = screen.getAllByRole("option").length;
    fireEvent.click(more);
    expect(screen.getAllByRole("option").length).toBeGreaterThan(before);
    expect(screen.queryByText(/^Show all \d+$/)).toBeNull();
  });

  it("leads with spellings for an Enochian word, pinned first", async () => {
    render(<Dictionary uses={{}} />);
    type("ol");
    await waitFor(() => expect(screen.getByText("Enochian word")).toBeTruthy());
    expect(optionWords()[0]).toBe("OL");
    expect(screen.getByText("Spelled with “ol”")).toBeTruthy();
    expect(screen.queryByText("Means “ol”")).toBeNull();
  });

  it("says how many words it found, and when it found none", async () => {
    const { container } = render(<Dictionary uses={{}} />);
    type("(");
    await waitFor(() =>
      expect(screen.getByText("Nothing found for “(”.")).toBeTruthy(),
    );
    type("light");
    await waitFor(() =>
      expect(
        container.querySelector('[aria-live="polite"]')?.textContent,
      ).toMatch(/^\d+ words found$/),
    );
  });

  it("keeps the query in the URL without a history entry per keystroke", async () => {
    vi.useFakeTimers();
    render(<Dictionary uses={{}} />);
    const length = window.history.length;
    type("light");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(window.location.search).toBe("?q=light");
    expect(window.history.length).toBe(length);
  });

  it("reads the query and word from a shared link", async () => {
    window.history.replaceState(null, "", `${PATH}?q=power&w=LONSHI`);
    render(<Dictionary uses={{}} />);
    await waitFor(() => expect(latinBox()).toHaveProperty("value", "power"));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "LONSHI" })).toBeTruthy();
  });

  it("opens a word as a history entry, and Back closes it", async () => {
    render(<Dictionary uses={{}} />);
    type("light");
    const length = window.history.length;
    fireEvent.click((await screen.findAllByRole("option"))[1]);
    expect(new URLSearchParams(window.location.search).get("w")).toBe("OLPRT");
    expect(window.history.length).toBe(length + 1);
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "OLPRT" })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(new URLSearchParams(window.location.search).get("w")).toBeNull();
  });

  it("closes a shared word without leaving the page", async () => {
    window.history.replaceState(null, "", `${PATH}?w=OLPRT`);
    const length = window.history.length;
    render(<Dictionary uses={{}} />);
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.pathname).toBe(PATH);
    expect(window.location.search).toBe("");
    expect(window.history.length).toBe(length);
  });

  it("moves through the results with the arrow keys and opens with Enter", async () => {
    render(<Dictionary uses={{}} />);
    type("light");
    await waitFor(() => expect(optionWords()[0]).toBe("OLPIRT"));
    fireEvent.keyDown(latinBox(), { key: "ArrowDown" });
    fireEvent.keyDown(latinBox(), { key: "ArrowDown" });
    const active = latinBox().getAttribute("aria-activedescendant");
    expect(document.getElementById(active ?? "")?.textContent).toContain(
      "OLPRT",
    );
    fireEvent.keyDown(latinBox(), { key: "Enter" });
    expect(new URLSearchParams(window.location.search).get("w")).toBe("OLPRT");
  });
});

describe("the Enochian keypad (plan 074, decisions 2 and 4)", () => {
  const enochianBox = () =>
    screen.getByLabelText("Enochian, right to left") as HTMLInputElement;
  const key = (name: string) =>
    screen.getByRole("button", { name: new RegExp(`^${name},`) });

  it("opens on the Enochian box and types at its caret, keeping focus", () => {
    render(<Dictionary uses={{}} />);
    expect(
      screen.queryByRole("group", { name: "Enochian letters" }),
    ).toBeNull();
    const box = enochianBox();
    act(() => box.focus());
    expect(
      screen.getByRole("group", { name: "Enochian letters" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /, / })).toHaveLength(21);
    // Pressing a key must not take focus from the box.
    const pressed = fireEvent.mouseDown(key("Med"));
    expect(pressed).toBe(false);
    fireEvent.click(key("Med"));
    fireEvent.click(key("Ur"));
    expect(box.value).toBe("OL");
    // Type before the L, then delete it again.
    box.setSelectionRange(1, 1);
    fireEvent.click(key("Un"));
    expect(box.value).toBe("OAL");
    expect(box.selectionStart).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Delete a letter" }));
    expect(box.value).toBe("OL");
    expect(document.activeElement).toBe(box);
  });

  it("moves the list down on a wide screen rather than covering it", () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("min-width"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      render(<Dictionary uses={{}} />);
      act(() => enochianBox().focus());
      const keypad = screen.getByRole("group", { name: "Enochian letters" });
      // Laid out in the page, not floated over the first matches.
      expect(getComputedStyle(keypad).position).toBe("static");
      expect(keypad.closest(".dict-search")).toBeTruthy();
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it("closes on Done, on Escape and when the box loses focus", () => {
    render(<Dictionary uses={{}} />);
    const keypad = () =>
      screen.queryByRole("group", { name: "Enochian letters" });
    act(() => enochianBox().focus());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(keypad()).toBeNull();
    act(() => enochianBox().focus());
    fireEvent.keyDown(enochianBox(), { key: "Escape" });
    expect(keypad()).toBeNull();
    act(() => enochianBox().blur());
    act(() => enochianBox().focus());
    expect(keypad()).toBeTruthy();
    act(() => enochianBox().blur());
    expect(keypad()).toBeNull();
  });

  it("takes the word typed as a spelling search", async () => {
    render(<Dictionary uses={{}} />);
    act(() => enochianBox().focus());
    fireEvent.click(key("Med"));
    fireEvent.click(key("Ur"));
    await waitFor(() => expect(optionWords()[0]).toBe("OL"));
  });
});

describe("In the Keys (plan 074, decision 9)", () => {
  it("fetches the uses once and links the first to its Key", async () => {
    const uses = {
      OLPIRT: [
        { key: 18, row: 40, english: "light,", before: "the", after: "of men" },
        { key: 3, row: 2, english: "light", before: "", after: "" },
      ],
    };
    const fetch = vi.fn(async () => Response.json(uses));
    vi.stubGlobal("fetch", fetch);
    window.history.replaceState(null, "", `${PATH}?w=OLPIRT`);
    render(<Dictionary uses={{}} />);
    const sheet = await screen.findByRole("dialog");
    const link = await within(sheet).findByRole("link", { name: "Key 18" });
    expect(link.getAttribute("href")).toBe("/enochian/keys#key-18-word-40");
    expect(within(sheet).getByText("light,").tagName).toBe("B");
    fireEvent.click(within(sheet).getByRole("button", { name: "and 1 more" }));
    expect(within(sheet).getByRole("link", { name: "Key 3" })).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe("what the review of 10 November 2026 found (plan 074)", () => {
  const sheetClose = async () => {
    const sheet = await screen.findByRole("dialog");
    return within(sheet).getByRole("button", { name: "Close" });
  };
  const params = () => new URLSearchParams(window.location.search);

  it("keeps a query typed just before a word opened, when it closes", async () => {
    render(<Dictionary uses={{}} />);
    type("light");
    // Within the URL's pause: the query is written before the push.
    fireEvent.click((await screen.findAllByRole("option"))[1]);
    fireEvent.click(await sheetClose());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(latinBox()).toHaveProperty("value", "light");
    expect(params().get("q")).toBe("light");
  });

  it("keeps a query typed while a word was open, when it closes", async () => {
    render(<Dictionary uses={{}} />);
    type("light");
    fireEvent.click((await screen.findAllByRole("option"))[1]);
    await screen.findByRole("dialog");
    type("fire");
    fireEvent.click(await sheetClose());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(params().get("q")).toBe("fire"));
    expect(latinBox()).toHaveProperty("value", "fire");
  });

  it("does not leave the page on a double close", async () => {
    render(<Dictionary uses={{}} />);
    type("light");
    fireEvent.click((await screen.findAllByRole("option"))[1]);
    const close = await sheetClose();
    fireEvent.click(close);
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(window.location.pathname).toBe(PATH);
  });

  it("closes a word opened from a shared word's link in one go", async () => {
    window.history.replaceState(null, "", `${PATH}?w=OLPRT`);
    render(<Dictionary uses={{}} />);
    await screen.findByRole("dialog");
    type("power");
    // The sheet is modal; a word opens from the list behind it as on desktop.
    fireEvent.keyDown(latinBox(), { key: "ArrowDown" });
    fireEvent.keyDown(latinBox(), { key: "Enter" });
    await waitFor(() => expect(params().get("w")).not.toBe("OLPRT"));
    fireEvent.click(await sheetClose());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(params().get("w")).toBeNull();
  });

  it("ignores a word the dictionary does not have", async () => {
    window.history.replaceState(null, "", `${PATH}?w=constructor`);
    render(<Dictionary uses={{}} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows all of a group from the keyboard", async () => {
    render(<Dictionary uses={{}} />);
    type("light");
    await screen.findByText(/^Show all \d+$/);
    // Two meanings, then 30 mentions, then "Show all".
    for (let i = 0; i < 33; i++)
      fireEvent.keyDown(latinBox(), { key: "ArrowDown" });
    fireEvent.keyDown(latinBox(), { key: "Enter" });
    expect(screen.queryByText(/^Show all \d+$/)).toBeNull();
  });

  it("puts the entry in the pane on a wide screen", async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("min-width"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    window.history.replaceState(null, "", `${PATH}?w=OLPRT`);
    render(<Dictionary uses={{}} />);
    expect(await screen.findByRole("heading", { name: "OLPRT" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    window.matchMedia = matchMedia;
  });

  it("separates a meaning from its source for screen readers", () => {
    render(<Dictionary uses={{}} />);
    const olprt = screen
      .getAllByRole("option")
      .find((one) => one.querySelector(".dict-word")?.textContent === "OLPRT");
    expect(olprt?.querySelector(".dict-meaning")?.textContent).toBe(
      "light EMPM",
    );
  });
});
