// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DocRender, { DocView } from "@/app/doc/[_id]/DocRender";
import type { DocNode } from "@/schemas";
import { Render } from "./blocks";
import DocContext from "./context";
import { prepare } from "./prepare";
import { roles } from "./ritualBlocks/roles";
import { type RitualRow, ritualHalls } from "./ritualHalls";

// The drawing names its hall by caption, so the tests read which hall each
// figure is, in the order the reader draws them.
vi.mock("./ritualBlocks/GdHallDrawing", () => ({
  default: ({ hall }: { hall: RitualRow }) => (
    <span
      data-drawn={String(
        hall.children?.find((child) => child.type === "caption")?.text ?? "",
      )}
    />
  ),
}));

afterEach(cleanup);

/** A hall named by its caption (the drawing above reads it back). */
const hall = (caption: string): RitualRow => ({
  type: "gdHall",
  children: [{ type: "caption", text: caption }],
});
const title = (text: string): RitualRow => ({ type: "title", text });
const note = (...children: RitualRow[]): RitualRow => ({
  type: "note",
  children,
});
const text = (value: string) => ({ type: "text", value }) as RitualRow;
const footnote = (...children: RitualRow[]): RitualRow => ({
  type: "footnote",
  children,
});
const doc = (...children: RitualRow[]): RitualRow => ({ children });

const reader = (tree: RitualRow, halls?: ReturnType<typeof ritualHalls>) => (
  <DocContext.Provider value={{ vars: {}, roles }}>
    <Render doc={tree} onChange={undefined} halls={halls} />
  </DocContext.Provider>
);

const figures = (container: Element) => [
  ...container.querySelectorAll<HTMLElement>('[data-ritual-frame="gdHall"]'),
];

/** The captions of the halls the reader draws, in the DOM's order. */
async function drawn(tree: RitualRow) {
  const view = render(reader(tree));
  await waitFor(() =>
    expect(
      figures(view.container).every((figure) =>
        figure.querySelector("[data-drawn]"),
      ),
    ).toBe(true),
  );
  const captions = figures(view.container).map(
    (figure) =>
      figure.querySelector("[data-drawn]")?.getAttribute("data-drawn") ?? "",
  );
  view.unmount();
  return captions;
}

/** Each drawn hall once, where it is first drawn. */
const once = (captions: string[]) => [...new Set(captions)];

describe("ritualHalls over the built-in rituals", () => {
  const compiled = (name: string) =>
    prepare(
      readFileSync(`src/doc/${name}.pug`, "utf8"),
    ) as unknown as RitualRow;
  const summary = (name: string) =>
    ritualHalls(compiled(name)).map(({ ordinal, name, context, row }) => ({
      ordinal,
      name,
      context,
      type: row.type,
    }));

  it("lists the Neophyte hall", () => {
    expect(summary("0=0")).toEqual([
      {
        ordinal: 1,
        name: "Neophyte Temple",
        context: "Opening of the Hall of the Neophytes",
        type: "gdHall",
      },
    ]);
  });

  it("lists the Zelator halls under their titles", () => {
    expect(summary("1=10")).toEqual([
      {
        ordinal: 1,
        name: "Zelator Temple 1",
        context: "Opening of the 1 = 10 Grade",
        type: "gdHall",
      },
      {
        ordinal: 2,
        name: "Zelator Temple 2",
        context: "Ceremony of Advancement — Second Part",
        type: "gdHall",
      },
    ]);
  });

  it("names a hall before every title by the first title after it", () => {
    expect(summary("2=9")).toEqual([
      {
        ordinal: 1,
        name: "Theoricus Temple 1",
        context: "Opening of the 2 = 9 Grade",
        type: "gdHall",
      },
      {
        ordinal: 2,
        name: "Theoricus Temple 2",
        context: "Ceremony of Reception into the 2=9 Grade",
        type: "gdHall",
      },
    ]);
  });

  it.each(["0=0", "1=10", "2=9"])(
    "%s lists the halls the reader draws, in order",
    async (name) => {
      const tree = compiled(name);
      expect(ritualHalls(tree).map((entry) => entry.name)).toEqual(
        once(await drawn(tree)),
      );
    },
  );
});

describe("ritualHalls walks as the reader draws", () => {
  it("lists a footnote's hall at its later footnotes block", async () => {
    const tree = doc(
      title("First"),
      note(text("See "), footnote(note(hall("In a footnote")))),
      title("Second"),
      note(hall("Plain")),
      { type: "footnotes" },
    );
    expect(await drawn(tree)).toEqual(["Plain", "In a footnote"]);
    expect(
      ritualHalls(tree).map(({ ordinal, name, context }) => ({
        ordinal,
        name,
        context,
      })),
    ).toEqual([
      { ordinal: 1, name: "Plain", context: "Second" },
      { ordinal: 2, name: "In a footnote", context: "Second" },
    ]);
  });

  it("leaves out a hall in a footnote with no host", async () => {
    const tree = doc(
      title("Only"),
      note(text("See "), footnote(note(hall("Never drawn")))),
      note(hall("Drawn")),
    );
    expect(await drawn(tree)).toEqual(["Drawn"]);
    expect(ritualHalls(tree).map((entry) => entry.name)).toEqual(["Drawn"]);
  });

  it("leaves out a footnote's hall whose host was drawn before it", async () => {
    const tree = doc(
      { type: "footnotes" },
      note(text("See "), footnote(note(hall("Too late")))),
      note(hall("Drawn")),
    );
    expect(await drawn(tree)).toEqual(["Drawn"]);
    expect(ritualHalls(tree).map((entry) => entry.name)).toEqual(["Drawn"]);
  });

  it("lists a hall in a task's footnote after the task's body", async () => {
    const tree = doc(
      title("Rite"),
      {
        type: "task",
        role: "hierophant",
        say: true,
        children: [footnote(note(hall("Footer"))), note(hall("Body"))],
      },
      note(hall("After")),
    );
    expect(await drawn(tree)).toEqual(["Body", "Footer", "After"]);
    expect(
      ritualHalls(tree).map(({ name, context }) => ({ name, context })),
    ).toEqual([
      { name: "Body", context: "Rite" },
      { name: "Footer", context: "Rite" },
      { name: "After", context: "Rite" },
    ]);
  });

  it("lists once a hall a legacy task draws to say and to do", async () => {
    const tree = doc(
      {
        type: "task",
        role: "hierophant",
        say: true,
        do: true,
        children: [note(hall("Twice"))],
      },
      note(hall("Next")),
    );
    expect(await drawn(tree)).toEqual(["Twice", "Twice", "Next"]);
    expect(ritualHalls(tree).map((entry) => entry.name)).toEqual([
      "Twice",
      "Next",
    ]);
  });

  it("leaves out a hall in a task that neither says nor does", async () => {
    const tree = doc(
      { type: "task", role: "hierophant", children: [note(hall("Silent"))] },
      note(hall("Drawn")),
    );
    expect(await drawn(tree)).toEqual(["Drawn"]);
    expect(ritualHalls(tree).map((entry) => entry.name)).toEqual(["Drawn"]);
  });

  it("leaves out a footnote's hall in a footnote whose host is expanding", async () => {
    const tree = doc(
      note(
        text("See "),
        footnote(note(hall("Outer")), footnote(note(hall("Nested")))),
      ),
      { type: "footnotes" },
    );
    expect(await drawn(tree)).toEqual(["Outer"]);
    expect(ritualHalls(tree).map((entry) => entry.name)).toEqual(["Outer"]);
  });

  it("lists a hall at a footnotes block inside a task's note", async () => {
    const tree = doc({
      type: "task",
      role: "hierophant",
      say: true,
      children: [
        note(text("See "), footnote(note(hall("Note host"))), {
          type: "footnotes",
        }),
        note(hall("Body")),
      ],
    });
    expect(await drawn(tree)).toEqual(["Note host", "Body"]);
    expect(ritualHalls(tree).map((entry) => entry.name)).toEqual([
      "Note host",
      "Body",
    ]);
  });

  it("lists a do-only task's footer after its body, wherever its footnotes block stands", async () => {
    const tree = doc({
      type: "task",
      role: "hierophant",
      do: true,
      children: [
        { type: "footnotes" },
        footnote(note(hall("Footer"))),
        note(hall("Body")),
      ],
    });
    expect(await drawn(tree)).toEqual(["Body", "Footer"]);
    expect(ritualHalls(tree).map((entry) => entry.name)).toEqual([
      "Body",
      "Footer",
    ]);
  });

  it("names a hall without a caption by its ordinal, with no context", () => {
    const tree = doc(
      note(hall("Named")),
      note({
        type: "gdHall",
        children: [
          { type: "caption", text: "  " },
          { type: "caption", text: " Second caption " },
        ],
      }),
      note({ type: "gdHall", children: [{ type: "caption", text: "" }] }),
      note({ type: "gdHall" }),
    );
    expect(
      ritualHalls(tree).map(({ name, context }) => ({ name, context })),
    ).toEqual([
      { name: "Named", context: null },
      { name: "Second caption", context: null },
      { name: "Hall 3", context: null },
      { name: "Hall 4", context: null },
    ]);
  });
});

describe("hall anchors", () => {
  const tree = () =>
    doc(
      title("First"),
      note(text("See "), footnote(note(hall("In a footnote")))),
      note(hall("Plain")),
      {
        type: "task",
        role: "hierophant",
        say: true,
        children: [note(hall("Task"))],
      },
      { type: "footnotes" },
    );
  const ids = (container: Element) =>
    figures(container).map((figure) => figure.getAttribute("id"));

  it("gives each hall the reader draws its ordinal's id, in drawn order", () => {
    const view = render(
      <DocView doc={tree() as DocNode} searchParams={null} />,
    );
    // On the figure before the drawing's chunk has loaded.
    expect(ids(view.container)).toEqual(["hall-1", "hall-2", "hall-3"]);
    expect(view.container.querySelectorAll('[id^="hall-"]').length).toBe(3);
  });

  it("matches the ids to ritualHalls' ordinals", async () => {
    const shown = tree();
    const halls = ritualHalls(shown);
    const view = render(reader(shown, halls));
    await waitFor(() =>
      expect(view.container.querySelectorAll("[data-drawn]")).toHaveLength(3),
    );
    expect(
      figures(view.container).map((figure) => [
        figure.id,
        figure.querySelector("[data-drawn]")?.getAttribute("data-drawn"),
      ]),
    ).toEqual(halls.map((entry) => [`hall-${entry.ordinal}`, entry.name]));
  });

  it("gives a hall a legacy task draws twice its one id twice", () => {
    const shown = doc(
      {
        type: "task",
        role: "hierophant",
        say: true,
        do: true,
        children: [note(hall("Twice"))],
      },
      note(hall("Next")),
    );
    const view = render(<DocView doc={shown as DocNode} searchParams={null} />);
    expect(ids(view.container)).toEqual(["hall-1", "hall-1", "hall-2"]);
    expect(ritualHalls(shown).map((entry) => entry.ordinal)).toEqual([1, 2]);
  });

  it("gives no ids in the ritual editor's preview", () => {
    // As SqlDocEdit renders its preview pane.
    const view = render(
      <DocRender
        doc={tree() as DocNode}
        wrapWithErrorBoundary={true}
        hallNavigation={false}
      />,
    );
    expect(figures(view.container)).toHaveLength(3);
    expect(ids(view.container)).toEqual([null, null, null]);
  });

  it("gives no ids in a render without the reader's halls, as the editor's footnote previews", () => {
    const view = render(
      <DocContext.Provider value={{ vars: {}, roles, linksInNewTab: true }}>
        <Render doc={tree()} onChange={undefined} />
      </DocContext.Provider>,
    );
    expect(figures(view.container)).toHaveLength(3);
    expect(ids(view.container)).toEqual([null, null, null]);
  });

  it("follows the opt-in across rerenders of the same rows", () => {
    // JRT reuses its node instances for the same rows.
    const shown = tree();
    const view = render(reader(shown, ritualHalls(shown)));
    expect(ids(view.container)).toEqual(["hall-1", "hall-2", "hall-3"]);
    view.rerender(reader(shown));
    expect(ids(view.container)).toEqual([null, null, null]);
    view.rerender(reader(shown, ritualHalls(shown)));
    expect(ids(view.container)).toEqual(["hall-1", "hall-2", "hall-3"]);
  });
});
