// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COPIED_FOR } from "./RowDetail";
import RowsTable, { type RowsTableRow } from "./RowsTable";

const ROWS: RowsTableRow[] = [
  {
    key: "keter",
    cells: ["Crown"],
    json: { id: "keter", name: { en: "Crown", he: "כתר" } },
    entity: "/kabbalah/sephirah/keter",
  },
  {
    key: "1=10",
    cells: ["Zelator"],
    json: { id: "1=10", name: "Zelator" },
  },
];

const table = () =>
  render(
    <RowsTable
      keyHeader="id"
      headers={["name"]}
      rows={ROWS}
      label="The rows of a table"
    />,
  );

const toggle = (key: string) =>
  screen.getByRole("button", { name: new RegExp(`${key} as JSON`) });

beforeEach(() => window.history.replaceState(null, "", "/open-source/data/x"));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a table's rows (plan 080, decision 4)", () => {
  it("names each row by its key in a row header", () => {
    table();
    const header = screen.getByRole("rowheader", { name: /keter/ });
    expect(header.tagName).toBe("TH");
    expect(header.getAttribute("scope")).toBe("row");
    expect(document.getElementById("keter")?.tagName).toBe("TR");
  });

  it("opens a row's detail under it, and says so", () => {
    table();
    const button = toggle("keter");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    const detail = document.getElementById(
      button.getAttribute("aria-controls") as string,
    );
    expect(detail?.hidden).toBe(true);
    fireEvent.click(button);
    expect(toggle("keter").getAttribute("aria-expanded")).toBe("true");
    expect(detail?.hidden).toBe(false);
    // The viewer draws the row's JSON.
    expect(detail?.textContent).toContain('"Crown"');
    expect(detail?.textContent).toContain('"כתר"');
    fireEvent.click(toggle("keter"));
    expect(detail?.hidden).toBe(true);
  });

  it("links the row, and its page where it has one", () => {
    table();
    fireEvent.click(toggle("keter"));
    fireEvent.click(toggle("1=10"));
    const links = screen.getAllByRole("link", { name: "Link to row" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#keter",
      "#1=10",
    ]);
    const pages = screen.getAllByRole("link", { name: "Its page" });
    expect(pages.map((link) => link.getAttribute("href"))).toEqual([
      "/kabbalah/sephirah/keter",
    ]);
  });

  it("copies the row's JSON, then reads Copy JSON again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    table();
    fireEvent.click(toggle("keter"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
    });
    expect(writeText).toHaveBeenCalledWith(
      JSON.stringify(ROWS[0].json, null, 2),
    );
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(COPIED_FOR);
    });
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeTruthy();
  });

  it("says when the browser refuses the clipboard, in a region already there", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("denied");
        }),
      },
    });
    table();
    fireEvent.click(toggle("keter"));
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
    });
    expect(status.textContent).toBe("The browser refused the clipboard.");
  });

  it("marks the row the URL names, however the URL came to name it", async () => {
    window.history.replaceState(null, "", "/open-source/data/x#keter");
    table();
    const current = () =>
      document.querySelector('[aria-current="location"]')?.id;
    await waitFor(() => expect(current()).toBe("keter"));
    // A plain link on the page.
    window.history.pushState(null, "", "#1=10");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => expect(current()).toBe("1=10"));
    // The router's own navigation, which raises no event: a click does.
    window.history.pushState(null, "", "#keter");
    fireEvent.click(document.body);
    await waitFor(() => expect(current()).toBe("keter"));
    window.history.pushState(null, "", "#");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(current()).toBeUndefined());
  });
});
