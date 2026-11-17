// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dictionary from "./dictionary";
import { forgetUses, USES_URL } from "./InTheKeys";
import { forgetRelated, RELATED_URL } from "./Related";
import type { RelatedTable } from "./related/format";

const PATH = "/enochian/dictionary";

/** A made-up table: RNAH relates to the sun, and to light by OLPIRT. */
const TABLE: RelatedTable = {
  format: 1,
  recipe: "test",
  asked: 6,
  cutoff: 6,
  glossHash: "0",
  entries: 1,
  items: 2,
  glosses: [
    ["light", ["OLPIRT", ["OLPRT", "OLPRT"]]],
    ["sun", ["ROR"]],
  ],
  related: { RNAH: [1, 0] },
};

let requests: { url: string; init?: RequestInit }[] = [];

/**
 * Serves the related words (or fails them), and the uses: none, or
 * RNAH's one, held until `release` is called.
 */
function serve(how: "table" | "fail" = "table", holdUses = false) {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (String(url) === USES_URL) {
        if (!holdUses) return Response.json({});
        await held;
        return Response.json({
          RNAH: [{ key: 3, row: 7, english: "sunrise", before: "", after: "" }],
        });
      }
      if (how === "fail") return new Response("", { status: 503 });
      return Response.json(TABLE);
    }),
  );
  return release;
}

const relatedRequests = () => requests.filter((one) => one.url === RELATED_URL);
const params = () => new URLSearchParams(window.location.search);

beforeEach(() => {
  window.history.replaceState(null, "", PATH);
  Element.prototype.scrollIntoView = vi.fn();
  requests = [];
  forgetRelated();
  forgetUses();
  serve();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Related by meaning (plan 081, S11, step 2G)", () => {
  it("shows an entry's related words, marked as a machine's, once fetched", async () => {
    window.history.replaceState(null, "", `${PATH}?q=sunrise&w=RNAH`);
    render(<Dictionary uses={{}} />);
    const sheet = await screen.findByRole("dialog");
    await within(sheet).findByText("Related by meaning");
    const items = within(sheet).getAllByRole("listitem").slice(-2);
    expect(items.map((item) => item.textContent)).toEqual([
      "ROR ‘sun’",
      "OLPIRT, OLPRT ‘light’",
    ]);
    expect(
      within(sheet).getByText(
        "Suggested by a machine from the meanings, not reviewed.",
      ),
    ).toBeTruthy();
    // Fetched once, sending nothing of the search: no query, origin only.
    expect(relatedRequests()).toHaveLength(1);
    expect(relatedRequests()[0].init?.referrerPolicy).toBe("origin");
  });

  it("opens a related word's entry as any entry opens, and fetches no more", async () => {
    render(<Dictionary uses={{}} />);
    fireEvent.change(screen.getByRole("combobox", { hidden: true }), {
      target: { value: "sunrise" },
    });
    const row = await screen.findAllByRole("option");
    fireEvent.click(
      row.find((one) => one.textContent?.startsWith("RNAH")) ?? row[0],
    );
    await waitFor(() => expect(params().get("w")).toBe("RNAH"));
    const length = window.history.length;
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(
      await within(sheet).findByRole("button", { name: "OLPRT" }),
    );
    await waitFor(() => expect(params().get("w")).toBe("OLPRT"));
    // The word's history entry is replaced, as for any word opened after
    // the first, and the search is kept.
    expect(window.history.length).toBe(length);
    expect(params().get("q")).toBe("sunrise");
    const heading = await screen.findByRole("heading", {
      level: 2,
      name: "OLPRT",
    });
    expect(document.activeElement).toBe(heading);
    // OLPRT has no related words of its own: the part isn't shown.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText("Related by meaning")).toBeNull();
    expect(relatedRequests()).toHaveLength(1);
    // Closing goes back past the entries to the list.
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Close",
      }),
    );
    await waitFor(() => expect(params().get("w")).toBeNull());
  });

  it("waits for In the Keys, so neither part pushes the other down", async () => {
    const release = serve("table", true);
    window.history.replaceState(null, "", `${PATH}?w=RNAH`);
    render(<Dictionary uses={{}} />);
    const sheet = await screen.findByRole("dialog");
    await waitFor(() => expect(relatedRequests()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The related words are in, but the uses aren't: nothing yet.
    expect(within(sheet).queryByText("Related by meaning")).toBeNull();
    release();
    await within(sheet).findByText("Related by meaning");
    const keys = within(sheet).getByText("In the Keys");
    const related = within(sheet).getByText("Related by meaning");
    expect(
      keys.compareDocumentPosition(related) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("starts a word opened from the phone's sheet at its top", async () => {
    window.history.replaceState(null, "", `${PATH}?w=RNAH`);
    render(<Dictionary uses={{}} />);
    const sheet = await screen.findByRole("dialog");
    const scroll = sheet.querySelector(".entry-sheet-scroll") as HTMLElement;
    expect(scroll).toBeTruthy();
    scroll.scrollTop = 300;
    expect(scroll.scrollTop).toBe(300);
    fireEvent.click(await within(sheet).findByRole("button", { name: "ROR" }));
    await waitFor(() => expect(params().get("w")).toBe("ROR"));
    await within(sheet).findByRole("heading", { level: 2, name: "ROR" });
    expect(scroll.scrollTop).toBe(0);
  });

  it("shows nothing, and no error, when the table fails to load", async () => {
    serve("fail");
    window.history.replaceState(null, "", `${PATH}?w=RNAH`);
    render(<Dictionary uses={{}} />);
    const sheet = await screen.findByRole("dialog");
    await waitFor(() => expect(relatedRequests()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(within(sheet).queryByText("Related by meaning")).toBeNull();
    expect(within(sheet).getByRole("heading", { name: "RNAH" })).toBeTruthy();
  });
});
