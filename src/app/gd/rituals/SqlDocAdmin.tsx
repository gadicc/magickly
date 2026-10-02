"use client";

import {
  Alert,
  Box,
  Button,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import React from "react";
import { parseRitualText, printRitualText } from "@/doc/ritualText";
import { pugRitualStarter, ritualTextStarter } from "@/doc/ritualTextExamples";
import type { RitualSemanticDocument } from "@/doc/semantic";
import {
  fetchSqlRitualCreationOptions,
  sendSqlRitualWrite,
} from "@/doc/sqlEditorClient";
import {
  creationScope,
  parseSqlRitualCreateRequest,
  type SqlRitualCreationOptionsV1,
} from "@/doc/sqlEditorContract";
import {
  SQL_RITUAL_WRITE_MESSAGES,
  type SqlRitualWriteResult,
} from "@/doc/sqlWriteContract";
import { createUuidV7 } from "@/lib/ids";
import { getBrowserOfflineRuntime } from "@/offline/browserRuntime";
import {
  createCreationPublicationHandoff,
  retainCreationPublicationHandoff,
} from "@/offline/ritualPublicationHandoff";

const RitualCreationEditor = dynamic(
  () => import("@/doc/RitualCreationEditor"),
  {
    ssr: false,
    loading: () => <p>Loading ritual editor…</p>,
  },
);

interface FormState {
  title: string;
  scopeKey: string;
  minGrade: number;
  source: string;
  semanticSource: string;
  format: "pug" | "semantic";
  editorMode: "visual" | "source";
}

interface CreationIdentity {
  ownerId: string;
  epoch: string;
  generation: number;
}

interface PreservedForm {
  ownerId: string;
  form: FormState;
}

const emptyForm = (): FormState => ({
  title: "",
  scopeKey: "",
  minGrade: 0,
  source: pugRitualStarter,
  semanticSource: ritualTextStarter,
  format: "semantic",
  editorMode: "visual",
});
const storageKey = (ownerId: string) => `magickli:ritual-create:v2:${ownerId}`;
const unavailable = (): SqlRitualWriteResult => ({
  ok: false,
  code: "UNAVAILABLE",
  message: SQL_RITUAL_WRITE_MESSAGES.UNAVAILABLE,
  retryable: true,
});
const scopeStillAuthorized = (
  options: SqlRitualCreationOptionsV1,
  scopeKey: string,
) => {
  if (!scopeKey) return true;
  if (scopeKey === "public") return options.public;
  const [kind, id] = scopeKey.split(":");
  const rows = kind === "group" ? options.groups : options.temples;
  return (
    (kind === "group" || kind === "temple") && rows.some((row) => row.id === id)
  );
};

export default function SqlDocAdmin() {
  const router = useRouter();
  const [options, setOptions] =
    React.useState<SqlRitualCreationOptionsV1 | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [pending, setPending] = React.useState<ReturnType<
    typeof parseSqlRitualCreateRequest
  > | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [terminal, setTerminal] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [composerValid, setComposerValid] = React.useState(true);
  const [blockedRecovery, setBlockedRecovery] = React.useState<string | null>(
    null,
  );
  const busyRef = React.useRef(false);
  const runtimeRef = React.useRef<ReturnType<
    typeof getBrowserOfflineRuntime
  > | null>(null);
  const identityRef = React.useRef<CreationIdentity | null>(null);
  const optionsRequestRef = React.useRef<AbortController | null>(null);
  const writeRequestRef = React.useRef<AbortController | null>(null);
  const formRef = React.useRef<FormState>(emptyForm());
  const pendingRef = React.useRef<ReturnType<
    typeof parseSqlRitualCreateRequest
  > | null>(null);
  const preservedFormRef = React.useRef<PreservedForm | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const presentationRef = React.useRef<{
    ownerId: string;
    epoch: string;
    height: number;
    editorMode: FormState["editorMode"];
  } | null>(null);
  const [reservedHeight, setReservedHeight] = React.useState(0);
  const [revalidating, setRevalidating] = React.useState(false);

  const replaceForm = React.useCallback((next: FormState) => {
    formRef.current = next;
    setForm(next);
  }, []);
  const updateForm = React.useCallback(
    (change: (current: FormState) => FormState) => {
      presentationRef.current = null;
      setReservedHeight(0);
      replaceForm(change(formRef.current));
    },
    [replaceForm],
  );
  const replacePending = React.useCallback(
    (next: ReturnType<typeof parseSqlRitualCreateRequest> | null) => {
      pendingRef.current = next;
      setPending(next);
    },
    [],
  );

  const currentIdentity = React.useCallback((expected: CreationIdentity) => {
    const runtime = runtimeRef.current;
    const state = runtime?.coordinator.state;
    return (
      identityRef.current === expected &&
      state?.phase === "ready" &&
      state.generation === expected.generation &&
      state.account?.ownerId === expected.ownerId &&
      state.account.epoch === expected.epoch
    );
  }, []);

  React.useEffect(() => {
    let disposed = false;
    let lastStateKey = "";
    let loadGeneration = 0;
    let unsubscribe = () => {};
    let displayIdentity: CreationIdentity | null = null;
    let retainingPresentation = false;
    let retentionTimeout: number | null = null;

    const lock = (message: string | null = null) => {
      retainingPresentation = false;
      displayIdentity = null;
      setRevalidating(false);
      if (retentionTimeout !== null) window.clearTimeout(retentionTimeout);
      retentionTimeout = null;
      const identity = identityRef.current;
      // Remove private form content while checking access, but keep its space
      // so the browser cannot clamp the ritual-list scroll to a shorter page.
      if (identity && rootRef.current) {
        const height = rootRef.current.getBoundingClientRect().height;
        presentationRef.current = {
          ...identity,
          height,
          editorMode: formRef.current.editorMode,
        };
        setReservedHeight(height);
      }
      if (message) {
        presentationRef.current = null;
        setReservedHeight(0);
      }
      if (identity && !pendingRef.current)
        preservedFormRef.current = {
          ownerId: identity.ownerId,
          form: { ...formRef.current },
        };
      loadGeneration++;
      lastStateKey = "";
      optionsRequestRef.current?.abort();
      optionsRequestRef.current = null;
      writeRequestRef.current?.abort();
      writeRequestRef.current = null;
      identityRef.current = null;
      busyRef.current = false;
      setOptions(null);
      replaceForm(emptyForm());
      replacePending(null);
      setBlockedRecovery(null);
      setTerminal(false);
      setBusy(false);
      setLoaded(message !== null);
      setError(message);
    };

    try {
      const runtime = getBrowserOfflineRuntime();
      runtimeRef.current = runtime;
      unsubscribe = runtime.subscribeState((state) => {
        if (disposed) return;
        if (state.phase !== "ready" || !state.account) {
          if (
            state.revalidating &&
            displayIdentity &&
            state.account &&
            displayIdentity.ownerId === state.account.ownerId &&
            displayIdentity.epoch === state.account.epoch
          ) {
            retainingPresentation = true;
            setRevalidating(true);
            if (
              retentionTimeout === null &&
              document.visibilityState !== "hidden"
            )
              retentionTimeout = window.setTimeout(() => {
                if (!disposed)
                  lock(
                    "Ritual creation is unavailable. Reconnect and try again.",
                  );
              }, 10_000);
            if (!pendingRef.current)
              preservedFormRef.current = {
                ownerId: displayIdentity.ownerId,
                form: { ...formRef.current },
              };
            loadGeneration++;
            lastStateKey = "";
            optionsRequestRef.current?.abort();
            writeRequestRef.current?.abort();
            identityRef.current = null;
            busyRef.current = false;
            setBusy(false);
            return;
          }
          lock();
          const presentation = presentationRef.current;
          if (
            presentation &&
            (!state.account ||
              presentation.ownerId !== state.account.ownerId ||
              presentation.epoch !== state.account.epoch)
          ) {
            presentationRef.current = null;
            setReservedHeight(0);
          }
          return;
        }
        const stateKey = `${state.generation}:${state.account.ownerId}:${state.account.epoch}`;
        if (stateKey === lastStateKey) return;
        const continuing =
          retainingPresentation &&
          displayIdentity?.ownerId === state.account.ownerId &&
          displayIdentity.epoch === state.account.epoch;
        if (!continuing) lock();
        lastStateKey = stateKey;
        const load = ++loadGeneration;
        const expected: CreationIdentity = {
          ownerId: state.account.ownerId,
          epoch: state.account.epoch,
          generation: state.generation,
        };
        const presentation = presentationRef.current;
        if (
          presentation &&
          (presentation.ownerId !== expected.ownerId ||
            presentation.epoch !== expected.epoch)
        ) {
          presentationRef.current = null;
          setReservedHeight(0);
        }
        const controller = new AbortController();
        optionsRequestRef.current = controller;
        void (async () => {
          const timeout = window.setTimeout(() => {
            if (!disposed && load === loadGeneration)
              lock("Ritual creation is unavailable. Reconnect and try again.");
          }, 5_000);
          try {
            const next = await fetchSqlRitualCreationOptions(controller.signal);
            if (
              disposed ||
              controller.signal.aborted ||
              load !== loadGeneration
            )
              return;
            const current = runtime.coordinator.state;
            if (
              current.phase !== "ready" ||
              current.generation !== expected.generation ||
              current.account?.ownerId !== expected.ownerId ||
              current.account.epoch !== expected.epoch
            ) {
              lock(
                "Ritual creation access changed. Reconnect with the authorized account.",
              );
              return;
            }
            setLoaded(true);
            if (!next) {
              lock("Ritual creation is unavailable. Reconnect and try again.");
              return;
            }
            if (next.ownerId !== expected.ownerId) {
              lock(
                "Ritual creation access changed. Reconnect with the authorized account.",
              );
              return;
            }
            identityRef.current = expected;
            displayIdentity = expected;
            retainingPresentation = false;
            setRevalidating(false);
            if (retentionTimeout !== null)
              window.clearTimeout(retentionTimeout);
            retentionTimeout = null;
            if (!next.public && !next.groups.length && !next.temples.length) {
              presentationRef.current = null;
              setReservedHeight(0);
            }
            setOptions(next);
            if (continuing) {
              preservedFormRef.current = null;
              if (!scopeStillAuthorized(next, formRef.current.scopeKey)) {
                if (pendingRef.current) {
                  setBlockedRecovery(JSON.stringify(pendingRef.current));
                } else {
                  replaceForm(emptyForm());
                }
                setError(
                  pendingRef.current
                    ? "The pending request's visibility is no longer authorized. Download the retained request; retry when access is restored."
                    : "The selected visibility is no longer authorized. Choose an available visibility.",
                );
              } else if (pendingRef.current) {
                setBlockedRecovery(null);
              }
              return;
            }
            let serialized: string | null = null;
            try {
              serialized = localStorage.getItem(storageKey(next.ownerId));
              if (!serialized) {
                const preserved = preservedFormRef.current;
                if (preserved?.ownerId === next.ownerId) {
                  preservedFormRef.current = null;
                  if (!scopeStillAuthorized(next, preserved.form.scopeKey)) {
                    presentationRef.current = null;
                    setReservedHeight(0);
                  }
                  replaceForm(
                    scopeStillAuthorized(next, preserved.form.scopeKey)
                      ? { ...preserved.form }
                      : emptyForm(),
                  );
                }
                return;
              }
              const retained = parseSqlRitualCreateRequest(
                JSON.parse(serialized),
                next.ownerId,
              );
              if (!retained || JSON.stringify(retained) !== serialized)
                throw new Error("invalid retained request");
              const key =
                retained.scope.kind === "public"
                  ? "public"
                  : retained.scope.kind === "group"
                    ? `group:${retained.scope.groupId}`
                    : `temple:${retained.scope.templeId}`;
              let semanticSource = "ritual 1\n";
              if (retained.version === 3) {
                const document = JSON.parse(
                  retained.source,
                ) as RitualSemanticDocument;
                semanticSource = printRitualText(document);
              }
              replaceForm({
                title: retained.title,
                scopeKey: key,
                minGrade:
                  retained.scope.kind === "temple"
                    ? retained.scope.minGrade
                    : 0,
                source: retained.version === 2 ? retained.source : "",
                semanticSource,
                format: retained.version === 3 ? "semantic" : "pug",
                editorMode:
                  presentationRef.current?.ownerId === next.ownerId &&
                  presentationRef.current.epoch === expected.epoch
                    ? presentationRef.current.editorMode
                    : "visual",
              });
              replacePending(retained);
            } catch {
              setBlockedRecovery(serialized ?? "unreadable");
              setError(
                "The retained creation request is unavailable. Preserve browser recovery before clearing it.",
              );
            }
          } finally {
            window.clearTimeout(timeout);
          }
        })();
      });
      void runtime.start().catch(() => {
        if (!disposed)
          lock("Ritual creation is unavailable. Reconnect and try again.");
      });
    } catch {
      lock("Ritual creation is unavailable. Reconnect and try again.");
    }
    return () => {
      disposed = true;
      if (retentionTimeout !== null) window.clearTimeout(retentionTimeout);
      unsubscribe();
      optionsRequestRef.current?.abort();
      writeRequestRef.current?.abort();
      identityRef.current = null;
      runtimeRef.current = null;
    };
  }, [replaceForm, replacePending]);

  React.useLayoutEffect(() => {
    const content = contentRef.current;
    const presentation = presentationRef.current;
    if (!reservedHeight || !options || !content || !presentation) return;
    const finish = () => {
      const identity = identityRef.current;
      if (
        identity &&
        presentationRef.current === presentation &&
        currentIdentity(identity) &&
        identity.ownerId === presentation.ownerId &&
        identity.epoch === presentation.epoch &&
        content.getBoundingClientRect().height >= presentation.height - 1
      ) {
        presentationRef.current = null;
        setReservedHeight(0);
      }
    };
    finish();
    // The lazy composer and autosizing textareas finish layout after the form.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(finish);
    observer.observe(content);
    return () => observer.disconnect();
  }, [options, reservedHeight, currentIdentity]);

  const permitted = React.useCallback(
    (scopeKey: string) =>
      !!scopeKey && !!options && scopeStillAuthorized(options, scopeKey),
    [options],
  );

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    const identity = identityRef.current;
    if (
      !options ||
      !identity ||
      options.ownerId !== identity.ownerId ||
      !currentIdentity(identity) ||
      busyRef.current
    )
      return;
    setError(null);
    setTerminal(false);
    if (!permitted(form.scopeKey)) {
      setError("Choose a visibility you currently administer.");
      return;
    }
    const scope = creationScope(form.scopeKey, form.minGrade);
    if (!scope) {
      setError("Choose a valid visibility and minimum grade.");
      return;
    }
    let source = form.source;
    if (!pending && form.format === "semantic") {
      try {
        source = JSON.stringify(parseRitualText(form.semanticSource));
        if (!composerValid) {
          setError("Correct the visual document before creating this ritual.");
          return;
        }
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Invalid ritual text.",
        );
        return;
      }
    }
    const request =
      pending ??
      parseSqlRitualCreateRequest({
        version: form.format === "semantic" ? 3 : 2,
        operationId: createUuidV7(),
        expectedActorId: options.ownerId,
        kind: "create",
        scope,
        title: form.title,
        source,
      });
    if (!request) {
      setError("Enter a valid title and ritual source.");
      return;
    }
    const serialized = JSON.stringify(request);
    try {
      localStorage.setItem(storageKey(options.ownerId), serialized);
    } catch {
      setError(
        "The exact creation request could not be retained. Free browser storage and retry.",
      );
      return;
    }
    replacePending(request);
    busyRef.current = true;
    setBusy(true);
    const controller = new AbortController();
    writeRequestRef.current = controller;
    try {
      const result =
        (await sendSqlRitualWrite(request, controller.signal)) ?? unavailable();
      if (controller.signal.aborted || !currentIdentity(identity)) return;
      if (!result.ok) {
        setError(result.message);
        setTerminal(!result.retryable);
        return;
      }
      const handoff = createCreationPublicationHandoff(request, result);
      if (!handoff) {
        setError(
          "The acknowledged ritual could not be prepared for publication safely. Retry the retained creation request.",
        );
        return;
      }
      try {
        retainCreationPublicationHandoff(localStorage, handoff);
        if (!currentIdentity(identity)) return;
        if (localStorage.getItem(storageKey(options.ownerId)) === serialized)
          localStorage.removeItem(storageKey(options.ownerId));
      } catch {
        setError(
          "The acknowledged ritual publication could not be retained. Free browser storage and retry the exact creation request.",
        );
        return;
      }
      router.push(
        `/doc/${result.ritualId}/edit${request.version === 3 ? "/semantic" : ""}`,
      );
    } catch {
      if (currentIdentity(identity))
        setError(SQL_RITUAL_WRITE_MESSAGES.UNAVAILABLE);
    } finally {
      controller.abort();
      if (writeRequestRef.current === controller) {
        writeRequestRef.current = null;
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const startNew = () => {
    const identity = identityRef.current;
    if (
      !options ||
      !identity ||
      !currentIdentity(identity) ||
      !pending ||
      !terminal
    )
      return;
    const serialized = JSON.stringify(pending);
    try {
      if (localStorage.getItem(storageKey(options.ownerId)) === serialized)
        localStorage.removeItem(storageKey(options.ownerId));
    } catch {
      setError("The retained request could not be cleared safely.");
      return;
    }
    replacePending(null);
    setBlockedRecovery(null);
    setTerminal(false);
    setError(null);
  };

  const downloadBlockedRecovery = () => {
    const retained =
      blockedRecovery ?? (pending ? JSON.stringify(pending) : null);
    const identity = identityRef.current;
    if (
      !retained ||
      !options ||
      !identity ||
      options.ownerId !== identity.ownerId ||
      !currentIdentity(identity)
    )
      return;
    const url = URL.createObjectURL(
      new Blob([retained], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "magickli-retained-ritual-create.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!loaded)
    return (
      <Box
        ref={rootRef}
        aria-label="Ritual creation area"
        sx={{ my: 2, minHeight: reservedHeight }}
      >
        <Typography sx={{ my: 2 }} color="text.secondary">
          Loading ritual creation access...
        </Typography>
      </Box>
    );
  if (!options)
    return error ? (
      <Alert severity="info" sx={{ my: 2 }}>
        {error}
      </Alert>
    ) : null;
  if (!options.public && !options.groups.length && !options.temples.length)
    return pending || blockedRecovery ? (
      <Alert severity="warning" sx={{ my: 2 }}>
        No creation visibility is currently authorized. Download the retained
        request for recovery; retry when access is restored.
        <Button disabled={revalidating} onClick={downloadBlockedRecovery}>
          Download retained request
        </Button>
      </Alert>
    ) : null;

  return (
    <Box
      ref={rootRef}
      aria-label="Ritual creation area"
      aria-busy={revalidating}
      sx={{ my: 2, minHeight: reservedHeight }}
    >
      <div ref={contentRef}>
        <Typography variant="h6">Create ritual</Typography>
        {error && <Alert severity="warning">{error}</Alert>}
        {pending && (
          <Alert severity="info">
            This exact creation request is retained. Retry it to resolve an
            uncertain result without creating a duplicate.
          </Alert>
        )}
        {blockedRecovery && (
          <Button disabled={revalidating} onClick={downloadBlockedRecovery}>
            Download retained request
          </Button>
        )}
        <form onSubmit={submit}>
          {
            <TextField
              select
              label="Source format"
              size="small"
              value={form.format}
              disabled={revalidating || busy || !!pending || !!blockedRecovery}
              onChange={(event) =>
                updateForm((current) => ({
                  ...current,
                  format: event.target.value as FormState["format"],
                }))
              }
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="pug">Pug source</MenuItem>
              <MenuItem value="semantic">Ritual text</MenuItem>
            </TextField>
          }{" "}
          <TextField
            label="Title"
            size="small"
            value={form.title}
            disabled={revalidating || busy || !!pending || !!blockedRecovery}
            onChange={(event) =>
              updateForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
          />{" "}
          <TextField
            select
            label="Visibility"
            size="small"
            value={form.scopeKey}
            disabled={revalidating || busy || !!pending || !!blockedRecovery}
            onChange={(event) =>
              updateForm((current) => ({
                ...current,
                scopeKey: event.target.value,
              }))
            }
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Choose visibility</MenuItem>
            {options.public && <MenuItem value="public">Public</MenuItem>}
            {options.temples.map((temple) => (
              <MenuItem value={`temple:${temple.id}`} key={temple.id}>
                {temple.name}
              </MenuItem>
            ))}
            {options.groups.map((group) => (
              <MenuItem value={`group:${group.id}`} key={group.id}>
                {group.name}
              </MenuItem>
            ))}
          </TextField>
          {form.scopeKey.startsWith("temple:") && (
            <TextField
              label="Min Grade"
              size="small"
              type="number"
              value={form.minGrade}
              disabled={revalidating || busy || !!pending || !!blockedRecovery}
              onChange={(event) =>
                updateForm((current) => ({
                  ...current,
                  minGrade: Number(event.target.value),
                }))
              }
              sx={{ width: 100 }}
            />
          )}
          {form.format === "semantic" ? (
            <RitualCreationEditor
              key={options.ownerId}
              source={form.semanticSource}
              onChange={(semanticSource) =>
                updateForm((current) => ({ ...current, semanticSource }))
              }
              onValidityChange={setComposerValid}
              initialMode={form.editorMode}
              onModeChange={(editorMode) =>
                updateForm((current) => ({ ...current, editorMode }))
              }
              disabled={revalidating || busy || !!pending || !!blockedRecovery}
            />
          ) : (
            <TextField
              label="Ritual source"
              multiline
              minRows={4}
              fullWidth
              value={form.source}
              disabled={revalidating || busy || !!pending || !!blockedRecovery}
              onChange={(event) =>
                updateForm((current) => ({
                  ...current,
                  source: event.target.value,
                }))
              }
              sx={{ mt: 1 }}
            />
          )}
          <Button
            type="submit"
            disabled={
              revalidating ||
              busy ||
              !!blockedRecovery ||
              !form.title.trim() ||
              !form.scopeKey
            }
          >
            {pending ? "Retry creation" : "Create"}
          </Button>
          {pending && terminal && (
            <Button onClick={startNew} disabled={revalidating || busy}>
              Edit and start a new request
            </Button>
          )}
        </form>
      </div>
    </Box>
  );
}
