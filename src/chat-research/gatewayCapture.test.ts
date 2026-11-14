import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUuidV7 } from "../lib/ids";
import {
  createResearchGatewayCapture,
  inspectResearchGatewayCapture,
  RESEARCH_GATEWAY_CAPTURE_ERROR,
  RESEARCH_GATEWAY_ENDPOINT,
  RESEARCH_GATEWAY_MAX_CHUNKS,
  RESEARCH_GATEWAY_TIMEOUT_MS,
  type ResearchGatewayHandoff,
} from "./gatewayCapture";
import {
  parseResearchGatewayEnvelope,
  RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT,
} from "./gatewayResponse";
import { gatewayResponseFixture } from "./gatewayResponse.fixture";
import {
  inspectResearchRequestArtifact,
  prepareResearchRequestArtifact,
} from "./requestArtifact";
import { artifactRequestFixture } from "./requestArtifact.fixture";
import type { ResearchDispatchClaim } from "./sqlAdmission";

vi.mock("server-only", () => ({}));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const KEY = "synthetic-capture-api-key-0123456789";
const active = () => new AbortController().signal;
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const body = () => Buffer.from(JSON.stringify(gatewayResponseFixture()));
const reply = (
  data: BodyInit = body(),
  status = 200,
  type = "application/json",
) => new Response(data, { status, headers: { "content-type": type } });
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function fixture() {
  const f = artifactRequestFixture(Date.now() + 600000),
    artifact = prepareResearchRequestArtifact(
      f.request,
      createUuidV7(),
      createUuidV7(),
    ),
    claim: ResearchDispatchClaim = Object.freeze({
      kind: "private_research_dispatch_claim",
    }),
    original = new AbortController(),
    events: string[] = [];
  let consumed = false;
  const handoff: ResearchGatewayHandoff = {
    consumeRequestDispatchClaim: vi.fn((c, a, signal) => {
      events.push("handoff");
      if (
        c !== claim ||
        a !== artifact ||
        consumed ||
        original.signal.aborted ||
        signal.aborted
      )
        throw Error("Synthetic denied marker");
      consumed = true;
      return AbortSignal.any([original.signal, signal]);
    }),
  };
  const beforeDispatch = vi.fn(async () => {
    events.push("fence");
  });
  const requestFetch = vi.fn<typeof fetch>(async () => {
    events.push("fetch");
    return reply();
  });
  const config = { apiKey: KEY, handoff, beforeDispatch, requestFetch };
  const send = createResearchGatewayCapture(config),
    inspect = (capture: Awaited<ReturnType<typeof send>>) =>
      inspectResearchGatewayCapture(capture, artifact, claim);
  return {
    ...f,
    artifact,
    claim,
    original,
    events,
    handoff,
    beforeDispatch,
    requestFetch,
    config,
    send,
    inspect,
  };
}

describe("inactive single-attempt HTTP capture", () => {
  it("constructs inertly and sends only frozen bytes to the literal Gateway after the final fence and synchronous handoff", async () => {
    const f = fixture();
    expect(f.requestFetch).not.toHaveBeenCalled();
    expect(f.beforeDispatch).not.toHaveBeenCalled();
    const capture = await f.send(f.artifact, f.claim, active()),
      out = f.inspect(capture),
      request = inspectResearchRequestArtifact(f.artifact);
    expect(f.events).toEqual(["fence", "handoff", "fetch"]);
    expect(f.requestFetch).toHaveBeenCalledWith(
      RESEARCH_GATEWAY_ENDPOINT,
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        body: request.packet.body_json,
        headers: {
          authorization: `Bearer ${KEY}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(out.metadata).toMatchObject({
      attempted: true,
      http_status: 200,
      media_type: "application/json",
      complete: true,
      failure: null,
      captured_bytes: body().length,
      captured_sha256: sha(body()),
      request_artifact_sha256: f.artifact.revision,
    });
    expect(Buffer.from(out.raw).equals(body())).toBe(true);
    expect(parseResearchGatewayEnvelope(out.raw).model).toBe(
      "openai/gpt-6.1-sol",
    );
    expect(Object.isFrozen(capture)).toBe(true);
  });
  it("owns stored chunks and inspection copies; copied/cross-object handles cannot read a capture", async () => {
    const f = fixture(),
      capture = await f.send(f.artifact, f.claim, active()),
      a = f.inspect(capture);
    a.raw.fill(0);
    a.metadata.attempted = false;
    expect(f.inspect(capture).metadata.attempted).toBe(true);
    expect(Buffer.from(f.inspect(capture).raw).equals(body())).toBe(true);
    expect(() => f.inspect({ revision: capture.revision })).toThrow(
      RESEARCH_GATEWAY_CAPTURE_ERROR,
    );
    expect(() =>
      inspectResearchGatewayCapture(capture, f.artifact, {
        kind: "private_research_dispatch_claim",
      }),
    ).toThrow(RESEARCH_GATEWAY_CAPTURE_ERROR);
    const p = inspectResearchRequestArtifact(f.artifact).packet,
      equal = prepareResearchRequestArtifact(
        f.request,
        p.window_id,
        p.operation_id,
      );
    expect(() =>
      inspectResearchGatewayCapture(capture, equal, f.claim),
    ).toThrow(RESEARCH_GATEWAY_CAPTURE_ERROR);
  });
  it("never retries the same claim across factories, including when preflight fails before any handoff", async () => {
    const f = fixture();
    f.beforeDispatch.mockRejectedValueOnce(Error(KEY));
    const first = await f.send(f.artifact, f.claim, active());
    expect(f.inspect(first).metadata).toMatchObject({
      attempted: false,
      failure: "preflight",
      complete: false,
      captured_bytes: 0,
    });
    expect(f.handoff.consumeRequestDispatchClaim).not.toHaveBeenCalled();
    expect(f.requestFetch).not.toHaveBeenCalled();
    await expect(
      createResearchGatewayCapture(f.config)(f.artifact, f.claim, active()),
    ).rejects.toThrow(RESEARCH_GATEWAY_CAPTURE_ERROR);
    expect(f.beforeDispatch).toHaveBeenCalledTimes(1);
  });
  it("copies trusted startup functions and credential rather than following later configuration mutations", async () => {
    const f = fixture(),
      originalFetch = f.config.requestFetch;
    f.config.apiKey = "other-synthetic-key-not-used";
    f.config.requestFetch = vi.fn(async () => {
      throw Error("Should not run");
    });
    f.handoff.consumeRequestDispatchClaim = () => {
      throw Error("Should not run");
    };
    f.config.beforeDispatch = vi.fn(async () => {
      throw Error("Should not run");
    });
    expect(
      f.inspect(await f.send(f.artifact, f.claim, active())).metadata.failure,
    ).toBeNull();
    expect(originalFetch).toHaveBeenCalledTimes(1);
    expect(f.config.requestFetch).not.toHaveBeenCalled();
  });
  it("rejects invalid startup credentials/ports and forged request artifacts without fetch", async () => {
    const f = fixture();
    for (const apiKey of [
      "",
      "short",
      KEY + "\n",
      " " + KEY,
      "é".repeat(32),
      "x".repeat(2049),
    ])
      expect(() =>
        createResearchGatewayCapture({ ...f.config, apiKey }),
      ).toThrow(RESEARCH_GATEWAY_CAPTURE_ERROR);
    for (const delta of [
      { beforeDispatch: null },
      { handoff: null },
      { requestFetch: null },
    ])
      expect(() =>
        createResearchGatewayCapture({ ...f.config, ...delta } as never),
      ).toThrow(RESEARCH_GATEWAY_CAPTURE_ERROR);
    await expect(
      f.send({ revision: f.artifact.revision }, f.claim, active()),
    ).rejects.toThrow();
    await expect(f.send(f.artifact, null as never, active())).rejects.toThrow(
      RESEARCH_GATEWAY_CAPTURE_ERROR,
    );
    expect(f.requestFetch).not.toHaveBeenCalled();
  });
  it("cancels before and during preflight without handoff/fetch, retaining no exception text", async () => {
    for (const preabort of [true, false]) {
      const f = fixture(),
        controller = new AbortController();
      f.beforeDispatch.mockImplementation(() => new Promise(() => {}));
      if (preabort) controller.abort(KEY);
      const pending = f.send(f.artifact, f.claim, controller.signal);
      if (!preabort) controller.abort(KEY);
      const out = f.inspect(await pending);
      expect(out.metadata).toMatchObject({
        attempted: false,
        failure: "cancelled",
        captured_bytes: 0,
      });
      expect(JSON.stringify(out.metadata)).not.toContain(KEY);
      expect(f.requestFetch).not.toHaveBeenCalled();
    }
  });
  it("does not fetch after a late final fence even when timer callbacks have not run", async () => {
    const f = fixture(),
      real = performance.now.bind(performance);
    let advance = 0;
    vi.spyOn(performance, "now").mockImplementation(() => real() + advance);
    f.beforeDispatch.mockImplementation(async () => {
      advance = RESEARCH_GATEWAY_TIMEOUT_MS + 1;
    });
    const out = f.inspect(await f.send(f.artifact, f.claim, active()));
    expect(out.metadata).toMatchObject({
      attempted: false,
      failure: "deadline",
    });
    expect(f.handoff.consumeRequestDispatchClaim).not.toHaveBeenCalled();
    expect(f.requestFetch).not.toHaveBeenCalled();
  });
  it("rejects an accidentally async handoff without fetch or unhandled rejection", async () => {
    const f = fixture();
    const bad: ResearchGatewayHandoff = {
      // @ts-expect-error an async handoff cannot supply a synchronous cancellation signal
      consumeRequestDispatchClaim: async () => {
        throw Error(KEY);
      },
    };
    const out = f.inspect(
      await createResearchGatewayCapture({ ...f.config, handoff: bad })(
        f.artifact,
        f.claim,
        active(),
      ),
    );
    expect(out.metadata).toMatchObject({
      attempted: false,
      failure: "handoff",
    });
    expect(f.requestFetch).not.toHaveBeenCalled();
  });
  it("preserves original-job cancellation through fetch despite an additional caller signal", async () => {
    const f = fixture();
    f.requestFetch.mockImplementation(async (_url, init) => {
      expect(init!.signal!.aborted).toBe(false);
      f.original.abort(KEY);
      expect(init!.signal!.aborted).toBe(true);
      throw Error(KEY);
    });
    const out = f.inspect(await f.send(f.artifact, f.claim, active()));
    expect(out.metadata).toMatchObject({
      attempted: true,
      failure: "cancelled",
      captured_bytes: 0,
    });
    expect(JSON.stringify(out.metadata)).not.toContain(KEY);
    expect(f.requestFetch).toHaveBeenCalledTimes(1);
  });
  it("records request failure without retry and without copying a thrown error", async () => {
    const f = fixture();
    f.requestFetch.mockRejectedValueOnce(Error(KEY));
    const out = f.inspect(await f.send(f.artifact, f.claim, active()));
    expect(out.metadata).toMatchObject({
      attempted: true,
      http_status: null,
      failure: "request",
      complete: false,
    });
    expect(JSON.stringify(out.metadata)).not.toContain(KEY);
    expect(f.requestFetch).toHaveBeenCalledTimes(1);
  });
});

describe("bounded raw response capture", () => {
  it.each([
    [401, "application/json", "http"],
    [200, "text/html", "media_type"],
    [201, "application/json", "http"],
  ] as const)(
    "retains a bounded %s/%s failure as private diagnostics only",
    async (status, type, failure) => {
      const f = fixture();
      f.requestFetch.mockResolvedValueOnce(reply(body(), status, type));
      const out = f.inspect(await f.send(f.artifact, f.claim, active()));
      expect(out.metadata).toMatchObject({
        attempted: true,
        http_status: status,
        failure,
        complete: true,
      });
      expect(out.raw.length).toBe(body().length);
    },
  );
  it("accepts JSON media parameters without retaining raw headers", async () => {
    const f = fixture();
    const response = reply(body(), 200, "Application/JSON; charset=UTF-8");
    response.headers.set("x-private-credential", KEY);
    f.requestFetch.mockResolvedValueOnce(response);
    const out = f.inspect(await f.send(f.artifact, f.claim, active()));
    expect(out.metadata.failure).toBeNull();
    expect(JSON.stringify(out.metadata)).not.toContain(KEY);
    expect(out.metadata).not.toHaveProperty("headers");
  });
  it.each(["url", "redirected"] as const)(
    "rejects unexpected %s without reading a redirected body",
    async (field) => {
      const f = fixture(),
        cancel = vi.fn(),
        response = reply(new ReadableStream({ cancel }));
      Object.defineProperty(response, field, {
        value: field === "url" ? "https://synthetic.invalid/" : true,
      });
      f.requestFetch.mockResolvedValueOnce(response);
      const out = f.inspect(await f.send(f.artifact, f.claim, active()));
      expect(out.metadata).toMatchObject({
        failure: "http",
        complete: false,
        captured_bytes: 0,
      });
      expect(cancel).toHaveBeenCalledTimes(1);
    },
  );
  it("handles an empty body and never cancels a reader owned by someone else", async () => {
    const f = fixture();
    f.requestFetch.mockResolvedValueOnce(reply(null as never));
    expect(
      f.inspect(await f.send(f.artifact, f.claim, active())).metadata.failure,
    ).toBe("body_unavailable");
    const other = fixture(),
      cancel = vi.fn(),
      stream = new ReadableStream({ cancel }),
      response = reply(stream),
      borrowed = response.body!.getReader();
    other.requestFetch.mockResolvedValueOnce(response);
    expect(
      other.inspect(await other.send(other.artifact, other.claim, active()))
        .metadata.failure,
    ).toBe("body_unavailable");
    expect(cancel).not.toHaveBeenCalled();
    await borrowed.cancel();
    borrowed.releaseLock();
  });
  it("does not adopt a disturbed response body", async () => {
    const f = fixture(),
      response = reply();
    await response.arrayBuffer();
    f.requestFetch.mockResolvedValueOnce(response);
    expect(
      f.inspect(await f.send(f.artifact, f.claim, active())).metadata.failure,
    ).toBe("body_unavailable");
  });
  it("copies each chunk immediately instead of retaining a mutable stream buffer", async () => {
    const f = fixture(),
      full = body(),
      first = Buffer.from(full.subarray(0, 16)),
      secondRead = deferred<void>();
    let controller!: ReadableStreamDefaultController<Uint8Array>,
      pulls = 0;
    const stream = new ReadableStream<Uint8Array>(
      {
        start(c) {
          controller = c;
        },
        pull(c) {
          if (++pulls === 1) c.enqueue(first);
          else secondRead.resolve();
        },
      },
      { highWaterMark: 0 },
    );
    f.requestFetch.mockResolvedValueOnce(reply(stream));
    const pending = f.send(f.artifact, f.claim, active());
    await secondRead.promise;
    first.fill(0);
    controller.enqueue(full.subarray(16));
    controller.close();
    const out = f.inspect(await pending);
    expect(Buffer.from(out.raw).equals(full)).toBe(true);
    expect(out.metadata.captured_sha256).toBe(sha(full));
  });
  it("uses actual bytes rather than Content-Length and never treats a valid captured prefix as clean EOF", async () => {
    const full = Buffer.concat([
        body(),
        Buffer.alloc(RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT - body().length, 32),
      ]),
      f = fixture(),
      response = reply(full);
    response.headers.set("content-length", "1");
    f.requestFetch.mockResolvedValueOnce(response);
    const exact = f.inspect(await f.send(f.artifact, f.claim, active()));
    expect(exact.metadata).toMatchObject({
      complete: true,
      failure: null,
      captured_bytes: RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT,
    });
    const other = fixture();
    other.requestFetch.mockResolvedValueOnce(
      reply(Buffer.concat([full, Buffer.from("x")])),
    );
    const overflow = other.inspect(
      await other.send(other.artifact, other.claim, active()),
    );
    expect(overflow.metadata).toMatchObject({
      complete: false,
      failure: "too_large",
      captured_bytes: RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT,
    });
    // This prefix is syntactically valid, showing why candidate JSON alone never establishes completed HTTP.
    expect(parseResearchGatewayEnvelope(overflow.raw).provider).toBe("openai");
  });
  it("retains bounded partial bytes on a read error and rejects non-byte chunks", async () => {
    const f = fixture();
    let reads = 0;
    f.requestFetch.mockResolvedValueOnce(
      reply(
        new ReadableStream(
          {
            pull(c) {
              if (++reads === 1) c.enqueue(Buffer.from("prefix"));
              else c.error(Error(KEY));
            },
          },
          { highWaterMark: 0 },
        ),
      ),
    );
    const out = f.inspect(await f.send(f.artifact, f.claim, active()));
    expect(out.metadata).toMatchObject({
      failure: "read",
      complete: false,
      captured_bytes: 6,
    });
    expect(Buffer.from(out.raw).toString()).toBe("prefix");
    const other = fixture();
    other.requestFetch.mockResolvedValueOnce(
      reply(
        new ReadableStream({
          start(c) {
            c.enqueue("not bytes");
            c.close();
          },
        }),
      ),
    );
    expect(
      other.inspect(await other.send(other.artifact, other.claim, active()))
        .metadata.failure,
    ).toBe("read");
  });
  it("bounds read work even when a peer emits only zero-byte chunks", async () => {
    const f = fixture();
    let pulls = 0;
    f.requestFetch.mockResolvedValueOnce(
      reply(
        new ReadableStream(
          {
            pull(c) {
              pulls++;
              c.enqueue(Buffer.alloc(0));
            },
          },
          { highWaterMark: 0 },
        ),
      ),
    );
    const out = f.inspect(await f.send(f.artifact, f.claim, active()));
    expect(out.metadata).toMatchObject({
      failure: "read",
      complete: false,
      captured_bytes: 0,
    });
    expect(pulls).toBe(RESEARCH_GATEWAY_MAX_CHUNKS + 1);
  });
  it("drops known credential echoes across multiple chunks and across the raw byte limit", async () => {
    for (const chunks of [
      [
        Buffer.from("prefix:" + KEY.slice(0, 5)),
        Buffer.from(KEY.slice(5, 10)),
        Buffer.from(KEY.slice(10)),
      ],
      [
        Buffer.alloc(RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT - 5, 32),
        Buffer.from(KEY),
      ],
    ]) {
      const f = fixture();
      f.requestFetch.mockResolvedValueOnce(
        reply(
          new ReadableStream({
            start(c) {
              for (const chunk of chunks) c.enqueue(chunk);
              c.close();
            },
          }),
        ),
      );
      const out = f.inspect(await f.send(f.artifact, f.claim, active()));
      expect(out.metadata).toMatchObject({
        failure: "credential_echo",
        complete: false,
        captured_bytes: 0,
        captured_sha256: sha(Buffer.alloc(0)),
      });
      expect(out.raw.length).toBe(0);
      expect(JSON.stringify(out.metadata)).not.toContain(KEY);
    }
  });
});

describe("fixed deadline and noncooperative I/O", () => {
  it("bounds a hung final fence without consuming a handoff", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.beforeDispatch.mockImplementation(() => new Promise(() => {}));
    const pending = f.send(f.artifact, f.claim, active());
    await vi.advanceTimersByTimeAsync(RESEARCH_GATEWAY_TIMEOUT_MS + 1);
    const out = f.inspect(await pending);
    expect(out.metadata).toMatchObject({
      attempted: false,
      failure: "deadline",
    });
    expect(f.requestFetch).not.toHaveBeenCalled();
    expect(f.handoff.consumeRequestDispatchClaim).not.toHaveBeenCalled();
  });
  it("bounds a hung fetch, discards a late response, and never mutates the sealed failed capture", async () => {
    vi.useFakeTimers();
    const f = fixture(),
      late = deferred<Response>(),
      cancel = vi.fn();
    f.requestFetch.mockReturnValueOnce(late.promise);
    const pending = f.send(f.artifact, f.claim, active());
    await vi.advanceTimersByTimeAsync(0);
    expect(f.requestFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(RESEARCH_GATEWAY_TIMEOUT_MS + 1);
    const capture = await pending,
      before = f.inspect(capture);
    expect(before.metadata).toMatchObject({
      attempted: true,
      failure: "deadline",
      captured_bytes: 0,
    });
    late.resolve(reply(new ReadableStream({ cancel })));
    await vi.advanceTimersByTimeAsync(0);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(f.inspect(capture)).toEqual(before);
  });
  it("bounds a hung reader without awaiting noncooperative cancellation", async () => {
    vi.useFakeTimers();
    const f = fixture(),
      cancel = vi.fn(() => new Promise<void>(() => {}));
    f.requestFetch.mockResolvedValueOnce(reply(new ReadableStream({ cancel })));
    const pending = f.send(f.artifact, f.claim, active());
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(RESEARCH_GATEWAY_TIMEOUT_MS + 1);
    expect(f.inspect(await pending).metadata).toMatchObject({
      attempted: true,
      failure: "deadline",
      complete: false,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("keeps its own deadline even if a miswired handoff returns an unrelated live signal", async () => {
    vi.useFakeTimers();
    const f = fixture(),
      handoff: ResearchGatewayHandoff = {
        consumeRequestDispatchClaim: () => active(),
      };
    f.requestFetch.mockImplementation(() => new Promise(() => {}));
    const pending = createResearchGatewayCapture({ ...f.config, handoff })(
      f.artifact,
      f.claim,
      active(),
    );
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(RESEARCH_GATEWAY_TIMEOUT_MS + 1);
    expect(f.inspect(await pending).metadata.failure).toBe("deadline");
  });
});

it("uses the captured global fetch only when the trusted override is absent", async () => {
  const f = fixture();
  vi.stubGlobal("fetch", f.requestFetch);
  const send = createResearchGatewayCapture({
    ...f.config,
    requestFetch: undefined,
  });
  expect(
    f.inspect(await send(f.artifact, f.claim, active())).metadata.failure,
  ).toBeNull();
  expect(f.requestFetch).toHaveBeenCalledTimes(1);
});

it("drops naturally JSON-escaped credentials and Unicode-escaped echoes split across chunks", async () => {
  const quoted = 'synthetic-quoted-key-"-\\-0123456789',
    encoded = Array.from(
      KEY,
      (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
    ).join("");
  for (const [apiKey, text] of [
    [quoted, JSON.stringify({ error: quoted })],
    [KEY, '{"error":"' + encoded + '"}'],
  ]) {
    const f = fixture(),
      data = Buffer.from(text),
      parts = Array.from({ length: Math.ceil(data.length / 3) }, (_, i) =>
        data.subarray(i * 3, i * 3 + 3),
      );
    f.requestFetch.mockResolvedValueOnce(
      reply(
        new ReadableStream({
          start(c) {
            for (const part of parts) c.enqueue(part);
            c.close();
          },
        }),
        401,
      ),
    );
    const send = createResearchGatewayCapture({ ...f.config, apiKey }),
      out = f.inspect(await send(f.artifact, f.claim, active()));
    expect(out.metadata).toMatchObject({
      failure: "credential_echo",
      complete: false,
      captured_bytes: 0,
    });
    expect(out.raw.length).toBe(0);
  }
});
it("ignores rejected late-body cancellation without changing the sealed timeout result", async () => {
  vi.useFakeTimers();
  const f = fixture(),
    late = deferred<Response>(),
    cancel = vi.fn(async () => {
      throw Error(KEY);
    });
  f.requestFetch.mockReturnValueOnce(late.promise);
  const pending = f.send(f.artifact, f.claim, active());
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(RESEARCH_GATEWAY_TIMEOUT_MS + 1);
  const capture = await pending;
  late.resolve(reply(new ReadableStream({ cancel })));
  await vi.advanceTimersByTimeAsync(0);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(f.inspect(capture).metadata).toMatchObject({
    failure: "deadline",
    captured_bytes: 0,
  });
});
it("resynchronizes after malformed Unicode escapes before a later encoded credential", async () => {
  const f = fixture(),
    encoded = Array.from(
      KEY,
      (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
    ).join(""),
    data = Buffer.from("invalid:\\u12Z0\\u00" + encoded);
  f.requestFetch.mockResolvedValueOnce(reply(data, 401));
  const out = f.inspect(await f.send(f.artifact, f.claim, active()));
  expect(out.metadata).toMatchObject({
    failure: "credential_echo",
    captured_bytes: 0,
  });
});
it("does not join credential fragments across escaped control characters or confuse overlapping near matches", async () => {
  const f = fixture(),
    text = JSON.stringify({
      error: KEY.slice(0, 10) + "\b\f\n\r\t" + KEY.slice(10),
    });
  f.requestFetch.mockResolvedValueOnce(reply(text, 401));
  expect(
    f.inspect(await f.send(f.artifact, f.claim, active())).metadata.failure,
  ).toBe("http");
  const other = fixture(),
    apiKey = "ababababababababX",
    near = JSON.stringify({ error: "ababababababababY" });
  other.requestFetch.mockResolvedValueOnce(reply(near, 401));
  const out = other.inspect(
    await createResearchGatewayCapture({ ...other.config, apiKey })(
      other.artifact,
      other.claim,
      active(),
    ),
  );
  expect(out.metadata.failure).toBe("http");
  expect(Buffer.from(out.raw).toString()).toBe(near);
});

it("drops a known credential completed in the chunk that crosses the read-work limit", async () => {
  const f = fixture();
  let pull = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        pull++;
        if (pull < RESEARCH_GATEWAY_MAX_CHUNKS) c.enqueue(Buffer.alloc(0));
        else if (pull === RESEARCH_GATEWAY_MAX_CHUNKS)
          c.enqueue(Buffer.from(KEY.slice(0, -4)));
        else {
          c.enqueue(Buffer.from(KEY.slice(-4)));
          c.close();
        }
      },
    },
    { highWaterMark: 0 },
  );
  f.requestFetch.mockResolvedValueOnce(reply(stream));
  const out = f.inspect(await f.send(f.artifact, f.claim, active()));
  expect(pull).toBe(RESEARCH_GATEWAY_MAX_CHUNKS + 1);
  expect(out.metadata).toMatchObject({
    failure: "credential_echo",
    complete: false,
    captured_bytes: 0,
  });
  expect(out.raw.length).toBe(0);
});

it("runs optional synchronous readiness on the same stack immediately before the single handoff", async () => {
  const f = fixture(),
    ready = vi.fn(() => {
      f.events.push("ready");
      return undefined;
    });
  const send = createResearchGatewayCapture({
    ...f.config,
    beforeHandoff: ready,
  });
  const result = await send(f.artifact, f.claim, new AbortController().signal);
  expect(f.inspect(result).metadata.complete).toBe(true);
  expect(f.events).toEqual(["fence", "ready", "handoff", "fetch"]);
  expect(ready).toHaveBeenCalledOnce();
});
it("refuses malformed or asynchronous final readiness without consuming or sending", async () => {
  const malformed = fixture();
  expect(() =>
    createResearchGatewayCapture({
      ...malformed.config,
      beforeHandoff: null as never,
    }),
  ).toThrow();
  const f = fixture(),
    ready = (async () => {
      throw Error("Synthetic asynchronous lease failure");
    }) as never;
  const result = await createResearchGatewayCapture({
    ...f.config,
    beforeHandoff: ready,
  })(f.artifact, f.claim, new AbortController().signal);
  expect(f.inspect(result).metadata).toMatchObject({
    attempted: false,
    failure: "preflight",
  });
  expect(f.handoff.consumeRequestDispatchClaim).not.toHaveBeenCalled();
  expect(f.requestFetch).not.toHaveBeenCalled();
});

describe("last synchronous source freshness after claim handoff", () => {
  it("checks after the claim callback and rejects expired freshness without a fetch", async () => {
    const f = fixture(),
      beforeRequest = vi.fn(() => {
        f.events.push("freshness");
        throw Error("Synthetic source expiry");
      }),
      send = createResearchGatewayCapture({
        ...f.config,
        beforeHandoff: () => {
          f.events.push("ready");
          return undefined;
        },
        beforeRequest,
      });
    const result = await send(f.artifact, f.claim, active());
    expect(f.events).toEqual(["fence", "ready", "handoff", "freshness"]);
    expect(f.requestFetch).not.toHaveBeenCalled();
    expect(f.inspect(result).metadata).toMatchObject({
      attempted: false,
      failure: "handoff",
    });
  });
  it("refuses an accidentally async freshness result after consuming the real claim", async () => {
    const f = fixture(),
      send = createResearchGatewayCapture({
        ...f.config,
        beforeRequest: (() =>
          Promise.reject(Error("Synthetic private detail"))) as never,
      });
    const result = await send(f.artifact, f.claim, active());
    expect(f.requestFetch).not.toHaveBeenCalled();
    expect(f.handoff.consumeRequestDispatchClaim).toHaveBeenCalledOnce();
    expect(f.inspect(result).metadata.attempted).toBe(false);
  });
  it("requires a function when a final freshness hook is configured", () => {
    const f = fixture();
    expect(() =>
      createResearchGatewayCapture({
        ...f.config,
        beforeRequest: null as never,
      }),
    ).toThrow(RESEARCH_GATEWAY_CAPTURE_ERROR);
  });
});
