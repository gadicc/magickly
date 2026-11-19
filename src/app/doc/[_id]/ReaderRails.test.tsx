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
import type { RitualRow } from "@/doc/ritualHalls";
import type { DocNode } from "@/schemas";
import ReaderShell from "../ReaderShell";
import { DocView } from "./DocRender";

// The drawing loads its own chunk; the anchor is on the figure.
vi.mock("@/doc/ritualBlocks/GdHallDrawing", () => ({ default: () => null }));

const role = (hidden = false): RitualRow => ({
  type: "declareVar",
  name: "myRole",
  label: "My Role",
  default: "member",
  varType: "select",
  hidden,
  children: [
    { type: "option", value: "member", label: "Member" },
    { type: "option", value: "hierophant", label: "Hierophant" },
  ],
});
const title = (text: string): RitualRow => ({ type: "title", text });
const say = (who: string, words: string): RitualRow => ({
  type: "task",
  role: who,
  say: true,
  children: [{ type: "text", value: words }],
});
const hall = (caption: string): RitualRow => ({
  type: "gdHall",
  children: [{ type: "caption", text: caption }],
});
const doc = (...children: RitualRow[]) => ({ children }) as unknown as DocNode;

function read(ritual: DocNode) {
  return render(
    <ReaderShell title={<h1>Synthetic Opening</h1>}>
      <DocView doc={ritual} searchParams={null} />
    </ReaderShell>,
  );
}

beforeEach(() => {
  history.replaceState(null, "", "/doc/test");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // Here, not only at a test's end, so a failing test cannot leave its
  // frame or scroll stubs to the next.
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

describe("the rails", () => {
  it("draw every control once", () => {
    read(
      doc(
        role(),
        title("Opening"),
        say("hierophant", "Words."),
        hall("Temple"),
        title("Closing"),
      ),
    );
    // jsdom ignores the media queries: the single instances are the point.
    expect(screen.getAllByRole("combobox", { name: "My Role" })).toHaveLength(
      1,
    );
    expect(
      screen.getAllByRole("navigation", { name: "Contents" }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "increase font size" }),
    ).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Temple" })).toHaveLength(1);
    expect(screen.getAllByText("Your next line")).toHaveLength(1);
    // Contents is ritual text; halls sit under their title.
    const contents = screen.getByRole("navigation", { name: "Contents" });
    const links = within(contents).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Opening",
      "Temple",
      "Closing",
    ]);
    expect(links[0].getAttribute("dir")).toBe("auto");
    expect(links[0].getAttribute("lang")).toBe("");
  });

  it("leave out Your next line without a role to read as", () => {
    read(doc(role(true), say("hierophant", "Words.")));
    expect(screen.queryByText("Your next line")).toBeNull();
    cleanup();
    read(doc(say("hierophant", "Words.")));
    expect(screen.queryByText("Your next line")).toBeNull();
    // The floating button keeps its jump.
    fireEvent.click(
      screen.getByRole("button", { name: "SpeedDial basic example" }),
    );
    expect(screen.getByRole("menuitem", { name: "Jump to Next" })).toBeTruthy();
  });

  it("go to a title by its place, recording it without a history entry", () => {
    const scrolled: Element[] = [];
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value(this: Element) {
        scrolled.push(this);
      },
    });
    const replaceState = vi.spyOn(history, "replaceState");
    const entries = history.length;
    const { container } = read(
      doc(title("Again"), say("hierophant", "Words."), title("Again")),
    );
    const contents = screen.getByRole("navigation", { name: "Contents" });
    fireEvent.click(within(contents).getAllByRole("link")[1]);
    // The second of two titles with the same anchor.
    const anchors = container.querySelectorAll("#Again");
    expect(scrolled).toEqual([anchors[1]]);
    expect(replaceState).toHaveBeenCalledOnce();
    expect(location.hash).toBe("#Again");
    expect(history.length).toBe(entries);
  });
});

/**
 * A layout for jsdom, which has none: each top-level row of the ritual is
 * 100 px below the last, from `layout.top`, and everything in a row shares
 * its top; content of a closed `<details>`, as in a browser, has no boxes.
 * jsdom's window is 768 px tall.
 */
const layout = { top: 800 };
function rowOf(element: Element): number {
  let node: Element | null = element;
  while (
    node?.parentElement &&
    !node.parentElement.classList.contains("docBody")
  )
    node = node.parentElement;
  return node?.parentElement
    ? [...node.parentElement.children].indexOf(node)
    : -1;
}
function layOut(top = 800) {
  layout.top = top;
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (
    this: Element,
  ) {
    const closed = this.closest("details:not([open])");
    const hidden = closed && !this.closest("summary");
    return (hidden ? [] : [new DOMRect()]) as unknown as DOMRectList;
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const row = rowOf(this);
      return new DOMRect(0, row < 0 ? 0 : layout.top + row * 100, 100, 50);
    },
  );
}
const countText = () =>
  screen.getByText("Your next line").parentElement?.querySelector("p")
    ?.textContent;

describe("Your next line", () => {
  it("counts tasks, not other rows, to the reader's next line", () => {
    layOut();
    read(
      doc(
        role(),
        say("hierophant", "One."),
        title("Between"),
        { type: "note", children: [{ type: "text", value: "A note." }] },
        hall("Temple"),
        say("hierophant", "Two."),
        say("member", "Mine."),
      ),
    );
    expect(countText()).toBe("2 lines before yours");
    expect(
      screen.getByRole("button", { name: "SpeedDial basic example" })
        .textContent,
    ).toContain("2");
  });

  it("leaves out a task in a closed summary and one in a footnote", () => {
    layOut();
    read(
      doc(
        role(),
        {
          type: "summary",
          summary: "More",
          children: [say("hierophant", "Folded.")],
        },
        {
          type: "task",
          role: "hierophant",
          say: true,
          children: [
            { type: "text", value: "Host." },
            { type: "footnote", children: [say("keryx", "Noted.")] },
          ],
        },
        say("member", "Mine."),
      ),
    );
    expect(screen.getByText("Noted.")).toBeTruthy();
    expect(countText()).toBe("1 line before yours");
  });

  it("follows the role chosen", () => {
    layOut();
    const ritual = doc(
      role(),
      say("hierophant", "One."),
      say("keryx", "Two."),
      say("member", "Mine."),
    );
    const view = render(
      <ReaderShell>
        <DocView doc={ritual} searchParams={null} />
      </ReaderShell>,
    );
    expect(countText()).toBe("2 lines before yours");
    view.rerender(
      <ReaderShell>
        <DocView
          doc={ritual}
          searchParams={new URLSearchParams("myRole=hierophant")}
        />
      </ReaderShell>,
    );
    expect(countText()).toBe("Your line is next");
  });

  it("follows the scroll, once a frame", () => {
    layOut();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});
    read(
      doc(
        role(),
        say("hierophant", "One."),
        say("keryx", "Two."),
        say("member", "Mine."),
      ),
    );
    expect(countText()).toBe("2 lines before yours");
    // Scrolled so the first task is on the screen: one task to go.
    layout.top = 700;
    fireEvent.scroll(window);
    fireEvent.scroll(window);
    expect(frames).toHaveLength(1);
    act(() => frames[0](0));
    expect(countText()).toBe("1 line before yours");
    vi.unstubAllGlobals();
  });

  it("measures again when any summary opens, More Variables too", () => {
    layOut();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});
    read(doc(role(), say("hierophant", "One."), say("member", "Mine.")));
    expect(countText()).toBe("1 line before yours");
    layout.top = 700;
    // `toggle` does not bubble; it reaches the reader on the way down.
    screen
      .getByText("More Variables")
      .closest("details")
      ?.dispatchEvent(new Event("toggle"));
    expect(frames).toHaveLength(1);
    act(() => frames[0](0));
    expect(countText()).toBe("Your line is next");
    vi.unstubAllGlobals();
  });

  it("says when the reader has no more lines, and cannot jump", () => {
    layOut();
    read(doc(role(), say("hierophant", "One."), say("hierophant", "Two.")));
    expect(countText()).toBe("No more lines");
    expect(
      (
        screen.getByRole("button", {
          name: "Jump to your next line",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("jumps, and offers to jump back as well as on", () => {
    layOut();
    const scrolled: Element[] = [];
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value(this: Element) {
        scrolled.push(this);
      },
    });
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    read(doc(role(), say("hierophant", "One."), say("member", "Mine.")));
    expect(countText()).toBe("1 line before yours");
    expect(screen.queryByRole("button", { name: "Jump back" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Jump to your next line" }),
    );
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0].textContent).toContain("Mine.");
    // Both, so the reader can jump on without going back first.
    expect(
      screen.getByRole("button", { name: "Jump to your next line" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Jump back" }));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(screen.queryByRole("button", { name: "Jump back" })).toBeNull();
    vi.unstubAllGlobals();
  });
});

/**
 * The ritual editor's preview: the reader without its rails, in a pane of
 * its own that scrolls while the window does not, inside the editor, which
 * scrolls too, beside the source pane. The pane's box is its own, from the
 * window's top to `bottom`; its client area and scroll position are
 * settable, as jsdom's are not.
 */
function preview(ritual: DocNode, bottom = 768) {
  const pane = { current: null as HTMLDivElement | null };
  const view = render(
    <div data-testid="editor">
      <div data-testid="source" />
      <div
        ref={(element) => {
          if (!element || pane.current) return;
          pane.current = element;
          element.getBoundingClientRect = () => new DOMRect(0, 0, 400, bottom);
          for (const [name, value] of [
            ["clientTop", 0],
            ["clientHeight", bottom],
            ["scrollTop", 0],
          ] as const)
            Object.defineProperty(element, name, {
              configurable: true,
              writable: true,
              value,
            });
        }}
      >
        <DocView
          doc={ritual}
          searchParams={null}
          chrome={false}
          scrollPane={pane}
        />
      </div>
    </div>,
  );
  const button = () =>
    screen.getByRole("button", { name: "SpeedDial basic example" });
  return { view, pane: pane.current!, count: () => button().textContent };
}

/** Animation frames, held to run by hand. */
function holdFrames() {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    frames.push(callback),
  );
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return frames;
}

describe("Your next line in the editor's preview pane", () => {
  const ritual = () =>
    doc(
      role(),
      say("hierophant", "One."),
      say("keryx", "Two."),
      say("member", "Mine."),
    );

  it("follows the pane's own scroll, not only the window's", () => {
    layOut();
    const frames = holdFrames();
    const { pane, count } = preview(ritual());
    expect(count()).toBe("2");
    layout.top = 700;
    // An element's scroll does not bubble; it is caught on the way down.
    fireEvent.scroll(pane);
    expect(frames).toHaveLength(1);
    act(() => frames[0](0));
    expect(count()).toBe("1");
  });

  it("follows the editor around the pane, not the source beside it", () => {
    layOut();
    const frames = holdFrames();
    const { view } = preview(ritual());
    fireEvent.scroll(screen.getByTestId("source"));
    expect(frames).toHaveLength(0);
    fireEvent.scroll(screen.getByTestId("editor"));
    expect(frames).toHaveLength(1);
    // And stops listening when it goes.
    view.unmount();
    frames.length = 0;
    fireEvent.scroll(document);
    fireEvent.scroll(window);
    expect(frames).toHaveLength(0);
  });

  it("measures against the pane's bottom edge, or the window's if lower", () => {
    // The first task, at 700, is on the window but below the pane's 650.
    layOut(700);
    expect(preview(ritual(), 650).count()).toBe("2");
    cleanup();
    expect(preview(ritual()).count()).toBe("1");
    cleanup();
    // The pane runs on below the window (the editor around it is not
    // scrolled to its end): the task at 800 is hidden all the same.
    layOut(800);
    expect(preview(ritual(), 1000).count()).toBe("2");
  });

  it("jumps in the pane alone, and back, leaving the page where it is", () => {
    layOut();
    const intoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: intoView,
    });
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    const { pane } = preview(ritual());
    pane.scrollTop = 120;
    fireEvent.click(
      screen.getByRole("button", { name: "SpeedDial basic example" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Jump to Next" }));
    // The next line's bottom brought to the pane's visible bottom, 768.
    const line = screen
      .getByText("Mine.")
      .closest('[data-ritual-frame="task"]')!
      .getBoundingClientRect();
    expect(pane.scrollTop).toBe(120 + line.bottom - 768);
    expect(intoView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("menuitem", { name: "Jump Back" }));
    expect(pane.scrollTop).toBe(120);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("Contents", () => {
  it("is not drawn for a ritual without titles or halls", () => {
    read(doc(role(), say("hierophant", "One.")));
    expect(screen.queryByRole("navigation", { name: "Contents" })).toBeNull();
  });

  it("marks the current section, the first one at the top of the page", () => {
    layOut(400);
    read(
      doc(
        title("Opening"),
        say("hierophant", "One."),
        title("Closing"),
        say("hierophant", "Two."),
      ),
    );
    const current = () =>
      within(screen.getByRole("navigation", { name: "Contents" }))
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "location")
        .map((link) => link.textContent);
    // Below the app bar's line, the reader is still in the first section.
    expect(current()).toEqual(["Opening"]);
    layout.top = -150;
    act(() => {
      fireEvent(window, new Event("resize"));
    });
    return waitFor(() => expect(current()).toEqual(["Closing"]));
  });

  it("goes to a hall without a history entry", () => {
    const scrolled: Element[] = [];
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value(this: Element) {
        scrolled.push(this);
      },
    });
    const entries = history.length;
    read(
      doc(title("Opening"), {
        type: "summary",
        summary: "More",
        children: [hall("Temple")],
      }),
    );
    const contents = screen.getByRole("navigation", { name: "Contents" });
    fireEvent.click(within(contents).getByRole("link", { name: "Temple" }));
    expect(scrolled.map((element) => element.id)).toEqual(["hall-1"]);
    expect(location.hash).toBe("#hall-1");
    expect(history.length).toBe(entries);
    expect(
      (screen.getByText("More").closest("details") as HTMLDetailsElement).open,
    ).toBe(true);
  });
});
