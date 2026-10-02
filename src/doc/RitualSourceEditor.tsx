"use client";

import { StreamLanguage } from "@codemirror/language";
import { pug } from "@codemirror/legacy-modes/mode/pug";
import { Button } from "@mui/material";
import {
  basicSetup,
  Decoration,
  type DecorationSet,
  EditorState,
  EditorView,
  StateEffect,
  StateField,
  WidgetType,
} from "@uiw/react-codemirror";
import React from "react";
import { ritualPugIdRanges } from "./ritualPugIds";
import type { RitualSourceDialect } from "./ritualSource";

const revealId = StateEffect.define<string>();
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
}: {
  value: string;
  dialect: RitualSourceDialect;
  onChange(value: string): void;
  disabled: boolean;
  label?: string;
  onCompositionChange?(composing: boolean): void;
}) {
  const [foldIds, setFoldIds] = React.useState(true);
  const host = React.useRef<HTMLDivElement>(null);
  const view = React.useRef<EditorView | null>(null);
  const latest = React.useRef({ onChange, value });
  latest.current = { onChange, value };
  const previousDialect = React.useRef(dialect);
  const extensions = React.useMemo(
    () => [
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
      EditorView.contentAttributes.of({
        "aria-label": label,
        "aria-multiline": "true",
        spellcheck: "false",
      }),
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
  return (
    <>
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
      <div ref={host} />
    </>
  );
}
