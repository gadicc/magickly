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
import { buildKeysTable } from "../translate/keysTable";
import { forgetTranslator } from "../translate/load";
import { KEYS_TABLE_URL } from "../translate/lookup";
import { MAX_WORDS } from "../translate/tokens";
import Dictionary from "./dictionary";

const TABLE = buildKeysTable();
/** The note under English into Enochian, after its hidden separator. */
const UNREVIEWED = ". No one who reads Enochian has reviewed this.";

/** Every request the page made. */
let requests: string[] = [];
/** Serves the slim Keys table, or fails, or holds it until released. */
function serve(how: "table" | "fail" | "hold" = "table") {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requests.push(String(url));
      if (how === "fail") return new Response("", { status: 503 });
      if (how === "hold") await held;
      return Response.json(TABLE);
    }),
  );
  return release;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/enochian/dictionary");
  Element.prototype.scrollIntoView = vi.fn();
  requests = [];
  forgetTranslator();
  serve();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const type = (text: string) =>
  fireEvent.change(screen.getByRole("combobox", { hidden: true }), {
    target: { value: text },
  });
/** The dictionary's live region: "N words found". */
const found = (container: HTMLElement) =>
  container.querySelector('[aria-live="polite"]')?.textContent;
const preview = () => screen.queryByRole("region", { name: /^As a sentence/ });
const line = () =>
  preview()?.querySelector(".dict-preview-line")?.textContent ?? null;
const link = () =>
  within(preview() as HTMLElement)
    .getByRole("link", { name: "Open in the translator" })
    .getAttribute("href") ?? "";

describe("the dictionary's preview of the translator (plan 081, decision 3)", () => {
  it("shows nothing and loads nothing below three words", async () => {
    const { container } = render(<Dictionary uses={{}} />);
    type("light of");
    await waitFor(() => expect(found(container)).toMatch(/found$/));
    await act(async () => {});
    expect(preview()).toBeNull();
    expect(requests).toEqual([]);
  });

  it("reads three English words as forms and gaps, with the link", async () => {
    render(<Dictionary uses={{}} />);
    type("the light of master");
    await waitFor(() =>
      expect(line()).toBe(
        `Word by word, 2 words left out by rule: OLPIRT [master] (no form)${UNREVIEWED}`,
      ),
    );
    expect(
      screen.getByRole("region", {
        name: "As a sentence, English → Enochian",
      }),
    ).toBeTruthy();
    expect(link()).toBe("/enochian/translate#q=the+light+of+master");
    // The one request is the Keys table, with nothing of the query.
    expect(requests).toEqual([KEYS_TABLE_URL]);
    // Outside the list of words, which holds only options.
    expect(preview()?.closest('[role="listbox"]')).toBeNull();
  });

  it("reads Enochian as the reading line, Dee's own English first", async () => {
    render(<Dictionary uses={{}} />);
    type("OL SONF VORSG");
    await waitFor(() =>
      expect(line()).toBe("Dee’s own English: I Raign over you"),
    );
    expect(
      screen.getByRole("region", {
        name: "As a sentence, Enochian → English",
      }),
    ).toBeTruthy();
    expect(link()).toBe("/enochian/translate#q=OL+SONF+VORSG");
  });

  it("marks our division of Dee's English and words not in our data", async () => {
    render(<Dictionary uses={{}} />);
    type("BALT ZIRDO SALMANX");
    await waitFor(() =>
      expect(line()).toBe(
        "word by word: of Justice ‹I am› (our division of Dee’s English) [SALMANX?] (not in our data)",
      ),
    );
  });

  it("keeps any character in the link's fragment, and only there", async () => {
    render(<Dictionary uses={{}} />);
    const text = "fire & light #1 + water?";
    type(text);
    await waitFor(() => expect(preview()).toBeTruthy());
    const href = link();
    const [path, fragment] = href.split("#");
    expect(path).toBe("/enochian/translate");
    expect(new URLSearchParams(fragment).get("q")).toBe(text);
    expect(new URLSearchParams(fragment).get("dir")).toBeNull();
  });

  it("holds its place while loading, then fills its line", async () => {
    const release = serve("hold");
    render(<Dictionary uses={{}} />);
    type("light of God");
    await waitFor(() => expect(preview()).toBeTruthy());
    // A quiet "…", read as loading, in the room the line will take.
    expect(line()).toBe("…Translating…");
    expect(screen.getByText("Translating…")).toBeTruthy();
    expect(link()).toBe("/enochian/translate#q=light+of+God");
    release();
    await waitFor(() =>
      expect(line()).toBe(`Word by word: OLPIRT MAD${UNREVIEWED}`),
    );
  });

  it("shows nothing if the Keys fail to load", async () => {
    serve("fail");
    const { container } = render(<Dictionary uses={{}} />);
    type("light of God");
    await waitFor(() => expect(requests).toHaveLength(1));
    await waitFor(() => expect(preview()).toBeNull());
    // The dictionary's own results are unaffected.
    expect(found(container)).toMatch(/found$/);
  });

  it("after a failed load, tries again only once the query drops below three words", async () => {
    serve("fail");
    render(<Dictionary uses={{}} />);
    type("light of God");
    await waitFor(() => expect(requests).toHaveLength(1));
    await waitFor(() => expect(preview()).toBeNull());
    serve();
    // More words: no fetch, and no "…" flashing in and out.
    type("light of God and");
    type("light of God and fire");
    await act(async () => {});
    expect(preview()).toBeNull();
    expect(requests).toHaveLength(1);
    // Below three and back: a fresh try.
    type("light of");
    await waitFor(() => expect(preview()).toBeNull());
    type("light of God");
    await waitFor(() =>
      expect(line()).toBe(`Word by word: OLPIRT MAD${UNREVIEWED}`),
    );
    expect(requests).toEqual([KEYS_TABLE_URL, KEYS_TABLE_URL]);
  });

  it("counts words, not spaces: nothing for three 'words' with no letters", async () => {
    const { container } = render(<Dictionary uses={{}} />);
    // As the direction guess counts them, which reads up to two words
    // both ways: "I'm fire" and "fire,water,light" are two and one.
    for (const text of [
      "? ! .",
      "1 2 3",
      "the light ?",
      "I'm fire",
      "fire,water,light",
      "light/fire/water",
    ]) {
      type(text);
      await waitFor(() => expect(found(container)).toBeDefined());
      await act(async () => {});
      expect(preview(), text).toBeNull();
    }
    expect(requests).toEqual([]);
  });

  it("follows the query: updates once loaded, and goes below three words", async () => {
    render(<Dictionary uses={{}} />);
    type("light of God");
    await waitFor(() =>
      expect(line()).toBe(`Word by word: OLPIRT MAD${UNREVIEWED}`),
    );
    type("light of master");
    await waitFor(() =>
      expect(line()).toBe(
        `Word by word, 1 word left out by rule: OLPIRT [master] (no form)${UNREVIEWED}`,
      ),
    );
    type("light of");
    await waitFor(() => expect(preview()).toBeNull());
    expect(requests).toHaveLength(1);
  });

  it("says nothing of review under Enochian into English", async () => {
    render(<Dictionary uses={{}} />);
    type("OL SONF VORSG");
    await waitFor(() => expect(line()).toBeTruthy());
    expect(line()).not.toContain("reviewed");
  });

  it("reads only the first 500 words, and says so; the link keeps all", async () => {
    render(<Dictionary uses={{}} />);
    const text = `${Array(MAX_WORDS).fill("light").join(" ")} master`;
    type(text);
    await waitFor(() =>
      expect(line()).toMatch(/Only the first 500 words are read\.$/),
    );
    expect(line()).not.toContain("master");
    expect(new URLSearchParams(link().split("#")[1]).get("q")).toBe(text);
  });

  it("reads the Enochian box's input", async () => {
    render(<Dictionary uses={{}} />);
    fireEvent.change(screen.getByLabelText("Enochian, right to left"), {
      target: { value: "OL SONF VORSG" },
    });
    await waitFor(() =>
      expect(line()).toBe("Dee’s own English: I Raign over you"),
    );
  });

  it("leaves the arrow keys and Show all to the list of words", async () => {
    render(<Dictionary uses={{}} />);
    type("the light of");
    await waitFor(() => expect(line()).toBeTruthy());
    const box = screen.getByRole("combobox", { hidden: true });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    const active = box.getAttribute("aria-activedescendant") ?? "";
    const first = document.getElementById(active);
    expect(first?.getAttribute("role")).toBe("option");
    expect(first?.closest('[role="listbox"]')).toBeTruthy();
    // Down to "Show all", past the group's 30 rows, and open it.
    const more = await screen.findByText(/^Show all \d+$/);
    for (let n = 0; n < 30; n++) fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box.getAttribute("aria-activedescendant")).toBe(more.id);
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() =>
      expect(screen.queryByText(/^Show all \d+$/)).toBeNull(),
    );
    expect(preview()).toBeTruthy();
  });
});
