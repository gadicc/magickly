// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import RitualCreationEditor from "./RitualCreationEditor";
import { RITUAL_EDITOR_LAYOUT_KEY } from "./useRitualEditorLayout";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

it("opens split by default, with source before visual, and remembers a chosen layout on remount", async () => {
  const props = {
    source: "//- magickli-ritual-pug 1\nHiero: hello\n",
    disabled: false,
    onChange: vi.fn(),
    onValidityChange: vi.fn(),
  };
  const view = render(<RitualCreationEditor {...props} />);
  const visual = await screen.findByRole("textbox", {
    name: "New ritual visual editor",
  });
  const source = screen.getByRole("textbox", { name: "New ritual source" });
  expect(
    source.compareDocumentPosition(visual) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(localStorage.getItem(RITUAL_EDITOR_LAYOUT_KEY)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Visual" }));
  expect(
    screen.queryByRole("textbox", { name: "New ritual source" }),
  ).toBeNull();
  expect(localStorage.getItem(RITUAL_EDITOR_LAYOUT_KEY)).toBe("visual");
  view.unmount();
  render(<RitualCreationEditor {...props} />);
  await screen.findByRole("textbox", { name: "New ritual visual editor" });
  expect(
    screen.queryByRole("textbox", { name: "New ritual source" }),
  ).toBeNull();
});

it("retains a split preference while invalid source forces source-only editing", async () => {
  localStorage.setItem(RITUAL_EDITOR_LAYOUT_KEY, "split");
  const props = {
    disabled: false,
    onChange: vi.fn(),
    onValidityChange: vi.fn(),
  };
  const view = render(<RitualCreationEditor {...props} source="broken" />);
  await screen.findByRole("textbox", { name: "New ritual source" });
  expect(
    screen.queryByRole("textbox", { name: "New ritual visual editor" }),
  ).toBeNull();
  expect(localStorage.getItem(RITUAL_EDITOR_LAYOUT_KEY)).toBe("split");
  view.rerender(
    <RitualCreationEditor
      {...props}
      source={"//- magickli-ritual-pug 1\nHiero: hello\n"}
    />,
  );
  await screen.findByRole("textbox", { name: "New ritual visual editor" });
  expect(
    screen.getByRole("textbox", { name: "New ritual source" }),
  ).toBeTruthy();
});

it.each(["invalid", "", '{"mode":"visual"}'])(
  "ignores unsupported saved layout %s",
  async (stored) => {
    localStorage.setItem(RITUAL_EDITOR_LAYOUT_KEY, stored);
    render(
      <RitualCreationEditor
        source={"//- magickli-ritual-pug 1\nHiero: hello\n"}
        disabled={false}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
    );
    await screen.findByRole("textbox", { name: "New ritual visual editor" });
    expect(
      screen.getByRole("textbox", { name: "New ritual source" }),
    ).toBeTruthy();
    expect(localStorage.getItem(RITUAL_EDITOR_LAYOUT_KEY)).toBe(stored);
  },
);

it("keeps layout controls working when browser storage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  render(
    <RitualCreationEditor
      source={"//- magickli-ritual-pug 1\nHiero: hello\n"}
      disabled={false}
      onChange={vi.fn()}
      onValidityChange={vi.fn()}
    />,
  );
  await screen.findByRole("textbox", { name: "New ritual visual editor" });
  fireEvent.click(screen.getByRole("button", { name: "Ritual source" }));
  expect(
    screen.getByRole("textbox", { name: "New ritual source" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("textbox", { name: "New ritual visual editor" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Split" }));
  await screen.findByRole("textbox", { name: "New ritual visual editor" });
  expect(
    screen.getByRole("textbox", { name: "New ritual source" }),
  ).toBeTruthy();
});
it("recovers when source is restored to its previous visual projection", async () => {
  let latest = "";
  const valid = vi.fn();
  function Host() {
    const [source, setSource] = React.useState(
      "//- magickli-ritual-pug 1\nhiero: hello\n",
    );
    return (
      <RitualCreationEditor
        source={source}
        disabled={false}
        onValidityChange={valid}
        onChange={(next) => {
          latest = next;
          setSource(next);
        }}
      />
    );
  }
  render(<Host />);
  const dom = await screen.findByRole("textbox", {
    name: "New ritual visual editor",
  });
  act(() => {
    (dom as HTMLElement & { editor: Editor }).editor.commands.insertContent(
      "!",
    );
  });
  const emitted = latest;
  fireEvent.click(screen.getByRole("button", { name: "Ritual source" }));
  fireEvent.change(screen.getByRole("textbox", { name: "New ritual source" }), {
    target: { value: "broken" },
  });
  await screen.findByText(
    "Correct the ritual source before using visual editing.",
  );
  expect(
    screen
      .getByRole("textbox", { name: "New ritual source" })
      .getAttribute("data-diagnostic-source"),
  ).toBe("broken");
  fireEvent.change(screen.getByRole("textbox", { name: "New ritual source" }), {
    target: { value: emitted },
  });
  expect(
    screen.queryByText(
      "Correct the ritual source before using visual editing.",
    ),
  ).toBeNull();
  expect(valid).toHaveBeenLastCalledWith(true);
  expect(
    screen
      .getByRole("textbox", { name: "New ritual source" })
      .getAttribute("data-diagnostic-source"),
  ).toBeNull();
  expect(
    (screen.getByRole("button", { name: "Visual" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

it("preserves composing source against visual commands in split view", async () => {
  let latest = "";
  function Host() {
    const [source, setSource] = React.useState(
      "//- magickli-ritual-pug 1\nHiero: Initial words\n",
    );
    const valid = React.useCallback(() => {}, []);
    return (
      <RitualCreationEditor
        source={source}
        disabled={false}
        onValidityChange={valid}
        onChange={(next) => {
          latest = next;
          setSource(next);
        }}
      />
    );
  }
  render(<Host />);
  const visual = await screen.findByRole("textbox", {
    name: "New ritual visual editor",
  });
  const editor = (visual as HTMLElement & { editor: Editor }).editor;
  const source = screen.getByRole("textbox", { name: "New ritual source" });
  const next = "//- magickli-ritual-pug 1\nHiero: Composing words\n";
  fireEvent.compositionStart(source);
  fireEvent.change(source, { target: { value: next } });
  expect(editor.isEditable).toBe(false);
  expect(visual.textContent).toContain("Initial words");
  fireEvent.click(screen.getByRole("button", { name: "Speech" }));
  fireEvent.click(screen.getByRole("button", { name: "Bold" }));
  expect(latest).toBe(next);
  expect(visual.textContent).toContain("Initial words");
  fireEvent.compositionEnd(source);
  await waitFor(() => expect(visual.textContent).toContain("Composing words"));
  expect(editor.isEditable).toBe(true);
});

vi.mock("@/doc/RitualSourceEditor", () => ({
  default: ({
    value,
    onChange,
    disabled,
    label = "Ritual semantic source",
    onCompositionChange,
    diagnostic,
  }) =>
    React.createElement("textarea", {
      "aria-label": label,
      "data-diagnostic-source": diagnostic?.source,
      value,
      disabled,
      onChange: (event) =>
        onChange((event.target as HTMLTextAreaElement).value),
      onCompositionStart: () => onCompositionChange?.(true),
      onCompositionEnd: () => onCompositionChange?.(false),
    }),
}));

it("synchronizes an open footnote when creation is disabled and re-enabled", async () => {
  const source = "//- magickli-ritual-pug 1\nHiero: Hello#[footnote Note]\n";
  const onChange = vi.fn(),
    valid = vi.fn();
  const view = render(
    <RitualCreationEditor
      source={source}
      disabled={false}
      onChange={onChange}
      onValidityChange={valid}
    />,
  );
  const outer = await screen.findByRole("textbox", {
    name: "New ritual visual editor",
  });
  await waitFor(() =>
    expect(outer.querySelector("button[data-footnote-reference]")).toBeTruthy(),
  );
  fireEvent.click(outer.querySelector("button[data-footnote-reference]")!);
  const inner = await screen.findByRole("textbox", {
    name: "Footnote 1 editor",
  });
  view.rerender(
    <RitualCreationEditor
      source={source}
      disabled
      onChange={onChange}
      onValidityChange={valid}
    />,
  );
  await waitFor(() =>
    expect(inner.getAttribute("contenteditable")).toBe("false"),
  );
  expect(onChange).not.toHaveBeenCalled();
  view.rerender(
    <RitualCreationEditor
      source={source}
      disabled={false}
      onChange={onChange}
      onValidityChange={valid}
    />,
  );
  await waitFor(() =>
    expect(inner.getAttribute("contenteditable")).toBe("true"),
  );
  act(() =>
    (inner as HTMLElement & { editor: Editor }).editor.commands.insertContent(
      "New ",
    ),
  );
  expect(onChange).toHaveBeenCalledWith(expect.stringContaining("NoteNew "));
});
