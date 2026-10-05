"use client";

import Link from "@magick-components/Link";

import HelpOutlined from "@mui/icons-material/HelpOutlined";
import MoreVert from "@mui/icons-material/MoreVert";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { EditorContent, useEditor } from "@tiptap/react";
import React from "react";
import EditorActionButton from "@/doc/EditorActionButton";
import { retainsOnlineEditorIdentity } from "@/doc/onlineEditorIdentity";
import RitualSourceEditor from "@/doc/RitualSourceEditor";
import RitualVisualControls from "@/doc/RitualVisualControls";
import { ritualPugTopLevelLines } from "@/doc/ritualPug";
import {
  detectRitualSourceDialect,
  parseRitualSource,
  printRitualSource,
  type RitualSourceDialect,
  restoreDraftSourceAnnotations,
  restorePugDraftAnnotations,
} from "@/doc/ritualSource";
import {
  type RitualSourceDiagnostic,
  ritualSourceDiagnostic,
} from "@/doc/ritualSourceDiagnostics";
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
  locateVisualIssue,
  normalizeTiptapNodeIds,
  semanticFromTiptap,
  visualRitualState,
} from "@/doc/tiptapRitual";
import { ritualTiptapClientExtensions } from "@/doc/tiptapRitualClient";
import { useRitualEditorLayout } from "@/doc/useRitualEditorLayout";
import { createUuidV7 } from "@/lib/ids";
import { getBrowserOfflineRuntime } from "@/offline/browserRuntime";
import styles from "./SemanticEditor.module.css";
import type { SemanticEditorProps } from "./SemanticEditorShell";

type SaveRequest = Extract<SqlRitualWriteRequest, { kind: "save" }>;
interface SourceState {
  text: string;
  dialect: RitualSourceDialect;
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
  const [source, setSource] = React.useState<SourceState>(() => ({
    text: printRitualSource(props.initialDocument),
    dialect: "pug",
    dirty: false,
    conflict: false,
  }));
  const [title, setTitle] = React.useState(props.title);
  const [mode, chooseMode, setMode] = useRitualEditorLayout();
  const [base, setBase] = React.useState({
    revisionId: props.revisionId,
    version: props.parentVersion,
  });
  const [pending, setPending] = React.useState<SaveRequest | null>(null);
  const [stale, setStale] = React.useState<SemanticDraft | null>(null);
  const [manualRecoveryDraft, setManualRecoveryDraft] =
    React.useState<SemanticDraft | null>(null);
  const [reloadRequired, setReloadRequired] = React.useState(false);
  const [recoveryBlocked, setRecoveryBlocked] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [access, setAccess] = React.useState<"checking" | "ready" | "locked">(
    "checking",
  );
  const [lockedMessage, setLockedMessage] = React.useState(
    "Editor access changed. Reload to verify this account again.",
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sourceError, setSourceError] =
    React.useState<RitualSourceDiagnostic | null>(null);
  const [sourceComposing, setSourceComposing] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [initialVisual] = React.useState(() =>
    visualRitualState(props.initialDocument),
  );
  const [visualIssue, setVisualIssue] = React.useState(initialVisual.issue);
  const narrow = useMediaQuery("(max-width: 800px)", { noSsr: true });
  // Narrow screens show split as Visual without overwriting the preference.
  const displayMode = visualIssue
    ? "source"
    : narrow && mode === "split"
      ? "visual"
      : mode;
  const [saved, setSaved] = React.useState(() => ({
    title: props.title,
    document: stringify(props.initialDocument),
  }));
  const documentJson = React.useMemo(() => stringify(document), [document]);
  // A legacy conversion is itself the change until its first semantic save.
  const unsaved =
    source.dirty ||
    title !== saved.title ||
    documentJson !== saved.document ||
    (props.importedFromLegacy && base.revisionId === props.revisionId);
  // Point at the first structure that keeps the ritual source-only.
  const issueLine = React.useMemo(() => {
    if (!visualIssue) return null;
    const issue = locateVisualIssue(document);
    if (!issue) return null;
    const index = issue.id
      ? source.text
          .split("\n")
          .findIndex((line) => line.includes(`#${issue.id}`))
      : -1;
    if (index >= 0) return index + 1;
    // Typed or pasted source may carry no IDs; trust the parse only while
    // the buffer is the source of the current document.
    if (source.dialect !== "pug" || source.dirty) return null;
    return ritualPugTopLevelLines(source.text)?.[issue.index] || null;
  }, [visualIssue, document, source.text, source.dialect, source.dirty]);
  const [reveal, setReveal] = React.useState<{
    line: number;
    key: number;
  } | null>(null);
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [conversionNotice, setConversionNotice] = React.useState(true);
  const [publicationMessage, setPublicationMessage] = React.useState<
    string | null
  >(null);
  const [publishing, setPublishing] = React.useState(false);
  const onPublicationMessage = React.useCallback(
    (message: string | null, kind: "success" | "progress" | "info") => {
      // Progress belongs in the header status; an alert would shift the panels.
      setPublishing(kind === "progress");
      if (kind === "success")
        setNotice((current) =>
          current === "Saved." ? "Saved and published for download." : message,
        );
      setPublicationMessage(kind === "info" ? message : null);
    },
    [],
  );
  const saveShortcut = React.useRef(() => {});
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "s"
      ) {
        // Never let the browser's Save Page dialog replace a ritual save.
        event.preventDefault();
        saveShortcut.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  React.useEffect(() => {
    // Removing the source panel can interrupt IME without compositionend.
    if (displayMode === "visual") setSourceComposing(false);
  }, [displayMode]);
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
    extensions: ritualTiptapClientExtensions,
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
            : {
                text: printRitualSource(next),
                dialect: "pug",
                dirty: false,
                conflict: false,
              },
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
    let authorizedEpoch: string | undefined;
    let permanentlyLocked = false;
    let verifying = false;
    let unsubscribe = () => {};
    let runtime: ReturnType<typeof getBrowserOfflineRuntime> | null = null;
    const requests = new Set<AbortController>();
    const lock = (
      message = "Editor access changed. Reload to verify this account again.",
    ) => {
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
      setSource({ text: "", dialect: "pug", dirty: false, conflict: false });
      setTitle("");
      setPending(null);
      setReady(false);
      setLockedMessage(message);
      setAccess("locked");
      for (const controller of requests) controller.abort();
    };
    const checkState = () => {
      if (!active || !runtime || permanentlyLocked) return;
      const state = runtime.coordinator.state;
      if (
        seenReady &&
        !retainsOnlineEditorIdentity(state, {
          ownerId: props.actorId,
          epoch: authorizedEpoch,
        })
      ) {
        lock();
      }
    };
    const verifyPermission = async (controller: AbortController) => {
      const delivery = await fetchSqlRitualSource(
        {
          version: 1,
          requestId: createUuidV7(),
          expectedActorId: props.actorId,
          ritualId: props.ritualId,
        },
        controller.signal,
      );
      return delivery?.permission;
    };
    const recheck = async () => {
      if (!active || !runtime || permanentlyLocked || verifying) return;
      verifying = true;
      const controller = new AbortController();
      requests.add(controller);
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      // A deadline must also release the check if another session refresh stalls.
      const deadline = new Promise<void>((resolve) =>
        controller.signal.addEventListener("abort", () => resolve(), {
          once: true,
        }),
      );
      try {
        await Promise.race([runtime.refreshVerifiedAccount(), deadline]);
        if (!active || permanentlyLocked || controller.signal.aborted) return;
        const state = runtime.coordinator.state;
        if (
          seenReady &&
          !retainsOnlineEditorIdentity(state, {
            ownerId: props.actorId,
            epoch: authorizedEpoch,
          })
        ) {
          lock();
          return;
        }
        const permission = await Promise.race([
          verifyPermission(controller),
          deadline,
        ]);
        if (!active || permanentlyLocked || controller.signal.aborted) return;
        if (
          permission &&
          (permission.kind === "denied" ||
            permission.kind === "authentication-required" ||
            (permission.kind === "granted" && !permission.grant.sourceEdit))
        ) {
          lock();
          return;
        }
        if (
          permission?.kind !== "granted" ||
          permission.ownerId !== props.actorId
        )
          return;
        const current = runtime.coordinator.state;
        if (
          !retainsOnlineEditorIdentity(current, {
            ownerId: props.actorId,
            epoch: authorizedEpoch,
          }) ||
          (!seenReady && current.phase !== "ready")
        )
          return;
        seenReady = true;
        authorizedEpoch = current.account!.epoch;
        setAccess("ready");
      } catch {
        // A transport failure says nothing about the previously granted access.
      } finally {
        window.clearTimeout(timeout);
        controller.abort();
        requests.delete(controller);
        verifying = false;
        if (active && !seenReady && !permanentlyLocked)
          lock(
            "Editor access could not be verified. Reconnect and reload to try again.",
          );
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
      })().catch(() =>
        lock(
          "Editor access could not be verified. Reconnect and reload to try again.",
        ),
      );
    } catch {
      lock();
    }
    const refresh = () => {
      if (globalThis.document.visibilityState !== "hidden") void recheck();
    };
    window.addEventListener("focus", refresh);
    globalThis.document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("focus", refresh);
      globalThis.document.removeEventListener("visibilitychange", refresh);
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
          const draftDialect =
            draft.sourceDialect ??
            detectRitualSourceDialect(draft.sourceBuffer) ??
            "ritual-text";
          if (!draftDialect || !["pug", "ritual-text"].includes(draftDialect))
            throw new Error("Unsupported draft source dialect");
          const parsed: unknown = JSON.parse(draft.documentJson);
          const errors = validateRitualSemantic(parsed);
          if (errors.length) throw new Error(errors[0]);
          if (
            !draft.pending &&
            !draft.sourceDirty &&
            !draft.sourceConflict &&
            draft.title === props.title &&
            draft.documentJson === stringify(props.initialDocument) &&
            draft.sourceBuffer ===
              printRitualSource(props.initialDocument, draftDialect)
          ) {
            await clearSemanticDraft(props.actorId, props.ritualId);
            return;
          }
          let restored = parsed as RitualSemanticDocument;
          // Older clean Pug buffers retain trivia that their saved JSON dropped.
          // The pending request itself remains immutable; recovered annotations
          // can become an unsaved follow-up after its receipt is confirmed.
          if (
            draftDialect === "pug" &&
            !draft.sourceDirty &&
            !draft.sourceConflict
          )
            restored = restorePugDraftAnnotations(restored, draft.sourceBuffer);
          let restoredSource: SourceState = {
            text: draft.sourceBuffer,
            dialect: draftDialect,
            dirty: draft.sourceDirty,
            conflict: draft.sourceConflict,
          };
          if (draftDialect === "ritual-text") {
            setMode("source");
            // Pending requests and conflicted/incomplete buffers retain their
            // bytes. Only clean, reconciled source can migrate immediately.
            if (!draft.sourceDirty && !draft.sourceConflict) {
              try {
                restored = restoreDraftSourceAnnotations(
                  restored,
                  draft.sourceBuffer,
                  "ritual-text",
                );
                if (!draft.pending)
                  restoredSource = {
                    text: printRitualSource(restored),
                    dialect: "pug",
                    dirty: false,
                    conflict: false,
                  };
              } catch {
                restoredSource.dirty = true;
                restoredSource.conflict = true;
              }
            }
          }
          const visual = visualRitualState(restored);
          setVisualIssue(visual.issue);
          editor.commands.setContent(visual.content, {
            emitUpdate: false,
          });
          setDocument(restored);
          setTitle(draft.title);
          setSource(restoredSource);
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
    setMode,
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
        !stale &&
        !source.dirty &&
        !sourceComposing,
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
    source.dirty,
    sourceComposing,
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
      sourceDialect: source.dialect,
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
        sourceDialect: source.dialect,
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
    sourceDialect: source.dialect,
    sourceDirty: source.dirty,
    sourceConflict: source.conflict,
    pending,
    updatedAt: Date.now(),
  });

  const applySource = React.useCallback(() => {
    if (
      !editor ||
      pending ||
      saving ||
      stale ||
      sourceComposing ||
      access !== "ready"
    )
      return;
    try {
      const next =
        source.dialect === "ritual-text" && !source.dirty
          ? restoreDraftSourceAnnotations(document, source.text, "ritual-text")
          : parseRitualSource(source.text, source.dialect);
      const visual = visualRitualState(next);
      editor.commands.setContent(visual.content, { emitUpdate: false });
      setVisualIssue(visual.issue);
      setDocument(next);
      setSource((current) =>
        current.dialect === "ritual-text"
          ? {
              text: printRitualSource(next),
              dialect: "pug",
              dirty: false,
              conflict: false,
            }
          : { ...current, dirty: false, conflict: false },
      );
      if (source.dialect === "ritual-text")
        setNotice("Recovered Ritual Text source converted to Pug.");
      setSourceError(null);
      setError(null);
      skipPersist.current = false;
    } catch (cause) {
      setSourceError(ritualSourceDiagnostic(cause, source.text));
    }
  }, [
    editor,
    pending,
    saving,
    stale,
    access,
    source.text,
    source.dialect,
    source.dirty,
    sourceComposing,
    document,
  ]);

  React.useEffect(() => {
    if (
      !ready ||
      (!source.dirty && source.dialect !== "ritual-text") ||
      source.conflict
    )
      return;
    // Keep the typed buffer intact. Incomplete syntax leaves the last valid
    // document visible; visual editing waits until this source catches up.
    const timer = window.setTimeout(applySource, 200);
    return () => window.clearTimeout(timer);
  }, [ready, source.dirty, source.dialect, source.conflict, applySource]);

  const confirmStalePending = async () => {
    const request = stale?.pending;
    if (!stale || !request || saving || access !== "ready") return;
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
      let followUp: SemanticDraft | undefined;
      const dialect =
        stale.sourceDialect ??
        detectRitualSourceDialect(stale.sourceBuffer) ??
        "ritual-text";
      if (stale.sourceDirty || stale.sourceConflict) {
        if (
          result.revisionId !== props.revisionId ||
          result.version !== props.parentVersion
        ) {
          setError(
            "The pending save is confirmed, but a newer server revision exists. Download this draft to recover its source changes before discarding it.",
          );
          return;
        }
        followUp = {
          ...stale,
          baseRevisionId: result.revisionId,
          baseVersion: result.version,
          pending: null,
          updatedAt: Date.now(),
        };
      } else {
        const restored = restoreDraftSourceAnnotations(
          JSON.parse(stale.documentJson),
          stale.sourceBuffer,
          dialect,
        );
        if (
          JSON.stringify(JSON.parse(request.source)) !==
          JSON.stringify(restored)
        ) {
          if (
            result.revisionId !== props.revisionId ||
            result.version !== props.parentVersion
          ) {
            setError(
              "The pending save is confirmed, but a newer server revision exists. Download this draft to recover its author annotations before discarding it.",
            );
            return;
          }
          const current = restoreDraftSourceAnnotations(
            props.initialDocument,
            stale.sourceBuffer,
            dialect,
          );
          followUp = {
            ...stale,
            baseRevisionId: result.revisionId,
            baseVersion: result.version,
            documentJson: stringify(current),
            pending: null,
            updatedAt: Date.now(),
          };
        }
      }
      setManualRecoveryDraft(followUp ?? null);
      const retained = await confirmSemanticSave(
        {
          version: 1,
          operationId: request.operationId,
          expectedActorId: props.actorId,
          ritualId: props.ritualId,
          expectedRevisionId: result.revisionId,
          expectedVersion: result.version,
        },
        followUp,
      );
      if (retained !== false) setManualRecoveryDraft(null);
      else setManualRecoveryDraft(followUp ?? stale);
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
      (!pending &&
        (!unsaved ||
          source.dirty ||
          sourceComposing ||
          source.conflict ||
          error))
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
      const followUp: SemanticDraft | undefined =
        source.dirty ||
        source.conflict ||
        JSON.stringify(JSON.parse(request.source)) !== JSON.stringify(document)
          ? {
              ...currentDraft(),
              baseRevisionId: result.revisionId,
              baseVersion: result.version,
              pending: null,
              updatedAt: Date.now(),
            }
          : undefined;
      skipPersist.current = true;
      draftWriteVersion.current++;
      // Rejected recovery must never become the access-lock persistence snapshot.
      liveDraft.current = null;
      setManualRecoveryDraft(followUp ?? null);
      setBase({ revisionId: result.revisionId, version: result.version });
      setSaved((current) => ({
        title: request.title ?? current.title,
        document: request.source,
      }));
      setPending(null);
      try {
        const retained = await queueDraftWrite(() =>
          confirmSemanticSave(
            {
              version: 1,
              operationId: request.operationId,
              expectedActorId: props.actorId,
              ritualId: props.ritualId,
              expectedRevisionId: result.revisionId,
              expectedVersion: result.version,
            },
            followUp,
          ),
        );
        if (retained === false) {
          setReloadRequired(true);
          return;
        }
        setManualRecoveryDraft(null);
        setError(null);
      } catch {
        setError(
          "The revision was saved, but its local draft could not be cleared. Reload to recover or discard that draft.",
        );
      }
      setNotice(
        followUp
          ? source.dirty || source.conflict
            ? "Save confirmed. Unapplied source changes remain in your local draft; resolve them before saving again."
            : "Save confirmed. Recovered author annotations remain in your local draft; save again to include them."
          : result.replayed
            ? "Save confirmed after retry."
            : "Saved.",
      );
    } catch {
      setError("The save result is unknown. Retry the same pending request.");
    } finally {
      setSaving(false);
    }
  };

  const sourceProblem = source.conflict || (!!sourceError && source.dirty);
  const sourceSyncing = source.dirty || sourceComposing;
  const canSave =
    access === "ready" &&
    !saving &&
    !stale &&
    (!!pending || (unsaved && !error && !sourceProblem && !sourceSyncing));
  saveShortcut.current = () => {
    if (canSave) void save();
  };

  if (access === "locked")
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        {lockedMessage}
      </Alert>
    );
  if (reloadRequired)
    return (
      <Alert severity="success" sx={{ m: 2 }}>
        {manualRecoveryDraft
          ? "The pending save is confirmed, but local recovery changed. Download this draft before reloading."
          : "The pending save is confirmed. Reload this page to open the current revision."}
        {manualRecoveryDraft && (
          <Button
            disabled={access !== "ready"}
            onClick={() => downloadDraft(manualRecoveryDraft)}
          >
            Download recovered draft
          </Button>
        )}
      </Alert>
    );
  if (recoveryBlocked)
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        The local draft could not be loaded. Reload this page before editing.
      </Alert>
    );
  if (!editor || !ready)
    return (
      <Typography color="text.secondary" sx={{ p: 2 }}>
        Verifying account and loading local draft…
      </Typography>
    );
  const saveStatus = saving
    ? "Saving…"
    : publishing
      ? "Publishing…"
      : pending
        ? "Save not confirmed"
        : unsaved
          ? "Unsaved changes"
          : "Saved";
  return (
    <Box
      className={styles.surface}
      aria-busy={access === "checking"}
      sx={{ visibility: access === "checking" ? "hidden" : undefined }}
      aria-hidden={access === "checking"}
    >
      <h1 className={styles.visuallyHidden}>Ritual editor</h1>
      <header className={styles.header}>
        <TextField
          className={styles.title}
          variant="standard"
          placeholder="Untitled ritual"
          value={title}
          disabled={access !== "ready" || !!pending || !!stale}
          onChange={(event) => {
            skipPersist.current = false;
            setTitle(event.target.value);
          }}
          slotProps={{
            htmlInput: { "aria-label": "Title" },
            input: { sx: { fontSize: "1.25rem" } },
          }}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          role="status"
          className={styles.status}
          title={
            unsaved && !pending
              ? "Unsaved changes are kept as a draft on this device."
              : undefined
          }
        >
          {saveStatus}
        </Typography>
        <ButtonGroup size="small" aria-label="Editor layout">
          {(narrow
            ? (["visual", "source"] as const)
            : (["visual", "source", "split"] as const)
          ).map((item) => (
            <Button
              key={item}
              variant={displayMode === item ? "contained" : "outlined"}
              disabled={
                access !== "ready" || (!!visualIssue && item !== "source")
              }
              onClick={() => chooseMode(item)}
            >
              {item}
            </Button>
          ))}
        </ButtonGroup>
        <SemanticPublication
          actorId={props.actorId}
          ritualId={props.ritualId}
          revisionId={base.revisionId}
          version={base.version}
          enabled={access === "ready" && !saving && !pending && !stale}
          onMessage={onPublicationMessage}
        />
        <EditorActionButton
          variant="contained"
          disabled={
            access !== "ready" ||
            saving ||
            !!stale ||
            (!pending && (!!error || sourceProblem || !unsaved))
          }
          inactive={!pending && sourceSyncing}
          inactiveReason={
            sourceProblem
              ? "Fix the ritual source error first."
              : "The visual panel is catching up with ritual source."
          }
          title="Save (Ctrl+S)"
          onClick={save}
        >
          {pending ? "Retry save" : "Save"}
        </EditorActionButton>
        <IconButton
          aria-label="More editor actions"
          aria-haspopup="menu"
          aria-expanded={!!menuAnchor || undefined}
          onClick={(event) => setMenuAnchor(event.currentTarget)}
        >
          <MoreVert />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={!!menuAnchor}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem
            disabled={access !== "ready"}
            onClick={() => {
              setMenuAnchor(null);
              downloadDraft(currentDraft());
            }}
          >
            Download draft
          </MenuItem>
          <MenuItem
            component="a"
            href={`/doc/${props.ritualId}`}
            onClick={() => setMenuAnchor(null)}
          >
            View ritual
          </MenuItem>
        </Menu>
      </header>
      <div className={styles.notices}>
        {props.importedFromLegacy && conversionNotice && (
          <Alert severity="info" onClose={() => setConversionNotice(false)}>
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
          <Alert
            severity="warning"
            action={
              issueLine ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() =>
                    setReveal((current) => ({
                      line: issueLine,
                      key: (current?.key ?? 0) + 1,
                    }))
                  }
                >
                  Show line {issueLine}
                </Button>
              ) : undefined
            }
          >
            {visualIssue}
            {issueLine &&
              ` The first structure that needs source editing is on line ${issueLine}.`}
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
            <Button
              disabled={access !== "ready"}
              onClick={() => {
                if (access === "ready") downloadDraft(stale);
              }}
            >
              Download draft
            </Button>{" "}
            {stale.pending && (
              <Button
                disabled={access !== "ready" || saving}
                onClick={confirmStalePending}
              >
                Confirm pending save
              </Button>
            )}{" "}
            <Button
              disabled={access !== "ready" || saving}
              onClick={() => {
                if (access !== "ready") return;
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
            <Button
              disabled={access !== "ready"}
              onClick={() => {
                if (access === "ready") downloadDraft(stale ?? currentDraft());
              }}
            >
              Download draft
            </Button>
          </Alert>
        )}
        {publicationMessage && (
          <Alert severity="info">{publicationMessage}</Alert>
        )}
        {pending && (
          <Alert severity="warning">
            A save is pending. Retry it unchanged before making another edit.
          </Alert>
        )}
      </div>
      <Box className={styles.panels}>
        {displayMode !== "visual" && (
          <section
            className={styles.sourcePanel}
            aria-label="Semantic source panel"
          >
            {source.dialect === "ritual-text" && (
              <Alert severity="info">
                This older Ritual Text draft is being recovered. Correct or
                resolve its source changes to convert it to Pug. Pending saves
                must be confirmed first. Download the draft to keep its original
                recovery buffer before changing it. Ritual Text uses command
                lines and quoted text fragments.
              </Alert>
            )}
            <RitualSourceEditor
              fill
              reveal={reveal}
              header={
                <>
                  <Typography
                    variant="subtitle1"
                    component="h2"
                    className={styles.panelTitle}
                  >
                    Ritual source
                  </Typography>
                  {source.dialect === "pug" && (
                    <Tooltip title="Pug uses indentation for blocks and #[…] for inline formatting. Valid edits update the visual panel as you type.">
                      <IconButton
                        size="small"
                        component={Link}
                        href="/help/ritual-pug"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Ritual Pug guide (opens in a new tab)"
                      >
                        <HelpOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              }
              diagnostic={sourceError}
              value={source.text}
              dialect={source.dialect}
              disabled={access !== "ready" || !!pending || !!stale}
              onCompositionChange={setSourceComposing}
              onChange={(text) => {
                skipPersist.current = false;
                setSource({
                  text,
                  dialect: source.dialect,
                  dirty: true,
                  conflict: source.conflict,
                });
              }}
            />
            {sourceError?.source === source.text && (
              <Alert severity="warning">
                {sourceError.message}. The visual panel shows the last valid
                source.
              </Alert>
            )}
            {source.conflict && (
              <Alert severity="warning">
                Both panels changed. Apply source to replace visual changes, or
                discard source changes.
              </Alert>
            )}
            <Box className={styles.sourceActions}>
              {source.conflict && (
                <Button
                  onClick={applySource}
                  disabled={
                    access !== "ready" || !source.dirty || !!pending || !!stale
                  }
                >
                  Apply source
                </Button>
              )}
              <EditorActionButton
                size="small"
                inactive={!source.dirty || sourceComposing}
                inactiveReason={
                  sourceComposing
                    ? "Finish composing ritual source first."
                    : "There are no unapplied source changes."
                }
                onClick={() => {
                  setSourceError(null);
                  setSource({
                    text: printRitualSource(document),
                    dialect: "pug",
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
                disabled={access !== "ready" || !!pending || !!stale}
              >
                Discard source changes
              </EditorActionButton>
            </Box>
          </section>
        )}
        {displayMode !== "source" && (
          <section
            className={styles.visualPanel}
            aria-label="Visual editor panel"
            aria-busy={(sourceSyncing && !sourceProblem) || undefined}
          >
            <RitualVisualControls
              editor={editor}
              concealed={access === "checking"}
              disabled={
                access !== "ready" ||
                saving ||
                !!pending ||
                !!stale ||
                sourceProblem
              }
              syncingSource={sourceSyncing}
              actorId={props.actorId}
              ritualId={props.ritualId}
              title={title}
            />
            <EditorContent editor={editor} className={styles.editor} />
          </section>
        )}
      </Box>
      <Snackbar
        open={!!notice}
        message={notice}
        autoHideDuration={6000}
        onClose={(_event, reason) => {
          if (reason !== "clickaway") setNotice(null);
        }}
      />
    </Box>
  );
}
