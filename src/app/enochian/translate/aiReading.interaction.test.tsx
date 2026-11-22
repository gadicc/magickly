// @vitest-environment jsdom
import {
  act,
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOADED_TEST_TIMEOUT,
  LOADED_WAIT_TIMEOUT,
} from "../../../../tests/loadBudget";
import { USES_URL } from "../dictionary/InTheKeys";
import { buildKeysTable } from "./keysTable";
import { TRANSLATOR_LIMITATIONS } from "./limitations";
import { forgetTranslator } from "./load";
import { KEYS_TABLE_URL } from "./lookup";
import type { CheckedReading, WordState } from "./reading/check";
import { READING_DEADLINE_MS } from "./reading/limits";
import type { ReadingEvent } from "./reading/respond";
import { READING_URL } from "./readingRequest";
import { lookupRuleNotes } from "./ruleNotes.server";
import Translator from "./translator";

// Each test builds the translator afresh: up to 1.1 s alone under
// coverage and 8 s with two coverage runs at once, when its waits also
// outran Testing Library's 1 s (tests/loadBudget.ts).
vi.setConfig({
  testTimeout: LOADED_TEST_TIMEOUT,
  hookTimeout: LOADED_TEST_TIMEOUT,
});
configure({ asyncUtilTimeout: LOADED_WAIT_TIMEOUT });

/**
 * The AI reading on the translator page (plan 081, S2 and S7; step 2E),
 * with `fetch` faked: no request reaches the route, let alone the model.
 */

const auth = vi.hoisted(() => ({
  session: { data: null, isPending: false } as {
    data: { user: { id: string } } | null;
    isPending: boolean;
  },
}));
vi.mock("@/auth/client", () => ({ useSession: () => auth.session }));

const PATH = "/enochian/translate";
const TABLE = buildKeysTable();
const notes = lookupRuleNotes();

/** Five words: four of Dee's and one we don't have, so one part. */
const SHORT = "ZACAR OD ZAMRAN CAOSGO TORZODU";
/** 90 words, read in two parts of 45. */
const LONG = Array.from({ length: 30 }, () => "MADRIAX OD CAOSGO").join(" ");
/** 120 words: two units. */
const LONGER = Array.from({ length: 40 }, () => "MADRIAX OD CAOSGO").join(" ");

/** A fake answer the test writes line by line. */
interface Answer {
  response: Response;
  send: (event: ReadingEvent) => void;
  end: () => void;
  /** Writes bytes as they are, to cut a line short. */
  raw?: (text: string) => void;
}

function answer(status = 200): Answer {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(one) {
      controller = one;
    },
  });
  const encoder = new TextEncoder();
  return {
    response: new Response(body, {
      status,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    }),
    send: (event) =>
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
    end: () => controller.close(),
    raw: (text: string) => controller.enqueue(encoder.encode(text)),
  };
}

/** A whole answer at once: a refusal, or parts and their end. */
const lines = (status: number, ...events: ReadingEvent[]) => {
  const one = answer(status);
  for (const event of events) one.send(event);
  one.end();
  return one;
};

/** Every request the page made. */
let requests: { url: string; init?: RequestInit }[] = [];
/** The answers the reading's requests get, in order. */
let answers: Answer[] = [];

beforeEach(() => {
  window.history.replaceState(null, "", PATH);
  requests = [];
  answers = [];
  auth.session = { data: { user: { id: "u1" } }, isPending: false };
  forgetTranslator();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (String(url) === KEYS_TABLE_URL) return Response.json(TABLE);
      if (String(url) === USES_URL) return Response.json({});
      if (String(url) === READING_URL) {
        const next = answers.shift();
        if (!next) throw new Error("no answer queued");
        return next.response;
      }
      return new Response("", { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Renders the page with a fragment, as a shared link would arrive. */
function arrive(text: string) {
  const hash = `#q=${encodeURIComponent(text)}`;
  window.history.replaceState(null, "", `${PATH}${hash}`);
  render(<Translator notes={notes} />);
  return hash;
}

const results = () => screen.getByRole("region", { name: "Translation" });
const tilesShown = () =>
  waitFor(() =>
    expect(results().querySelectorAll(".tr-tile").length).toBeGreaterThan(0),
  );
const offer = () => screen.queryByRole("button", { name: "Read with AI" });
/** A button and what it says it will use, as its description. */
const said = (button: Element | null) =>
  [
    button?.textContent,
    document.getElementById(button?.getAttribute("aria-describedby") ?? "")
      ?.textContent,
  ]
    .filter(Boolean)
    .join(" | ");
const card = () => screen.getByRole("region", { name: "AI reading" });
/** The reading's polite live region, beside the offer or the card. */
const live = () => results().querySelector(".ai-live") as HTMLElement;
/** The card's word rows, as read. */
const rows = () =>
  [...card().querySelectorAll(".ai-words li")].map((li) => li.textContent);
/** What the reading's requests sent. */
const sent = () =>
  requests
    .filter((one) => one.url === READING_URL)
    .map((one) => JSON.parse(String(one.init?.body)));

/** A checked reading: each word with its state and English. */
function reading(
  words: [string, WordState, string?][],
  sentence?: string,
): CheckedReading {
  return {
    words: words.map(([word, state, english]) => ({
      word,
      state,
      ...(english ? { english } : {}),
      sources:
        state === "confirmed"
          ? [{ kind: "row", key: 3, row: 14, word }]
          : state === "unconfirmed"
            ? [{ kind: "headword", headword: word }]
            : [],
    })),
    sentence: sentence
      ? { shown: true, text: sentence, contentWords: 3, supported: 3 }
      : {
          shown: false,
          withheld: "too few supported",
          contentWords: 4,
          supported: 1,
        },
    dropped: 0,
  };
}

const SHORT_READING = reading(
  [
    ["ZACAR", "confirmed", "move"],
    ["OD", "confirmed", "and"],
    ["ZAMRAN", "unconfirmed", "show yourselves"],
    ["CAOSGO", "confirmed", "unto the earth"],
    ["TORZODU", "guess", "arise"],
  ],
  "Move, and show yourselves unto the earth.",
);

const part = (
  n: number,
  of: number,
  read: CheckedReading,
  from: "store" | "model" = "model",
): ReadingEvent => ({
  type: "part",
  part: n,
  parts: of,
  from,
  status: "read",
  reading: read,
});

/** A reset time as the card shows it, in the reader's clock. */
const at = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

const RESET = "2026-11-18T00:00:00.000Z";

describe("the offer (plan 081, S2)", () => {
  it("is offered under the reading line, saying what it uses", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    expect(said(offer())).toBe("Read with AI | uses 1 of today’s 100");
    // Under the reading line, above the tiles.
    const line = results().querySelector(".tr-line") as Element;
    const tiles = results().querySelector(".tr-tiles") as Element;
    const button = offer() as Element;
    expect(line.compareDocumentPosition(button)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(button.compareDocumentPosition(tiles)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    // Nothing is sent until it is asked for.
    expect(sent()).toEqual([]);
    // The live region is there, empty, before anything is said in it.
    expect(live().getAttribute("aria-live")).toBe("polite");
    expect(live().textContent).toBe("");
  });

  it("says a signed-out reader uses the shared pool, at most 10 a day for each address", async () => {
    auth.session = { data: null, isPending: false };
    arrive(LONGER);
    await waitFor(() => expect(offer()).not.toBeNull());
    expect(said(offer())).toBe(
      "Read with AI | uses 2 of today’s allowance shared by readers not signed in, at most 10 a day for each address",
    );
  });

  it("says nothing of the cost until the session is known", async () => {
    auth.session = { data: null, isPending: true };
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    expect(said(offer())).toBe("Read with AI");
  });

  it.each([
    ["one word", "MADRIAX"],
    ["a run of Dee's lines, whose English the line shows", "ZACAR OD ZAMRAN"],
    ["English", "the house of God"],
    ["too few of its words ours", "ZACAR QWERTY ZXCVB"],
  ])("isn't offered for %s, which the route would refuse", async (_, text) => {
    arrive(text);
    await tilesShown();
    await act(async () => {});
    expect(offer()).toBeNull();
  });
});

describe("the card (plan 081, S7)", () => {
  it("sends the text in the body, never the URL", async () => {
    const hash = arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(
      lines(200, part(1, 1, SHORT_READING), {
        type: "done",
        state: "read",
        from: "model",
        units: 1,
      }),
    );
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() => expect(rows()).toHaveLength(5));
    const [request] = requests.filter((one) => one.url === READING_URL);
    expect(request.url).toBe("/api/enochian/read");
    expect(request.init?.method).toBe("POST");
    expect(sent()).toEqual([{ text: SHORT, again: false }]);
    // The address is as the lookup left it: the text after the # alone.
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe(hash);
  });

  it("shows the sentence, unchecked, each word in its state, and what it used", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(
      lines(200, part(1, 1, SHORT_READING), {
        type: "done",
        state: "read",
        from: "model",
        units: 1,
      }),
    );
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() => expect(rows()).toHaveLength(5));
    const sentence = card().querySelector(".ai-sentence") as HTMLElement;
    expect(sentence.textContent).toBe(
      "The model’s sentence, not checkedMove, and show yourselves unto the earth.",
    );
    // Plain text: nothing in it is marked or linked.
    expect(sentence.querySelectorAll("a, mark, b").length).toBe(0);
    expect(rows()).toEqual([
      "ZACAR move confirmed · , Key 3.14 ZACAR",
      "OD and confirmed · , Key 3.14 OD",
      "ZAMRAN show yourselves not confirmed · , dictionary, ZAMRAN",
      "CAOSGO unto the earth confirmed · , Key 3.14 CAOSGO",
      "TORZODU arise the model’s guess",
    ]);
    expect(card().querySelectorAll("a").length).toBe(0);
    expect(card().querySelector(".ai-foot")?.textContent).toBe(
      "Your text went to OpenAI through Vercel for this reading, and our server keeps it and the reading for a day. It used 1 of today’s 100.",
    );
    // The AI reading's limitations, with the card.
    expect(
      [...card().querySelectorAll(".ai-limits li")].map((li) => li.textContent),
    ).toEqual([...TRANSLATOR_LIMITATIONS.ai]);
    // The lookup's own six are still shown once, after the tiles.
    expect(results().querySelectorAll(".tr-limits li")).toHaveLength(
      TRANSLATOR_LIMITATIONS.lookup.length,
    );
  });

  it("shows a word with no reading without English, and says why a sentence is withheld", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(
      lines(
        200,
        part(
          1,
          1,
          reading([
            ["ZACAR", "confirmed", "move"],
            ["OD", "none"],
            ["ZAMRAN", "guess", "a b c d e f g h i j"],
            ["CAOSGO", "confirmed", "earth"],
            ["TORZODU", "none"],
          ]),
        ),
        { type: "done", state: "read", from: "model", units: 1 },
      ),
    );
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() => expect(rows()).toHaveLength(5));
    expect(rows()[1]).toBe("OD no reading");
    expect(card().querySelector(".ai-sentence")).toBeNull();
    expect(card().querySelector(".ai-note")?.textContent).toBe(
      "The model’s sentence is withheld: too few of its words are in the word readings or our data.",
    );
  });

  it("shows each part as it lands, and announces it politely", async () => {
    arrive(LONG);
    await waitFor(() => expect(offer()).not.toBeNull());
    const stream = answer();
    answers.push(stream);
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() =>
      expect(card().querySelector(".ai-status")?.textContent).toBe(
        "Reading with AI…",
      ),
    );
    // Keyboard: the card's heading takes the focus from the button.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(card()).getByRole("heading", { name: "AI reading" }),
      ),
    );
    const first = reading(
      Array.from({ length: 45 }, (_, n) => [
        ["MADRIAX", "OD", "CAOSGO"][n % 3],
        "confirmed",
        ["heavens", "and", "earth"][n % 3],
      ]),
      "The heavens and the earth.",
    );
    await act(async () => stream.send(part(1, 2, first)));
    await waitFor(() => expect(rows()).toHaveLength(45));
    expect(card().querySelector(".ai-status")?.textContent).toBe(
      "Reading part 2 of 2…",
    );
    expect(live().textContent).toBe(
      "Part 1 of 2 read: 45 of 45 words confirmed.",
    );
    await act(async () => {
      stream.send(part(2, 2, first));
      stream.send({ type: "done", state: "read", from: "model", units: 1 });
      stream.end();
    });
    await waitFor(() => expect(rows()).toHaveLength(90));
    expect(card().querySelector(".ai-status")).toBeNull();
    expect(live().textContent).toBe(
      "Part 2 of 2 read: 45 of 45 words confirmed.",
    );
    expect(card().querySelector(".ai-sentence")?.textContent).toBe(
      "The model’s sentence, not checkedThe heavens and the earth. The heavens and the earth.",
    );
  });

  it("says when the reading came from the store, at no cost", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(
      lines(200, part(1, 1, SHORT_READING, "store"), {
        type: "done",
        state: "read",
        from: "store",
        units: 0,
      }),
    );
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() => expect(rows()).toHaveLength(5));
    expect(card().querySelector(".ai-foot")?.textContent).toBe(
      "This text was read in the last day, so the reading came from our server and nothing went to OpenAI. It used none of your allowance.",
    );
  });

  it("reads again at the reader's cost, saying so first", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    const done = {
      type: "done",
      state: "read",
      from: "model",
      units: 1,
    } as const;
    answers.push(lines(200, part(1, 1, SHORT_READING), done));
    fireEvent.click(offer() as HTMLElement);
    const again = await screen.findByRole("button", { name: "Read again" });
    expect(said(again)).toBe(
      "Read again | a new reading, which replaces this one, uses 1 of today’s 100",
    );
    answers.push(
      lines(
        200,
        part(1, 1, reading([["ZACAR", "confirmed", "move on"]], "Move on.")),
        done,
      ),
    );
    fireEvent.click(again);
    await waitFor(() =>
      expect(rows()).toEqual(["ZACAR move on confirmed · , Key 3.14 ZACAR"]),
    );
    expect(sent()).toEqual([
      { text: SHORT, again: false },
      { text: SHORT, again: true },
    ]);
  });
});

describe("the card's states (plan 081, S7)", () => {
  /** Asks for a reading of `text` and waits for the card to settle. */
  async function ask(text: string, ...queued: Answer[]) {
    arrive(text);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(...queued);
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() =>
      expect(card().querySelector(".ai-status")).not.toBeNull(),
    );
    await waitFor(() =>
      expect(card().querySelector(".ai-status")?.textContent).not.toMatch(/…$/),
    );
    return card().querySelector(".ai-status")?.textContent;
  }

  it("says the reader's allowance is spent, with what is left and when it renews", async () => {
    const status = await ask(
      SHORT,
      lines(429, {
        type: "refused",
        state: "allowance",
        scope: "user",
        units: 1,
        left: 0,
        limit: 100,
        resetAt: RESET,
      }),
    );
    expect(status).toBe(
      `This reading needs 1, and you have 0 of today’s 100 left. They renew at ${at(RESET)}.`,
    );
    expect(live()?.textContent).toBe(status);
    // Nothing to try again until it renews.
    expect(within(card()).queryByRole("button")).toBeNull();
  });

  it("says a signed-out client has used its 10", async () => {
    auth.session = { data: null, isPending: false };
    expect(
      await ask(
        LONGER,
        lines(429, {
          type: "refused",
          state: "allowance",
          scope: "client",
          units: 2,
          left: 1,
          limit: 10,
          resetAt: RESET,
        }),
      ),
    ).toBe(
      `This reading needs 2, and 1 is left of the 10 a day for each address not signed in (readers sharing an address share them). They renew at ${at(RESET)}.`,
    );
  });

  it("says the shared pool is spent", async () => {
    auth.session = { data: null, isPending: false };
    expect(
      await ask(
        SHORT,
        lines(429, {
          type: "refused",
          state: "allowance",
          scope: "anonymous",
          units: 1,
          left: 0,
          limit: 500,
          resetAt: RESET,
        }),
      ),
    ).toBe(
      `Readers not signed in have used today’s shared allowance. It renews at ${at(RESET)}; signed in, you have your own.`,
    );
  });

  it("says too little of the shared pool is left", async () => {
    auth.session = { data: null, isPending: false };
    expect(
      await ask(
        LONGER,
        lines(429, {
          type: "refused",
          state: "allowance",
          scope: "anonymous",
          units: 2,
          left: 1,
          limit: 500,
          resetAt: RESET,
        }),
      ),
    ).toBe(
      `Too little is left of today’s allowance shared by readers not signed in: this reading needs 2, and 1 is left. It renews at ${at(RESET)}; signed in, you have your own.`,
    );
  });

  it("says the day's ceiling is reached, until when", async () => {
    expect(
      await ask(
        SHORT,
        lines(503, { type: "refused", state: "ceiling", resetAt: RESET }),
      ),
    ).toBe(
      `AI readings have stopped for everyone today: the day’s spending limit is reached. They start again at ${at(RESET)}.`,
    );
  });

  it("says readings are off", async () => {
    expect(
      await ask(SHORT, lines(503, { type: "refused", state: "off" })),
    ).toBe("AI readings are turned off for now.");
    expect(within(card()).queryByRole("button")).toBeNull();
  });

  it("says the text is being read already, and offers to try again", async () => {
    expect(
      await ask(SHORT, lines(409, { type: "refused", state: "busy" })),
    ).toBe("This text is being read just now. Try again shortly.");
    // No price: the reading in hand may be stored by then, free.
    expect(
      said(within(card()).getByRole("button", { name: "Try again" })),
    ).toBe("Try again");
    answers.push(
      lines(200, part(1, 1, SHORT_READING, "store"), {
        type: "done",
        state: "read",
        from: "store",
        units: 0,
      }),
    );
    fireEvent.click(within(card()).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(rows()).toHaveLength(5));
    expect(card().querySelector(".ai-status")).toBeNull();
  });

  it("says the provider refused the passage, with nothing to try again", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(
      lines(
        200,
        { type: "part", part: 1, parts: 1, status: "failed", state: "refused" },
        { type: "done", state: "failed", from: "model", units: 1 },
      ),
    );
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() =>
      expect(rows()).toEqual(["The provider refused to read this passage."]),
    );
    expect(within(card()).queryByRole("button")).toBeNull();
    // The call was made: the card says where the text went and what it used.
    expect(card().querySelector(".ai-foot")?.textContent).toBe(
      "Your text went to OpenAI through Vercel for this reading; with no part read, our server keeps none of it. It used 1 of today’s 100.",
    );
  });

  it("offers to try a failed part again, paying only for it", async () => {
    auth.session = { data: null, isPending: false };
    arrive(LONGER);
    await waitFor(() => expect(offer()).not.toBeNull());
    const first = reading([["MADRIAX", "confirmed", "heavens"]], "Heavens.");
    answers.push(
      lines(
        200,
        part(1, 2, first),
        { type: "part", part: 2, parts: 2, status: "failed", state: "timeout" },
        { type: "done", state: "partial", from: "model", units: 2 },
      ),
    );
    fireEvent.click(offer() as HTMLElement);
    const retry = await screen.findByRole("button", {
      name: "Try the failed part again",
    });
    expect(rows()).toEqual([
      "MADRIAX heavens confirmed · , Key 3.14 MADRIAX",
      "Part 2 of 2: The model took too long.",
    ]);
    // 60 words in the second part: one unit, not the reading's two.
    expect(said(retry)).toBe(
      "Try the failed part again | uses 1 of today’s allowance shared by readers not signed in, at most 10 a day for each address",
    );
    const second = reading([["CAOSGO", "confirmed", "earth"]], "Earth.");
    const stream = answer();
    answers.push(stream);
    fireEvent.click(retry);
    // The part already read stays while the rest is read.
    await waitFor(() =>
      expect(card().querySelector(".ai-status")?.textContent).toBe(
        "Reading part 2 of 2…",
      ),
    );
    expect(rows()).toEqual(["MADRIAX heavens confirmed · , Key 3.14 MADRIAX"]);
    await act(async () => {
      stream.send(part(1, 2, first, "store"));
      stream.send(part(2, 2, second));
      stream.send({ type: "done", state: "read", from: "model", units: 1 });
      stream.end();
    });
    await waitFor(() =>
      expect(rows()).toEqual([
        "MADRIAX heavens confirmed · , Key 3.14 MADRIAX",
        "CAOSGO earth confirmed · , Key 3.14 CAOSGO",
      ]),
    );
    expect(sent()).toEqual([
      { text: LONGER, again: false },
      { text: LONGER, again: false },
    ]);
    expect(card().querySelector(".ai-foot")?.textContent).toBe(
      "Your text went to OpenAI through Vercel for this reading, and our server keeps it and the reading for a day. It used 1 of today’s shared allowance.",
    );
  });

  it("says when the answer stops arriving, and offers to try again", async () => {
    expect(await ask(SHORT, lines(200, part(1, 2, SHORT_READING)))).toBe(
      "The reading stopped arriving.",
    );
    expect(live().textContent).toBe("The reading stopped arriving.");
    // A part came, so the text was sent; the rest may still be read and
    // kept, so the retry is priced at most (2H, S8).
    expect(card().querySelector(".ai-foot")?.textContent).toBe(
      "Your text was sent for this reading, and the rest of it may still be read. Our server keeps the text and its reading for a day and deletes them within two days, so trying again may use less, or none.",
    );
    expect(
      said(within(card()).getByRole("button", { name: "Try again" })),
    ).toBe("Try again | uses at most 1 of today’s 100");
  });

  it("says the answer was lost when a line is cut short", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    const stream = answer();
    answers.push(stream);
    fireEvent.click(offer() as HTMLElement);
    await act(async () => {
      stream.send(part(1, 1, SHORT_READING));
      // Half a line, then the end.
      stream.raw?.('{"type":"done","state":"re');
      stream.end();
    });
    await waitFor(() =>
      expect(card().querySelector(".ai-status")?.textContent).toBe(
        "The reading stopped arriving.",
      ),
    );
    expect(rows()).toHaveLength(5);
    expect(live().textContent).toBe("The reading stopped arriving.");
  });

  it("says the answer was lost when the server sends a page, not a reading", async () => {
    const page = new Response("<html><body>Bad gateway</body></html>", {
      status: 502,
      headers: { "Content-Type": "text/html" },
    });
    expect(
      await ask(SHORT, { response: page, send: () => {}, end: () => {} }),
    ).toBe("The reading stopped arriving.");
    expect(
      within(card()).getByRole("button", { name: "Try again" }),
    ).toBeTruthy();
  });

  it("passes over events it doesn't know or can't trust", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(
      lines(
        200,
        { type: "progress", note: "later" } as unknown as ReadingEvent,
        { ...part(1, 1, SHORT_READING), parts: 1e9 } as ReadingEvent,
        { ...part(1, 1, SHORT_READING), part: 0 } as ReadingEvent,
        { ...part(1, 1, SHORT_READING), part: 3 } as ReadingEvent,
        {
          type: "part",
          part: 1,
          parts: 1,
          from: "model",
          status: "read",
          reading: { words: "nope" },
        } as unknown as ReadingEvent,
        { type: "refused", state: "allowance" } as ReadingEvent,
        part(1, 1, SHORT_READING),
        { type: "done", state: "read", from: "model", units: 1 },
      ),
    );
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() =>
      expect(card().querySelector(".ai-foot")).not.toBeNull(),
    );
    expect(rows()).toHaveLength(5);
    expect(card().querySelector(".ai-status")).toBeNull();
  });

  it("stops reading the answer when the card goes", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    const stream = answer();
    answers.push(stream);
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() => expect(sent()).toHaveLength(1));
    const [request] = requests.filter((one) => one.url === READING_URL);
    expect(request.init?.signal?.aborted).toBe(false);
    cleanup();
    expect(request.init?.signal?.aborted).toBe(true);
  });

  it("shows where the text went and what it used when every part fails", async () => {
    arrive(LONG);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(
      lines(
        200,
        { type: "part", part: 1, parts: 2, status: "failed", state: "timeout" },
        { type: "part", part: 2, parts: 2, status: "failed", state: "failed" },
        { type: "done", state: "failed", from: "model", units: 1 },
      ),
    );
    fireEvent.click(offer() as HTMLElement);
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(rows()).toEqual([
      "Part 1 of 2: The model took too long.",
      "Part 2 of 2: The model failed.",
    ]);
    expect(card().querySelector(".ai-foot")?.textContent).toBe(
      "Your text went to OpenAI through Vercel for this reading; with no part read, our server keeps none of it. It used 1 of today’s 100.",
    );
    expect(said(retry)).toBe("Try again | uses 1 of today’s 100");
  });

  it("says nothing went out when the reading stopped before any call", async () => {
    arrive(LONG);
    await waitFor(() => expect(offer()).not.toBeNull());
    // The route's answer when the switch can't be read before the first
    // part: the parts aren't sent, no call is made, and the units come back.
    const unsent = (n: number): ReadingEvent => ({
      type: "part",
      part: n,
      parts: 2,
      status: "failed",
      state: "unavailable",
    });
    answers.push(
      lines(200, unsent(1), unsent(2), {
        type: "done",
        state: "failed",
        from: "model",
        units: 0,
      }),
    );
    fireEvent.click(offer() as HTMLElement);
    await screen.findByRole("button", { name: "Try again" });
    expect(rows()).toEqual([
      "Part 1 of 2: Not sent: something went wrong on our side.",
      "Part 2 of 2: Not sent: something went wrong on our side.",
    ]);
    expect(card().querySelector(".ai-foot")).toBeNull();
  });

  it("offers no retry after the provider's privacy terms couldn't be confirmed", async () => {
    arrive(LONG);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(
      lines(
        200,
        { type: "part", part: 1, parts: 2, status: "failed", state: "routing" },
        {
          type: "part",
          part: 2,
          parts: 2,
          status: "failed",
          state: "not read",
        },
        { type: "done", state: "failed", from: "model", units: 1 },
      ),
    );
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() =>
      expect(card().querySelector(".ai-foot")).not.toBeNull(),
    );
    expect(rows()).toEqual([
      "Part 1 of 2: Not shown, since the provider’s privacy terms couldn’t be confirmed.",
      "Part 2 of 2: Not sent.",
    ]);
    expect(card().querySelector(".ai-status")?.textContent).toBe(
      "The reading stopped because the provider’s privacy terms (OpenAI, keeping no copy) couldn’t be confirmed, and nothing more was sent.",
    );
    expect(card().querySelector(".ai-foot")?.textContent).toBe(
      "Your text went through Vercel for this reading, which didn’t confirm that it reached OpenAI with no copy kept; with no part read, our server keeps none of it. It used 1 of today’s 100.",
    );
    expect(within(card()).queryByRole("button")).toBeNull();
  });

  it("says when the server didn't answer", async () => {
    expect(
      await ask(SHORT, lines(503, { type: "refused", state: "unavailable" })),
    ).toBe(
      "Something went wrong on our side, so the reading didn’t start. Nothing was sent.",
    );
  });

  it("starts again with the offer when the text changes", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(lines(503, { type: "refused", state: "off" }));
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() => expect(card()).toBeTruthy());
    fireEvent.change(
      screen.getByRole("textbox", { name: "English or Latin letters" }),
      { target: { value: "MADRIAX OD CAOSGO" } },
    );
    await waitFor(() => expect(offer()).not.toBeNull());
    expect(screen.queryByRole("region", { name: "AI reading" })).toBeNull();
  });
});

describe("the final review's fixes (2H)", () => {
  const failedPart = (n: number, of: number, state: string): ReadingEvent =>
    ({
      type: "part",
      part: n,
      parts: of,
      status: "failed",
      state,
    }) as ReadingEvent;

  it.each([
    ["timeout", "routing"],
    ["refused", "timeout"],
    ["timeout", "refused"],
  ])("offers no retry after [%s, %s]", async (one, two) => {
    arrive(LONG);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(
      lines(200, failedPart(1, 2, one), failedPart(2, 2, two), {
        type: "done",
        state: "failed",
        from: "model",
        units: 1,
      }),
    );
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() =>
      expect(card().querySelector(".ai-foot")).not.toBeNull(),
    );
    expect(rows()).toHaveLength(2);
    expect(within(card()).queryByRole("button")).toBeNull();
  });

  it('keeps the shown reading through a refused "Read again"', async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    const done = {
      type: "done",
      state: "read",
      from: "model",
      units: 1,
    } as const;
    answers.push(lines(200, part(1, 1, SHORT_READING), done));
    fireEvent.click(offer() as HTMLElement);
    const again = await screen.findByRole("button", { name: "Read again" });
    const before = rows();
    expect(before).toHaveLength(5);
    // Kept while the new reading starts…
    const stream = answer(429);
    answers.push(stream);
    fireEvent.click(again);
    await waitFor(() =>
      expect(card().querySelector(".ai-status")?.textContent).toBe(
        "Reading with AI…",
      ),
    );
    expect(rows()).toEqual(before);
    // …and when it is refused.
    await act(async () => {
      stream.send({
        type: "refused",
        state: "allowance",
        scope: "user",
        units: 1,
        left: 0,
        limit: 100,
        resetAt: RESET,
      });
      stream.end();
    });
    await waitFor(() =>
      expect(card().querySelector(".ai-status")?.textContent).toBe(
        `This reading needs 1, and you have 0 of today’s 100 left. They renew at ${at(RESET)}.`,
      ),
    );
    expect(rows()).toEqual(before);
    expect(card().querySelector(".ai-sentence")?.textContent).toContain(
      "Move, and show yourselves unto the earth.",
    );
  });

  it("offers a retry for a part not sent after another's failure (2H review 2)", async () => {
    arrive(LONG);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(
      lines(200, failedPart(1, 2, "timeout"), failedPart(2, 2, "not read"), {
        type: "done",
        state: "failed",
        from: "model",
        units: 1,
      }),
    );
    fireEvent.click(offer() as HTMLElement);
    const retry = await within(card()).findByRole("button", {
      name: "Try again",
    });
    expect(rows()).toEqual([
      "Part 1 of 2: The model took too long.",
      "Part 2 of 2: Not sent.",
    ]);
    // Nothing blames the privacy terms.
    expect(card().textContent).not.toMatch(/privacy/);
    expect(said(retry)).toBe("Try again | uses 1 of today’s 100");
  });

  it("says the text may have been sent when only stored parts came before the answer stopped", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(lines(200, part(1, 2, SHORT_READING, "store")));
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() =>
      expect(card().querySelector(".ai-status")?.textContent).toBe(
        "The reading stopped arriving.",
      ),
    );
    expect(card().querySelector(".ai-foot")?.textContent).toMatch(
      /^Your text may have been sent for this reading,/,
    );
  });

  it("says the text may have been sent when the answer stops before any part", async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    answers.push(lines(200));
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() =>
      expect(card().querySelector(".ai-status")?.textContent).toBe(
        "The reading stopped arriving.",
      ),
    );
    expect(card().querySelector(".ai-foot")?.textContent).toBe(
      "Your text may have been sent for this reading, and if so it may still be read. Our server keeps the text and its reading for a day and deletes them within two days, so trying again may use less, or none.",
    );
    expect(
      said(within(card()).getByRole("button", { name: "Try again" })),
    ).toBe("Try again | uses at most 1 of today’s 100");
  });

  it('prices a retry after a failed "Read again" at most the whole text', async () => {
    arrive(LONGER);
    await waitFor(() => expect(offer()).not.toBeNull());
    const first = reading([["MADRIAX", "confirmed", "heavens"]], "Heavens.");
    answers.push(
      lines(200, part(1, 2, first), part(2, 2, first), {
        type: "done",
        state: "read",
        from: "model",
        units: 2,
      }),
    );
    fireEvent.click(offer() as HTMLElement);
    const again = await screen.findByRole("button", { name: "Read again" });
    answers.push(
      lines(200, failedPart(1, 2, "timeout"), part(2, 2, first), {
        type: "done",
        state: "partial",
        from: "model",
        units: 2,
      }),
    );
    fireEvent.click(again);
    const retry = await screen.findByRole("button", {
      name: "Try the failed part again",
    });
    expect(said(retry)).toBe(
      "Try the failed part again | uses at most 2 of today’s 100",
    );
  });

  it('repeats "Read again" when it was busy, and replaces the reading as it lands', async () => {
    arrive(SHORT);
    await waitFor(() => expect(offer()).not.toBeNull());
    const done = {
      type: "done",
      state: "read",
      from: "model",
      units: 1,
    } as const;
    answers.push(lines(200, part(1, 1, SHORT_READING), done));
    fireEvent.click(offer() as HTMLElement);
    const again = await screen.findByRole("button", { name: "Read again" });
    answers.push(lines(409, { type: "refused", state: "busy" }));
    fireEvent.click(again);
    const retry = await within(card()).findByRole("button", {
      name: "Try again",
    });
    expect(card().querySelector(".ai-status")?.textContent).toBe(
      "This text is being read just now. Try again shortly.",
    );
    expect(rows()).toHaveLength(5);
    answers.push(
      lines(
        200,
        part(1, 1, reading([["ZACAR", "confirmed", "move on"]], "Move on.")),
        done,
      ),
    );
    fireEvent.click(retry);
    await waitFor(() => expect(sent()).toHaveLength(3));
    expect(sent().map((one) => one.again)).toEqual([false, true, true]);
    await waitFor(() =>
      expect(rows()).toEqual(["ZACAR move on confirmed · , Key 3.14 ZACAR"]),
    );
  });

  it("ends a stalled answer as lost at its deadline", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      arrive(SHORT);
      await waitFor(() => expect(offer()).not.toBeNull());
      const stream = answer();
      answers.push(stream);
      fireEvent.click(offer() as HTMLElement);
      await act(async () => {
        stream.send(part(1, 2, SHORT_READING));
      });
      await waitFor(() => expect(rows()).toHaveLength(5));
      await act(async () => {
        vi.advanceTimersByTime(READING_DEADLINE_MS - 1000);
      });
      expect(card().querySelector(".ai-status")?.textContent).toBe(
        "Reading part 2 of 2…",
      );
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      await waitFor(() =>
        expect(card().querySelector(".ai-status")?.textContent).toBe(
          "The reading stopped arriving.",
        ),
      );
      expect(card().querySelector(".ai-foot")?.textContent).toMatch(
        /^Your text was sent for this reading,/,
      );
      expect(live().textContent).toBe("The reading stopped arriving.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows server text that names no label of ours as no label", async () => {
    arrive(LONG);
    await waitFor(() => expect(offer()).not.toBeNull());
    const odd = reading([["MADRIAX", "confirmed", "heavens"]]);
    answers.push(
      lines(
        200,
        part(1, 2, {
          ...odd,
          sentence: {
            shown: false,
            withheld: "constructor",
            contentWords: 1,
            supported: 0,
          } as unknown as CheckedReading["sentence"],
        }),
        failedPart(2, 2, "constructor"),
        { type: "done", state: "partial", from: "model", units: 1 },
      ),
    );
    fireEvent.click(offer() as HTMLElement);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows()[1]).toBe("Part 2 of 2: The model failed.");
    expect(card().textContent).not.toMatch(/function|native code/);
    expect(card().querySelector(".ai-note")?.textContent).toBe(
      "The model’s sentence for part 1 is withheld: ",
    );
  });
});
