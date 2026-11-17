"use client";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import {
  type DraftDepartureHandle,
  installDraftDepartureGuard,
} from "./draftDeparture";
import { flushPendingEdits, hasPendingEdits } from "./pendingEdits";

/** Keep page exits behind durable local writes, without remounting the editor. */
export function useDraftDeparture(handle: DraftDepartureHandle) {
  const current = useRef(handle);
  current.current = handle;
  useEffect(
    () =>
      installDraftDepartureGuard(
        {
          pending: () => current.current.pending(),
          flush: () => current.current.flush(),
          failed: () => current.current.failed(),
        },
        {
          document,
          window,
          pendingFields: hasPendingEdits,
          flushFields: () => {
            flushSync(() => {
              flushPendingEdits();
            });
          },
        },
      ),
    [],
  );
}
