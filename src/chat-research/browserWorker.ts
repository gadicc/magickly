/** Browser compatibility gate only. Existing same-origin scripts/XSS remain in the trust boundary; server authorization is always independent. */
import {
  RESEARCH_API_PATH,
  RESEARCH_ARCHIVE_API_PATH,
  RESEARCH_CATALOG_API_PATH,
  RESEARCH_READ_API_PATH,
} from "./paths";
import {
  RESEARCH_WORKER_PROBE,
  RESEARCH_WORKER_REPLY,
  RESEARCH_WORKER_VERSION,
} from "./workerProtocol";
export const RESEARCH_WORKER_CHECK_TIMEOUT_MS = 1500;
export const RESEARCH_BROWSER_WORKER_ERROR =
  "Private research browser check unavailable";
/** Observe the actual current controller. A compatible reply does not register/update/unregister workers or alter browser caches. */
export async function createResearchBrowserFetch(
  workers: Pick<ServiceWorkerContainer, "controller"> | null,
  signal: AbortSignal,
  requestFetch: typeof fetch = fetch,
): Promise<typeof fetch> {
  const fail = (): never => {
    throw Error(RESEARCH_BROWSER_WORKER_ERROR);
  };
  let selected: ServiceWorker | null = null;
  const active = () => {
    signal.throwIfAborted();
    if ((workers?.controller ?? null) !== selected) fail();
  };
  try {
    selected = workers?.controller ?? null;
    active();
    if (selected) {
      const worker = selected;
      if (selected.scriptURL !== location.origin + "/sw.js") fail();
      const bytes = crypto.getRandomValues(new Uint8Array(16)),
        nonce = [...bytes]
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("");
      await new Promise<void>((resolve, reject) => {
        const channel = new MessageChannel(),
          end = performance.now() + RESEARCH_WORKER_CHECK_TIMEOUT_MS;
        let done = false;
        const finish = (ok: boolean) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            signal.removeEventListener("abort", stop);
            try {
              channel.port1.onmessage = null;
              channel.port1.close();
            } catch {}
            try {
              channel.port2.close();
            } catch {}
            if (ok) resolve();
            else reject(Error(RESEARCH_BROWSER_WORKER_ERROR));
          },
          stop = () => finish(false),
          timer = setTimeout(stop, RESEARCH_WORKER_CHECK_TIMEOUT_MS);
        signal.addEventListener("abort", stop, { once: true });
        channel.port1.onmessage = (event) => {
          try {
            active();
            const value = event.data;
            if (
              performance.now() >= end ||
              !value ||
              typeof value !== "object" ||
              Array.isArray(value) ||
              Object.keys(value).sort().join(",") !== "nonce,type,version" ||
              value.type !== RESEARCH_WORKER_REPLY ||
              value.version !== RESEARCH_WORKER_VERSION ||
              value.nonce !== nonce
            ) {
              finish(false);
              return;
            }
            finish(true);
          } catch {
            finish(false);
          }
        };
        try {
          active();
          worker.postMessage({ type: RESEARCH_WORKER_PROBE, nonce }, [
            channel.port2,
          ]);
        } catch {
          finish(false);
        }
      });
    }
    active();
    return (input, init) => {
      active();
      if (
        typeof input !== "string" ||
        ![
          RESEARCH_API_PATH,
          RESEARCH_CATALOG_API_PATH,
          RESEARCH_ARCHIVE_API_PATH,
          RESEARCH_READ_API_PATH,
        ].includes(input) ||
        init?.method !== "POST" ||
        init.credentials !== "same-origin" ||
        init.cache !== "no-store" ||
        init.redirect !== "error"
      )
        fail();
      const combined = AbortSignal.any(
        init?.signal ? [signal, init.signal] : [signal],
      );
      combined.throwIfAborted();
      return requestFetch(input, { ...init, signal: combined });
    };
  } catch {
    return fail();
  }
}
