import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  fetchRitualAsset,
  fetchRitualCheck,
  resetRitualCheckSupportForTests,
} from "./ritualClientTransport";

const owner = "019947c5-abcd-7000-8000-000000000001";
const ritual = "019947c5-abcd-7000-8000-000000000002";
const bundle = "019947c5-abcd-7000-8000-000000000003";
const key = "019947c5-abcd-7000-8000-000000000004";
const bytes = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg">${" ".repeat(512)}</svg>`,
);
const digest = createHash("sha256").update(bytes).digest("hex");
const compressed = gzipSync(bytes);
let origin: string;
const server = createServer((_request, response) => {
  response.writeHead(200, {
    "cache-control": "private, no-store",
    "content-type": "image/svg+xml",
    "content-encoding": "gzip",
    "content-length": String(compressed.length),
    "x-content-sha256": digest,
  });
  response.end(compressed);
});

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test listener");
  origin = `http://127.0.0.1:${address.port}`;
  vi.stubGlobal("location", new URL(origin));
});

afterAll(async () => {
  vi.unstubAllGlobals();
  server.closeAllConnections();
  if (server.listening)
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

const asset = {
  key,
  reference: "/synthetic.svg",
  sha256: digest,
  mime: "image/svg+xml" as const,
  bytes: bytes.length,
  purpose: "read" as const,
};
const transport: typeof fetch = (input, init) =>
  fetch(new URL(String(input), origin), init);

it("verifies decoded asset bytes through a real compressed HTTP response", async () => {
  expect(compressed.length).not.toBe(bytes.length);
  const result = await fetchRitualAsset(
    owner,
    ritual,
    bundle,
    asset,
    new AbortController().signal,
    transport,
  );
  expect(result?.type).toBe("image/svg+xml");
  expect(Buffer.from(await result!.arrayBuffer())).toEqual(bytes);
});

it("rejects a compressed body that expands past its manifest byte bound", async () => {
  expect(
    await fetchRitualAsset(
      owner,
      ritual,
      bundle,
      { ...asset, bytes: bytes.length - 1 },
      new AbortController().signal,
      transport,
    ),
  ).toBeNull();
});

describe("fetchRitualCheck", () => {
  const ALIAS = "0123456789abcdef01234567";
  const LEASE = "019947c5-abcd-7000-8000-000000000005";
  const REQUEST_ID = "019947c5-abcd-7000-8000-000000000006";
  const request = {
    version: 1 as const,
    requestId: REQUEST_ID,
    expectedActorId: owner,
    ritualId: ritual,
  };
  const renderedJson = JSON.stringify({ type: "root", children: [] });
  const descriptor = {
    descriptorSha256: "a".repeat(64),
    contentSha256: createHash("sha256").update(renderedJson).digest("hex"),
    outputFormat: "json-rich-text" as const,
    outputFormatVersion: "1" as const,
  };
  const manifestJson = JSON.stringify({
    version: 1,
    bundleId: bundle,
    ritualId: ritual,
    descriptor,
    title: "Synthetic private ritual",
    renderedJson,
    assets: [],
    occurrences: [],
  });
  const manifestSha256 = createHash("sha256")
    .update(manifestJson)
    .digest("hex");
  const head = (requestId: string) => ({
    version: 1,
    requestId,
    ownerId: owner,
    ritualId: ritual,
  });
  const granted = (requestId: string) => ({
    ...head(requestId),
    kind: "granted",
    rendered: { kind: "available", descriptor },
    editor: null,
    grant: {
      version: 1,
      leaseId: LEASE,
      ownerId: owner,
      ritualId: ritual,
      checkedAtMs: 100,
      respondedAtMs: 200,
      expiresAtMs: 10_000,
      sourceEdit: false,
    },
  });
  const INVALID = '{"error":"invalid-request"}';

  type Reply = {
    status?: number;
    body?: string;
    headers?: Record<string, string>;
    url?: string;
    redirected?: boolean;
  };
  function respond(reply: Reply) {
    const body = reply.body ?? "";
    const response = new Response(body, {
      status: reply.status ?? 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": "application/json",
        ...reply.headers,
      },
    });
    Object.defineProperty(response, "url", {
      value: reply.url ?? `${origin}/api/rituals/permission`,
    });
    if (reply.redirected)
      Object.defineProperty(response, "redirected", { value: true });
    return response;
  }
  /** v2 bodies get `v2`, v1 bodies `v1`; every request is recorded. */
  function server(
    v2: (body: Record<string, unknown>) => Reply,
    v1: (body: Record<string, unknown>) => Reply = () => ({
      status: 400,
      body: INVALID,
    }),
  ) {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/rituals/permission");
      const body = JSON.parse(String(init?.body));
      return respond(body.version === 2 ? v2(body) : v1(body));
    });
  }
  const checkReply = (body: Record<string, unknown>, alias: string | null) => ({
    body: JSON.stringify({
      version: 2,
      requestId: body.requestId,
      ownerId: owner,
      ritualId: ritual,
      routeAlias: alias,
      permission: granted(String(body.requestId)),
      bundle: { bundleId: bundle, manifestSha256 },
    }),
  });
  const deliveryReply = (body: Record<string, unknown>) => ({
    body: JSON.stringify({
      ...head(String(body.requestId)),
      routeAlias: null,
      permission: granted(String(body.requestId)),
      bundle: { bundleId: bundle, manifestJson, manifestSha256 },
    }),
  });
  const deniedReply = (body: Record<string, unknown>) => ({
    body: JSON.stringify({
      ...head(String(body.requestId)),
      routeAlias: null,
      permission: { ...head(String(body.requestId)), kind: "denied" },
      bundle: null,
    }),
  });
  const sent = (fetcher: ReturnType<typeof server>) =>
    fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
  const signal = () => new AbortController().signal;
  const temporary = expect.objectContaining({
    permission: expect.objectContaining({ kind: "temporarily-unavailable" }),
    bundle: null,
  });

  afterEach(() => resetRitualCheckSupportForTests());

  it("sends the v1 request as version 2 and returns the identity alone", async () => {
    const fetcher = server((body) => checkReply(body, ALIAS));
    const result = await fetchRitualCheck(
      request,
      signal(),
      fetcher as typeof fetch,
      ALIAS,
    );
    expect(result).toEqual({
      routeAlias: ALIAS,
      permission: granted(REQUEST_ID),
      bundle: { bundleId: bundle, manifestSha256 },
    });
    expect(sent(fetcher)).toEqual([{ ...request, version: 2 }]);
    const init = fetcher.mock.calls[0][1];
    expect(init).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      cache: "no-store",
    });
    expect(new Headers(init?.headers).get("x-magickli-ritual-alias")).toBe(
      ALIAS,
    );
  });

  it("returns null for an unusable request without sending it", async () => {
    const fetcher = server((body) => checkReply(body, null));
    expect(
      await fetchRitualCheck(
        { ...request, requestId: "invalid" },
        signal(),
        fetcher as typeof fetch,
      ),
    ).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("falls back once to v1 on an exact 400 invalid-request and returns its verified delivery", async () => {
    const fetcher = server(
      () => ({ status: 400, body: INVALID }),
      deliveryReply,
    );
    const result = await fetchRitualCheck(
      request,
      signal(),
      fetcher as typeof fetch,
    );
    // `bundle` stays the identity alone; the delivery carries the manifest.
    expect(result).toEqual({
      routeAlias: null,
      permission: granted(REQUEST_ID),
      bundle: { bundleId: bundle, manifestSha256 },
      delivery: {
        routeAlias: null,
        permission: granted(REQUEST_ID),
        bundle: {
          bundleId: bundle,
          manifestJson,
          manifestSha256,
          manifest: expect.objectContaining({ bundleId: bundle, renderedJson }),
        },
      },
    });
    expect(sent(fetcher)).toEqual([{ ...request, version: 2 }, request]);
  });

  it("goes straight to v1 for the rest of the page once a v1 retry parsed", async () => {
    const fetcher = server(() => ({ status: 400, body: INVALID }), deniedReply);
    await expect(
      fetchRitualCheck(request, signal(), fetcher as typeof fetch),
    ).resolves.toMatchObject({ permission: { kind: "denied" } });
    expect(fetcher).toHaveBeenCalledTimes(2);

    const next = {
      ...request,
      requestId: "019947c5-abcd-7000-8000-000000000007",
    };
    await expect(
      fetchRitualCheck(next, signal(), fetcher as typeof fetch),
    ).resolves.toMatchObject({
      permission: { kind: "denied" },
      delivery: { permission: { kind: "denied" } },
    });
    expect(sent(fetcher).slice(2)).toEqual([next]);

    resetRitualCheckSupportForTests();
    await fetchRitualCheck(request, signal(), fetcher as typeof fetch);
    expect(sent(fetcher)[3]).toEqual({ ...request, version: 2 });
  });

  it.each([
    ["a 400", () => ({ status: 400, body: INVALID })],
    ["a 503", () => ({ status: 503, body: '{"error":"unavailable"}' })],
    [
      "a 200 with a temporary permission",
      (body: Record<string, unknown>) => ({
        body: JSON.stringify({
          ...head(String(body.requestId)),
          routeAlias: null,
          permission: {
            ...head(String(body.requestId)),
            kind: "temporarily-unavailable",
          },
          bundle: null,
        }),
      }),
    ],
  ])("leaves the flag clear when the v1 retry gets %s", async (_name, v1) => {
    const fetcher = server(() => ({ status: 400, body: INVALID }), v1);
    await expect(
      fetchRitualCheck(request, signal(), fetcher as typeof fetch, ALIAS),
    ).resolves.toEqual(temporary);
    expect(sent(fetcher)).toEqual([{ ...request, version: 2 }, request]);
    // The retry used the same alias.
    expect(
      new Headers(fetcher.mock.calls[1][1]?.headers).get(
        "x-magickli-ritual-alias",
      ),
    ).toBe(ALIAS);

    await fetchRitualCheck(request, signal(), fetcher as typeof fetch);
    expect(sent(fetcher)[2]).toEqual({ ...request, version: 2 });
  });

  it.each([
    ["redirected", { redirected: true }],
    ["cached", { headers: { "Cache-Control": "private, max-age=60" } }],
    [
      "cross-origin",
      { url: "https://elsewhere.example/api/rituals/permission" },
    ],
    ["on another path", { url: `${origin}/api/rituals/permission/` }],
    ["with a query", { url: `${origin}/api/rituals/permission?x=1` }],
    ["not JSON", { headers: { "Content-Type": "text/plain" } }],
  ] as const)(
    "does not fall back on a matching 400 that is %s",
    async (_name, reply) => {
      const fetcher = server(() => ({ status: 400, body: INVALID, ...reply }));
      await expect(
        fetchRitualCheck(request, signal(), fetcher as typeof fetch),
      ).resolves.toEqual(temporary);
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["another error", '{"error":"forbidden"}'],
    ["spaced JSON", '{ "error": "invalid-request" }'],
    ["an empty body", ""],
  ])("does not fall back on a 400 with %s", async (_name, body) => {
    const fetcher = server(() => ({ status: 400, body }));
    await expect(
      fetchRitualCheck(request, signal(), fetcher as typeof fetch),
    ).resolves.toEqual(temporary);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([404, 405, 503])(
    "does not fall back on %i, even with the matching body",
    async (status) => {
      const fetcher = server(() => ({ status, body: INVALID }));
      await expect(
        fetchRitualCheck(request, signal(), fetcher as typeof fetch),
      ).resolves.toEqual(temporary);
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it("does not fall back on a network error", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      fetchRitualCheck(request, signal(), fetcher as typeof fetch),
    ).resolves.toEqual(temporary);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not fall back on an abort, before or after the reply", async () => {
    const controller = new AbortController();
    const aborting = vi.fn(async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    await expect(
      fetchRitualCheck(request, controller.signal, aborting as typeof fetch),
    ).resolves.toEqual(temporary);
    expect(aborting).toHaveBeenCalledOnce();

    const late = new AbortController();
    const fetcher = server(() => {
      late.abort();
      return { status: 400, body: INVALID };
    }, deliveryReply);
    await expect(
      fetchRitualCheck(request, late.signal, fetcher as typeof fetch),
    ).resolves.toEqual(temporary);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("reads a reply up to 64 KiB and no further", async () => {
    const limit = 64 * 1024;
    const padded = (body: Record<string, unknown>, bytes: number) => {
      const text = checkReply(body, null).body;
      return { body: text + " ".repeat(bytes - text.length) };
    };
    const exact = server((body) => padded(body, limit));
    await expect(
      fetchRitualCheck(request, signal(), exact as typeof fetch),
    ).resolves.toMatchObject({ bundle: { bundleId: bundle } });

    const over = server((body) => padded(body, limit + 1));
    await expect(
      fetchRitualCheck(request, signal(), over as typeof fetch),
    ).resolves.toEqual(temporary);

    const declared = server((body) => ({
      ...checkReply(body, null),
      headers: { "Content-Length": String(limit + 1) },
    }));
    await expect(
      fetchRitualCheck(request, signal(), declared as typeof fetch),
    ).resolves.toEqual(temporary);

    // A matching 400 past the bound triggers nothing either.
    const big400 = server(() => ({
      status: 400,
      body: INVALID + " ".repeat(limit),
    }));
    await expect(
      fetchRitualCheck(request, signal(), big400 as typeof fetch),
    ).resolves.toEqual(temporary);
    expect(big400).toHaveBeenCalledOnce();
  });

  it("treats a v1 envelope answering a v2 request as temporary", async () => {
    const fetcher = server(deliveryReply);
    await expect(
      fetchRitualCheck(request, signal(), fetcher as typeof fetch),
    ).resolves.toEqual(temporary);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
