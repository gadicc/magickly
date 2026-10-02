"use client";

import { Alert, Button } from "@mui/material";
import React from "react";
import { createUuidV7 } from "@/lib/ids";
import {
  parseRitualPublicationRequest,
  type RitualPublicationRequestV1,
} from "@/offline/ritualPublicationContract";
import {
  clearCreationPublicationHandoff,
  creationPublicationHandoffKey,
  readCreationPublicationHandoff,
} from "@/offline/ritualPublicationHandoff";
import {
  clearSemanticPublication,
  loadSemanticPublication,
  saveSemanticPublication,
} from "./semanticDraft";
import { sendRitualPublication } from "./sqlEditorClient";

/** Online-only publishing retains exact requests across unknown outcomes and reloads. */
export default function SemanticPublication({
  actorId,
  ritualId,
  revisionId,
  version,
  enabled,
}: {
  actorId: string;
  ritualId: string;
  revisionId: string;
  version: number;
  enabled: boolean;
}) {
  const [request, setRequest] =
    React.useState<RitualPublicationRequestV1 | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [renew, setRenew] = React.useState(false);
  const [staleTarget, setStaleTarget] = React.useState<string | null>(null);
  const staleRevision = staleTarget === `${revisionId}:${version}`;
  const [loaded, setLoaded] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const creating = React.useRef(false);
  const live = React.useRef({
    actorId,
    ritualId,
    revisionId,
    version,
    enabled,
  });
  live.current = { actorId, ritualId, revisionId, version, enabled };
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  React.useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoaded(false);
    void (async () => {
      const handoff = readCreationPublicationHandoff(
        localStorage,
        actorId,
        ritualId,
      );
      if (
        !handoff &&
        localStorage.getItem(creationPublicationHandoffKey(actorId, ritualId))
      )
        throw new Error("Invalid creation recovery");
      const stored = await loadSemanticPublication(actorId, ritualId);
      let next = stored ? parseRitualPublicationRequest(stored) : null;
      if (
        stored &&
        (!next ||
          next.expectedActorId !== actorId ||
          next.ritualId !== ritualId)
      )
        throw new Error("Invalid publication recovery");
      if (!active) return;
      if (
        !next &&
        handoff &&
        handoff.value.publication.expectedVersion >= version
      ) {
        next = handoff.value.publication;
        await saveSemanticPublication(next);
      }
      if (!active) return;
      if (handoff)
        clearCreationPublicationHandoff(
          localStorage,
          handoff.value,
          handoff.serialized,
        );
      setRequest(next);
      setRenew(
        !!next &&
          (next.expectedRevisionId !== revisionId ||
            next.expectedVersion !== version),
      );
      setLoaded(true);
    })().catch(() => {
      if (active)
        setMessage(
          "The ritual is saved, but publication recovery is unavailable. Reload to retry.",
        );
    });
    return () => {
      active = false;
    };
  }, [enabled, actorId, ritualId, revisionId, version]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry increments attempt while preserving the immutable request.
  React.useEffect(() => {
    if (!enabled || (loaded && !request)) {
      setBusy(false);
      return;
    }
    if (
      !enabled ||
      !loaded ||
      !request ||
      staleRevision ||
      renew ||
      request.expectedRevisionId !== revisionId ||
      request.expectedVersion !== version
    )
      return;
    let active = true;
    const controller = new AbortController();
    setBusy(true);
    setMessage("Publishing the saved version for download…");
    void (async () => {
      const result = await sendRitualPublication(request, controller.signal);
      if (!active) return;
      if (!result) {
        setMessage(
          "Publication could not be confirmed. Retry the same request.",
        );
      } else if (result.ok) {
        await clearSemanticPublication(request);
        if (!active) return;
        setRequest(null);
        setMessage("Published for download.");
      } else {
        if (result.code === "STALE") setStaleTarget(`${revisionId}:${version}`);
        setMessage(
          result.code === "STALE"
            ? "A newer revision exists. Download any local draft, then reload this page before publishing."
            : result.message,
        );
        setRenew(result.code === "EXPIRED");
      }
    })()
      .catch(() => {
        if (active)
          setMessage(
            "The ritual is saved. Publication needs the same request retried.",
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    enabled,
    loaded,
    request,
    renew,
    attempt,
    revisionId,
    version,
    staleRevision,
  ]);
  const start = async () => {
    if (!enabled || busy || !loaded || creating.current || staleRevision)
      return;
    creating.current = true;
    setBusy(true);
    const next: RitualPublicationRequestV1 = {
      version: 1,
      operationId: createUuidV7(),
      expectedActorId: actorId,
      ritualId,
      expectedRevisionId: revisionId,
      expectedVersion: version,
    };
    try {
      await saveSemanticPublication(next, request?.operationId);
      if (
        !mounted.current ||
        !live.current.enabled ||
        live.current.actorId !== actorId ||
        live.current.ritualId !== ritualId ||
        live.current.revisionId !== revisionId ||
        live.current.version !== version
      )
        return;
      setRenew(false);
      setRequest(next);
    } catch {
      if (mounted.current)
        setMessage(
          "The ritual is saved, but its publication request could not be retained.",
        );
    } finally {
      creating.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <>
      {message && (
        <Alert
          severity={message === "Published for download." ? "success" : "info"}
        >
          {message}
        </Alert>
      )}
      {staleRevision ? null : request && !renew ? (
        <Button
          disabled={!enabled || busy || !loaded}
          onClick={() => setAttempt((value) => value + 1)}
        >
          Retry publication
        </Button>
      ) : (
        <Button
          disabled={!enabled || busy || !loaded}
          onClick={() => void start()}
        >
          {renew
            ? "Publish current saved version"
            : "Publish saved version for download"}
        </Button>
      )}
    </>
  );
}
