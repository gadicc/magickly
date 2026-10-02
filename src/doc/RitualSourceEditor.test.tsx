// @vitest-environment jsdom

import { diagnosticCount, forEachDiagnostic } from "@codemirror/lint";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { EditorState, EditorView } from "@uiw/react-codemirror";
import { afterEach, expect, it, vi } from "vitest";
import RitualSourceEditor, { ritualIdFolding } from "./RitualSourceEditor";
import { parseRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import { ritualPugIdRanges } from "./ritualPugIds";
import {
  RitualSourceError,
  ritualSourceDiagnostic,
} from "./ritualSourceDiagnostics";

const id = "Ab3k9Qp7Zx2Mn5Rs";
const secondId = "Other00000000001";
const source = `${RITUAL_PUG_HEADER}\nnote#${id} Text #[b#${secondId} bold]\n`;
Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(),
});
afterEach(cleanup);

it("marks the authored attribute after multiline comments and exposes accessible error navigation", () => {
  const invalid = `${RITUAL_PUG_HEADER}\n//- section\n  more detail\nnote(value=someCall()) text\n`;
  let diagnostic;
  try {
    parseRitualPug(invalid);
  } catch (cause) {
    diagnostic = ritualSourceDiagnostic(cause, invalid);
  }
  expect(diagnostic).toMatchObject({ line: 4, column: 6 });
  const changed = vi.fn();
  const { container } = render(
    <RitualSourceEditor
      value={invalid}
      dialect="pug"
      disabled={false}
      onChange={changed}
      diagnostic={diagnostic}
    />,
  );
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  const positions: number[][] = [];
  forEachDiagnostic(view.state, (_diagnostic, from, to) =>
    positions.push([from, to]),
  );
  expect(positions).toEqual([
    [invalid.indexOf("value="), invalid.indexOf("value=") + 5],
  ]);
  expect(container.querySelector(".cm-lintRange-error")?.textContent).toBe(
    "value",
  );
  expect(container.querySelector(".cm-lint-marker-error")).toBeTruthy();
  expect(view.contentDOM.getAttribute("aria-invalid")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Go to error" }));
  expect(view.state.selection.main.from).toBe(invalid.indexOf("value="));
  fireEvent.click(screen.getByRole("button", { name: "Problems" }));
  expect(container.querySelector(".cm-panel-lint")?.textContent).toContain(
    "attributes must be JSON literals",
  );
  expect(changed).not.toHaveBeenCalled();
});

it("preserves diagnostics across ID visibility/read-only changes and clears stale source snapshots", () => {
  const invalid = `${source}note(value=someCall()) text\n`;
  const diagnostic = ritualSourceDiagnostic(
    new RitualSourceError("Line 3: invalid literal", 3, 6),
    invalid,
  );
  const props = {
    value: invalid,
    dialect: "pug" as const,
    onChange: vi.fn(),
    diagnostic,
  };
  const { container, rerender } = render(
    <RitualSourceEditor {...props} disabled={false} />,
  );
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  fireEvent.click(screen.getByRole("button", { name: "Problems" }));
  expect(container.querySelector(".cm-panel-lint")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Show IDs" }));
  expect(diagnosticCount(view.state)).toBe(1);
  expect(container.querySelector(".cm-panel-lint")).toBeTruthy();
  rerender(<RitualSourceEditor {...props} disabled />);
  expect(diagnosticCount(view.state)).toBe(1);
  expect(container.querySelector(".cm-panel-lint")).toBeTruthy();
  const repaired = invalid.replace("someCall()", '"fixed"');
  rerender(<RitualSourceEditor {...props} value={repaired} disabled={false} />);
  expect(diagnosticCount(view.state)).toBe(0);
  expect(view.contentDOM.getAttribute("aria-invalid")).toBe("false");
  expect(screen.queryByRole("button", { name: "Go to error" })).toBeNull();
  expect(props.onChange).not.toHaveBeenCalled();
});

it("reveals the offending folded identity through F8 and keeps Problems open during typing", () => {
  const invalid = `${RITUAL_PUG_HEADER}\nnote#${id} first\nnote#${id} second\n`;
  let diagnostic;
  try {
    parseRitualPug(invalid);
  } catch (cause) {
    diagnostic = ritualSourceDiagnostic(cause, invalid);
  }
  const props = {
    value: invalid,
    dialect: "pug" as const,
    disabled: false,
    onChange: vi.fn(),
    diagnostic,
  };
  const { container, rerender } = render(<RitualSourceEditor {...props} />);
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  expect(
    screen.getAllByRole("button", { name: `Show block ID ${id}` }),
  ).toHaveLength(2);
  act(() => {
    view.focus();
    fireEvent.keyDown(view.contentDOM, { key: "F8", code: "F8" });
  });
  expect(view.state.selection.main.from).toBe(invalid.lastIndexOf(`#${id}`));
  expect(
    screen.queryByRole("button", { name: `Show block ID ${id}` }),
  ).toBeNull();
  expect(container.querySelector(".cm-lintRange-error")?.textContent).toBe(
    `#${id}`,
  );
  fireEvent.click(screen.getByRole("button", { name: "Show IDs" }));
  fireEvent.click(screen.getByRole("button", { name: "Fold IDs" }));
  expect(
    screen.getAllByRole("button", { name: `Show block ID ${id}` }),
  ).toHaveLength(2);
  act(() => {
    view.focus();
    fireEvent.keyDown(view.contentDOM, { key: "F8", code: "F8" });
  });
  expect(
    screen.queryByRole("button", { name: `Show block ID ${id}` }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show IDs" }));
  fireEvent.click(screen.getByRole("button", { name: "Fold IDs" }));
  fireEvent.click(screen.getByRole("button", { name: "Go to error" }));
  expect(
    screen.queryByRole("button", { name: `Show block ID ${id}` }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Problems" }));
  act(() =>
    view.dispatch({
      changes: { from: view.state.doc.length, insert: "note more\n" },
      userEvent: "input.type",
    }),
  );
  const typed = `${invalid}note more\n`;
  rerender(<RitualSourceEditor {...props} value={typed} />);
  expect(container.querySelector(".cm-panel-lint")).toBeTruthy();
  expect(diagnosticCount(view.state)).toBe(0);
  expect(view.state.doc.toString()).toBe(typed);
});

it("reveals an offending folded ID when selecting its Problems entry", () => {
  const invalid = `${RITUAL_PUG_HEADER}\nnote#${id} first\nnote#${id} second\n`;
  let diagnostic;
  try {
    parseRitualPug(invalid);
  } catch (cause) {
    diagnostic = ritualSourceDiagnostic(cause, invalid);
  }
  const { container } = render(
    <RitualSourceEditor
      value={invalid}
      dialect="pug"
      disabled={false}
      onChange={vi.fn()}
      diagnostic={diagnostic}
    />,
  );
  expect(
    screen.getAllByRole("button", { name: `Show block ID ${id}` }),
  ).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Problems" }));
  fireEvent.click(container.querySelector(".cm-panel-lint li")!);
  expect(
    screen.queryByRole("button", { name: `Show block ID ${id}` }),
  ).toBeNull();
  expect(container.querySelector(".cm-lintRange-error")?.textContent).toBe(
    `#${id}`,
  );
});

it("underlines line-only Ritual Text errors and safely represents an empty end-of-line error", () => {
  const text = "ritual 1\n  @bad\n";
  const props = {
    value: text,
    dialect: "ritual-text" as const,
    disabled: false,
    onChange: vi.fn(),
  };
  const { container, rerender } = render(
    <RitualSourceEditor
      {...props}
      diagnostic={ritualSourceDiagnostic(
        new Error("Line 2: invalid indentation"),
        text,
      )}
    />,
  );
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  expect(container.querySelector(".cm-lintRange-error")?.textContent).toBe(
    "@bad",
  );
  rerender(
    <RitualSourceEditor
      {...props}
      diagnostic={ritualSourceDiagnostic(
        new RitualSourceError("Line 3: incomplete source", 3, 999),
        text,
      )}
    />,
  );
  const positions: number[][] = [];
  forEachDiagnostic(view.state, (_diagnostic, from, to) =>
    positions.push([from, to]),
  );
  expect(positions).toEqual([[text.length, text.length]]);
  expect(diagnosticCount(view.state)).toBe(1);
});

it("folds lexer-owned identities without hiding quoted payloads or plain text", () => {
  const sample = `${source}ritualText(value="#[b#${id} literal]")/\nnote Literal #${id}\n`;
  const ranges = ritualPugIdRanges(sample)!;
  expect(ranges.map((range) => sample.slice(range.from, range.to))).toEqual([
    `#${id}`,
    `#${secondId}`,
  ]);
  expect(
    ritualPugIdRanges(sample.replaceAll("\n", "\r\n"))?.map((range) =>
      sample.replaceAll("\n", "\r\n").slice(range.from, range.to),
    ),
  ).toEqual([`#${id}`, `#${secondId}`]);
});

it("retains intact folds through incomplete syntax and exposes changed identity bytes", () => {
  const field = ritualIdFolding();
  let state = EditorState.create({ doc: source, extensions: [field] });
  expect(state.field(field).decorations.size).toBe(2);
  state = state.update({
    changes: { from: state.doc.length, insert: 'note(value="' },
  }).state;
  expect(state.field(field).decorations.size).toBe(2);
  const from = state.doc.toString().indexOf(`#${id}`) + 1;
  state = state.update({ changes: { from, to: from + 1, insert: "!" } }).state;
  expect(state.field(field).decorations.size).toBe(1);
  expect(state.doc.toString()).toContain(`#!${id.slice(1)}`);
});

it("reveals one ID or all IDs without changing source, selection, or undo history", () => {
  const changed = vi.fn();
  const { container } = render(
    <RitualSourceEditor
      value={source}
      dialect="pug"
      disabled={false}
      onChange={changed}
    />,
  );
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  act(() => view.dispatch({ selection: { anchor: 2, head: 9 } }));
  fireEvent.click(screen.getByRole("button", { name: `Show block ID ${id}` }));
  expect(
    screen.queryByRole("button", { name: `Show block ID ${id}` }),
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: `Show block ID ${secondId}` }),
  ).toBeTruthy();
  expect(view.state.doc.toString()).toBe(source);
  expect(view.state.selection.main).toMatchObject({ anchor: 2, head: 9 });
  fireEvent.click(screen.getByRole("button", { name: "Show IDs" }));
  expect(
    screen.queryByRole("button", { name: `Show block ID ${secondId}` }),
  ).toBeNull();
  expect(EditorView.findFromDOM(container.querySelector(".cm-editor")!)).toBe(
    view,
  );
  expect(view.state.doc.toString()).toBe(source);
  expect(view.state.selection.main).toMatchObject({ anchor: 2, head: 9 });
  expect(changed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Fold IDs" }));
  expect(
    screen.getByRole("button", { name: `Show block ID ${id}` }),
  ).toBeTruthy();
});

it("copies the full source including folded IDs", () => {
  const { container } = render(
    <RitualSourceEditor
      value={source}
      dialect="pug"
      disabled={false}
      onChange={vi.fn()}
    />,
  );
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  act(() => {
    view.focus();
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
  });
  const clipboard = { clearData: vi.fn(), setData: vi.fn() };
  const event = new Event("copy", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: clipboard });
  view.contentDOM.dispatchEvent(event);
  expect(clipboard.setData).toHaveBeenCalledWith("text/plain", source);
  expect(view.state.doc.toString()).toBe(source);
});

it("keeps the source view mounted and read-only across authorization updates", () => {
  const changed = vi.fn();
  const props = { value: source, dialect: "pug" as const, onChange: changed };
  const { container, rerender } = render(
    <RitualSourceEditor {...props} disabled={false} />,
  );
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  rerender(<RitualSourceEditor {...props} disabled />);
  expect(EditorView.findFromDOM(container.querySelector(".cm-editor")!)).toBe(
    view,
  );
  expect(view.state.readOnly).toBe(true);
  expect(view.contentDOM.getAttribute("contenteditable")).toBe("false");
  expect(view.state.doc.toString()).toBe(source);
});

it("never restores another syntax through Undo after switching dialects", () => {
  const changed = vi.fn();
  const { container, rerender } = render(
    <RitualSourceEditor
      value={source}
      dialect="pug"
      disabled={false}
      onChange={changed}
    />,
  );
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  act(() =>
    view.dispatch({
      changes: { from: view.state.doc.length, insert: "note More\n" },
      userEvent: "input.type",
    }),
  );
  const text = 'ritual 1\n= "Different syntax"\n';
  rerender(
    <RitualSourceEditor
      value={text}
      dialect="ritual-text"
      disabled={false}
      onChange={changed}
    />,
  );
  act(() => {
    view.focus();
    fireEvent.keyDown(view.contentDOM, {
      key: "z",
      code: "KeyZ",
      ctrlKey: true,
    });
  });
  expect(view.state.doc.toString()).toBe(text);
  expect(changed).toHaveBeenCalledTimes(1);
});

it("applies Discard synchronously and preserves continued typing beyond the old wrapper latch", async () => {
  const changed = vi.fn();
  const { container, rerender } = render(
    <RitualSourceEditor
      value={source}
      dialect="pug"
      disabled={false}
      onChange={changed}
    />,
  );
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  act(() =>
    view.dispatch({
      changes: { from: view.state.doc.length, insert: "note Discarded\n" },
      userEvent: "input.type",
    }),
  );
  rerender(
    <RitualSourceEditor
      value={`${source}note Discarded\n`}
      dialect="pug"
      disabled={false}
      onChange={changed}
    />,
  );
  rerender(
    <RitualSourceEditor
      value={source}
      dialect="pug"
      disabled={false}
      onChange={changed}
    />,
  );
  expect(view.state.doc.toString()).toBe(source);
  act(() =>
    view.dispatch({
      changes: { from: view.state.doc.length, insert: "note CONTINUED\n" },
      userEvent: "input.type",
    }),
  );
  const continued = `${source}note CONTINUED\n`;
  rerender(
    <RitualSourceEditor
      value={continued}
      dialect="pug"
      disabled={false}
      onChange={changed}
    />,
  );
  await new Promise((resolve) => setTimeout(resolve, 450));
  expect(view.state.doc.toString()).toBe(continued);
  expect(changed).toHaveBeenLastCalledWith(continued);
  act(() => {
    view.focus();
    fireEvent.keyDown(view.contentDOM, {
      key: "z",
      code: "KeyZ",
      ctrlKey: true,
    });
  });
  expect(view.state.doc.toString()).toBe(source);
});
