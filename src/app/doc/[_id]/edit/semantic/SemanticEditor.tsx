"use client";

import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  TextField,
  Typography,
} from "@mui/material";
import { EditorContent, useEditor } from "@tiptap/react";
import React from "react";
import { parseRitualText, printRitualText } from "@/doc/ritualText";
import {
  type RitualSemanticDocument,
  validateRitualSemantic,
} from "@/doc/semantic";
import {
  clearSemanticDraft,
  loadSemanticDraft,
  type SemanticDraft,
  saveSemanticDraft,
} from "@/doc/semanticDraft";
import {
  fetchSqlRitualSource,
  sendSqlRitualWrite,
} from "@/doc/sqlEditorClient";
import type { SqlRitualWriteRequest } from "@/doc/sqlWriteContract";
import {
  ritualTiptapExtensions,
  semanticFromTiptap,
  semanticToTiptap,
} from "@/doc/tiptapRitual";
import { createUuidV7 } from "@/lib/ids";
import { getBrowserOfflineRuntime } from "@/offline/browserRuntime";
import styles from "./SemanticEditor.module.css";
import type { SemanticEditorProps } from "./SemanticEditorShell";

type SaveRequest = Extract<SqlRitualWriteRequest, { kind: "save" }>;
type Mode = "visual" | "source" | "split";
interface SourceState {
  text: string;
  dirty: boolean;
  conflict: boolean;
}
const stringify = (document: RitualSemanticDocument) =>
  JSON.stringify(document, null, 2);

function downloadDraft(draft: SemanticDraft) {
  const blob = new Blob([JSON.stringify(draft, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ritual-draft-${draft.ritualId}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SemanticEditor(props: SemanticEditorProps) {
  const [document, setDocument] = React.useState(props.initialDocument);
  const [source, setSource] = React.useState<SourceState>({
    text: printRitualText(props.initialDocument),
    dirty: false,
    conflict: false,
  });
  const [title, setTitle] = React.useState(props.title);
  const [mode, setMode] = React.useState<Mode>("visual");
  const [base, setBase] = React.useState({
    revisionId: props.revisionId,
    version: props.parentVersion,
  });
  const [pending, setPending] = React.useState<SaveRequest | null>(null);
  const [stale, setStale] = React.useState<SemanticDraft | null>(null);
  const [reloadRequired, setReloadRequired] = React.useState(false);
  const [recoveryBlocked, setRecoveryBlocked] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [access, setAccess] = React.useState<"checking" | "ready" | "locked">(
    "checking",
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [selectedTask, setSelectedTask] = React.useState<{
    pos: number;
    role: string;
    mode: "say" | "do";
  } | null>(null);
  const [role, setRole] = React.useState("all");
  const skipPersist = React.useRef(true);
  const liveDraft = React.useRef<SemanticDraft | null>(null);
  const accessGeneration = React.useRef(0);

  const editor = useEditor({
    extensions: ritualTiptapExtensions,
    content: semanticToTiptap(props.initialDocument),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Ritual visual editor",
        "aria-multiline": "true",
      },
    },
    onUpdate({ editor: changed }) {
      try {
        const next = semanticFromTiptap(changed.getJSON());
        skipPersist.current = false;
        setDocument(next);
        setSource((current) =>
          current.dirty
            ? { ...current, conflict: true }
            : { text: printRitualText(next), dirty: false, conflict: false },
        );
        setError(null);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The visual document is invalid.",
        );
      }
    },
    onSelectionUpdate({ editor: selected }) {
      const position = selected.state.selection.$from;
      for (let depth = position.depth; depth > 0; depth--) {
        const node = position.node(depth);
        if (node.type.name === "ritualBlock" && node.attrs.tag === "task") {
          const next = {
            pos: position.before(depth),
            role: String(node.attrs.attrs.role ?? "all"),
            mode:
              node.attrs.attrs.say === true
                ? ("say" as const)
                : ("do" as const),
          };
          setSelectedTask(next);
          setRole(next.role);
          return;
        }
      }
      setSelectedTask(null);
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    let active = true;
    let seenReady = false;
    let permissionReady = false;
    let unsubscribe = () => {};
    let runtime: ReturnType<typeof getBrowserOfflineRuntime> | null = null;
    const requests = new Set<AbortController>();
    const lock = () => {
      if (!active) return;
      seenReady = true;
      accessGeneration.current++;
      const recovery = liveDraft.current;
      if (recovery)
        void saveSemanticDraft(structuredClone(recovery)).catch(() => {});
      liveDraft.current = null;
      skipPersist.current = true;
      editor.setEditable(false);
      editor.commands.setContent(
        { type: "doc", content: [] },
        { emitUpdate: false },
      );
      setDocument({ format: "magickli-ritual", version: 1, nodes: [] });
      setSource({ text: "", dirty: false, conflict: false });
      setTitle("");
      setPending(null);
      setReady(false);
      setAccess("locked");
    };
    const checkState = () => {
      if (!active || !runtime) return;
      const state = runtime.coordinator.state;
      if (
        state.phase === "locked" ||
        (state.phase === "ready" && state.account?.ownerId !== props.actorId)
      ) {
        lock();
        return;
      }
      if (!seenReady && permissionReady && state.phase === "ready") {
        seenReady = true;
        setAccess("ready");
      }
    };
    const verifyPermission = async () => {
      const controller = new AbortController();
      requests.add(controller);
      try {
        const delivery = await fetchSqlRitualSource(
          {
            version: 1,
            requestId: createUuidV7(),
            expectedActorId: props.actorId,
            ritualId: props.ritualId,
          },
          controller.signal,
        );
        return (
          delivery?.permission.kind === "granted" &&
          delivery.permission.ownerId === props.actorId &&
          delivery.permission.grant.sourceEdit === true
        );
      } finally {
        requests.delete(controller);
      }
    };
    const recheck = async () => {
      if (!active || !runtime) return;
      await runtime.refreshVerifiedAccount();
      if (!active) return;
      const state = runtime.coordinator.state;
      if (
        state.phase !== "ready" ||
        state.account?.ownerId !== props.actorId ||
        !(await verifyPermission())
      ) {
        lock();
        return;
      }
      permissionReady = true;
      checkState();
    };
    try {
      runtime = getBrowserOfflineRuntime();
      const current = runtime;
      void (async () => {
        await current.start();
        if (!active) return;
        unsubscribe = current.subscribeState(checkState);
        await recheck();
      })().catch(lock);
    } catch {
      lock();
    }
    const refresh = () => {
      void recheck().catch(lock);
    };
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
      for (const controller of requests) controller.abort();
    };
  }, [editor, props.actorId, props.ritualId]);

  React.useEffect(() => {
    if (!editor || access !== "ready") return;
    let active = true;
    loadSemanticDraft(props.actorId, props.ritualId)
      .then((draft) => {
        if (!active || !draft) return;
        if (
          draft.baseRevisionId !== props.revisionId ||
          draft.baseVersion !== props.parentVersion
        ) {
          setStale(draft);
          return;
        }
        try {
          const parsed: unknown = JSON.parse(draft.documentJson);
          const errors = validateRitualSemantic(parsed);
          if (errors.length) throw new Error(errors[0]);
          const restored = parsed as RitualSemanticDocument;
          editor.commands.setContent(semanticToTiptap(restored), {
            emitUpdate: false,
          });
          setDocument(restored);
          setTitle(draft.title);
          setSource({
            text: draft.sourceBuffer,
            dirty: draft.sourceDirty,
            conflict: draft.sourceConflict,
          });
          setPending(draft.pending);
          setNotice("Recovered the local draft.");
          skipPersist.current = false;
        } catch {
          setStale(draft);
          setError(
            "The local draft needs manual recovery. Download it before editing.",
          );
        }
      })
      .catch(() => setRecoveryBlocked(true))
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [
    editor,
    access,
    props.actorId,
    props.ritualId,
    props.revisionId,
    props.parentVersion,
  ]);

  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(
      access === "ready" &&
        ready &&
        !recoveryBlocked &&
        !saving &&
        !pending &&
        !stale,
    );
  }, [editor, access, ready, recoveryBlocked, saving, pending, stale]);

  React.useEffect(() => {
    if (access !== "ready" || !ready || skipPersist.current) return;
    liveDraft.current = {
      ownerId: props.actorId,
      ritualId: props.ritualId,
      baseRevisionId: base.revisionId,
      baseVersion: base.version,
      title,
      documentJson: stringify(document),
      sourceBuffer: source.text,
      sourceDirty: source.dirty,
      sourceConflict: source.conflict,
      pending,
      updatedAt: Date.now(),
    };
    const timer = setTimeout(() => {
      const draft: SemanticDraft = {
        ownerId: props.actorId,
        ritualId: props.ritualId,
        baseRevisionId: base.revisionId,
        baseVersion: base.version,
        title,
        documentJson: stringify(document),
        sourceBuffer: source.text,
        sourceDirty: source.dirty,
        sourceConflict: source.conflict,
        pending,
        updatedAt: Date.now(),
      };
      void saveSemanticDraft(draft).catch(() =>
        setError(
          "The local draft could not be saved. Download a recovery copy.",
        ),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [
    ready,
    access,
    props.actorId,
    props.ritualId,
    base,
    title,
    document,
    source,
    pending,
  ]);

  const currentDraft = (): SemanticDraft => ({
    ownerId: props.actorId,
    ritualId: props.ritualId,
    baseRevisionId: base.revisionId,
    baseVersion: base.version,
    title,
    documentJson: stringify(document),
    sourceBuffer: source.text,
    sourceDirty: source.dirty,
    sourceConflict: source.conflict,
    pending,
    updatedAt: Date.now(),
  });

  const applySource = () => {
    if (!editor || pending) return;
    try {
      const next = parseRitualText(source.text);
      editor.commands.setContent(semanticToTiptap(next), { emitUpdate: false });
      setDocument(next);
      setSource((current) => ({ ...current, dirty: false, conflict: false }));
      setError(null);
      skipPersist.current = false;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The source is invalid.",
      );
    }
  };

  const insertTask = (kind: "say" | "do") => {
    if (!editor || pending) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "ritualBlock",
        attrs: {
          id: createUuidV7(),
          tag: "task",
          attrs: { [kind]: true, role: role.trim() || "all" },
        },
        content: [{ type: "paragraph" }],
      })
      .run();
  };

  const insertNote = () => {
    if (!editor || pending) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "ritualBlock",
        attrs: { id: createUuidV7(), tag: "note", attrs: {} },
        content: [{ type: "paragraph" }],
      })
      .run();
  };

  const applyRole = () => {
    if (!editor || !selectedTask || pending) return;
    const node = editor.state.doc.nodeAt(selectedTask.pos);
    if (!node) return;
    const updated = {
      ...node.attrs,
      attrs: { ...node.attrs.attrs, role: role.trim() },
    };
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(selectedTask.pos, undefined, updated),
    );
  };

  const confirmStalePending = async () => {
    const request = stale?.pending;
    if (!request || saving || access !== "ready") return;
    if (
      request.version !== 3 ||
      request.expectedActorId !== props.actorId ||
      request.ritualId !== props.ritualId
    ) {
      setError(
        "The retained request does not belong to this account and ritual.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    const generation = accessGeneration.current;
    try {
      const result = await sendSqlRitualWrite(
        request,
        new AbortController().signal,
      );
      if (generation !== accessGeneration.current) return;
      if (!result) {
        setError(
          "The pending save result is still unknown. Keep this draft and retry later.",
        );
        return;
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await clearSemanticDraft(props.actorId, props.ritualId);
      setStale(null);
      setReloadRequired(true);
      setNotice(
        "The pending save is confirmed. Reload to open the current revision.",
      );
    } catch {
      setError(
        "The pending save result is still unknown. Keep this draft and retry later.",
      );
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (
      !editor ||
      saving ||
      !ready ||
      access !== "ready" ||
      stale ||
      (!pending && (source.dirty || source.conflict || error))
    )
      return;
    const generation = accessGeneration.current;
    if (!title.trim() || title.length > 500) {
      setError("Enter a title of at most 500 characters.");
      return;
    }
    const request: SaveRequest = pending ?? {
      version: 3,
      kind: "save",
      operationId: createUuidV7(),
      expectedActorId: props.actorId,
      ritualId: props.ritualId,
      expectedRevisionId: base.revisionId,
      expectedVersion: base.version,
      title,
      source: stringify(document),
    };
    setSaving(true);
    setPending(request);
    setNotice(null);
    try {
      await saveSemanticDraft({ ...currentDraft(), pending: request });
      const result = await sendSqlRitualWrite(
        request,
        new AbortController().signal,
      );
      if (generation !== accessGeneration.current) return;
      if (!result) {
        setError("The save result is unknown. Retry the same pending request.");
        return;
      }
      if (!result.ok) {
        setError(result.message);
        if (!result.retryable) setPending(null);
        return;
      }
      skipPersist.current = true;
      setBase({ revisionId: result.revisionId, version: result.version });
      setPending(null);
      await clearSemanticDraft(props.actorId, props.ritualId);
      setError(null);
      setNotice(
        result.replayed
          ? "Save confirmed after retry."
          : "Saved as a semantic revision.",
      );
    } catch {
      setError("The save result is unknown. Retry the same pending request.");
    } finally {
      setSaving(false);
    }
  };

  if (access === "locked")
    return (
      <Alert severity="info">
        Editor access changed. Reload to verify this account again.
      </Alert>
    );
  if (reloadRequired)
    return (
      <Alert severity="success">
        The pending save is confirmed. Reload this page to open the current
        revision.
      </Alert>
    );
  if (recoveryBlocked)
    return (
      <Alert severity="error">
        The local draft could not be loaded. Reload this page before editing.
      </Alert>
    );
  if (!editor || !ready || access !== "ready")
    return <p>Verifying account and loading local draft…</p>;
  return (
    <Box className={styles.root}>
      <Typography variant="h4" component="h1">
        Ritual editor
      </Typography>
      {props.importedFromLegacy && (
        <Alert severity="info">
          This is a semantic conversion of the current Pug revision. Saving
          creates a new revision; the original source remains in history.
        </Alert>
      )}
      {stale && (
        <Alert severity="warning">
          A local draft needs recovery or belongs to an older revision. Review
          it before editing this ritual.{" "}
          <Button onClick={() => downloadDraft(stale)}>Download draft</Button>{" "}
          {stale.pending && (
            <Button disabled={saving} onClick={confirmStalePending}>
              Confirm pending save
            </Button>
          )}{" "}
          <Button
            disabled={saving}
            onClick={() => {
              void clearSemanticDraft(props.actorId, props.ritualId).then(
                () => {
                  setStale(null);
                  setError(null);
                },
              );
            }}
          >
            Discard local draft
          </Button>
        </Alert>
      )}
      {error && (
        <Alert severity="error">
          {error}{" "}
          <Button onClick={() => downloadDraft(stale ?? currentDraft())}>
            Download draft
          </Button>
        </Alert>
      )}
      {notice && <Alert severity="success">{notice}</Alert>}
      <Box className={styles.topbar}>
        <TextField
          label="Title"
          size="small"
          value={title}
          disabled={!!pending || !!stale}
          onChange={(event) => {
            skipPersist.current = false;
            setTitle(event.target.value);
          }}
        />
        <ButtonGroup size="small" aria-label="Editor layout">
          {(["visual", "source", "split"] as const).map((item) => (
            <Button
              key={item}
              variant={mode === item ? "contained" : "outlined"}
              onClick={() => setMode(item)}
            >
              {item}
            </Button>
          ))}
        </ButtonGroup>
        <Button
          variant="contained"
          disabled={
            saving ||
            !!stale ||
            (!pending && (!!error || source.dirty || source.conflict))
          }
          onClick={save}
        >
          {pending ? "Retry save" : "Save"}
        </Button>
        <Button onClick={() => downloadDraft(currentDraft())}>
          Download draft
        </Button>
      </Box>
      {pending && (
        <Alert severity="warning">
          A save is pending. Retry it unchanged before making another edit.
        </Alert>
      )}
      <Box className={styles.panels}>
        {mode !== "source" && (
          <section
            className={styles.visualPanel}
            aria-label="Visual editor panel"
          >
            <Box className={styles.toolbar}>
              <Button
                size="small"
                onClick={() => insertTask("say")}
                disabled={!!pending || !!stale}
              >
                Speech
              </Button>
              <Button
                size="small"
                onClick={() => insertTask("do")}
                disabled={!!pending || !!stale}
              >
                Action
              </Button>
              <Button
                size="small"
                onClick={insertNote}
                disabled={!!pending || !!stale}
              >
                Note
              </Button>
              <Button
                size="small"
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!!pending || !!stale}
              >
                Bold
              </Button>
              <Button
                size="small"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!!pending || !!stale}
              >
                Italic
              </Button>
              <Button
                size="small"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!!pending || !!stale}
              >
                Undo
              </Button>
              <Button
                size="small"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!!pending || !!stale}
              >
                Redo
              </Button>
            </Box>
            <Box className={styles.rolebar}>
              <TextField
                label={
                  selectedTask ? "Selected task role" : "Role for new task"
                }
                size="small"
                value={role}
                disabled={!!pending || !!stale}
                onChange={(event) => setRole(event.target.value)}
              />
              {selectedTask && (
                <Button onClick={applyRole} disabled={!!pending || !!stale}>
                  Apply role
                </Button>
              )}
            </Box>
            <EditorContent editor={editor} className={styles.editor} />
          </section>
        )}
        {mode !== "visual" && (
          <section
            className={styles.sourcePanel}
            aria-label="Semantic source panel"
          >
            <Typography variant="h6">Ritual source</Typography>
            <Typography variant="body2">
              Each line is a ritual command or a quoted text fragment. Try{" "}
              <code>Hiero: words</code>, <code>* Keryx action</code>, or{" "}
              <code>@note:</code>. Apply changes to update the visual panel.
            </Typography>
            <textarea
              aria-label="Ritual semantic source"
              spellCheck={false}
              value={source.text}
              disabled={!!pending || !!stale}
              onChange={(event) => {
                skipPersist.current = false;
                setSource({
                  text: event.target.value,
                  dirty: true,
                  conflict: source.conflict,
                });
              }}
            />
            {source.conflict && (
              <Alert severity="warning">
                Both panels changed. Apply source to replace visual changes, or
                discard source changes.
              </Alert>
            )}
            <Box className={styles.sourceActions}>
              <Button
                onClick={applySource}
                disabled={!source.dirty || !!pending || !!stale}
              >
                Apply source
              </Button>
              <Button
                onClick={() =>
                  setSource({
                    text: printRitualText(document),
                    dirty: false,
                    conflict: false,
                  })
                }
                disabled={!source.dirty || !!pending || !!stale}
              >
                Discard source changes
              </Button>
            </Box>
          </section>
        )}
      </Box>
    </Box>
  );
}
