"use client";

import Link from "@magick-components/Link";

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
import RitualVisualControls from "@/doc/RitualVisualControls";
import { parseRitualText, printRitualText } from "@/doc/ritualText";
import SemanticPublication from "@/doc/SemanticPublication";
import {
  type RitualSemanticDocument,
  validateRitualSemantic,
} from "@/doc/semantic";
import {
  clearSemanticDraft,
  confirmSemanticSave,
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
  normalizeTiptapNodeIds,
  ritualTiptapExtensions,
  semanticFromTiptap,
  visualRitualState,
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
  const [initialVisual] = React.useState(() =>
    visualRitualState(props.initialDocument),
  );
  const [visualIssue, setVisualIssue] = React.useState(initialVisual.issue);
  const displayMode = visualIssue ? "source" : mode;
  const skipPersist = React.useRef(true);
  const liveDraft = React.useRef<SemanticDraft | null>(null);
  const draftWrites = React.useRef<Promise<void>>(Promise.resolve());
  const draftWriteVersion = React.useRef(0);
  const accessGeneration = React.useRef(0);

  const queueDraftWrite = React.useCallback(
    (operation: () => Promise<unknown>) => {
      const next = draftWrites.current.then(operation);
      draftWrites.current = next.then(
        () => {},
        () => {},
      );
      return next;
    },
    [],
  );

  const editor = useEditor({
    extensions: ritualTiptapExtensions,
    content: initialVisual.content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Ritual visual editor",
        "aria-multiline": "true",
      },
    },
    onUpdate({ editor: changed, transaction }) {
      if (!transaction.docChanged) return;
      try {
        if (normalizeTiptapNodeIds(changed)) return;
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
  });

  React.useEffect(() => {
    if (!editor) return;
    let active = true;
    let seenReady = false;
    let permanentlyLocked = false;
    let verifying = false;
    let unsubscribe = () => {};
    let runtime: ReturnType<typeof getBrowserOfflineRuntime> | null = null;
    const requests = new Set<AbortController>();
    const lock = () => {
      if (!active || permanentlyLocked) return;
      permanentlyLocked = true;
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
      if (!active || !runtime || permanentlyLocked) return;
      const state = runtime.coordinator.state;
      if (state.phase === "ready" && state.account?.ownerId !== props.actorId) {
        lock();
        return;
      }
      if (state.phase === "locked" && seenReady) {
        // A verified account refresh also emits a temporary locked state.
        setAccess("checking");
        if (!verifying) void recheck().catch(lock);
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
      if (!active || !runtime || permanentlyLocked || verifying) return;
      verifying = true;
      setAccess("checking");
      try {
        await runtime.refreshVerifiedAccount();
        if (!active || permanentlyLocked) return;
        const state = runtime.coordinator.state;
        if (
          state.phase !== "ready" ||
          state.account?.ownerId !== props.actorId ||
          !(await verifyPermission()) ||
          runtime.coordinator.state.phase !== "ready" ||
          runtime.coordinator.state.account?.ownerId !== props.actorId
        ) {
          lock();
          return;
        }
        if (!active || permanentlyLocked) return;
        seenReady = true;
        setAccess("ready");
      } finally {
        verifying = false;
      }
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
    if (!editor || access !== "ready" || ready) return;
    let active = true;
    loadSemanticDraft(props.actorId, props.ritualId)
      .then(async (draft) => {
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
          if (
            !draft.pending &&
            !draft.sourceDirty &&
            !draft.sourceConflict &&
            draft.title === props.title &&
            draft.documentJson === stringify(props.initialDocument) &&
            draft.sourceBuffer === printRitualText(props.initialDocument)
          ) {
            await clearSemanticDraft(props.actorId, props.ritualId);
            return;
          }
          const restored = parsed as RitualSemanticDocument;
          const visual = visualRitualState(restored);
          setVisualIssue(visual.issue);
          editor.commands.setContent(visual.content, {
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
    ready,
    props.actorId,
    props.ritualId,
    props.revisionId,
    props.parentVersion,
    props.title,
    props.initialDocument,
  ]);

  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(
      !visualIssue &&
        access === "ready" &&
        ready &&
        !recoveryBlocked &&
        !saving &&
        !pending &&
        !stale,
    );
  }, [
    editor,
    access,
    ready,
    recoveryBlocked,
    saving,
    pending,
    stale,
    visualIssue,
  ]);

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
    const writeVersion = draftWriteVersion.current;
    const timer = setTimeout(() => {
      if (skipPersist.current || writeVersion !== draftWriteVersion.current)
        return;
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
      void queueDraftWrite(() => saveSemanticDraft(draft)).catch(() =>
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
    queueDraftWrite,
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
      const visual = visualRitualState(next);
      editor.commands.setContent(visual.content, { emitUpdate: false });
      setVisualIssue(visual.issue);
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
      await confirmSemanticSave({
        version: 1,
        operationId: request.operationId,
        expectedActorId: props.actorId,
        ritualId: props.ritualId,
        expectedRevisionId: result.revisionId,
        expectedVersion: result.version,
      });
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
      await queueDraftWrite(() =>
        saveSemanticDraft({ ...currentDraft(), pending: request }),
      );
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
      draftWriteVersion.current++;
      liveDraft.current = null;
      setBase({ revisionId: result.revisionId, version: result.version });
      setPending(null);
      try {
        const retained = await queueDraftWrite(() =>
          confirmSemanticSave({
            version: 1,
            operationId: request.operationId,
            expectedActorId: props.actorId,
            ritualId: props.ritualId,
            expectedRevisionId: result.revisionId,
            expectedVersion: result.version,
          }),
        );
        if (retained === false) {
          setReloadRequired(true);
          return;
        }
        setError(null);
      } catch {
        setError(
          "The revision was saved, but its local draft could not be cleared. Reload to recover or discard that draft.",
        );
      }
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
  if (!editor || !ready)
    return <p>Verifying account and loading local draft…</p>;
  return (
    <Box
      className={styles.root}
      sx={{ visibility: access === "checking" ? "hidden" : undefined }}
      aria-hidden={access === "checking"}
    >
      {access === "checking" && (
        <Alert severity="info">Verifying editor access…</Alert>
      )}
      <Typography variant="h4" component="h1">
        Ritual editor
      </Typography>
      {props.importedFromLegacy && (
        <Alert severity="info">
          This is a semantic conversion of the current Pug revision. Saving
          creates a new revision; the original source remains in history.
        </Alert>
      )}
      {props.importReport && props.importReport.opaqueCount > 0 && (
        <Alert severity="warning">
          {props.importReport.opaqueCount} unsupported legacy blocks are
          preserved. Inspect them in ritual source; they cannot be edited
          visually.
        </Alert>
      )}
      {visualIssue && (
        <Alert severity="warning">
          {visualIssue}
          {props.importedFromLegacy && (
            <Button href={`/doc/${props.ritualId}/edit?legacy=1`}>
              Open Pug editor
            </Button>
          )}
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
      <SemanticPublication
        actorId={props.actorId}
        ritualId={props.ritualId}
        revisionId={base.revisionId}
        version={base.version}
        enabled={access === "ready" && !saving && !pending && !stale}
      />
      <Box className={styles.topbar}>
        <TextField
          label="Title"
          size="small"
          value={title}
          disabled={access !== "ready" || !!pending || !!stale}
          onChange={(event) => {
            skipPersist.current = false;
            setTitle(event.target.value);
          }}
        />
        <ButtonGroup size="small" aria-label="Editor layout">
          {(["visual", "source", "split"] as const).map((item) => (
            <Button
              key={item}
              variant={displayMode === item ? "contained" : "outlined"}
              disabled={
                access !== "ready" || (!!visualIssue && item !== "source")
              }
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
        {displayMode !== "visual" && (
          <section
            className={styles.sourcePanel}
            aria-label="Semantic source panel"
          >
            <Typography variant="h6">Ritual source</Typography>
            <Typography variant="body2">
              Each line is a ritual command or a quoted text fragment. Try{" "}
              <code>Hiero: words</code>, <code>* Keryx action</code>, or{" "}
              <code>@note:</code>. Apply changes to update the visual panel.{" "}
              <Link
                href="/help/ritual-text"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read the Ritual Text guide (opens in a new tab)
              </Link>
            </Typography>
            <textarea
              aria-label="Ritual semantic source"
              spellCheck={false}
              value={source.text}
              disabled={access !== "ready" || !!pending || !!stale}
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
                disabled={
                  access !== "ready" || !source.dirty || !!pending || !!stale
                }
              >
                Apply source
              </Button>
              <Button
                onClick={() => {
                  setSource({
                    text: printRitualText(document),
                    dirty: false,
                    conflict: false,
                  });
                  try {
                    // A source error can be cleared only if the other panel is valid.
                    if (!visualIssue) semanticFromTiptap(editor.getJSON());
                    setError(null);
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "The visual document is invalid.",
                    );
                  }
                }}
                disabled={
                  access !== "ready" || !source.dirty || !!pending || !!stale
                }
              >
                Discard source changes
              </Button>
            </Box>
          </section>
        )}
        {displayMode !== "source" && (
          <section
            className={styles.visualPanel}
            aria-label="Visual editor panel"
          >
            <RitualVisualControls
              editor={editor}
              concealed={access !== "ready"}
              disabled={access !== "ready" || saving || !!pending || !!stale}
              actorId={props.actorId}
              ritualId={props.ritualId}
              title={title}
            />
            <EditorContent editor={editor} className={styles.editor} />
          </section>
        )}
      </Box>
    </Box>
  );
}
