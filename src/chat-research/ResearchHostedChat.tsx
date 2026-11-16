"use client";
import { useEffect, useState } from "react";
import { createResearchBrowserFetch } from "./browserWorker";
import { SessionResearchChat } from "./ResearchSessionChat";
/** Server-authenticated operator shell. Existing controllers must prove research NetworkOnly compatibility before any private UI/API work. */
export function ResearchHostedChat({
  expiresAt,
  readOnly = false,
}: {
  expiresAt: number;
  readOnly?: boolean;
}) {
  const [state, setState] = useState<
    | { kind: "checking" }
    | { kind: "blocked" }
    | { kind: "ready"; requestFetch: typeof fetch; sequence: number }
  >({ kind: "checking" });
  useEffect(() => {
    let current: AbortController | undefined,
      closed = false,
      sequence = 0;
    let workers: ServiceWorkerContainer | null;
    try {
      workers = "serviceWorker" in navigator ? navigator.serviceWorker : null;
    } catch {
      setState({ kind: "blocked" });
      return;
    }
    const check = () => {
      current?.abort();
      const controller = new AbortController(),
        id = ++sequence;
      current = controller;
      setState({ kind: "checking" });
      void createResearchBrowserFetch(workers, controller.signal)
        .then((requestFetch) => {
          if (!closed && id === sequence && !controller.signal.aborted)
            setState({ kind: "ready", requestFetch, sequence: id });
        })
        .catch(() => {
          if (!closed && id === sequence && !controller.signal.aborted)
            setState({ kind: "blocked" });
        });
    };
    workers?.addEventListener("controllerchange", check);
    check();
    return () => {
      closed = true;
      current?.abort();
      workers?.removeEventListener("controllerchange", check);
    };
  }, []);
  if (state.kind === "checking")
    return <p role="status">Checking this browser for private research…</p>;
  if (state.kind === "blocked")
    return (
      <p>
        Update the site in <a href="/">the normal site</a>, then return here to
        open private research. Your offline work has not been changed.
      </p>
    );
  return (
    <SessionResearchChat
      key={state.sequence}
      expiresAt={expiresAt}
      readOnly={readOnly}
      requestFetch={state.requestFetch}
    />
  );
}
