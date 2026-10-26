// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gdHallPug, parseHallSource, printHallSource } from "@/doc/gdHallPug";
import HallPlayground, {
  clipped,
  exportFilename,
  HALL_LAYOUT_KEY,
  matchingPreset,
  presetEntry,
  validHall,
} from "./HallPlayground";
import { HALL_DRAFT_KEY, MAX_HALL_DRAFT } from "./hallDraft";
import { readShareHash, shareFragment } from "./hallShare";
import HallPage from "./page";

const runtime = vi.hoisted(() => ({
  rasterizeSvg: vi.fn(),
  downloadBlob: vi.fn(),
  copySvg: vi.fn(),
  copyPng: vi.fn(),
  copyText: vi.fn(),
}));
vi.mock("@/export/exportRuntime", () => runtime);

// How often the page reads source as a hall.
const parses = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/doc/gdHallPug", async (importActual) => {
  const actual = await importActual<typeof import("@/doc/gdHallPug")>();
  return {
    ...actual,
    parseHallSource: (text: string) => {
      parses.count++;
      // A parser message that repeats much of what it read.
      if (text.startsWith("//- echo\n"))
        throw new Error(`Line 1: ${"echo ".repeat(100)}`);
      return actual.parseHallSource(text);
    },
  };
});

// A link's hall is read as `hallShare` reads it, unless a test sets the
// moment it arrives.
vi.mock("./hallShare", async (importActual) => {
  const actual = await importActual<typeof import("./hallShare")>();
  return { ...actual, readShareHash: vi.fn(actual.readShareHash) };
});

// The Pug source panel is CodeMirror; its own tests cover it. Here it is a
// plain text box, so the page's handling of what is typed can be tested.
vi.mock("@/doc/RitualSourceEditor", () => ({
  default: ({
    value,
    onChange,
    label,
    diagnostic,
    headerless,
  }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    diagnostic?: { source: string; message: string } | null;
    headerless?: boolean;
  }) => (
    <div>
      <textarea
        aria-label={label}
        value={value}
        data-headerless={headerless}
        onChange={(event) => onChange(event.target.value)}
      />
      {diagnostic?.source === value && (
        <p data-testid="source-error">{diagnostic.message}</p>
      )}
    </div>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/gd/hall");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  // A link's hall a test queued and did not use goes with it.
  vi.mocked(readShareHash).mockReset();
});

const sourceBox = () =>
  // Hidden while a dialog closes: MUI hides the page from assistive
  // technology until its transition ends.
  screen.getByRole("textbox", {
    name: "Temple hall source",
    hidden: true,
  }) as HTMLTextAreaElement;
const source = () => sourceBox().value;
const type = (text: string) =>
  fireEvent.change(sourceBox(), { target: { value: text } });
/** Typing rests, and the page reads what was typed. */
const rest = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 250)));
/** The titles of the halls drawn (the editor's and the export's). */
const titles = () =>
  [...document.querySelectorAll("svg[role=img]")].map(
    (svg) => svg.querySelector("title")?.textContent,
  );
const presetShown = () =>
  screen.getByRole("combobox", { name: "Preset", hidden: true }).textContent;

function choose(title: string) {
  fireEvent.mouseDown(
    screen.getByRole("combobox", { name: "Preset", hidden: true }),
  );
  fireEvent.click(
    screen.getByRole("option", { name: new RegExp(`^${title}`) }),
  );
}

/** One visual gesture: the first object nudged right with the keyboard. */
function nudgeFirst() {
  const surface = screen.getByRole("application");
  fireEvent.keyDown(surface, { key: "Tab" });
  fireEvent.keyDown(surface, { key: "ArrowRight" });
}

/**
 * The hall rests: read, and kept as the draft. In short spans, since
 * React renders what a span's timers changed only as the span ends.
 */
async function kept() {
  for (let span = 0; span < 4; span++)
    await act(() => new Promise((resolve) => setTimeout(resolve, 250)));
}

/** A source's hall as Pug without IDs, as the page shares it. */
const pugOf = (text: string) =>
  printHallSource(parseHallSource(text), { ids: false });

/** A hall of `count` plain markers: it packs well. */
const markers = (count: number) =>
  `gdHall\n  floor\n${'    marker(text="a", x=1, y=1)\n'.repeat(count)}`;

/** A hall of `count` markers with text that does not compress. */
function noisyHall(count: number) {
  let seed = 7;
  const noise = () => {
    seed = (seed * 48271) % 2147483647;
    return seed.toString(36);
  };
  return `gdHall\n  floor\n${Array.from(
    { length: count },
    (_, n) => `    marker(text="${noise()}${noise()}", x=${n % 16}, y=3)\n`,
  ).join("")}`;
}

describe("the /gd/hall page", { timeout: 20_000 }, () => {
  it("declares the hall fonts once and says where drafts stay", () => {
    const markup = renderToStaticMarkup(<HallPage />);
    const style = markup.match(/<style>(.*?)<\/style>/s)?.[1] ?? "";
    expect(style.match(/@font-face/g)).toHaveLength(3);
    expect(style).toContain('src:url("/fonts/NotoSerif-Italic-latin1.woff2")');
    expect(markup.match(/<style>/g)).toHaveLength(1);
    expect(markup).toContain("kept as a draft in this browser only");
    expect(markup).toContain("<code>/hall</code>");
    // The editor loads after the page: the shell draws no hall, and says
    // so where scripts are off.
    expect(markup).not.toContain('role="img"');
    expect(markup).toContain(
      "<noscript><p>The hall editor needs JavaScript, which is off in this browser.</p></noscript>",
    );
  });

  it("starts from a copy of the Neophyte hall, in split view", () => {
    render(<HallPlayground />);
    expect(presetShown()).toBe("Neophyte Temple");
    expect(source()).toMatch(/^gdHall#[A-Za-z0-9]{16}\(/);
    expect(pugOf(source())).toBe(gdHallPug(HALL_PRESETS[0].hall));
    expect(sourceBox().getAttribute("data-headerless")).toBe("true");
    expect(screen.getByRole("application")).toBeTruthy();
    expect(titles()).toEqual(["Neophyte Temple", "Neophyte Temple"]);
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(
      screen.getByRole("link", { name: "public/pics/neophyte.svg" }),
    ).toBeTruthy();
  });

  it("puts the editor below the page's text column, not inside it", () => {
    const markup = renderToStaticMarkup(<HallPage />);
    // The text column holds the page's words and closes before the
    // editor's band, which split view widens to the screen (Gadi, 20
    // October 2026); the sources follow in a column of their own.
    const parts = [...markup.matchAll(/data-hall-page="(\w+)"/g)];
    expect(parts.map(([, part]) => part)).toEqual(["text", "editor", "text"]);
    const [words, editor, sources] = parts.map(({ index }) => index);
    const text = markup.indexOf("kept as a draft in this browser only");
    expect(words).toBeLessThan(text);
    expect(text).toBeLessThan(editor);
    expect(markup.indexOf("Magick.ly is open-source")).toBeGreaterThan(sources);
  });

  it("takes the screen's width in split view only", () => {
    render(<HallPlayground />);
    const toolbar = screen.getByRole("toolbar", { name: "Temple hall editor" });
    const playground = () => toolbar.closest("[data-layout]");
    // The toolbar is the playground's own child, which keeps to the text
    // column in every layout; only the panels widen.
    expect(toolbar.parentElement).toBe(playground());
    expect(playground()?.getAttribute("data-layout")).toBe("split");
    fireEvent.click(screen.getByRole("button", { name: "Visual" }));
    expect(playground()?.getAttribute("data-layout")).toBe("visual");
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(playground()?.getAttribute("data-layout")).toBe("source");
  });

  it("splits source and drawing three parts to five on a wide screen", () => {
    // jsdom lays nothing out, so the stylesheet is read: 3:5 gives the
    // hall editor 761px at 1280 x 800 with classic scrollbars, beside its
    // panel (Gadi, 21 October 2026); 2:3 gave 730 and docked it.
    const css = readFileSync(
      "src/app/gd/hall/hallPlayground.module.css",
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(
      /@media \(min-width: 900px\) \{\s*\.panels\[data-layout="split"\] \{\s*grid-template-columns: ([^;]*);/.exec(
        css,
      )?.[1],
    ).toBe("minmax(0, 3fr) minmax(0, 5fr)");
  });

  it("remembers its layout apart from the ritual editor's", () => {
    render(<HallPlayground />);
    expect(
      within(screen.getByRole("group", { name: "Hall editor layout" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Source", "Split", "Visual"]);
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(screen.queryByRole("application")).toBeNull();
    expect(localStorage.getItem(HALL_LAYOUT_KEY)).toBe("source");
    fireEvent.click(screen.getByRole("button", { name: "Visual" }));
    expect(
      screen.queryByRole("textbox", { name: "Temple hall source" }),
    ).toBeNull();
    expect(screen.getByRole("application")).toBeTruthy();
  });
});

describe("presets", { timeout: 20_000 }, () => {
  it("loads another at once while the hall is unchanged", () => {
    render(<HallPlayground />);
    choose("Zelator Temple 1");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(presetShown()).toBe("Zelator Temple 1");
    expect(pugOf(source())).toBe(gdHallPug(HALL_PRESETS[1].hall));
  });

  it("asks before replacing a hall changed by typing not yet read", () => {
    render(<HallPlayground />);
    type(source().replace('text="Neophyte Temple"', 'text="Mine"'));
    const mine = source();
    // The drawing is still the unchanged Neophyte; the typing is not.
    expect(titles()).toEqual(["Neophyte Temple", "Neophyte Temple"]);
    choose("Zelator Temple 1");
    expect(
      screen.getByRole("dialog", { name: "Replace your hall?" }),
    ).toBeTruthy();
    expect(source()).toBe(mine);
  });

  it("asks before replacing a changed hall, which Undo brings back", async () => {
    render(<HallPlayground />);
    nudgeFirst();
    expect(presetShown()).toBe("Your hall (changed)");
    const changed = source();
    choose("Theoricus Temple 1");
    const dialog = screen.getByRole("dialog", { name: "Replace your hall?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(source()).toBe(changed);
    choose("Theoricus Temple 1");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Replace",
      }),
    );
    expect(presetShown()).toBe("Theoricus Temple 1");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toBe(changed);
  });

  it("closes the question with Escape, keeping the hall", async () => {
    render(<HallPlayground />);
    nudgeFirst();
    const changed = source();
    choose("Zelator Temple 2");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(source()).toBe(changed);
  });

  it("does nothing when the preset shown is chosen again", () => {
    render(<HallPlayground />);
    const first = source();
    choose("Neophyte Temple");
    expect(source()).toBe(first);
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("gives each copy fresh IDs and knows an unchanged one", () => {
    const a = presetEntry(HALL_PRESETS[0]);
    const b = presetEntry(HALL_PRESETS[0]);
    expect(a.hall?.id).not.toBe(b.hall?.id);
    expect(matchingPreset(a)).toBe(HALL_PRESETS[0]);
    expect(matchingPreset({ ...a, hall: null })).toBeUndefined();
  });
});

describe("source and drawing in step", { timeout: 20_000 }, () => {
  it("draws what is typed, and prints what is drawn", async () => {
    render(<HallPlayground />);
    type(source().replace('text="Neophyte Temple"', 'text="My hall"'));
    await rest();
    expect(titles()).toEqual(["My hall", "My hall"]);
    nudgeFirst();
    // The visual edit reprints the source, IDs and all.
    expect(source()).toMatch(
      /officer#[A-Za-z0-9]{16}\(role="imperator", x=2\.1\)/,
    );
    expect(source()).toContain('text="My hall"');
  });

  it("locks the drawing while the source has an error", async () => {
    render(<HallPlayground />);
    const good = source();
    type(`${good}  each x in y\n`);
    await rest();
    expect(screen.getByTestId("source-error").textContent).toMatch(
      /^Line \d+:/,
    );
    expect(
      screen.getByText(
        "The source has an error: correct it to edit the drawing again.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("application").getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Copy Pug source" }),
    ).toHaveProperty("disabled", true);
    // Said beside the buttons, but not announced at each keystroke.
    const said = screen.getByText("Correct the source to share the hall.");
    expect(said.closest("[role=status], [aria-live]")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
    type(good);
    await rest();
    expect(
      screen.getByRole("application").getAttribute("aria-disabled"),
    ).toBeNull();
  });

  it("reads typed source as a hall once typing rests", async () => {
    render(<HallPlayground />);
    const first = source();
    parses.count = 0;
    for (const text of ["A", "AB", "ABC"])
      type(first.replace("Neophyte Temple", text));
    // The text shows at once; the drawing waits for the rest.
    expect(source()).toContain('text="ABC"');
    expect(titles()).toEqual(["Neophyte Temple", "Neophyte Temple"]);
    expect(parses.count).toBe(0);
    await rest();
    expect(titles()).toEqual(["ABC", "ABC"]);
    expect(parses.count).toBe(1);
  });

  it("reads unread typing before an undo, a gesture or a copy", async () => {
    runtime.copyText.mockResolvedValue(undefined);
    render(<HallPlayground />);
    const first = source();
    type(first.replace("Neophyte Temple", "Mine"));
    // Undo takes the unread edit back whole, and Redo restores it.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toBe(first);
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(titles()).toEqual(["Mine", "Mine"]);
    type(source().replace('text="Mine"', 'text="Copied"'));
    fireEvent.click(screen.getByRole("button", { name: "Copy Pug source" }));
    await screen.findByText(
      "Copied the Pug source. Paste it into a ritual's source.",
    );
    expect(runtime.copyText.mock.calls[0][0]).toContain('text="Copied"');
    type(source().replace('text="Copied"', 'text="Typed"'));
    // A gesture on the hall drawn before the typing would write over it:
    // it is refused, and the typing kept.
    const typed = source();
    nudgeFirst();
    expect(source()).toBe(typed);
    expect(titles()).toEqual(["Typed", "Typed"]);
    expect(
      screen.getAllByText("That change was not made; the hall is as it was."),
    ).not.toHaveLength(0);
    // Typing that has not paused is one step: Undo takes both edits back.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toContain('text="Mine"');
  });

  it("refuses a gesture made before read typing is drawn", async () => {
    render(<HallPlayground />);
    const surface = screen.getByRole("application");
    fireEvent.keyDown(surface, { key: "Tab" });
    const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      type(source().replace('text="Neophyte Temple"', 'text="Mine"'));
      const mine = source();
      // The typing is read as its wait ends; a key press moves the
      // selection before React draws the typed hall (in a task of its own).
      scope.IS_REACT_ACT_ENVIRONMENT = false;
      try {
        vi.advanceTimersByTime(200);
      } finally {
        scope.IS_REACT_ACT_ENVIRONMENT = true;
      }
      fireEvent.keyDown(surface, { key: "ArrowRight" });
      vi.useRealTimers();
      await rest();
      expect(source()).toBe(mine);
      expect(titles()).toEqual(["Mine", "Mine"]);
      expect(
        screen.getAllByText("That change was not made; the hall is as it was."),
      ).not.toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("makes typing one undo step once it pauses, and redoes it", async () => {
    render(<HallPlayground />);
    const first = source();
    type(first.replace("Neophyte Temple", "A"));
    type(first.replace("Neophyte Temple", "AB"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toBe(first);
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(source()).toContain('text="AB"');
    type(first.replace("Neophyte Temple", "ABC"));
    // Once the typing settles, undo goes back one step, to "AB".
    await act(() => new Promise((resolve) => setTimeout(resolve, 900)));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toContain('text="AB"');
  });

  it("refuses a drawn hall that is not valid source", () => {
    const hall = presetEntry(HALL_PRESETS[0]).hall;
    if (!hall) throw new Error("no hall");
    expect(validHall(hall)).toBe(true);
    expect(validHall({ ...hall, attrs: { type: "cup" } })).toBe(false);
    expect(
      validHall({
        ...hall,
        children: [{ kind: "text", text: "loose text" }],
      }),
    ).toBe(false);
  });

  it("takes the drawing's undo and redo keys into its history", () => {
    render(<HallPlayground />);
    const first = source();
    nudgeFirst();
    const surface = screen.getByRole("application");
    fireEvent.keyDown(surface, { key: "z", ctrlKey: true });
    expect(source()).toBe(first);
    fireEvent.keyDown(surface, { key: "y", ctrlKey: true });
    expect(source()).not.toBe(first);
    // The editor keeps no buttons of its own: the page's are the ones.
    expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(1);
  });
});

describe("the draft", { timeout: 20_000 }, () => {
  const draft = () =>
    JSON.parse(localStorage.getItem(HALL_DRAFT_KEY) ?? "null") as {
      v: number;
      source: string;
    } | null;

  it("keeps typing read but not yet drawn as the page goes", async () => {
    render(<HallPlayground />);
    const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      type(source().replace('text="Neophyte Temple"', 'text="Mine"'));
      const mine = source();
      // The typing is read as its wait ends, and the page goes before
      // React draws the typed hall (in a task of its own).
      scope.IS_REACT_ACT_ENVIRONMENT = false;
      try {
        vi.advanceTimersByTime(200);
        window.dispatchEvent(new Event("pagehide"));
        expect(titles()).toEqual(["Neophyte Temple", "Neophyte Temple"]);
        expect(draft()?.source).toBe(mine);
      } finally {
        scope.IS_REACT_ACT_ENVIRONMENT = true;
      }
      vi.useRealTimers();
      await rest();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the hall in this browser and restores it on return", async () => {
    const first = render(<HallPlayground />);
    nudgeFirst();
    const changed = source();
    await waitFor(() => expect(draft()?.source).toBe(changed));
    first.unmount();
    render(<HallPlayground />);
    expect(source()).toBe(changed);
    expect(screen.getByText("Draft restored.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(presetShown()).toBe("Neophyte Temple");
    expect(screen.queryByText("Draft restored.")).toBeNull();
  });

  it("lets a note be closed", () => {
    localStorage.setItem(HALL_DRAFT_KEY, "{not json");
    render(<HallPlayground />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(
      screen.queryByText(/The draft kept in this browser could not be read/),
    ).toBeNull();
  });

  it("restores an unchanged preset without a note", () => {
    localStorage.setItem(
      HALL_DRAFT_KEY,
      JSON.stringify({ v: 1, source: presetEntry(HALL_PRESETS[2]).source }),
    );
    render(<HallPlayground />);
    expect(presetShown()).toBe("Zelator Temple 2");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a draft whose source has an error, as source", () => {
    localStorage.setItem(
      HALL_DRAFT_KEY,
      JSON.stringify({ v: 1, source: "gdHall\n  floor\n    altar(x=.5)\n" }),
    );
    localStorage.setItem(HALL_LAYOUT_KEY, "visual");
    render(<HallPlayground />);
    expect(screen.getByTestId("source-error").textContent).toMatch(/^Line 3:/);
    expect(screen.getByText("Draft restored.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Visual" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(
      screen.getByText("Correct the source to share the hall."),
    ).toBeTruthy();
  });

  it.each([
    ["corrupt", "{not json"],
    ["of another version", JSON.stringify({ v: 9, source: "gdHall\n" })],
    ["oversized", "x".repeat(MAX_HALL_DRAFT + 100)],
  ])("starts from the Neophyte when the draft is %s", (_name, value) => {
    localStorage.setItem(HALL_DRAFT_KEY, value);
    render(<HallPlayground />);
    expect(presetShown()).toBe("Neophyte Temple");
    expect(
      screen.getByText(/The draft kept in this browser could not be read/),
    ).toBeTruthy();
  });

  it("does not restore a draft of more nodes than it keeps", () => {
    localStorage.setItem(
      HALL_DRAFT_KEY,
      JSON.stringify({ v: 1, source: markers(1000) }),
    );
    render(<HallPlayground />);
    expect(presetShown()).toBe("Neophyte Temple");
    expect(
      screen.getByText(/The draft kept in this browser could not be read/),
    ).toBeTruthy();
  });

  it("neither keeps nor shares a hall of more nodes than it keeps", async () => {
    // The source alone: a thousand markers draw slowly in jsdom.
    localStorage.setItem(HALL_LAYOUT_KEY, "source");
    render(<HallPlayground />);
    const before = localStorage.getItem(HALL_DRAFT_KEY);
    type(markers(1000));
    expect(
      await screen.findByText(
        "This hall is too large to keep as a draft in this browser: a draft holds at most 1,000 nodes and 96,000 characters.",
        {},
        { timeout: 20_000 },
      ),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        "This hall is too large for a share link (1,002 nodes; the most is 1,000). Copy its Pug source instead.",
        {},
        { timeout: 20_000 },
      ),
    ).toBeTruthy();
    expect(localStorage.getItem(HALL_DRAFT_KEY)).toBe(before);
  }, 30_000);

  it("works when storage is blocked, and says the draft is not kept", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    render(<HallPlayground />);
    expect(presetShown()).toBe("Neophyte Temple");
    nudgeFirst();
    expect(
      await screen.findByText(
        "This browser is not keeping a draft: its storage is unavailable or full.",
      ),
    ).toBeTruthy();
  });
});

describe("two tabs", { timeout: 20_000 }, () => {
  // Each write reaches the other tabs as a `storage` event, after it, as
  // a browser sends it. Both pages here share one window and one storage;
  // a page knows its own write when it hears it.
  beforeEach(() => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      const oldValue = this.getItem(key);
      setItem.call(this, key, value);
      setTimeout(() =>
        window.dispatchEvent(
          new StorageEvent("storage", { key, oldValue, newValue: value }),
        ),
      );
    });
  });

  /** A page in a tab of its own. */
  function openTab() {
    const page = render(<HallPlayground />);
    const tab = within(page.container);
    const box = () =>
      tab.getByRole("textbox", {
        name: "Temple hall source",
        hidden: true,
      }) as HTMLTextAreaElement;
    return {
      ...tab,
      unmount: page.unmount,
      source: () => box().value,
      /** Gives the hall's caption a new text. */
      caption(text: string) {
        fireEvent.change(box(), {
          target: {
            value: box().value.replace(/caption(#\w+)?\(text="[^"]*"/, (m) =>
              m.replace(/text="[^"]*"/, `text="${text}"`),
            ),
          },
        });
      },
    };
  }
  const draft = () =>
    JSON.parse(localStorage.getItem(HALL_DRAFT_KEY) ?? "null")?.source as
      | string
      | undefined;

  it("never writes an idle tab's old draft over a newer one", async () => {
    const a = openTab();
    a.caption("Seven");
    await kept();
    expect(draft()).toContain('text="Seven"');
    const b = openTab();
    expect(b.source()).toContain('text="Seven"');
    a.caption("Six");
    await kept();
    expect(draft()).toContain('text="Six"');
    // Both tabs go: the idle one changed nothing, so writes nothing.
    a.unmount();
    window.dispatchEvent(new Event("pagehide"));
    await kept();
    expect(draft()).toContain('text="Six"');
    // Had it stayed, it is told, and offered the newer draft.
    expect(b.getByText("A newer draft from another tab.")).toBeTruthy();
    // Loading it is one step: Undo brings this tab's hall back.
    fireEvent.click(b.getByRole("button", { name: "Load it" }));
    expect(b.source()).toContain('text="Six"');
    expect(b.queryByText("A newer draft from another tab.")).toBeNull();
    fireEvent.click(b.getByRole("button", { name: "Undo" }));
    expect(b.source()).toContain('text="Seven"');
  });

  it("lets the author choose when both tabs changed the hall", async () => {
    const a = openTab();
    const b = openTab();
    a.caption("From A");
    await kept();
    expect(draft()).toContain('text="From A"');
    b.caption("From B");
    await kept();
    // Not written over: said, with the choice.
    expect(draft()).toContain('text="From A"');
    expect(
      b.getByText(/^Another tab kept a newer draft while this one has changes/),
    ).toBeTruthy();
    window.dispatchEvent(new Event("pagehide"));
    expect(draft()).toContain('text="From A"');
    fireEvent.click(b.getByRole("button", { name: "Keep mine" }));
    expect(draft()).toContain('text="From B"');
    // Now the first tab is offered B's draft, and loads it.
    await kept();
    fireEvent.click(a.getByRole("button", { name: "Load it" }));
    expect(a.source()).toContain('text="From B"');
    await kept();
    expect(draft()).toContain('text="From B"');
  });

  it("loads the other tab's draft on request in a conflict too", async () => {
    const a = openTab();
    const b = openTab();
    a.caption("From A");
    await kept();
    b.caption("From B");
    await kept();
    fireEvent.click(b.getByRole("button", { name: "Load it" }));
    expect(b.source()).toContain('text="From A"');
    await kept();
    expect(draft()).toContain('text="From A"');
    // Undo brings this tab's changes back, which are then its own again.
    fireEvent.click(b.getByRole("button", { name: "Undo" }));
    expect(b.source()).toContain('text="From B"');
    await kept();
    expect(draft()).toContain('text="From B"');
  });
});

describe("sharing and export", { timeout: 20_000 }, () => {
  it("copies a share link that opens the hall in a fresh browser", async () => {
    runtime.copyText.mockResolvedValue(undefined);
    const first = render(<HallPlayground />);
    type(source().replace('text="Neophyte Temple"', 'text="Shared hall"'));
    const button = screen.getByRole("button", { name: "Copy share link" });
    await waitFor(() => expect(button).toHaveProperty("disabled", false));
    fireEvent.click(button);
    await screen.findByText(/^Copied a link to this hall as it is now/);
    const [url] = runtime.copyText.mock.calls[0] as [string];
    const link = new URL(url);
    expect(link.pathname).toBe("/gd/hall");
    expect(link.search).toBe("");
    expect(link.hash).toMatch(/^#hall=1\./);
    const shared = pugOf(source());
    first.unmount();
    // A fresh browser: no draft. The link's hall opens, as one step.
    localStorage.clear();
    window.history.replaceState(null, "", `/gd/hall${link.hash}`);
    render(<HallPlayground />);
    await screen.findByText(
      "Opened a hall from a share link. Once you change it, it is kept as a draft in this browser.",
    );
    expect(pugOf(source())).toBe(shared);
    expect(titles()).toContain("Shared hall");
    expect(window.location.hash).toBe("");
    // Not written over the draft until it is changed.
    await kept();
    expect(localStorage.getItem(HALL_DRAFT_KEY) ?? "").not.toContain(
      "Shared hall",
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(presetShown()).toBe("Neophyte Temple");
  });

  it("says when a link cannot be opened, keeping the draft", async () => {
    window.history.replaceState(null, "", "/gd/hall#hall=1.%%%");
    render(<HallPlayground />);
    await screen.findByText(
      "This share link could not be opened: it is damaged.",
    );
    expect(presetShown()).toBe("Neophyte Temple");
    expect(window.location.hash).toBe("");
    cleanup();
    const notHall = await shareFragment("p <img src=x onerror=alert(1)>\n");
    if (!("fragment" in notHall)) throw new Error("too long");
    window.history.replaceState(null, "", `/gd/hall#${notHall.fragment}`);
    render(<HallPlayground />);
    await screen.findByText(
      /^This share link could not be opened: its hall does not read/,
    );
    expect(document.querySelector("img[src=x]")).toBeNull();
  });

  it("refuses a link to a hall of more nodes than it keeps", async () => {
    const link = await shareFragment(markers(1000));
    if (!("fragment" in link)) throw new Error("too long");
    window.history.replaceState(null, "", `/gd/hall#${link.fragment}`);
    render(<HallPlayground />);
    await screen.findByText(
      "This share link could not be opened: its hall holds more than 1,000 nodes, more than a shared hall may.",
    );
    expect(presetShown()).toBe("Neophyte Temple");
  });

  it("does nothing once the page has gone", async () => {
    const zelator = await shareFragment(gdHallPug(HALL_PRESETS[1].hall));
    if (!("fragment" in zelator)) throw new Error("too long");
    for (const hash of [`#${zelator.fragment}`, "#hall=1.%%%"]) {
      window.history.replaceState(null, "", `/gd/hall${hash}`);
      render(<HallPlayground />).unmount();
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      // The link was left as it was: nothing ran after unmounting.
      expect(window.location.hash).toBe(hash);
    }
  });

  it("says when the browser cannot make a share link", async () => {
    class Broken {
      constructor() {
        throw new Error("unsupported");
      }
    }
    vi.stubGlobal("CompressionStream", Broken);
    try {
      render(<HallPlayground />);
      expect(
        await screen.findByText("This browser could not make a share link."),
      ).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("says when the browser refuses to copy a share link", async () => {
    runtime.copyText.mockRejectedValue(new Error("denied"));
    render(<HallPlayground />);
    const button = screen.getByRole("button", { name: "Copy share link" });
    await waitFor(() => expect(button).toHaveProperty("disabled", false));
    fireEvent.click(button);
    await screen.findByText(
      "Could not copy: the browser refused the clipboard.",
    );
  });

  it("keeps an existing draft while a shared hall is unchanged", async () => {
    const mine = presetEntry(HALL_PRESETS[4]).source;
    localStorage.setItem(
      HALL_DRAFT_KEY,
      JSON.stringify({ v: 1, source: mine }),
    );
    const zelator = await shareFragment(gdHallPug(HALL_PRESETS[1].hall));
    if (!("fragment" in zelator)) throw new Error("too long");
    window.history.replaceState(null, "", `/gd/hall#${zelator.fragment}`);
    render(<HallPlayground />);
    await screen.findByText(
      "Opened a hall from a share link. Your own draft stays in this browser until you change this hall; Undo goes back to the hall you had.",
    );
    expect(presetShown()).toBe("Zelator Temple 1");
    await kept();
    expect(
      JSON.parse(localStorage.getItem(HALL_DRAFT_KEY) ?? "{}").source,
    ).toBe(mine);
  });

  it("keeps the draft while the shared hall shows, through Undo and Redo", async () => {
    const mine = presetEntry(HALL_PRESETS[4]).source;
    localStorage.setItem(
      HALL_DRAFT_KEY,
      JSON.stringify({ v: 1, source: mine }),
    );
    const zelator = await shareFragment(gdHallPug(HALL_PRESETS[1].hall));
    if (!("fragment" in zelator)) throw new Error("too long");
    window.history.replaceState(null, "", `/gd/hall#${zelator.fragment}`);
    render(<HallPlayground />);
    await waitFor(() => expect(presetShown()).toBe("Zelator Temple 1"));
    const stored = () =>
      JSON.parse(localStorage.getItem(HALL_DRAFT_KEY) ?? "{}").source;
    await kept();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toBe(mine);
    await kept();
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(presetShown()).toBe("Zelator Temple 1");
    await kept();
    window.dispatchEvent(new Event("pagehide"));
    expect(stored()).toBe(mine);
    // Changed, the shared hall is the author's: kept as the draft.
    nudgeFirst();
    await kept();
    expect(stored()).toBe(source());
  });

  it("says a draft stays when a link is pasted into an open page", async () => {
    const zelator = await shareFragment(gdHallPug(HALL_PRESETS[1].hall));
    if (!("fragment" in zelator)) throw new Error("too long");
    // The link's hall arrives at once: the typing is still unread.
    vi.mocked(readShareHash).mockResolvedValueOnce(
      gdHallPug(HALL_PRESETS[1].hall),
    );
    render(<HallPlayground />);
    nudgeFirst();
    await kept();
    // Typed, and not yet read or kept, as the link arrives.
    type(source().replace('text="Neophyte Temple"', 'text="Mine"'));
    const mine = source();
    act(() => {
      window.history.replaceState(null, "", `/gd/hall#${zelator.fragment}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await screen.findByText(
      "Opened a hall from a share link. Your own draft stays in this browser until you change this hall; Undo goes back to the hall you had.",
    );
    expect(
      JSON.parse(localStorage.getItem(HALL_DRAFT_KEY) ?? "{}").source,
    ).toBe(mine);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toBe(mine);
  });

  it("refuses a gesture made before an opened link's hall is drawn", async () => {
    const zelator = await shareFragment(gdHallPug(HALL_PRESETS[1].hall));
    if (!("fragment" in zelator)) throw new Error("too long");
    // The link's hall arrives at once, so the page opens it in the task
    // the link came in.
    vi.mocked(readShareHash).mockResolvedValueOnce(
      gdHallPug(HALL_PRESETS[1].hall),
    );
    render(<HallPlayground />);
    const mine = source();
    const surface = screen.getByRole("application");
    fireEvent.keyDown(surface, { key: "Tab" });
    const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    scope.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      window.history.replaceState(null, "", `/gd/hall#${zelator.fragment}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      // Opened in the promise steps that follow; React draws it in a
      // task of its own.
      for (let step = 0; step < 20; step++) await null;
      expect(titles()).toEqual(["Neophyte Temple", "Neophyte Temple"]);
    } finally {
      scope.IS_REACT_ACT_ENVIRONMENT = true;
    }
    // A key press on the drawing before then.
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    await screen.findByText(
      "Opened a hall from a share link. Once you change it, it is kept as a draft in this browser.",
    );
    expect(presetShown()).toBe("Zelator Temple 1");
    expect(
      screen.getAllByText("That change was not made; the hall is as it was."),
    ).not.toHaveLength(0);
    // Undo goes back to the hall before the link, as the note says.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toBe(mine);
  });

  it("keeps typing read but not yet drawn as a link opens", async () => {
    const zelator = await shareFragment(gdHallPug(HALL_PRESETS[1].hall));
    if (!("fragment" in zelator)) throw new Error("too long");
    // The link's hall arrives at once, so the page opens it in the task
    // the link came in.
    vi.mocked(readShareHash).mockResolvedValueOnce(
      gdHallPug(HALL_PRESETS[1].hall),
    );
    render(<HallPlayground />);
    nudgeFirst();
    await kept();
    const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      type(source().replace('text="Neophyte Temple"', 'text="Mine"'));
      const mine = source();
      // As in a browser: the typing is read as its wait ends and the link
      // arrives in the same task; React draws the typed hall only in a
      // later one, after the link has opened.
      scope.IS_REACT_ACT_ENVIRONMENT = false;
      try {
        vi.advanceTimersByTime(200);
        window.history.replaceState(null, "", `/gd/hall#${zelator.fragment}`);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        // The link opens in the promise steps that follow, before React
        // renders (in a task of its own): the typed hall is not yet drawn,
        // and is kept as the draft.
        for (let step = 0; step < 20; step++) await null;
        expect(titles()).toEqual(["Neophyte Temple", "Neophyte Temple"]);
        expect(
          JSON.parse(localStorage.getItem(HALL_DRAFT_KEY) ?? "{}").source,
        ).toBe(mine);
      } finally {
        scope.IS_REACT_ACT_ENVIRONMENT = true;
      }
      vi.useRealTimers();
      await screen.findByText(
        "Opened a hall from a share link. Your own draft stays in this browser until you change this hall; Undo goes back to the hall you had.",
      );
      expect(presetShown()).toBe("Zelator Temple 1");
      // The typed hall stays the draft, and is one undo step back.
      await kept();
      expect(
        JSON.parse(localStorage.getItem(HALL_DRAFT_KEY) ?? "{}").source,
      ).toBe(mine);
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(source()).toBe(mine);
    } finally {
      vi.useRealTimers();
    }
  });

  it("says when the draft a link would replace could not be read", async () => {
    localStorage.setItem(HALL_DRAFT_KEY, "{not json");
    const zelator = await shareFragment(gdHallPug(HALL_PRESETS[1].hall));
    if (!("fragment" in zelator)) throw new Error("too long");
    window.history.replaceState(null, "", `/gd/hall#${zelator.fragment}`);
    render(<HallPlayground />);
    await screen.findByText(
      "Opened a hall from a share link. The draft kept in this browser could not be read; once you change this hall, it is kept as the draft in its place.",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    cleanup();
    // A link that cannot be opened leaves both said.
    window.history.replaceState(null, "", "/gd/hall#hall=1.%%%");
    render(<HallPlayground />);
    await screen.findByText(
      "This share link could not be opened: it is damaged.",
    );
    expect(
      screen.getByText(/^The draft kept in this browser could not be read/),
    ).toBeTruthy();
  });

  it("repeats only the start of a parser's message about a link", async () => {
    const echo = await shareFragment("//- echo\ngdHall\n");
    if (!("fragment" in echo)) throw new Error("too long");
    window.history.replaceState(null, "", `/gd/hall#${echo.fragment}`);
    render(<HallPlayground />);
    const note = await screen.findByText(
      /^This share link could not be opened: its hall does not read/,
    );
    expect(note.textContent).toBe(
      `This share link could not be opened: its hall does not read (${`Line 1: ${"echo ".repeat(100)}`.slice(0, 119)}…).`,
    );
    expect(clipped("short")).toBe("short");
    expect(clipped("x".repeat(121))).toHaveLength(120);
  });

  it("opens a link pasted while the page is open", async () => {
    render(<HallPlayground />);
    const zelator = await shareFragment(gdHallPug(HALL_PRESETS[1].hall));
    if (!("fragment" in zelator)) throw new Error("too long");
    act(() => {
      window.history.replaceState(null, "", `/gd/hall#${zelator.fragment}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => expect(presetShown()).toBe("Zelator Temple 1"));
  });

  it("says when a hall is too large to share", async () => {
    // The source alone: a thousand markers draw slowly in jsdom.
    localStorage.setItem(HALL_LAYOUT_KEY, "source");
    render(<HallPlayground />);
    type(noisyHall(1000));
    expect(
      await screen.findByText(
        /^This hall is too large for a share link/,
        {},
        { timeout: 20_000 },
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Copy share link" }),
    ).toHaveProperty("disabled", true);
  }, 30_000);

  it("copies the hall's Pug without IDs, and exports its drawing", async () => {
    runtime.copyText.mockResolvedValue(undefined);
    render(<HallPlayground />);
    choose("Theoricus Temple 1");
    fireEvent.click(screen.getByRole("button", { name: "Copy Pug source" }));
    await screen.findByText(
      "Copied the Pug source. Paste it into a ritual's source.",
    );
    expect(runtime.copyText).toHaveBeenCalledWith(
      gdHallPug(HALL_PRESETS[3].hall),
    );
    fireEvent.click(screen.getByLabelText("Download SVG"));
    expect(await screen.findByText("Downloading SVG")).toBeTruthy();
    const [blob, name] = runtime.downloadBlob.mock.calls[0] as [Blob, string];
    // An unchanged preset's export is named as its published image.
    expect(name).toBe("golden-dawn-theoricus-1-temple.svg");
    const svg = await blob.text();
    expect(svg).toContain(">Theoricus Temple 1</title>");
    // The drawing alone: none of the editor's overlay.
    expect(svg).not.toContain("aria-hidden");
  });

  it("opens a preset from a hall page's link, keeping the draft", async () => {
    const mine = presetEntry(HALL_PRESETS[4]).source;
    localStorage.setItem(
      HALL_DRAFT_KEY,
      JSON.stringify({ v: 1, source: mine }),
    );
    window.history.replaceState(null, "", "/gd/hall#preset=philosophus-3");
    render(<HallPlayground />);
    await screen.findByText(
      "Opened the Philosophus Temple 3. Your own draft stays in this browser until you change this hall; Undo goes back to the hall you had.",
    );
    expect(presetShown()).toBe("Philosophus Temple 3");
    expect(window.location.hash).toBe("");
    await kept();
    expect(
      JSON.parse(localStorage.getItem(HALL_DRAFT_KEY) ?? "{}").source,
    ).toBe(mine);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(source()).toBe(mine);
  });

  it("opens a preset link in a fresh browser and when pasted", async () => {
    window.history.replaceState(null, "", "/gd/hall#preset=portal-2");
    render(<HallPlayground />);
    await screen.findByText(
      "Opened the Portal Temple 2. Once you change it, it is kept as a draft in this browser.",
    );
    expect(presetShown()).toBe("Portal Temple 2");
    act(() => {
      window.history.replaceState(null, "", "/gd/hall#preset=neophyte");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => expect(presetShown()).toBe("Neophyte Temple"));
  });

  it("says when a preset link names no hall, keeping the draft", async () => {
    window.history.replaceState(null, "", "/gd/hall#preset=zelator1");
    render(<HallPlayground />);
    await screen.findByText(
      'This preset link could not be opened: no preset hall is called "zelator1".',
    );
    expect(presetShown()).toBe("Neophyte Temple");
    expect(window.location.hash).toBe("");
  });

  it("names a changed hall's export as a custom hall", () => {
    expect(exportFilename(HALL_PRESETS[12])).toBe(
      "golden-dawn-portal-1-temple",
    );
    expect(exportFilename(undefined)).toBe("gd-hall-custom");
    expect(exportFilename({ ...HALL_PRESETS[0], id: "unknown" })).toBe(
      "gd-hall-custom",
    );
  });

  it("says when the browser refuses the clipboard", async () => {
    runtime.copyText.mockRejectedValue(new Error("denied"));
    render(<HallPlayground />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Pug source" }));
    await screen.findByText(
      "Could not copy: the browser refused the clipboard.",
    );
  });
});
