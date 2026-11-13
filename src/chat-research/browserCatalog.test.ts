import { afterEach, expect, it, vi } from "vitest";
import {
  RESEARCH_CATALOG_TIMEOUT_MS,
  requestResearchBookCatalog,
} from "./browserCatalog";
import { RESEARCH_CATALOG_BYTE_LIMIT, RESEARCH_CATALOG_ERROR } from "./catalog";
import { catalogFixture } from "./catalog.fixture";
import { RESEARCH_CATALOG_API_PATH } from "./paths";

const signal = () => new AbortController().signal;
const encode = (text: string) => new TextEncoder().encode(text);
const response = (text = JSON.stringify(catalogFixture())) =>
  new Response(text, { headers: { "content-type": "application/json" } });
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { resolve, promise };
};
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("dispatches one fixed credentialed local POST and returns complete qualified metadata", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => response()),
    value = await requestResearchBookCatalog(signal(), fetch);
  expect(value).toEqual(catalogFixture());
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toBe(RESEARCH_CATALOG_API_PATH);
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    body: "{}",
    headers: { "content-type": "application/json", accept: "application/json" },
  });
  expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true);
});
it("accepts split multibyte UTF8 and measures decoded bytes rather than compressed Content-Length", async () => {
  const value = JSON.parse(JSON.stringify(catalogFixture()));
  value.books[0].book.title = "Σύμβολο";
  const bytes = encode(JSON.stringify(value)),
    r = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(bytes.slice(0, 210));
          c.enqueue(bytes.slice(210, 211));
          c.enqueue(bytes.slice(211));
          c.close();
        },
      }),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-encoding": "gzip",
          "content-length": "20",
        },
      },
    );
  expect(await requestResearchBookCatalog(signal(), async () => r)).toEqual(
    value,
  );
});
it.each(["status", "type", "redirect", "body", "locked", "used"])(
  "refuses invalid %s metadata before decoding",
  async (kind) => {
    let r = response();
    if (kind === "status") r = new Response("private error", { status: 503 });
    if (kind === "type") r.headers.set("content-type", "text/html");
    if (kind === "redirect")
      Object.defineProperty(r, "redirected", { value: true });
    if (kind === "body")
      r = new Response(null, {
        headers: { "content-type": "application/json" },
      });
    let reader: ReadableStreamDefaultReader | undefined;
    if (kind === "locked") reader = r.body!.getReader();
    if (kind === "used") await r.text();
    await expect(
      requestResearchBookCatalog(signal(), async () => r),
    ).rejects.toThrow(RESEARCH_CATALOG_ERROR);
    reader?.releaseLock();
  },
);
it.each([
  "extra",
  "alias",
  "duplicate",
  "whitespace",
  "trailing",
  "utf8",
  "bom",
  "oversize",
  "chunks",
  "chunk-type",
])("rejects malformed atomic catalog wire %s", async (kind) => {
  let text = JSON.stringify(catalogFixture()),
    body: BodyInit | ReadableStream = text;
  if (kind === "extra")
    body = text.replace(
      '"schema_version":1',
      '"file_url":"private","schema_version":1',
    );
  if (kind === "duplicate")
    body = text.replace(
      '"schema_version":1',
      '"schema_version":2,"schema_version":1',
    );
  if (kind === "alias")
    body = text.replace(
      '"schema_version":1',
      '"schema_version":2,"schema_\\u0076ersion":1',
    );
  if (kind === "whitespace") body = " " + text;
  if (kind === "trailing") body = text + "{";
  if (kind === "utf8") body = Uint8Array.from([0xff]);
  if (kind === "bom")
    body = Uint8Array.from([0xef, 0xbb, 0xbf, ...encode(text)]);
  if (kind === "oversize") body = "x".repeat(RESEARCH_CATALOG_BYTE_LIMIT + 1);
  if (kind === "chunks")
    body = new ReadableStream({
      start(c) {
        for (let i = 0; i < 1025; i++) c.enqueue(new Uint8Array());
        c.close();
      },
    });
  if (kind === "chunk-type")
    body = new ReadableStream({
      start(c) {
        c.enqueue("private");
        c.close();
      },
    });
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response(body, { headers: { "content-type": "application/json" } }),
  );
  await expect(requestResearchBookCatalog(signal(), fetch)).rejects.toThrow(
    RESEARCH_CATALOG_ERROR,
  );
  expect(fetch).toHaveBeenCalledOnce();
});
it("does not display a complete-looking prefix until physical EOF", async () => {
  let c!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
      start(controller) {
        c = controller;
        c.enqueue(encode(JSON.stringify(catalogFixture())));
      },
    }),
    r = new Response(body, { headers: { "content-type": "application/json" } }),
    controller = new AbortController(),
    done = vi.fn();
  const pending = requestResearchBookCatalog(controller.signal, async () => r);
  void pending.then(done, () => {});
  await Promise.resolve();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  controller.abort();
  await expect(pending).rejects.toThrow(RESEARCH_CATALOG_ERROR);
  expect(done).not.toHaveBeenCalled();
});
it("times out a noncooperative fetch and cancels its late response without retry", async () => {
  vi.useFakeTimers();
  const gate = deferred<Response>(),
    fetch = vi.fn<typeof globalThis.fetch>(() => gate.promise),
    pending = requestResearchBookCatalog(signal(), fetch),
    rejected = expect(pending).rejects.toThrow(RESEARCH_CATALOG_ERROR);
  await vi.advanceTimersByTimeAsync(RESEARCH_CATALOG_TIMEOUT_MS);
  await rejected;
  const cancel = vi.fn(),
    r = new Response(new ReadableStream({ cancel }, { highWaterMark: 0 }));
  gate.resolve(r);
  await Promise.resolve();
  await Promise.resolve();
  expect(cancel).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledOnce();
});
it("rejects a timer-starved first late chunk without pulling another", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const pull = vi.fn((c) => {
      now = RESEARCH_CATALOG_TIMEOUT_MS;
      c.enqueue(encode(JSON.stringify(catalogFixture())));
    }),
    cancel = vi.fn(),
    r = new Response(
      new ReadableStream({ pull, cancel }, { highWaterMark: 0 }),
      { headers: { "content-type": "application/json" } },
    );
  await expect(
    requestResearchBookCatalog(signal(), async () => r),
  ).rejects.toThrow(RESEARCH_CATALOG_ERROR);
  expect(pull).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
});
it("includes response-header work in the original deadline", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const r = response(),
    get = r.headers.get.bind(r.headers),
    pull = vi.spyOn(r.body!, "getReader");
  vi.spyOn(r.headers, "get").mockImplementation((key) => {
    now = RESEARCH_CATALOG_TIMEOUT_MS;
    return get(key);
  });
  await expect(
    requestResearchBookCatalog(signal(), async () => r),
  ).rejects.toThrow(RESEARCH_CATALOG_ERROR);
  expect(pull).not.toHaveBeenCalled();
});
it("an already cancelled operation never dispatches", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetch = vi.fn();
  await expect(
    requestResearchBookCatalog(controller.signal, fetch),
  ).rejects.toThrow(RESEARCH_CATALOG_ERROR);
  expect(fetch).not.toHaveBeenCalled();
});

it.each(["headers", "reader"])(
  "a rejected %s cancellation sink cannot leak diagnostics or hold a failed catalog open",
  async (kind) => {
    const cancel = vi.fn(() =>
        Promise.reject(Error("Synthetic private cancellation diagnostic")),
      ),
      body = new ReadableStream(
        {
          start(c) {
            if (kind === "reader")
              c.enqueue(new Uint8Array(RESEARCH_CATALOG_BYTE_LIMIT + 1));
          },
          cancel,
        },
        { highWaterMark: 0 },
      ),
      r = new Response(body, {
        status: kind === "headers" ? 503 : 200,
        headers: { "content-type": "application/json" },
      });
    await expect(
      requestResearchBookCatalog(signal(), async () => r),
    ).rejects.toThrow(RESEARCH_CATALOG_ERROR);
    expect(cancel).toHaveBeenCalledOnce();
  },
);
