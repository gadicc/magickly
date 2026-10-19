"use client";

import Link from "@magick-components/Link";
import { Alert, Box } from "@mui/material";
import { EditorContent, useEditor } from "@tiptap/react";
import React from "react";
import styles from "@/app/doc/[_id]/edit/semantic/SemanticEditor.module.css";
import { ritualTiptapClientExtensions } from "@/doc/tiptapRitualClient";
import { RitualLayoutSwitch } from "./RitualLayoutSwitch";
import RitualSourceEditor from "./RitualSourceEditor";
import RitualVisualControls from "./RitualVisualControls";
import { parseRitualSource, printRitualSource } from "./ritualSource";
import { ritualSourceDiagnostic } from "./ritualSourceDiagnostics";
import {
  normalizeTiptapNodeIds,
  semanticFromTiptap,
  visualRitualState,
} from "./tiptapRitual";
import {
  type RitualEditorLayout,
  useRitualEditorLayout,
} from "./useRitualEditorLayout";

const initialView = (source: string) => {
  try {
    return {
      ...visualRitualState(parseRitualSource(source, "pug")),
      diagnostic: null,
    };
  } catch (cause) {
    return {
      content: { type: "doc", content: [{ type: "paragraph" }] },
      issue: "Correct the ritual source before using visual editing.",
      diagnostic: ritualSourceDiagnostic(cause, source),
    };
  }
};

/** Unsaved authoring shares the ritual schema; uploads start after authorization on creation. */
export default function RitualCreationEditor({
  source,
  onChange,
  disabled,
  onValidityChange,
  initialMode = "split",
  onModeChange,
}: {
  source: string;
  onChange(source: string): void;
  disabled: boolean;
  onValidityChange(valid: boolean): void;
  initialMode?: RitualEditorLayout;
  onModeChange?(mode: RitualEditorLayout): void;
}) {
  const [initial] = React.useState(() => initialView(source));
  const [issue, setIssue] = React.useState(initial.issue);
  const [sourceDiagnostic, setSourceDiagnostic] = React.useState(
    initial.diagnostic,
  );
  const [visualError, setVisualError] = React.useState<string | null>(null);
  const [sourceComposing, setSourceComposing] = React.useState(false);
  const [mode, chooseLayout] = useRitualEditorLayout(initialMode);
  const displayMode = issue ? "source" : mode;
  const chooseMode = (next: RitualEditorLayout) => {
    if (next === "visual") setSourceComposing(false);
    chooseLayout(next);
    onModeChange?.(next);
  };
  const lastEmission = React.useRef<string | null>(null);
  const editor = useEditor({
    extensions: ritualTiptapClientExtensions,
    content: initial.content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "New ritual visual editor",
        "aria-multiline": "true",
      },
    },
    onUpdate({ editor: changed, transaction }) {
      if (!transaction.docChanged) return;
      try {
        if (normalizeTiptapNodeIds(changed)) return;
        const next = printRitualSource(semanticFromTiptap(changed.getJSON()));
        lastEmission.current = next;
        onChange(next);
        setIssue(null);
        setSourceDiagnostic(null);
        setVisualError(null);
        onValidityChange(true);
      } catch {
        setVisualError(
          "The visual document is invalid. Undo the last change before creating the ritual.",
        );
        onValidityChange(false);
      }
    },
  });
  React.useEffect(() => {
    if (!editor || sourceComposing) return;
    if (source === lastEmission.current) {
      lastEmission.current = null;
      return;
    }
    lastEmission.current = null;
    const next = initialView(source);
    // React node views mount with flushSync, which React refuses during the
    // commit that a discrete event (typing, paste) flushes this effect in.
    // Microtasks run in order and before any further input, so the latest
    // source still wins; a later task could overwrite a visual edit.
    queueMicrotask(() => {
      if (!editor.isDestroyed)
        editor.commands.setContent(next.content, { emitUpdate: false });
    });
    setIssue(next.issue);
    setSourceDiagnostic(next.diagnostic);
    setVisualError(null);
    // Source-only shapes are still valid semantic documents.
    onValidityChange(!next.diagnostic);
  }, [editor, source, sourceComposing, onValidityChange]);
  React.useEffect(() => {
    editor?.setEditable(!disabled && !issue && !sourceComposing);
  }, [editor, disabled, issue, sourceComposing]);
  return (
    <Box sx={{ mt: 2, display: "grid", gap: 1 }}>
      <RitualLayoutSwitch
        label="New ritual editor layout"
        value={displayMode}
        onChoose={chooseMode}
        isDisabled={(value) => disabled || (!!issue && value !== "source")}
      />
      <Link href="/help/ritual-pug" target="_blank" rel="noopener noreferrer">
        Ritual Pug guide (opens in a new tab)
      </Link>
      {issue && <Alert severity="warning">{issue}</Alert>}
      {visualError && <Alert severity="error">{visualError}</Alert>}
      <Box className={styles.panels}>
        {displayMode !== "visual" && (
          <section
            className={styles.sourcePanel}
            aria-label="New ritual source panel"
          >
            <RitualSourceEditor
              diagnostic={sourceDiagnostic}
              label="New ritual source"
              value={source}
              dialect="pug"
              disabled={disabled}
              onCompositionChange={setSourceComposing}
              onChange={onChange}
            />
          </section>
        )}
        {displayMode !== "source" &&
          (editor ? (
            <section
              className={styles.visualPanel}
              aria-label="New ritual visual editor panel"
              aria-busy={sourceComposing || undefined}
            >
              <RitualVisualControls
                editor={editor}
                disabled={disabled}
                syncingSource={sourceComposing}
              />
              <EditorContent editor={editor} className={styles.editor} />
            </section>
          ) : (
            <p>Loading visual editor…</p>
          ))}
      </Box>
    </Box>
  );
}
