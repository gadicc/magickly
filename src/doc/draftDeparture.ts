/** Opaque local-durability checks; a handle never grants access or exports bytes. */
export interface DraftDepartureHandle {
  /** True while edits/recovery exist only in memory or a local write is pending. */
  pending(): boolean;
  /** Persist the current snapshot and await already queued writes; reject on failure. */
  flush(): Promise<void>;
  /** Keep the editor open and explain how to recover when a flush fails. */
  failed(): void;
}

/** The caller flushes React-held fields synchronously before taking a snapshot. */
export interface DraftDepartureEnvironment {
  document: Document;
  window: Window;
  flushFields(): void;
  pendingFields(): boolean;
}

/**
 * Guard all app-controlled page exits, including native anchors inside one
 * root. Replaying the original anchor preserves Next Link/native navigation
 * behavior after durability succeeds. Unload/visibility writes are best effort.
 */
export function installDraftDepartureGuard(
  handle: DraftDepartureHandle,
  environment: DraftDepartureEnvironment,
): () => void {
  const { document, window, flushFields, pendingFields } = environment;
  let active = true;
  let replay: HTMLAnchorElement | null = null;
  let departure = false;
  let saving: Promise<void> | null = null;
  const pending = () => handle.pending() || pendingFields();

  const flush = () => {
    if (saving) return saving;
    saving = (async () => {
      // An edit made during an awaited write must also become durable. A
      // continuously changing or invalid field keeps the page open.
      for (let attempt = 0; attempt < 4; attempt++) {
        flushFields();
        await handle.flush();
        if (!pending()) return;
      }
      throw new Error("Local edits are not durable yet.");
    })().finally(() => {
      saving = null;
    });
    return saving;
  };
  const bestEffort = () => {
    if (!pending()) return;
    void flush().catch(() => {
      if (active) handle.failed();
    });
  };
  const beforeUnload = (event: BeforeUnloadEvent) => {
    try {
      flushFields();
    } catch {
      event.preventDefault();
      event.returnValue = "";
      handle.failed();
      return;
    }
    if (!pending()) return;
    event.preventDefault();
    event.returnValue = "";
    bestEffort();
  };
  const hidden = () => {
    if (document.visibilityState === "hidden") {
      bestEffort();
    }
  };
  const pageHide = () => {
    bestEffort();
  };
  const click = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest?.(
      "a[href]",
    ) as HTMLAnchorElement | null;
    if (!anchor) return;
    if (anchor === replay) {
      replay = null;
      return;
    }
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      anchor.hasAttribute("download") ||
      (anchor.target && anchor.target !== "_self")
    )
      return;
    const from = new URL(window.location.href);
    let to: URL;
    try {
      to = new URL(anchor.href, from);
    } catch {
      return;
    }
    if (
      !["http:", "https:"].includes(to.protocol) ||
      anchor.getAttribute("href")?.startsWith("#")
    )
      return;
    if (!pending() && !departure) return;
    event.preventDefault();
    event.stopPropagation();
    if (departure) return;
    departure = true;
    void flush()
      .then(
        () => {
          if (
            !active ||
            window.location.href !== from.href ||
            !anchor.isConnected ||
            anchor.href !== to.href
          )
            return;
          replay = anchor;
          anchor.click();
          replay = null;
        },
        () => {
          if (active) handle.failed();
        },
      )
      .finally(() => {
        departure = false;
      });
  };

  document.addEventListener("click", click, true);
  document.addEventListener("visibilitychange", hidden, true);
  window.addEventListener("pagehide", pageHide, true);
  window.addEventListener("beforeunload", beforeUnload);
  return () => {
    active = false;
    document.removeEventListener("click", click, true);
    document.removeEventListener("visibilitychange", hidden, true);
    window.removeEventListener("pagehide", pageHide, true);
    window.removeEventListener("beforeunload", beforeUnload);
  };
}
