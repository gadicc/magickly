// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createResearchBrowserFetch,
  RESEARCH_BROWSER_WORKER_ERROR,
  RESEARCH_WORKER_CHECK_TIMEOUT_MS,
} from "./browserWorker";
import {
  RESEARCH_WORKER_PROBE,
  RESEARCH_WORKER_REPLY,
  RESEARCH_WORKER_VERSION,
  replyToResearchWorkerProbe,
} from "./workerProtocol";

class Port {
  onmessage: ((event: MessageEvent) => unknown) | null = null;
  peer!: Port;
  closed = false;
  postMessage(data: unknown) {
    if (!this.peer.closed)
      this.peer.onmessage?.(new MessageEvent("message", { data }));
  }
  close() {
    this.closed = true;
  }
}
const channels: { port1: Port; port2: Port }[] = [];
class Channel {
  port1 = new Port();
  port2 = new Port();
  constructor() {
    this.port1.peer = this.port2;
    this.port2.peer = this.port1;
    channels.push(this);
  }
}
beforeEach(() => {
  channels.length = 0;
  vi.stubGlobal("MessageChannel", Channel);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const init = () => ({
  method: "POST",
  credentials: "same-origin" as const,
  cache: "no-store" as const,
  redirect: "error" as const,
});
function fixture(
  reply: (
    data: { type: string; nonce: string },
    ports: MessagePort[],
  ) => void = (data, ports) => replyToResearchWorkerProbe({ data, ports }),
) {
  const worker = {
      scriptURL: location.origin + "/sw.js",
      postMessage: vi.fn(reply),
    } as unknown as ServiceWorker,
    workers = { controller: worker },
    controller = new AbortController(),
    fetcher = vi.fn<typeof fetch>(async () => new Response("synthetic"));
  return { worker, workers, controller, fetcher };
}
it.each(["no-api", "uncontrolled"])(
  "allows closed POST transport when there is no controlling worker: %s",
  async (kind) => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response()),
      controller = new AbortController(),
      workers = kind === "no-api" ? null : { controller: null },
      ready = await createResearchBrowserFetch(
        workers,
        controller.signal,
        fetcher,
      );
    expect(channels).toHaveLength(0);
    await ready("/chat/research/api", init());
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(false);
    controller.abort();
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  },
);
it("accepts only the real worker's exact nonce/version reply and closes both ports", async () => {
  const f = fixture(),
    ready = await createResearchBrowserFetch(
      f.workers,
      f.controller.signal,
      f.fetcher,
    );
  expect(
    channels.every((channel) => channel.port1.closed && channel.port2.closed),
  ).toBe(true);
  for (const path of [
    "/chat/research/api",
    "/chat/research/catalog",
    "/chat/research/answers/list",
    "/chat/research/answers/read",
  ])
    await ready(path, init());
  expect(f.fetcher).toHaveBeenCalledTimes(4);
});
it.each(["version", "nonce", "type", "extra", "null"])(
  "refuses an old or malformed worker reply: %s",
  async (kind) => {
    const f = fixture((data, ports) => {
      const reply = {
        type: RESEARCH_WORKER_REPLY,
        version: RESEARCH_WORKER_VERSION,
        nonce: data.nonce,
      };
      if (kind === "version") reply.version = 0;
      if (kind === "nonce") reply.nonce = "f".repeat(32);
      if (kind === "type") reply.type = "synthetic-other";
      if (kind === "extra") Object.assign(reply, { extra: true });
      ports[0].postMessage(kind === "null" ? null : reply);
    });
    await expect(
      createResearchBrowserFetch(f.workers, f.controller.signal, f.fetcher),
    ).rejects.toThrow(RESEARCH_BROWSER_WORKER_ERROR);
    expect(f.fetcher).not.toHaveBeenCalled();
    expect(
      channels.every((channel) => channel.port1.closed && channel.port2.closed),
    ).toBe(true);
  },
);
it("refuses a silent old worker within the original bound, without fetching or registering anything", async () => {
  vi.useFakeTimers();
  const f = fixture(() => {}),
    pending = createResearchBrowserFetch(
      f.workers,
      f.controller.signal,
      f.fetcher,
    ),
    rejected = expect(pending).rejects.toThrow(RESEARCH_BROWSER_WORKER_ERROR);
  await vi.advanceTimersByTimeAsync(RESEARCH_WORKER_CHECK_TIMEOUT_MS);
  await rejected;
  expect(f.fetcher).not.toHaveBeenCalled();
  expect(channels[0].port1.closed).toBe(true);
});
it("refuses changed controllers before and after compatibility, and aborts the actual request signal", async () => {
  const f = fixture(),
    ready = await createResearchBrowserFetch(
      f.workers,
      f.controller.signal,
      f.fetcher,
    );
  await ready("/chat/research/api", init());
  f.workers.controller = null as never;
  expect(() => ready("/chat/research/api", init())).toThrow(
    RESEARCH_BROWSER_WORKER_ERROR,
  );
  f.controller.abort();
  expect(f.fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(f.fetcher).toHaveBeenCalledOnce();
  const g = fixture(() => {
    g.workers.controller = null as never;
    channels.at(-1)!.port2.postMessage({
      type: RESEARCH_WORKER_REPLY,
      version: 1,
      nonce: "not-correct",
    });
  });
  await expect(
    createResearchBrowserFetch(g.workers, g.controller.signal, g.fetcher),
  ).rejects.toThrow(RESEARCH_BROWSER_WORKER_ERROR);
});
it.each(["abort", "script", "post-error", "getter"])(
  "refuses %s without private fetches or exposed diagnostics",
  async (kind) => {
    const f = fixture();
    if (kind === "abort") f.controller.abort();
    if (kind === "script")
      Object.assign(f.worker, { scriptURL: "https://other.example/sw.js" });
    if (kind === "post-error")
      vi.mocked(f.worker.postMessage).mockImplementation(() => {
        throw Error("synthetic private details");
      });
    if (kind === "getter")
      Object.defineProperty(f.workers, "controller", {
        get() {
          throw Error("synthetic private details");
        },
      });
    await expect(
      createResearchBrowserFetch(f.workers, f.controller.signal, f.fetcher),
    ).rejects.toThrow(RESEARCH_BROWSER_WORKER_ERROR);
    expect(f.fetcher).not.toHaveBeenCalled();
  },
);
it("cancels a pending probe and closes its ports on abort", async () => {
  const f = fixture(() => {}),
    pending = createResearchBrowserFetch(
      f.workers,
      f.controller.signal,
      f.fetcher,
    ),
    rejected = expect(pending).rejects.toThrow(RESEARCH_BROWSER_WORKER_ERROR);
  f.controller.abort();
  await rejected;
  expect(channels[0].port1.closed).toBe(true);
  expect(f.fetcher).not.toHaveBeenCalled();
});
it("refuses other routes and non-private transport options at dispatch", async () => {
  const f = fixture(),
    ready = await createResearchBrowserFetch(
      f.workers,
      f.controller.signal,
      f.fetcher,
    );
  for (const [path, options] of [
    ["/api/chat", init()],
    ["/chat/research/api", { ...init(), method: "GET" }],
    ["/chat/research/api", { ...init(), cache: "force-cache" }],
    ["/chat/research/api", undefined],
  ] as const)
    expect(() => ready(path, options as never)).toThrow(
      RESEARCH_BROWSER_WORKER_ERROR,
    );
  expect(f.fetcher).not.toHaveBeenCalled();
});
it("ignores non-probe worker messages and malformed nonces without taking another protocol's port", () => {
  for (const data of [
    null,
    "synthetic",
    {},
    { type: "SKIP_WAITING" },
    { type: RESEARCH_WORKER_PROBE, nonce: "a".repeat(32) + "\n" },
    { type: RESEARCH_WORKER_PROBE, nonce: "a".repeat(32), extra: true },
  ]) {
    const port = new Port();
    port.peer = new Port();
    replyToResearchWorkerProbe({ data, ports: [port as never] });
    expect(port.closed).toBe(false);
  }
});
