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
