/** Edge assembly uses a controlled bootstrap boundary; actual startup/file/configured guards are tested separately. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const bootstrap = vi.fn(),
  handler = vi.fn();
let imports = 0;
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { resolve, promise };
};
beforeEach(() => {
  vi.resetModules();
  imports = 0;
  bootstrap.mockReset();
  handler.mockReset();
  bootstrap.mockResolvedValue(handler);
  handler.mockImplementation(
    async () => new Response("synthetic", { status: 200 }),
  );
  vi.doMock("./localBootstrap", () => {
    imports++;
    return { bootstrapLocalResearch: bootstrap };
  });
  for (const key of [
    "CI",
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_URL",
    "VERCEL_REGION",
  ])
    vi.stubEnv(key, undefined);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_LOCAL", "1");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:4179");
  vi.stubEnv("MAGICKLI_RESEARCH_STARTUP_SHA256", "a".repeat(64));
  vi.stubEnv("MAGICKLI_RESEARCH_RUNTIME_SHA256", "b".repeat(64));
  vi.stubEnv("MAGICKLI_RESEARCH_ENDPOINT_SHA256", "c".repeat(64));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const req = (
  init: RequestInit = {},
  url = "http://localhost:4179/chat/research/api",
) =>
  new Request(url, {
    method: "POST",
    headers: {
      host: "localhost:4179",
      origin: "http://localhost:4179",
      "content-type": "application/json",
    },
    body: '{"question":"Synthetic","mode":"passage"}',
    ...init,
  });
it("returns a private disabled404 without evaluating private/bootstrap imports", async () => {
  vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_LOCAL", undefined);
  const { handleLocalResearchRequest } = await import("./localServer"),
    r = await handleLocalResearchRequest(req());
  expect(r.status).toBe(404);
  expect(imports).toBe(0);
  expect(bootstrap).not.toHaveBeenCalled();
  expect(r.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
});
it.each([
  ["GET", 405],
  ["origin", 403],
  ["host", 403],
  ["cross-site", 403],
  ["query", 403],
  ["path", 403],
  ["hash", 403],
  ["forwarded-host", 403],
  ["forwarded-proto", 403],
  ["forwarded-port", 403],
  ["forwarded", 403],
  ["content-type", 415],
  ["too-large", 413],
  ["bad-length", 413],
])(
  "refuses cheap %s ingress before any private import",
  async (kind, status) => {
    const headers = new Headers({
      host: "localhost:4179",
      origin: "http://localhost:4179",
      "content-type": "application/json",
    });
    if (kind === "origin") headers.set("origin", "https://external.example");
    if (kind === "host") headers.set("host", "external.example");
    if (kind === "cross-site") headers.set("sec-fetch-site", "cross-site");
    if (kind === "forwarded-host")
      headers.set("x-forwarded-host", "external.example");
    if (kind === "forwarded-proto") headers.set("x-forwarded-proto", "https");
    if (kind === "forwarded-port") headers.set("x-forwarded-port", "1");
    if (kind === "forwarded") headers.set("forwarded", "host=localhost:4179");
    if (kind === "content-type") headers.set("content-type", "text/plain");
    if (kind === "too-large") headers.set("content-length", "32769");
    if (kind === "bad-length") headers.set("content-length", "-1");
    const request = req(
      {
        headers,
        ...(kind === "GET" ? { method: "GET", body: undefined } : {}),
      },
      kind === "query"
        ? "http://localhost:4179/chat/research/api?private=yes"
        : kind === "path"
          ? "http://localhost:4179/chat/research/api/other"
          : kind === "hash"
            ? "http://localhost:4179/chat/research/api#fragment"
            : undefined,
    );
    const { handleLocalResearchRequest } = await import("./localServer");
    expect((await handleLocalResearchRequest(request)).status).toBe(status);
    expect(imports).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  },
);
it("refuses invalid runtime/pins before importing private or credential modules", async () => {
  vi.stubEnv("MAGICKLI_RESEARCH_STARTUP_SHA256", "bad");
  const { handleLocalResearchRequest } = await import("./localServer");
  expect((await handleLocalResearchRequest(req())).status).toBe(503);
  expect(imports).toBe(0);
});
it("transfers the body without clone and owns original headers and abort dependency before its first await", async () => {
  const gate = deferred<typeof handler>(),
    controller = new AbortController(),
    request = req({ signal: controller.signal });
  bootstrap.mockReturnValue(gate.promise);
  const clone = vi.spyOn(request, "clone");
  const { handleLocalResearchRequest } = await import("./localServer"),
    pending = handleLocalResearchRequest(request);
  request.headers.set("origin", "https://changed.example");
  await vi.waitFor(() => expect(bootstrap).toHaveBeenCalledOnce());
  gate.resolve(handler);
  expect((await pending).status).toBe(200);
  expect(clone).not.toHaveBeenCalled();
  const [owned, end] = handler.mock.calls[0];
  expect(owned).not.toBe(request);
  expect(owned.headers.get("origin")).toBe("http://localhost:4179");
  expect(await owned.json()).toEqual({
    question: "Synthetic",
    mode: "passage",
  });
  expect(Number.isFinite(end)).toBe(true);
  controller.abort();
  expect(owned.signal.aborted).toBe(true);
});
it("shares a cold startup while each request still reaches its own actual handler call", async () => {
  const gate = deferred<typeof handler>();
  bootstrap.mockReturnValue(gate.promise);
  const { handleLocalResearchRequest } = await import("./localServer"),
    a = handleLocalResearchRequest(req()),
    b = handleLocalResearchRequest(req());
  await vi.waitFor(() => expect(bootstrap).toHaveBeenCalledOnce());
  gate.resolve(handler);
  expect((await a).status).toBe(200);
  expect((await b).status).toBe(200);
  expect(handler).toHaveBeenCalledTimes(2);
});
it("keeps shared startup independent of a first waiter's cancellation, without dispatching for that waiter", async () => {
  const gate = deferred<typeof handler>(),
    controller = new AbortController();
  bootstrap.mockReturnValue(gate.promise);
  const { handleLocalResearchRequest } = await import("./localServer"),
    a = handleLocalResearchRequest(req({ signal: controller.signal }));
  await vi.waitFor(() => expect(bootstrap).toHaveBeenCalledOnce());
  controller.abort();
  expect((await a).status).toBe(503);
  expect(bootstrap.mock.calls[0][1].aborted).toBe(false);
  const b = handleLocalResearchRequest(req());
  gate.resolve(handler);
  expect((await b).status).toBe(200);
  expect(handler).toHaveBeenCalledOnce();
  expect(bootstrap).toHaveBeenCalledOnce();
});
it("poisons a genuine startup failure until process restart without automatic retries", async () => {
  bootstrap.mockRejectedValue(Error("private source and key"));
  const { handleLocalResearchRequest } = await import("./localServer");
  for (let n = 0; n < 2; n++) {
    const r = await handleLocalResearchRequest(req());
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("private source");
  }
  expect(bootstrap).toHaveBeenCalledOnce();
  expect(handler).not.toHaveBeenCalled();
});
it("does not replace a captured configuration if environment pins change", async () => {
  const { handleLocalResearchRequest } = await import("./localServer");
  expect((await handleLocalResearchRequest(req())).status).toBe(200);
  vi.stubEnv("MAGICKLI_RESEARCH_STARTUP_SHA256", "d".repeat(64));
  expect((await handleLocalResearchRequest(req())).status).toBe(503);
  expect(bootstrap).toHaveBeenCalledOnce();
  expect(handler).toHaveBeenCalledOnce();
});
it("does not wrap long provider/settlement waiting in the short startup deadline", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const gate = deferred<Response>();
  handler.mockReturnValue(gate.promise);
  const { handleLocalResearchRequest } = await import("./localServer"),
    pending = handleLocalResearchRequest(req());
  await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(9000);
  expect(handler.mock.calls[0][0].signal.aborted).toBe(false);
  gate.resolve(new Response("synthetic completed"));
  expect((await pending).status).toBe(200);
});
it("refuses a timer-starved late bootstrap result before dispatch", async () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  bootstrap.mockImplementation(async (_config, _signal, end) => {
    now.mockReturnValue(end + 1);
    return handler;
  });
  const { handleLocalResearchRequest } = await import("./localServer");
  expect((await handleLocalResearchRequest(req())).status).toBe(503);
  expect(handler).not.toHaveBeenCalled();
});
it("returns after startup timeout and never dispatches its noncooperative late result", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const gate = deferred<typeof handler>();
  bootstrap.mockReturnValue(gate.promise);
  const { handleLocalResearchRequest } = await import("./localServer"),
    pending = handleLocalResearchRequest(req());
  await vi.waitFor(() => expect(bootstrap).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(8000);
  expect((await pending).status).toBe(503);
  gate.resolve(handler);
  await Promise.resolve();
  await Promise.resolve();
  expect(handler).not.toHaveBeenCalled();
  expect((await handleLocalResearchRequest(req())).status).toBe(503);
  expect(bootstrap).toHaveBeenCalledOnce();
});
it("cancels an unclaimed refused request body without parsing it", async () => {
  const cancel = vi.fn(),
    request = req({
      headers: {
        host: "bad",
        origin: "http://localhost:4179",
        "content-type": "application/json",
      },
      body: new ReadableStream({ cancel }),
      duplex: "half",
    } as RequestInit);
  const { handleLocalResearchRequest } = await import("./localServer");
  expect((await handleLocalResearchRequest(request)).status).toBe(403);
  await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  expect(imports).toBe(0);
});
it("accepts only the matching forwarded values Next may add to a local request", async () => {
  const request = req({
    headers: {
      host: "localhost:4179",
      origin: "http://localhost:4179",
      "content-type": "application/json; charset=utf-8",
      "x-forwarded-host": "localhost:4179",
      "x-forwarded-proto": "http",
      "x-forwarded-port": "4179",
    },
  });
  const { handleLocalResearchRequest } = await import("./localServer");
  expect((await handleLocalResearchRequest(request)).status).toBe(200);
});

it.each(["resolve", "reject"])(
  "cancels a completed but unreturned body after a late original-request abort: %s",
  async (kind) => {
    const controller = new AbortController(),
      cancel = vi.fn(async () => {
        if (kind === "reject") throw Error("Synthetic cancellation failure");
      });
    handler.mockImplementation(async () => {
      controller.abort();
      return new Response(new ReadableStream({ cancel }));
    });
    const { handleLocalResearchRequest } = await import("./localServer");
    expect(
      (await handleLocalResearchRequest(req({ signal: controller.signal })))
        .status,
    ).toBe(503);
    expect(cancel).toHaveBeenCalledOnce();
  },
);

it("sanitizes refusal-body cancellation failures without unhandled rejection", async () => {
  const cancel = vi.fn(async () => {
    throw Error("Synthetic private cancellation diagnostic");
  });
  const request = req({
    headers: {
      host: "bad",
      origin: "http://localhost:4179",
      "content-type": "application/json",
    },
    body: new ReadableStream({ cancel }),
    duplex: "half",
  } as RequestInit);
  const { handleLocalResearchRequest } = await import("./localServer"),
    response = await handleLocalResearchRequest(request);
  expect(response.status).toBe(403);
  expect(await response.text()).not.toContain("cancellation diagnostic");
  await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  await Promise.resolve();
});

it("keeps a captured highWaterMark-zero body unread throughout a stalled cold startup", async () => {
  let pulls = 0;
  const gate = deferred<typeof handler>(),
    stream = new ReadableStream<Uint8Array>(
      {
        pull(c) {
          pulls++;
          c.enqueue(
            new TextEncoder().encode(
              '{"question":"Synthetic","mode":"passage"}',
            ),
          );
          c.close();
        },
      },
      { highWaterMark: 0 },
    );
  bootstrap.mockReturnValue(gate.promise);
  handler.mockImplementation(async (request: Request) => {
    expect(await request.json()).toEqual({
      question: "Synthetic",
      mode: "passage",
    });
    return new Response("Synthetic");
  });
  const { handleLocalResearchRequest } = await import("./localServer"),
    original = req({ body: stream, duplex: "half" } as RequestInit),
    pending = handleLocalResearchRequest(original);
  await vi.waitFor(() => expect(bootstrap).toHaveBeenCalledOnce());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(pulls).toBe(0);
  expect(original.body!.locked).toBe(false);
  gate.resolve(handler);
  expect((await pending).status).toBe(200);
  expect(pulls).toBe(1);
});
it.each(["used", "locked"])(
  "refuses an already %s request without taking another reader or starting private work",
  async (kind) => {
    const request = req();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    if (kind === "used") await request.text();
    else reader = request.body!.getReader();
    const { handleLocalResearchRequest } = await import("./localServer");
    expect((await handleLocalResearchRequest(request)).status).toBe(400);
    expect(imports).toBe(0);
    reader?.releaseLock();
  },
);

it("dispatches the exact retained-read path under the original ingress bound", async () => {
  const { handleLocalResearchRequest } = await import("./localServer");
  const response = await handleLocalResearchRequest(
    req(
      { body: JSON.stringify({ permit_id: "synthetic" }) },
      "http://localhost:4179/chat/research/answers/read",
    ),
  );
  expect(response.status).toBe(200);
  expect(handler).toHaveBeenCalledOnce();
  expect(new URL(handler.mock.calls[0][0].url).pathname).toBe(
    "/chat/research/answers/read",
  );
  expect(Number.isFinite(handler.mock.calls[0][1])).toBe(true);
});
it("refuses an oversized retained-read body before importing startup", async () => {
  const { handleLocalResearchRequest } = await import("./localServer");
  const headers = {
    host: "localhost:4179",
    origin: "http://localhost:4179",
    "content-type": "application/json",
    "content-length": "129",
  };
  expect(
    (
      await handleLocalResearchRequest(
        req({ headers }, "http://localhost:4179/chat/research/answers/read"),
      )
    ).status,
  ).toBe(413);
  expect(imports).toBe(0);
});

it("owns the catalog path and refuses oversized metadata input before private assembly", async () => {
  const { handleLocalResearchRequest } = await import("./localServer");
  expect(
    (
      await handleLocalResearchRequest(
        req({ body: "{}" }, "http://localhost:4179/chat/research/catalog"),
      )
    ).status,
  ).toBe(200);
  expect(new URL(handler.mock.calls[0][0].url).pathname).toBe(
    "/chat/research/catalog",
  );
  handler.mockClear();
  const h = {
    host: "localhost:4179",
    origin: "http://localhost:4179",
    "content-type": "application/json",
    "content-length": "17",
  };
  expect(
    (
      await handleLocalResearchRequest(
        req(
          { headers: h, body: "{}" },
          "http://localhost:4179/chat/research/catalog",
        ),
      )
    ).status,
  ).toBe(413);
  expect(handler).not.toHaveBeenCalled();
});

it("routes only the exact bounded empty-body archive path", async () => {
  const { handleLocalResearchRequest } = await import("./localServer");
  expect(
    (
      await handleLocalResearchRequest(
        req({ body: "{}" }, "http://localhost:4179/chat/research/answers/list"),
      )
    ).status,
  ).toBe(200);
  expect(new URL(handler.mock.calls[0][0].url).pathname).toBe(
    "/chat/research/answers/list",
  );
  const h = {
    host: "localhost:4179",
    origin: "http://localhost:4179",
    "content-type": "application/json",
    "content-length": "17",
  };
  expect(
    (
      await handleLocalResearchRequest(
        req(
          { body: "{}", headers: h },
          "http://localhost:4179/chat/research/answers/list",
        ),
      )
    ).status,
  ).toBe(413);
  expect(handler).toHaveBeenCalledOnce();
});
