/** Fixed same-origin metadata lanes. No dynamic URL/provider, background calls, retries or storage. */

import {
  parseResearchAnswerArchive,
  RESEARCH_ARCHIVE_BYTE_LIMIT,
  RESEARCH_ARCHIVE_ERROR,
  type ResearchAnswerArchive,
} from "./archive";
import {
  parseResearchBookCatalog,
  RESEARCH_CATALOG_BYTE_LIMIT,
  RESEARCH_CATALOG_ERROR,
  type ResearchBookCatalog,
} from "./catalog";
import { RESEARCH_ARCHIVE_API_PATH, RESEARCH_CATALOG_API_PATH } from "./paths";
export const RESEARCH_PRIVATE_JSON_TIMEOUT_MS = 15000;
/** Closed typed catalog/archive lanes only; the server independently authorizes every request. */
export function requestPrivateResearchMetadata(
  kind: "catalog",
  signal: AbortSignal,
  requestFetch?: typeof fetch,
): Promise<ResearchBookCatalog>;
export function requestPrivateResearchMetadata(
  kind: "archive",
  signal: AbortSignal,
  requestFetch?: typeof fetch,
): Promise<ResearchAnswerArchive>;
export async function requestPrivateResearchMetadata(
  kind: "catalog" | "archive",
  signal: AbortSignal,
  requestFetch: typeof fetch = fetch,
): Promise<ResearchBookCatalog | ResearchAnswerArchive> {
  if (kind !== "catalog" && kind !== "archive")
    throw Error("Private research metadata unavailable");
  const { path, byteLimit, error, parse } =
    kind === "catalog"
      ? {
          path: RESEARCH_CATALOG_API_PATH,
          byteLimit: RESEARCH_CATALOG_BYTE_LIMIT,
          error: RESEARCH_CATALOG_ERROR,
          parse: parseResearchBookCatalog,
        }
      : {
          path: RESEARCH_ARCHIVE_API_PATH,
          byteLimit: RESEARCH_ARCHIVE_BYTE_LIMIT,
          error: RESEARCH_ARCHIVE_ERROR,
          parse: parseResearchAnswerArchive,
        };
  const end = performance.now() + RESEARCH_PRIVATE_JSON_TIMEOUT_MS,
    controller = new AbortController(),
    combined = AbortSignal.any([signal, controller.signal]);
  let response: Response | undefined,
    reader: ReadableStreamDefaultReader<Uint8Array> | undefined,
    reject!: () => void;
  const interrupted = new Promise<never>((_, r) => {
    reject = () => r(Error(error));
  });
  void interrupted.catch(() => {});
  const check = () => {
    if (combined.aborted || performance.now() >= end) throw Error(error);
  };
  const cancel = (value?: Response) => {
    try {
      if (reader) void reader.cancel().catch(() => {});
      else if (value?.body && !value.body.locked)
        void value.body.cancel().catch(() => {});
    } catch {}
  };
  const stop = () => {
    cancel(response);
    reject();
  };
  combined.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(0, end - performance.now()),
  );
  try {
    check();
    const pending = Promise.resolve()
      .then(() => {
        check();
        return requestFetch(path, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: "{}",
          signal: combined,
        });
      })
      .then((value) => {
        response = value;
        try {
          check();
        } catch {
          cancel(value);
          throw Error(error);
        }
        return value;
      });
    response = await Promise.race([pending, interrupted]);
    check();
    if (
      response.status !== 200 ||
      response.redirected ||
      response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/json" ||
      !response.body ||
      response.bodyUsed ||
      response.body.locked
    )
      throw Error();
    check();
    reader = response.body.getReader();
    check();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (let n = 0; ; n++) {
      check();
      const result = await Promise.race([reader.read(), interrupted]);
      check();
      if (result.done) break;
      if (
        n >= 1024 ||
        !(result.value instanceof Uint8Array) ||
        result.value.byteLength > byteLimit - bytes
      )
        throw Error();
      bytes += result.value.byteLength;
      chunks.push(Uint8Array.from(result.value));
    }
    const all = new Uint8Array(bytes);
    let at = 0;
    for (const chunk of chunks) {
      all.set(chunk, at);
      at += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(all);
    check();
    const parsed: unknown = JSON.parse(text);
    // The server uses Response.json. Exact spelling rejects duplicate/escaped-alias keys and unfinished tails.
    if (JSON.stringify(parsed) !== text) throw Error();
    const value = parse(parsed);
    check();
    return value;
  } catch {
    cancel(response);
    throw Error(error);
  } finally {
    clearTimeout(timer);
    combined.removeEventListener("abort", stop);
    controller.abort();
    try {
      reader?.releaseLock();
    } catch {}
  }
}
