"use client";

import { StreamLanguage } from "@codemirror/language";
import { pug } from "@codemirror/legacy-modes/mode/pug";
import {
  type Diagnostic,
  diagnosticCount,
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
import { ritualPugIdRanges } from "./ritualPugIds";
import type { RitualSourceDialect } from "./ritualSource";
import type { RitualSourceDiagnostic } from "./ritualSourceDiagnostics";

const revealId = StateEffect.define<string>();
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

/** Shared Pug/Ritual Text source panel with optional, lossless identity folding. */
export default function RitualSourceEditor({
  value,
  dialect,
  onChange,
  disabled,
  label = "Ritual semantic source",
  onCompositionChange,
  diagnostic,
}: {
  value: string;
  dialect: RitualSourceDialect;
  onChange(value: string): void;
  disabled: boolean;
  label?: string;
  onCompositionChange?(composing: boolean): void;
  diagnostic?: RitualSourceDiagnostic | null;
}) {
  const [foldIds, setFoldIds] = React.useState(true);
  const host = React.useRef<HTMLDivElement>(null);
  const view = React.useRef<EditorView | null>(null);
  const latest = React.useRef({ onChange, value });
  latest.current = { onChange, value };
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
      }),
      ...(dialect === "pug"
        ? [StreamLanguage.define(pug), ...(foldIds ? [ritualIdFolding()] : [])]
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
      EditorView.contentAttributes.of((editor) => ({
        "aria-label": label,
        "aria-multiline": "true",
        "aria-invalid": diagnosticCount(editor.state) ? "true" : "false",
        spellcheck: "false",
      })),
      EditorView.theme({
        "&": {
          minHeight: "25rem",
          maxHeight: "65vh",
          fontSize: "0.85rem",
          border: "1px solid #8886",
          borderRadius: "4px",
        },
        ".cm-scroller": { overflow: "auto" },
        ".ritual-folded-id": {
          font: "inherit",
          color: "#52657e",
          background: "#b8c5d433",
          border: "1px solid #8b9caf66",
          borderRadius: "3px",
          padding: "0 0.15em",
          cursor: "pointer",
        },
      }),
    ],
    [dialect, foldIds, disabled, label, onCompositionChange],
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: projections and reconfiguration can replace the CodeMirror state; reapply its diagnostics afterward.
  React.useLayoutEffect(() => {
    const instance = view.current;
    if (!instance) return;
    const active =
      diagnostic?.source === instance.state.doc.toString() ? diagnostic : null;
    const diagnostics: Diagnostic[] = [];
    if (active) {
      const line = instance.state.doc.line(
        Math.max(1, Math.min(active.line ?? 1, instance.state.doc.lines)),
      );
      const hasColumn = active.column !== undefined;
      const from =
        active.line === undefined
          ? 0
          : line.from +
            (hasColumn
              ? Math.max(0, Math.min(active.column! - 1, line.length))
              : line.text.search(/\S|$/));
      const to =
        active.line === undefined
          ? 0
          : hasColumn
            ? Math.min(
                line.to,
                from +
                  (line.text
                    .slice(from - line.from)
                    .match(/^#?[A-Za-z0-9_-]+/)?.[0].length ??
                    ((line.text.codePointAt(from - line.from) ?? 0) > 0xffff
                      ? 2
                      : 1)),
              )
            : line.to;
      diagnostics.push({
        from,
        to,
        severity: "error",
        message: active.message,
        source:
          active.column === undefined ? undefined : `Column ${active.column}`,
      });
    }
    instance.dispatch(setDiagnostics(instance.state, diagnostics));
  }, [diagnostic, value, extensions]);
  const hasDiagnostic = diagnostic?.source === value;
  return (
    <>
      {(dialect === "pug" || hasDiagnostic) && (
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
                title="F8; Shift+F8 for the previous error"
                onClick={() => {
                  if (view.current) {
                    navigateDiagnostic(view.current, nextDiagnostic);
                    view.current.focus();
                  }
                }}
              >
                Go to error
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
      )}
      <div ref={host} />
    </>
  );
}
