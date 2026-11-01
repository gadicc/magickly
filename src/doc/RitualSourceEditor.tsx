"use client";

import { StreamLanguage } from "@codemirror/language";
import { pug } from "@codemirror/legacy-modes/mode/pug";
import {
  type Diagnostic,
  forEachDiagnostic,
  linter,
  lintGutter,
  lintKeymap,
  nextDiagnostic,
  openLintPanel,
  previousDiagnostic,
  setDiagnostics,
} from "@codemirror/lint";
import { Button } from "@mui/material";
import {
  Annotation,
  basicSetup,
  Decoration,
  type DecorationSet,
  EditorState,
  EditorView,
  keymap,
  StateEffect,
  StateField,
  WidgetType,
} from "@uiw/react-codemirror";
import React from "react";
import type { RitualSourceWarning } from "./gdHallDiagnostics";
import {
  ritualPugHeaderId,
  ritualPugIdRanges,
  ritualPugNodeIdsAtLine,
} from "./ritualPugIds";
import type { RitualSourceDialect } from "./ritualSource";
import type { RitualSourceDiagnostic } from "./ritualSourceDiagnostics";

/**
 * Pug's legacy mode marks each line's leading whitespace as `indent`,
 * which is no highlighting tag; mapping it to none leaves it unstyled, as
 * before, without CodeMirror's "Unknown highlighting tag indent" warning.
 */
const pugLanguage = StreamLanguage.define({
  ...pug,
  tokenTable: { indent: [] },
});

const revealId = StateEffect.define<string>();
/** Marks the caret a host placed (`cursor`), which `onCursor` never echoes. */
const placedCaret = Annotation.define<boolean>();
function navigateDiagnostic(
  view: EditorView,
  command: (view: EditorView) => boolean,
) {
  if (command(view)) return true;
  const selection = view.state.selection.main;
  let alreadySelected = false;
  forEachDiagnostic(view.state, (_diagnostic, from, to) => {
    if (selection.from === from && selection.to === to) alreadySelected = true;
  });
  if (!alreadySelected) return false;
  // Native navigation is a no-op when the sole error is already selected.
  // Re-dispatch that selection so a newly folded ID becomes visible again.
  view.dispatch({ selection: view.state.selection, scrollIntoView: true });
  return true;
}
class IdWidget extends WidgetType {
  constructor(readonly id: string) {
    super();
  }
  eq(other: IdWidget) {
    return other.id === this.id;
  }
  toDOM(view: EditorView) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "#…";
    button.className = "ritual-folded-id";
    button.title = `Show block ID ${this.id}`;
    button.setAttribute("aria-label", `Show block ID ${this.id}`);
    button.onclick = () => view.dispatch({ effects: revealId.of(this.id) });
    return button;
  }
  ignoreEvent() {
    return true;
  }
}

/**
 * The span a diagnostic underlines: its token (a tag, an attribute name,
 * an ID) when the column is known, else the line's content, or the start
 * of the document when there is no line.
 */
function diagnosticRange(
  doc: EditorState["doc"],
  at: { line?: number; column?: number },
) {
  if (at.line === undefined) return { from: 0, to: 0 };
  const line = doc.line(Math.max(1, Math.min(at.line, doc.lines)));
  if (at.column === undefined)
    return { from: line.from + line.text.search(/\S|$/), to: line.to };
  const from = line.from + Math.max(0, Math.min(at.column - 1, line.length));
  const rest = line.text.slice(from - line.from);
  return {
    from,
    to: Math.min(
      line.to,
      from +
        (rest.match(/^#?[A-Za-z0-9_-]+/)?.[0].length ??
          ((rest.codePointAt(0) ?? 0) > 0xffff ? 2 : 1)),
    ),
  };
}

/**
 * Runs `task` when the main thread is idle (within `timeout` ms at the
 * latest), or in a later task where `requestIdleCallback` is missing
 * (Safari). Returns its cancel function.
 */
function whenIdle(task: () => void, timeout: number): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(task, { timeout });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(task, 0);
  return () => window.clearTimeout(handle);
}

/**
 * Temple hall warnings for the exact bytes of `source` (plan 061, stage C).
 * The validator and the hall art load lazily, and only for source that
 * holds a hall, so other rituals' editors never fetch them. The warnings
 * parse the source themselves (as long as the editor's own parse, about
 * 80 ms for 75 KB), so they wait for a pause in typing and then for idle
 * time, behind the editor's own work. A result for older source, or one
 * that arrives after unmounting, is dropped.
 */
function useHallWarnings(
  source: string,
  enabled: boolean,
  headerless: boolean,
): { source: string; warnings: RitualSourceWarning[] } | null {
  const [found, setFound] = React.useState<{
    source: string;
    warnings: RitualSourceWarning[];
  } | null>(null);
  React.useEffect(() => {
    // Halls, and images of the retired temple drawings under /pics.
    if (!enabled || !/gdHall|\/pics\//.test(source)) {
      setFound(null);
      return;
    }
    let current = true;
    let cancelIdle = () => {};
    const timer = window.setTimeout(() => {
      import("./gdHallDiagnostics")
        .then(({ gdHallSourceWarnings }) => {
          if (!current) return;
          cancelIdle = whenIdle(() => {
            if (current)
              setFound({
                source,
                warnings: gdHallSourceWarnings(source, { headerless }),
              });
          }, 2000);
        })
        // A chunk that fails to load leaves the source without warnings.
        .catch(() => {});
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(timer);
      cancelIdle();
    };
  }, [source, enabled, headerless]);
  return found;
}

/** Fold identity spans visually; the underlying document, selection copy and save bytes stay intact. */
export function ritualIdFolding() {
  const build = (
    source: string,
    expanded: Set<string>,
  ): DecorationSet | null => {
    const ranges = ritualPugIdRanges(source);
    if (!ranges) return null;
    return Decoration.set(
      ranges
        .filter((range) => !expanded.has(range.id))
        .map((range) =>
          Decoration.replace({ widget: new IdWidget(range.id) }).range(
            range.from,
            range.to,
          ),
        ),
      true,
    );
  };
  const field = StateField.define<{
    decorations: DecorationSet;
    expanded: Set<string>;
  }>({
    create(state) {
      return {
        decorations: build(state.doc.toString(), new Set()) ?? Decoration.none,
        expanded: new Set(),
      };
    },
    update(value, transaction) {
      const expanded = new Set(value.expanded);
      let reveal = false;
      for (const effect of transaction.effects)
        if (effect.is(revealId)) {
          expanded.add(effect.value);
          reveal = true;
        }
      // Diagnostic navigation includes F8, Problems clicks and panel arrows.
      // Reveal selected error text in the same transaction as its selection.
      if (transaction.selection && !transaction.docChanged) {
        const selection = transaction.state.selection.main;
        forEachDiagnostic(transaction.state, (_diagnostic, from, to) => {
          if (selection.from !== from || selection.to !== to) return;
          value.decorations.between(from, to, (start, end, decoration) => {
            if (from < start || from >= end) return;
            expanded.add((decoration.spec.widget as IdWidget).id);
            reveal = true;
          });
        });
      }
      if (!transaction.docChanged && !reveal) return value;
      return {
        expanded,
        decorations:
          build(transaction.state.doc.toString(), expanded) ??
          value.decorations.map(transaction.changes).update({
            filter: (from, to, decoration) => {
              const id = (decoration.spec.widget as IdWidget).id;
              return (
                !expanded.has(id) &&
                transaction.state.doc.sliceString(from, to) === `#${id}`
              );
            },
          }),
      };
    },
    provide: (self) => [
      EditorView.decorations.from(self, (value) => value.decorations),
      EditorView.atomicRanges.of((view) => view.state.field(self).decorations),
    ],
  });
  return field;
}

/**
 * The `scrollTop` that centres a line in the box that scrolls it, or null
 * when the line is already wholly in view. Everything in client pixels,
 * as measured; never below 0.
 */
export function centredScrollTop(
  line: { top: number; bottom: number },
  port: { top: number; bottom: number },
  scrollTop: number,
): number | null {
  if (line.top >= port.top && line.bottom <= port.bottom) return null;
  const room = port.bottom - port.top - (line.bottom - line.top);
  return Math.max(0, scrollTop + line.top - port.top - room / 2);
}

/** A caret the host asked for: 1-based, in the text `source`. */
export interface RitualSourceCursor {
  line: number;
  column: number;
  source: string;
}

/** Shared Pug/Ritual Text source panel with optional, lossless identity folding. */
export default function RitualSourceEditor({
  value,
  dialect,
  onChange,
  disabled,
  label = "Ritual semantic source",
  onCompositionChange,
  diagnostic,
  fill = false,
  header,
  reveal,
  follow,
  onCaretNode,
  headerless = false,
  cursor,
  onCursor,
}: {
  value: string;
  dialect: RitualSourceDialect;
  onChange(value: string): void;
  disabled: boolean;
  label?: string;
  onCompositionChange?(composing: boolean): void;
  diagnostic?: RitualSourceDiagnostic | null;
  /** Fill a sized flex parent instead of the inline form's bounded height. */
  fill?: boolean;
  /** Leading content for the tools row, such as the panel title. */
  header?: React.ReactNode;
  /** Select and scroll to a 1-based line whenever `key` changes. */
  reveal?: { line: number; key: number } | null;
  /** Scroll a node's header line into view, without selecting it, per `key`. */
  follow?: { id: string; key: number } | null;
  /** The nodes around the caret, innermost first, when they change while focused. */
  onCaretNode?(ids: string[]): void;
  /**
   * The source is ritual Pug without its header line (the `/gd/halls/editor`
   * page's hall); hall warnings count lines from its first.
   */
  headerless?: boolean;
  /**
   * Puts the caret here, without taking the focus, whenever a new object
   * is given (and again for a new editor view, as Strict Mode makes one),
   * if the text is still `source`. The editor's own box then scrolls to
   * centre the line if it is not wholly in view; the page never scrolls.
   * Give it with, or after, the `value` it names: one given before is
   * spent on the text then shown and skipped. The hall editor's drawing
   * places it on the tag it selects (plan 063).
   */
  cursor?: RitualSourceCursor | null;
  /**
   * The caret (1-based) whenever the author moves it, or types, while the
   * editor has the focus; never for `cursor` or a new `value`.
   */
  onCursor?(at: { line: number; column: number }): void;
}) {
  const [foldIds, setFoldIds] = React.useState(true);
  const host = React.useRef<HTMLDivElement>(null);
  const view = React.useRef<EditorView | null>(null);
  const latest = React.useRef({ onChange, value, onCaretNode, onCursor });
  const caretNode = React.useRef<string | null>(null);
  latest.current = { onChange, value, onCaretNode, onCursor };
  const previousDialect = React.useRef(dialect);
  const extensions = React.useMemo(
    () => [
      linter(null),
      lintGutter(),
      keymap.of([
        ...lintKeymap.filter((binding) => binding.key !== "F8"),
        { key: "F8", run: (view) => navigateDiagnostic(view, nextDiagnostic) },
        {
          key: "Shift-F8",
          run: (view) => navigateDiagnostic(view, previousDiagnostic),
        },
      ]),
      basicSetup({ foldGutter: false }),
      EditorView.lineWrapping,
      EditorState.readOnly.of(disabled),
      EditorView.editable.of(!disabled),
      EditorView.updateListener.of((update) => {
        if (update.docChanged)
          latest.current.onChange(update.state.doc.toString());
        if (!update.view.hasFocus) {
          caretNode.current = null;
          return;
        }
        if (!update.selectionSet && !update.focusChanged && !update.docChanged)
          return;
        const { doc } = update.state;
        // After `onChange`, so a host sees the typing before the caret in it.
        if (
          (update.selectionSet || update.docChanged) &&
          !update.transactions.some((tr) => tr.annotation(placedCaret))
        ) {
          const head = update.state.selection.main.head;
          const line = doc.lineAt(head);
          latest.current.onCursor?.({
            line: line.number,
            column: head - line.from + 1,
          });
        }
        const ids = ritualPugNodeIdsAtLine(
          (line) => doc.line(line).text,
          doc.lineAt(update.state.selection.main.head).number,
        );
        const key = ids.join(" ");
        if (key === caretNode.current) return;
        caretNode.current = key;
        latest.current.onCaretNode?.(ids);
      }),
      ...(dialect === "pug"
        ? [pugLanguage, ...(foldIds ? [ritualIdFolding()] : [])]
        : []),
      EditorView.domEventHandlers({
        compositionstart: () => {
          onCompositionChange?.(true);
          return false;
        },
        compositionend: () => {
          onCompositionChange?.(false);
          return false;
        },
      }),
      EditorView.contentAttributes.of((editor) => {
        // Hall warnings do not make the source invalid; only errors do.
        let invalid = false;
        forEachDiagnostic(editor.state, (found) => {
          if (found.severity === "error") invalid = true;
        });
        return {
          "aria-label": label,
          "aria-multiline": "true",
          "aria-invalid": invalid ? "true" : "false",
          spellcheck: "false",
        };
      }),
      EditorView.theme({
        "&": {
          ...(fill
            ? { height: "100%" }
            : { minHeight: "25rem", maxHeight: "65vh" }),
          fontSize: "0.85rem",
          border: "1px solid #8886",
          borderRadius: "4px",
        },
        ".cm-scroller": { overflow: "auto" },
        ".ritual-folded-id": {
          font: "inherit",
          color: "#52657e",
          background: "transparent",
          border: "1px solid transparent",
          opacity: "0.5",
          borderRadius: "3px",
          padding: "0 0.15em",
          cursor: "pointer",
        },
        ".ritual-folded-id:hover, .ritual-folded-id:focus-visible": {
          opacity: "1",
          background: "#b8c5d41a",
          borderColor: "#8b9caf66",
        },
        ".ritual-folded-id:focus-visible": {
          outline: "2px solid #52657e",
          outlineOffset: "1px",
        },
      }),
    ],
    [dialect, foldIds, disabled, label, onCompositionChange, fill],
  );
  const initialExtensions = React.useRef(extensions);
  React.useLayoutEffect(() => {
    if (!host.current) return;
    const instance = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: latest.current.value,
        extensions: initialExtensions.current,
      }),
    });
    view.current = instance;
    return () => {
      view.current = null;
      instance.destroy();
    };
    // The view owns its selection and scroll for its entire mounted lifetime.
  }, []);
  React.useLayoutEffect(() => {
    const instance = view.current;
    if (!instance) return;
    const changedDialect = previousDialect.current !== dialect;
    previousDialect.current = dialect;
    const old = instance.state.doc.toString();
    if (changedDialect || old !== value) {
      // External projections (visual changes, discard, dialect switching) are
      // authoritative now. Reset source Undo so it cannot restore stale syntax.
      let from = 0;
      while (
        from < old.length &&
        from < value.length &&
        old[from] === value[from]
      )
        from++;
      let end = old.length;
      let newEnd = value.length;
      while (
        end > from &&
        newEnd > from &&
        old[end - 1] === value[newEnd - 1]
      ) {
        end--;
        newEnd--;
      }
      const transaction = instance.state.update({
        changes: { from, to: end, insert: value.slice(from, newEnd) },
      });
      const scrollTop = instance.scrollDOM.scrollTop;
      const scrollLeft = instance.scrollDOM.scrollLeft;
      instance.setState(
        EditorState.create({
          doc: value,
          selection: transaction.state.selection,
          extensions,
        }),
      );
      instance.scrollDOM.scrollTop = scrollTop;
      instance.scrollDOM.scrollLeft = scrollLeft;
    } else {
      instance.dispatch({ effects: StateEffect.reconfigure.of(extensions) });
    }
  }, [value, dialect, extensions]);
  // After the value is applied, so a caret for the new text finds it.
  const placed = React.useRef<{
    view: EditorView | null;
    cursor: RitualSourceCursor | null;
  }>({ view: null, cursor: null });
  React.useLayoutEffect(() => {
    const instance = view.current;
    if (!instance || !cursor) return;
    if (placed.current.view === instance && placed.current.cursor === cursor)
      return;
    placed.current = { view: instance, cursor };
    const { doc } = instance.state;
    if (
      cursor.line < 1 ||
      cursor.line > doc.lines ||
      doc.toString() !== cursor.source
    )
      return;
    const line = doc.line(cursor.line);
    const pos =
      line.from + Math.min(Math.max(cursor.column - 1, 0), line.length);
    const main = instance.state.selection.main;
    if (!main.empty || main.head !== pos)
      instance.dispatch({
        selection: { anchor: pos },
        annotations: placedCaret.of(true),
      });
    // Measured, not read now: a new value's line heights are estimates
    // until CodeMirror measures them. The line is scrolled to even when
    // the caret was already there.
    instance.requestMeasure({
      read: (editor) => {
        const block = editor.lineBlockAt(pos);
        const port = editor.scrollDOM.getBoundingClientRect();
        return {
          line: {
            top: editor.documentTop + block.top,
            bottom: editor.documentTop + block.bottom,
          },
          port: { top: port.top, bottom: port.bottom },
          scrollTop: editor.scrollDOM.scrollTop,
        };
      },
      write: ({ line, port, scrollTop }, editor) => {
        const top = centredScrollTop(line, port, scrollTop);
        if (top !== null) editor.scrollDOM.scrollTop = top;
      },
    });
  }, [cursor]);
  const hallWarnings = useHallWarnings(
    value,
    dialect === "pug" && diagnostic?.source !== value,
    headerless,
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: projections and reconfiguration can replace the CodeMirror state; reapply its diagnostics afterward.
  React.useLayoutEffect(() => {
    const instance = view.current;
    if (!instance) return;
    const { doc } = instance.state;
    const text = doc.toString();
    const active = diagnostic?.source === text ? diagnostic : null;
    const diagnostics: Diagnostic[] = [];
    if (active)
      diagnostics.push({
        ...diagnosticRange(doc, active),
        severity: "error",
        message: active.message,
        source:
          active.column === undefined ? undefined : `Column ${active.column}`,
      });
    if (hallWarnings?.source === text)
      for (const warning of hallWarnings.warnings)
        diagnostics.push({
          ...diagnosticRange(doc, warning),
          severity: "warning",
          message: warning.message,
          source: "Temple hall",
        });
    instance.dispatch(setDiagnostics(instance.state, diagnostics));
  }, [diagnostic, hallWarnings, value, extensions]);
  // A remounted panel must not replay a reveal it already applied.
  const revealed = React.useRef(reveal?.key);
  React.useEffect(() => {
    const instance = view.current;
    if (!instance || !reveal || reveal.key === revealed.current) return;
    revealed.current = reveal.key;
    const line = instance.state.doc.line(
      Math.max(1, Math.min(reveal.line, instance.state.doc.lines)),
    );
    instance.dispatch({
      selection: { anchor: line.from, head: line.to },
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    instance.focus();
  }, [reveal]);
  // Like reveal: a remounted panel must not replay an earlier follow.
  const followed = React.useRef(follow?.key);
  React.useEffect(() => {
    const instance = view.current;
    if (!instance || !follow || follow.key === followed.current) return;
    followed.current = follow.key;
    if (instance.hasFocus) return;
    const { doc } = instance.state;
    for (let n = 1; n <= doc.lines; n++) {
      const line = doc.line(n);
      if (ritualPugHeaderId(line.text) !== follow.id) continue;
      const block = instance.lineBlockAt(line.from);
      const top = instance.scrollDOM.scrollTop;
      const visible =
        block.top >= top &&
        block.bottom <= top + instance.scrollDOM.clientHeight;
      if (!visible)
        instance.dispatch({
          effects: EditorView.scrollIntoView(line.from, { y: "center" }),
        });
      return;
    }
  }, [follow]);
  const hasError = diagnostic?.source === value;
  const hasWarnings =
    hallWarnings?.source === value && hallWarnings.warnings.length > 0;
  const hasDiagnostic = hasError || hasWarnings;
  const problem = hasError ? "error" : "warning";
  const tools = (dialect === "pug" || hasDiagnostic) && (
    <div
      role="group"
      aria-label="Source editor tools"
      style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}
    >
      {dialect === "pug" && (
        <Button
          size="small"
          type="button"
          aria-pressed={!foldIds}
          onClick={() => setFoldIds((current) => !current)}
        >
          {foldIds ? "Show IDs" : "Fold IDs"}
        </Button>
      )}
      {hasDiagnostic && (
        <>
          <Button
            size="small"
            type="button"
            title={`F8; Shift+F8 for the previous ${problem}`}
            onClick={() => {
              if (view.current) {
                navigateDiagnostic(view.current, nextDiagnostic);
                view.current.focus();
              }
            }}
          >
            Go to {problem}
          </Button>
          <Button
            size="small"
            type="button"
            title="Ctrl+Shift+M (Cmd+Shift+M on Mac)"
            onClick={() => {
              if (view.current) openLintPanel(view.current);
            }}
          >
            Problems
          </Button>
        </>
      )}
    </div>
  );
  return (
    <>
      {header ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.25rem 0.5rem",
          }}
        >
          {header}
          {tools}
        </div>
      ) : (
        tools
      )}
      <div ref={host} style={fill ? { flex: 1, minHeight: 0 } : undefined} />
    </>
  );
}
