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
import { USES_URL } from "../dictionary/InTheKeys";
import type { HintTable } from "./hints/format";
import { forgetHints, HINTS_URL } from "./hints/load";
import { buildKeysTable } from "./keysTable";
import { forgetTranslator } from "./load";
import { KEYS_TABLE_URL } from "./lookup";
import { lookupRuleNotes } from "./ruleNotes.server";
import Translator from "./translator";

// The AI reading's offer reads the session; these tests never sign in.
vi.mock("@/auth/client", () => ({
  useSession: () => ({ data: null, isPending: false }),
}));

const PATH = "/enochian/translate";
const TABLE = buildKeysTable();
const notes = lookupRuleNotes();

/**
 * A made-up hint table (the lazy load mocked): "dawn" and "daybreak"
 * to SUNRISE's RNAH; "could", a grammar word, which must never take one;
 * and "telephone" to a gloss the lookup doesn't have.
 */
const HINTS: Pick<HintTable, "hints"> = {
  hints: [
    ["sunrise", ["RNAH"], "dawn daybreak"],
    ["sun", ["ROR"], "could"],
    ["no such gloss of ours", ["RNAH"], "telephone"],
  ],
};

let requests: { url: string; init?: RequestInit }[] = [];
function serve() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (String(url) === KEYS_TABLE_URL) return Response.json(TABLE);
      if (String(url) === HINTS_URL) return Response.json(HINTS);
      if (String(url) === USES_URL) return Response.json({});
      return new Response("", { status: 404 });
    }),
  );
}

beforeEach(() => {
  window.history.replaceState(null, "", PATH);
  requests = [];
  forgetTranslator();
  forgetHints();
  serve();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The tiles, found by class: an open sheet hides the rest of the page
 * from the accessibility tree, and a closed one does until it has slid
 * away.
 */
const tiles = () => [
  ...document.querySelectorAll<HTMLElement>(".tr-tiles > .tr-tile"),
];
const gaps = () => tiles().filter((item) => item.classList.contains("tr-gap"));
const arrive = (hash: string) => {
  window.history.replaceState(null, "", `${PATH}${hash}`);
  return render(<Translator notes={notes} />);
};
const hintRequests = () => requests.filter((one) => one.url === HINTS_URL);

describe("a gap's hint (plan 081, S11)", () => {
  it("shows one hint beside the gap, marked as a suggestion", async () => {
    arrive("#q=dawn");
    await waitFor(() =>
      expect(gaps()[0]?.textContent).toContain("related: RNAH ‘sunrise’"),
    );
    const [gap] = gaps();
    // The gap stays a gap: no form in its place.
    expect(gap.querySelector(".tr-form")?.textContent).toBe("no form");
    expect(gap.textContent).toContain("suggested by meaning, not reviewed");
    expect(gap.textContent?.match(/related:/g)).toHaveLength(1);
  });

  it("fetches the table once, with the first result, gap or none, carrying nothing of the text", async () => {
    const view = arrive("#q=OL%20SONF%20VORSG");
    await waitFor(() =>
      expect(screen.getByText(/Reading as Enochian/)).toBeTruthy(),
    );
    // Enochian into English alone: no hint table.
    expect(hintRequests()).toEqual([]);
    view.unmount();
    // A result with no gap fetches it, so the fetch tells nothing of the
    // text.
    const next = arrive("#q=I%20reign%20over%20you");
    await waitFor(() => expect(tiles()).toHaveLength(3));
    await waitFor(() => expect(hintRequests()).toHaveLength(1));
    next.unmount();
    arrive("#q=the%20dawn%20and%20the%20daybreak");
    await waitFor(() =>
      expect(
        gaps().filter((gap) => gap.textContent?.includes("RNAH")),
      ).toHaveLength(2),
    );
    expect(hintRequests()).toHaveLength(1);
    const [{ url, init }] = hintRequests();
    expect(url).not.toMatch(/reign|dawn|daybreak|\?/);
    expect(init?.body).toBeUndefined();
    expect(init?.referrerPolicy).toBe("origin");
  });

  it("shows nothing for a word the table has no row for", async () => {
    arrive("#q=dawn%20emu");
    await waitFor(() => expect(gaps()).toHaveLength(2));
    await waitFor(() =>
      expect(gaps()[0].textContent).toContain("related: RNAH"),
    );
    expect(gaps()[1].textContent).not.toContain("related:");
  });

  it("shows nothing for a gloss the lookup no longer has", async () => {
    arrive("#q=telephone%20dawn");
    await waitFor(() =>
      expect(gaps()[1]?.textContent).toContain("related: RNAH"),
    );
    expect(gaps()[0].textContent).not.toContain("related:");
  });

  it("gives no hint to a grammar word's gap", async () => {
    arrive("#q=could%20dawn");
    await waitFor(() =>
      expect(gaps()[1]?.textContent).toContain("related: RNAH"),
    );
    expect(gaps()[0].textContent).toMatch(/^no formcould/);
    expect(gaps()[0].textContent).not.toContain("related:");
  });

  it("opens the hinted form's entry, leaving the translation as it was", async () => {
    arrive("#q=dawn%20light");
    await waitFor(() => expect(gaps()[0]?.textContent).toContain("RNAH"));
    const before = tiles().map((tile) => tile.textContent);
    const hash = window.location.hash;
    fireEvent.click(within(gaps()[0]).getByRole("button", { name: "RNAH" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "RNAH" })).toBeTruthy();
    // Close the sheet: the tiles, the gap among them, and the text are
    // unchanged.
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await act(async () => {});
    expect(tiles().map((tile) => tile.textContent)).toEqual(before);
    expect(gaps()).toHaveLength(1);
    expect(window.location.hash).toBe(hash);
  });

  it("shows no hint, and no error, when the table doesn't load, and tries again with the next result", async () => {
    let fail = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        requests.push({ url: String(url) });
        if (String(url) === KEYS_TABLE_URL) return Response.json(TABLE);
        if (String(url) === HINTS_URL && !fail) return Response.json(HINTS);
        return new Response("", { status: 503 });
      }),
    );
    arrive("#q=dawn");
    await waitFor(() => expect(gaps()).toHaveLength(1));
    await waitFor(() => expect(hintRequests()).toHaveLength(1));
    await act(async () => {});
    expect(gaps()[0].textContent).not.toContain("related:");
    expect(gaps()[0].textContent).toMatch(/^no formdawn/);
    // The next result shown fetches the table again.
    fail = false;
    fireEvent.change(
      screen.getByRole("textbox", { name: "English or Latin letters" }),
      { target: { value: "daybreak" } },
    );
    await waitFor(() =>
      expect(gaps()[0]?.textContent).toContain("related: RNAH ‘sunrise’"),
    );
    expect(hintRequests()).toHaveLength(2);
  });
});
