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
import { buildKeysTable } from "./keysTable";
import { TRANSLATOR_LIMITATIONS } from "./limitations";
import { forgetTranslator } from "./load";
import { KEYS_TABLE_URL } from "./lookup";
import { lookupRuleNotes } from "./ruleNotes.server";
import { MAX_WORDS } from "./tokens";
import Translator from "./translator";

// The AI reading's offer reads the session; these tests never sign in.
vi.mock("@/auth/client", () => ({
  useSession: () => ({ data: null, isPending: false }),
}));

const PATH = "/enochian/translate";
const TABLE = buildKeysTable();
const notes = lookupRuleNotes();

/** Every request the page made: its URL and anything sent with it. */
let requests: { url: string; init?: RequestInit }[] = [];
/** Serves the real slim Keys table, as the route does. */
function serveTable(fail = false) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (fail) return new Response("", { status: 503 });
      if (String(url) === KEYS_TABLE_URL) return Response.json(TABLE);
      if (String(url) === USES_URL) return Response.json({});
      return new Response("", { status: 404 });
    }),
  );
}

beforeEach(() => {
  window.history.replaceState(null, "", PATH);
  requests = [];
  forgetTranslator();
  serveTable();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// An open sheet hides the rest of the page from assistive technology.
const latinBox = () =>
  screen.getByRole("textbox", {
    name: "English or Latin letters",
    hidden: true,
  }) as HTMLTextAreaElement;
const enochianBox = () =>
  screen.getByLabelText("Enochian, right to left") as HTMLTextAreaElement;
const type = (text: string) =>
  fireEvent.change(latinBox(), { target: { value: text } });
const results = () => screen.getByRole("region", { name: "Translation" });
/** Each tile's words, as shown. */
const tiles = () =>
  within(results())
    .queryAllByRole("listitem")
    .filter((item) => item.classList.contains("tr-tile"))
    .map((item) => item.textContent ?? "");
/** The limitations shown, each once. */
const limitations = () =>
  [...results().querySelectorAll(".tr-limits li")].map(
    (item) => item.textContent,
  );
const liveRegion = (container: HTMLElement) =>
  container.querySelector('[aria-live="polite"]')?.textContent;

/** Renders the page with a fragment, as a shared link would arrive. */
function arrive(hash = "") {
  window.history.replaceState(null, "", `${PATH}${hash}`);
  return render(<Translator notes={notes} />);
}

describe("the translator page (plan 081, step E)", () => {
  it("translates a shared link's text on a cold load", async () => {
    arrive("#q=the%20house%20of%20God");
    await waitFor(() => expect(tiles().length).toBe(2));
    expect(latinBox().value).toBe("the house of God");
    expect(enochianBox().value).toBe("the house of God");
    const [house, god] = tiles();
    expect(house).toMatch(/^SALMAN.*the house.*Key 11\.16/);
    expect(god).toMatch(/^MAD.*of God.*Key 13\.18/);
    // MAD has rivals, offered on the tile.
    expect(god).toContain("2 other forms");
    expect(
      screen.getByText("Reading as English → Enochian").textContent,
    ).toBeTruthy();
  });

  it("fetches the Keys table once, lazily, carrying nothing of the text", async () => {
    const { container } = arrive();
    // Nothing is fetched for a reader who hasn't typed.
    await act(async () => {});
    expect(requests).toEqual([]);
    type("over you");
    await waitFor(() => expect(tiles()).toHaveLength(1));
    type("I reign over you");
    await waitFor(() => expect(liveRegion(container)).toMatch(/3 forms/));
    expect(requests.map((one) => one.url)).toEqual([KEYS_TABLE_URL]);
    // Only the origin as its referrer, wherever the page is loaded from.
    expect(requests[0].init?.referrerPolicy).toBe("origin");
  });

  it("sends no text anywhere: no request carries it, nor the query string", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const beacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: beacon });
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "open");
    arrive();
    type("secret words of power");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await waitFor(() => expect(tiles().length).toBeGreaterThan(0));
    // Open a tile: the entry's "In the Keys" fetches its map, also blind.
    fireEvent.click(results().querySelector(".tr-open") as HTMLElement);
    await waitFor(() => expect(requests.length).toBe(2));
    for (const { url, init } of requests) {
      expect([KEYS_TABLE_URL, USES_URL]).toContain(url);
      expect(url).not.toMatch(/secret|power|\?/);
      expect(init?.body).toBeUndefined();
    }
    expect(beacon).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    xhr.mockRestore();
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#q=secret+words+of+power");
  });

  it("keeps any character the text holds through the fragment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const text = "fire & light #1 + water\nof God?";
    arrive();
    type(text);
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    const hash = window.location.hash;
    expect(hash).toMatch(/^#q=/);
    expect(new URLSearchParams(hash.slice(1)).get("q")).toBe(text);
    // A shared link with that fragment gives the same text back.
    cleanup();
    arrive(hash);
    await waitFor(() => expect(latinBox().value).toBe(text));
  });

  it("goes Back and Forward through texts the URL held", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    arrive();
    type("light");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(window.location.hash).toBe("#q=light");
    // A link to another text: a history entry of its own.
    act(() => {
      window.location.hash = "#q=house";
    });
    await waitFor(() => expect(latinBox().value).toBe("house"));
    act(() => window.history.back());
    await waitFor(() => expect(latinBox().value).toBe("light"));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(window.location.hash).toBe("#q=light");
    act(() => window.history.forward());
    await waitFor(() => expect(latinBox().value).toBe("house"));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(window.location.hash).toBe("#q=house");
  });

  it("leaves the text alone for an in-page anchor", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    arrive("#q=house");
    await waitFor(() => expect(latinBox().value).toBe("house"));
    act(() => {
      window.location.hash = "#translator-text";
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(latinBox().value).toBe("house");
    // Nor is the anchor overwritten until the text changes.
    expect(window.location.hash).toBe("#translator-text");
  });

  it("cancels a pending write when an anchor is followed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    arrive();
    type("abcd");
    act(() => {
      window.location.hash = "#translator-text";
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(window.location.hash).toBe("#translator-text");
    expect(latinBox().value).toBe("abcd");
    // Typing away and back to the same text is a change: it is written.
    type("abcde");
    type("abcd");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(window.location.hash).toBe("#q=abcd");
  });

  it("keeps a link to an anchor as it is", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    arrive("#translator-text");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(window.location.hash).toBe("#translator-text");
    expect(latinBox().value).toBe("");
  });

  it("cancels a pending write on Back to an entry with the same fragment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    arrive("#q=house");
    await waitFor(() => expect(latinBox().value).toBe("house"));
    // History: house, light, house.
    act(() => {
      window.location.hash = "#q=light";
    });
    await waitFor(() => expect(latinBox().value).toBe("light"));
    act(() => {
      window.location.hash = "#q=house";
    });
    await waitFor(() => expect(latinBox().value).toBe("house"));
    type("house of God");
    act(() => window.history.go(-2));
    await waitFor(() => expect(latinBox().value).toBe("house"));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(window.location.hash).toBe("#q=house");
    // The entries are as they were.
    act(() => window.history.forward());
    await waitFor(() => expect(latinBox().value).toBe("light"));
    expect(window.location.hash).toBe("#q=light");
  });

  it("treats a text with no words as no result", async () => {
    const { container } = arrive("#q=%3F%20...%20!");
    await waitFor(() => expect(requests).toHaveLength(1));
    await waitFor(() =>
      expect(
        screen.getByText(
          "Type a word or a sentence, in English or in Enochian.",
        ),
      ).toBeTruthy(),
    );
    expect(results().textContent).toBe("");
    expect(screen.queryByRole("note")).toBeNull();
    expect(liveRegion(container)).toBe("");
  });

  it("keeps the text in the fragment without a history entry per keystroke", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    arrive();
    const length = window.history.length;
    type("light");
    type("light of");
    expect(window.location.hash).toBe("");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(window.location.hash).toBe("#q=light+of");
    expect(window.location.pathname).toBe(PATH);
    expect(window.history.length).toBe(length);
  });

  it("follows the fragment when it changes", async () => {
    arrive();
    act(() => {
      window.location.hash = "#q=SALMAN";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => expect(latinBox().value).toBe("SALMAN"));
    await waitFor(() =>
      expect(screen.getByText("Reading as Enochian → English")).toBeTruthy(),
    );
  });

  it("switches direction, writing it to the fragment, and back to the guess", async () => {
    arrive("#q=fire%20of%20God");
    await waitFor(() =>
      expect(screen.getByText("Reading as English → Enochian")).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "switch" }));
    expect(new URLSearchParams(window.location.hash.slice(1)).get("dir")).toBe(
      "enochian",
    );
    await waitFor(() =>
      expect(
        screen.getByText("Reading as Enochian → English (your choice)"),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole("heading", { name: "Enochian → English" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "English → Enochian" }),
    ).toBeNull();
    // Switching again goes back to the guess, and out of the fragment.
    fireEvent.click(screen.getByRole("button", { name: "switch" }));
    expect(window.location.hash).toBe("#q=fire+of+God");
  });

  it("reads a chosen direction from a shared link", async () => {
    arrive("#q=DSSALMAN&dir=enochian");
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(
      screen.getByText("Reading as Enochian → English (your choice)"),
    ).toBeTruthy();
  });

  it("shows both readings for a short input that scores both ways", async () => {
    arrive("#q=I");
    await waitFor(() =>
      expect(screen.getByText("Reading both ways")).toBeTruthy(),
    );
    const headings = within(results())
      .getAllByRole("heading", { level: 2 })
      .map((one) => one.textContent);
    expect(headings).toEqual(["English → Enochian", "Enochian → English"]);
    expect(tiles()).toEqual([
      expect.stringMatching(/^OL.*I.*Key 1\.1.*by rule.*rule G21/),
      expect.stringMatching(/^I.*is.*Key 1\.13/),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "only as Enochian" }));
    expect(window.location.hash).toBe("#q=I&dir=enochian");
    await waitFor(() =>
      expect(
        within(results()).getAllByRole("heading", { level: 2 }),
      ).toHaveLength(1),
    );
  });

  it("announces a short summary in a polite live region, once typing pauses", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = arrive("#q=the%20light%20of%20God%20and%20master");
    await waitFor(() =>
      expect(liveRegion(container)).toBe(
        "English into Enochian: 3 forms, 1 word left out by rule, 1 gap.",
      ),
    );
    type("the light of God and master and");
    type("the light of God and master and fire");
    await waitFor(() => expect(tiles()).toHaveLength(7));
    // Not yet: the region waits for the same pause as the URL.
    expect(liveRegion(container)).toBe(
      "English into Enochian: 3 forms, 1 word left out by rule, 1 gap.",
    );
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(liveRegion(container)).toBe(
      "English into Enochian: 5 forms, 1 word left out by rule, 1 gap.",
    );
  });
});

describe("a long paste", () => {
  it("reads only the first 500 words, says so, and keeps all in the fragment", async () => {
    const { container } = arrive();
    const text = `${Array(MAX_WORDS).fill("light").join(" ")} master`;
    type(text);
    await waitFor(() => expect(tiles()).toHaveLength(MAX_WORDS));
    expect(tiles().join(" ")).not.toContain("master");
    expect(screen.getByText("Only the first 500 words are read.").tagName).toBe(
      "P",
    );
    await waitFor(() =>
      expect(liveRegion(container)).toMatch(
        /^English into Enochian: .* Only the first 500 words are read\.$/,
      ),
    );
    expect(new URLSearchParams(window.location.hash.slice(1)).get("q")).toBe(
      text,
    );
    // Up to the cap, nothing is said.
    type(Array(MAX_WORDS).fill("light").join(" "));
    await waitFor(() =>
      expect(
        screen.queryByText("Only the first 500 words are read."),
      ).toBeNull(),
    );
  });
});

describe("English into Enochian (decisions 5 and 17)", () => {
  it("reads a superlative as its base, a near match with no rule", async () => {
    arrive("#q=greatest");
    await waitFor(() => expect(tiles()).toHaveLength(1));
    const [greatest] = tiles();
    expect(greatest).toMatch(/^DRILPA.*near match: read as “great”/);
    expect(greatest).not.toContain("rule G16");
  });

  it("marks a lone am as carrying its I", async () => {
    arrive("#q=I%20really%20am");
    await waitFor(() => expect(tiles()).toHaveLength(3));
    expect(tiles()[2]).toMatch(/^ZIR.*carries “I”/);
  });

  it("puts the notice and the limitations above the tiles", async () => {
    arrive("#q=house");
    await waitFor(() => expect(tiles()).toHaveLength(1));
    const note = screen.getByRole("note");
    expect(note.textContent).toMatch(/^No one who reads Enochian has reviewed/);
    expect(note.textContent).toContain("a gap is a word we have no form for");
    expect(limitations()).toEqual(TRANSLATOR_LIMITATIONS.lookup);
    // The notice, then the limitations, then the tiles.
    const [first] = within(results()).getAllByRole("listitem");
    const tile = results().querySelector(".tr-tile") as HTMLElement;
    expect(
      note.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      first.compareDocumentPosition(tile) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the limitations once, whichever way it reads", async () => {
    arrive("#q=SALMAN");
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(screen.queryByRole("note")).toBeNull();
    expect(limitations()).toEqual(TRANSLATOR_LIMITATIONS.lookup);
    // After the tiles when reading Enochian.
    const tile = results().querySelector(".tr-tile") as HTMLElement;
    const limits = results().querySelector(".tr-limits") as HTMLElement;
    expect(
      tile.compareDocumentPosition(limits) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    cleanup();
    // Both ways: once, beside the notice.
    arrive("#q=I");
    await waitFor(() => expect(tiles()).toHaveLength(2));
    expect(limitations()).toEqual(TRANSLATOR_LIMITATIONS.lookup);
  });

  it("shows rule chips for words left out, opening the note", async () => {
    arrive("#q=the%20light");
    await waitFor(() => expect(tiles()).toHaveLength(2));
    expect(tiles()[0]).toMatch(/^left out.*the.*rule G4/);
    const chip = screen.getByRole("button", {
      name: "Rule G4, There are no articles",
    });
    expect(chip.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(chip);
    const popover = await screen.findByRole("dialog", {
      name: "G4. There are no articles",
    });
    expect(popover.textContent).toContain(
      'Enochian has no word for "the", "a" or "an".',
    );
    expect(popover.textContent).toContain(
      "Sources: Laycock (Weiser, 2001), p. 43;",
    );
    fireEvent.keyDown(popover, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("marks a moved possessive and a verb read plain, each with its rule", async () => {
    arrive("#q=his%20son%20came");
    await waitFor(() => expect(tiles()).toHaveLength(3));
    const [son, his, came] = tiles();
    expect(son).toMatch(/^NOR/);
    expect(his).toMatch(
      /^TOX.*his.*by rule.*rule G22.*moved after its noun.*rule G22/,
    );
    expect(came).toMatch(/^NIIS.*came.*read as “come”.*rule G16/);
    fireEvent.click(
      screen.getByRole("button", { name: /^Rule G16, Most verbs/ }),
    );
    expect((await screen.findByRole("dialog")).textContent).toContain(
      "a verb usually has one form",
    );
  });

  it("shows a gap with its nearest forms, each with its source", async () => {
    arrive("#q=master");
    await waitFor(() => expect(tiles()).toHaveLength(1));
    const [gap] = within(results())
      .getAllByRole("listitem")
      .filter((item) => item.classList.contains("tr-gap"));
    expect(gap.textContent).toMatch(/^no formmaster.*nearest:.*GEIAD/);
    const geiad = within(gap).getByRole("button", { name: "GEIAD" });
    expect(geiad.nextSibling?.textContent).toMatch(/^Key \d+\.\d+/);
    // A nearest form opens its entry.
    fireEvent.click(geiad);
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "GEIAD" })).toBeTruthy();
  });

  it("lists a form's alternatives, each with its source", async () => {
    arrive("#q=fire");
    await waitFor(() => expect(tiles().length).toBeGreaterThan(0));
    expect(tiles()[0]).toMatch(
      /^PRGE.*fire.*dictionary, EMPM.*also in the Keys/,
    );
    fireEvent.click(screen.getByRole("button", { name: "3 other forms" }));
    const list = await screen.findByRole("dialog", {
      name: "Other forms for “fire”",
    });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "BITOMdictionary, EMPM",
      "IALPIRGAHdictionary, WE",
      "MALPRGdictionary, WE",
    ]);
  });

  it("opens a tile's entry in a sheet on a phone", async () => {
    arrive("#q=the%20house");
    await waitFor(() => expect(tiles()).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: /^SALMAN/ }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "SALMAN" })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens an entry in the pane on a wide screen", async () => {
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
      arrive("#q=the%20house");
      await waitFor(() => expect(tiles()).toHaveLength(1));
      fireEvent.click(screen.getByRole("button", { name: /^SALMAN/ }));
      expect(
        await screen.findByRole("heading", { name: "SALMAN" }),
      ).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
    } finally {
      window.matchMedia = matchMedia;
    }
  });
});

describe("Enochian into English (decisions 13–17)", () => {
  it("gives Dee's own English for a run of his lines", async () => {
    arrive("#q=OL%20SONF%20VORSG");
    await waitFor(() => expect(tiles()).toHaveLength(3));
    const line = within(results()).getByText("I Raign over you");
    expect(line.closest(".tr-line")?.textContent).toBe(
      "Dee’s own English: I Raign over you",
    );
  });

  it("marks our division of Dee's English by text, with a label", async () => {
    arrive("#q=BALT%20ZIRDO");
    await waitFor(() => expect(tiles()).toHaveLength(2));
    const line = results().querySelector(".tr-line");
    expect(line?.textContent).toBe(
      "word by word: of Justice ‹I am› (our division of Dee’s English)",
    );
    // The tile marks it too.
    expect(tiles()[1]).toContain("‹I am›");
  });

  it("tags the word-by-word stretch of a mixed line", async () => {
    arrive("#q=OL%20SONF%20VORSG%20BALT");
    await waitFor(() => expect(tiles()).toHaveLength(4));
    const line = results().querySelector(".tr-line");
    expect(line?.textContent).toBe(
      "Dee’s own English, and word by word where marked: I Raign over you word by word: of Justice",
    );
  });

  it("marks a split with the rule that made it, opening the rule", async () => {
    arrive("#q=DSSALMAN&dir=enochian");
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(tiles()[0]).toMatch(/^DS.*which.*SALMAN.*split by rule.*rule G26/);
    fireEvent.click(
      screen.getByRole("button", { name: /^Rule G26, Small words/ }),
    );
    expect((await screen.findByRole("dialog")).textContent).toContain(
      "G26. Small words join the next word",
    );
  });

  it("labels Leitch's spellings with his page", async () => {
    arrive("#q=PRGEL");
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(tiles()[0]).toMatch(/^PURGEL.*Leitch’s spelling, vol\. II p\. 432/);
  });

  it("says a word is not in our data, with the nearest spellings", async () => {
    arrive("#q=SALMANX&dir=enochian");
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(tiles()[0]).toMatch(
      /^SALMANXnot in our datanearest spellings: .*SALMAN/,
    );
    expect(results().querySelector(".tr-line")?.textContent).toBe(
      "word by word: [SALMANX?] (not in our data)",
    );
  });

  it("opens a word only in the Keys at its rows", async () => {
    arrive("#q=ZOMDV");
    await waitFor(() => expect(tiles()).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: /^ZOMDV/ }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "ZOMDV" })).toBeTruthy();
    expect(sheet.textContent).toContain(
      "This word is in Dee’s Keys but not in our dictionary.",
    );
    // Dee's English there is our division of it: marked, not quoted.
    expect(sheet.querySelector(".entry-quote")?.textContent).toMatch(
      /^‹.+› \(our division of Dee’s English\)$/,
    );
    const link = within(sheet).getAllByRole("link")[0];
    expect(link.getAttribute("href")).toMatch(
      /^\/enochian\/keys#key-\d+-word-\d+$/,
    );
  });
});

describe("the Enochian box and its keypad (plan 074)", () => {
  const key = (name: string) =>
    screen.getByRole("button", { name: new RegExp(`^${name},`) });

  it("types at the caret, keeping focus, and translates the words", async () => {
    const { container } = arrive();
    const box = enochianBox();
    act(() => box.focus());
    expect(
      screen.getByRole("group", { name: "Enochian letters" }),
    ).toBeTruthy();
    // Focusing a box starts loading the Keys.
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(fireEvent.mouseDown(key("Med"))).toBe(false);
    fireEvent.click(key("Med"));
    fireEvent.click(key("Ur"));
    expect(box.value).toBe("OL");
    expect(latinBox().value).toBe("OL");
    expect(document.activeElement).toBe(box);
    await waitFor(() => expect(liveRegion(container)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Delete a letter" }));
    expect(box.value).toBe("O");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(
      screen.queryByRole("group", { name: "Enochian letters" }),
    ).toBeNull();
  });
});

describe("loading the Keys", () => {
  it("says when they fail, and tries again", async () => {
    serveTable(true);
    arrive("#q=house");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "The Keys didn’t load.",
    );
    serveTable();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
