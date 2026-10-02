"use client";

import Link from "@magick-components/Link";
import { Alert, Box, Button, ButtonGroup } from "@mui/material";
import { EditorContent, useEditor } from "@tiptap/react";
import React from "react";
import styles from "@/app/doc/[_id]/edit/semantic/SemanticEditor.module.css";
import RitualSourceEditor from "./RitualSourceEditor";
import RitualVisualControls from "./RitualVisualControls";
import { parseRitualSource, printRitualSource } from "./ritualSource";
import { ritualSourceDiagnostic } from "./ritualSourceDiagnostics";
import {
  normalizeTiptapNodeIds,
  ritualTiptapExtensions,
  semanticFromTiptap,
  visualRitualState,
} from "./tiptapRitual";

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
  initialMode = "visual",
  onModeChange,
}: {
  source: string;
  onChange(source: string): void;
  disabled: boolean;
  onValidityChange(valid: boolean): void;
  initialMode?: "visual" | "source";
  onModeChange?(mode: "visual" | "source"): void;
}) {
  const [initial] = React.useState(() => initialView(source));
  const [issue, setIssue] = React.useState(initial.issue);
  const [sourceDiagnostic, setSourceDiagnostic] = React.useState(
    initial.diagnostic,
  );
  const [visualError, setVisualError] = React.useState<string | null>(null);
  const [sourceComposing, setSourceComposing] = React.useState(false);
  const [mode, setMode] = React.useState(initialMode);
  const chooseMode = (next: "visual" | "source") => {
    setMode(next);
    onModeChange?.(next);
  };
  const lastEmission = React.useRef<string | null>(null);
  const editor = useEditor({
    extensions: ritualTiptapExtensions,
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
    editor.commands.setContent(next.content, { emitUpdate: false });
    setIssue(next.issue);
    setSourceDiagnostic(next.diagnostic);
    setVisualError(null);
    // Source-only shapes are still valid semantic documents.
    onValidityChange(!next.diagnostic);
  }, [editor, source, sourceComposing, onValidityChange]);
  React.useEffect(() => {
    editor?.setEditable(!disabled && !issue, false);
  }, [editor, disabled, issue]);
  return (
    <Box sx={{ mt: 2, display: "grid", gap: 1 }}>
      <ButtonGroup size="small" aria-label="New ritual editor layout">
        <Button
          type="button"
          disabled={disabled || !!issue}
          variant={mode === "visual" && !issue ? "contained" : "outlined"}
          onClick={() => chooseMode("visual")}
        >
          Visual
        </Button>
        <Button
          type="button"
          disabled={disabled}
          variant={mode === "source" || issue ? "contained" : "outlined"}
          onClick={() => chooseMode("source")}
        >
          Ritual source
        </Button>
      </ButtonGroup>
      <Link href="/help/ritual-pug" target="_blank" rel="noopener noreferrer">
        Ritual Pug guide (opens in a new tab)
      </Link>
      {issue && <Alert severity="warning">{issue}</Alert>}
      {visualError && <Alert severity="error">{visualError}</Alert>}
      {mode === "source" || issue ? (
        <RitualSourceEditor
          diagnostic={sourceDiagnostic}
          label="New ritual source"
          value={source}
          dialect="pug"
          disabled={disabled}
          onCompositionChange={setSourceComposing}
          onChange={onChange}
        />
      ) : editor ? (
        <section
          className={styles.visualPanel}
          aria-label="New ritual visual editor panel"
        >
          <RitualVisualControls editor={editor} disabled={disabled} />
          <EditorContent editor={editor} className={styles.editor} />
        </section>
      ) : (
        <p>Loading visual editor…</p>
      )}
    </Box>
  );
}
