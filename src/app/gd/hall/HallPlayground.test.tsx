// @vitest-environment jsdom

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
  HALL_LAYOUT_KEY,
  matchingPreset,
  originalDrawing,
  presetEntry,
  validHall,
} from "./HallPlayground";
import { HALL_DRAFT_KEY, MAX_HALL_DRAFT } from "./hallDraft";
import { shareFragment } from "./hallShare";
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
      return actual.parseHallSource(text);
    },
  };
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

describe("the /gd/hall page", () => {
  it("declares the hall fonts once and says where drafts stay", () => {
    const markup = renderToStaticMarkup(<HallPage />);
    const style = markup.match(/<style>(.*?)<\/style>/s)?.[1] ?? "";
    expect(style.match(/@font-face/g)).toHaveLength(3);
    expect(style).toContain('src:url("/fonts/NotoSerif-Italic-latin1.woff2")');
    expect(markup.match(/<style>/g)).toHaveLength(1);
    expect(markup).toContain("kept as a draft in this browser only");
    expect(markup).toContain("<code>/hall</code>");
    // The editor loads after the page: the shell draws no hall.
    expect(markup).not.toContain('role="img"');
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

  it("remembers its layout apart from the ritual editor's", () => {
    render(<HallPlayground />);
    fireEvent.click(screen.getByRole("button", { name: "Pug source" }));
    expect(screen.queryByRole("application")).toBeNull();
    expect(localStorage.getItem(HALL_LAYOUT_KEY)).toBe("source");
    fireEvent.click(screen.getByRole("button", { name: "Visual" }));
    expect(
      screen.queryByRole("textbox", { name: "Temple hall source" }),
    ).toBeNull();
    expect(screen.getByRole("application")).toBeTruthy();
  });
});

describe("presets", () => {
  it("loads another at once while the hall is unchanged", () => {
    render(<HallPlayground />);
    choose("Zelator Temple 1");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(presetShown()).toBe("Zelator Temple 1");
    expect(pugOf(source())).toBe(gdHallPug(HALL_PRESETS[1].hall));
    fireEvent.click(screen.getByLabelText("Compare with the original drawing"));
    expect(
      screen
        .getByRole("img", {
          name: "The original drawing of the Zelator Temple 1",
        })
        .getAttribute("src"),
    ).toBe("/pics/zelator1.svg");
  });

  it("asks before replacing a changed hall, which Undo brings back", async () => {
    render(<HallPlayground />);
    nudgeFirst();
    expect(presetShown()).toBe("Your hall (changed)");
    expect(
      screen.queryByLabelText("Compare with the original drawing"),
    ).toBeNull();
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

  it("gives each copy fresh IDs and knows an unchanged one", () => {
    const a = presetEntry(HALL_PRESETS[0]);
    const b = presetEntry(HALL_PRESETS[0]);
    expect(a.hall?.id).not.toBe(b.hall?.id);
    expect(matchingPreset(a)).toBe(HALL_PRESETS[0]);
    expect(matchingPreset({ ...a, hall: null })).toBeUndefined();
    expect(HALL_PRESETS.map(originalDrawing)).toEqual(
      HALL_PRESETS.map((preset) => `/pics/${preset.id}.svg`),
    );
  });
});

describe("source and drawing in step", () => {
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
    expect(
      screen.getByText("Correct the source to share the hall."),
    ).toBeTruthy();
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

describe("the draft", () => {
  const draft = () =>
    JSON.parse(localStorage.getItem(HALL_DRAFT_KEY) ?? "null") as {
      v: number;
      source: string;
    } | null;

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
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    const kept = localStorage.getItem(HALL_DRAFT_KEY);
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
    expect(localStorage.getItem(HALL_DRAFT_KEY)).toBe(kept);
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

describe("sharing and export", () => {
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
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
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
      "Opened a hall from a share link. Your own draft stays in this browser until you change this hall; Undo goes back to it.",
    );
    expect(presetShown()).toBe("Zelator Temple 1");
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    expect(
      JSON.parse(localStorage.getItem(HALL_DRAFT_KEY) ?? "{}").source,
    ).toBe(mine);
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
    expect(name).toBe("gd-hall-theoricus1.svg");
    const svg = await blob.text();
    expect(svg).toContain(">Theoricus Temple 1</title>");
    // The drawing alone: none of the editor's overlay.
    expect(svg).not.toContain("aria-hidden");
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
