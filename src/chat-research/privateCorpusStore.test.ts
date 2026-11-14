import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createResearchPrivateCorpusStore,
  prepareResearchPrivateCorpusStore,
  type ResearchPrivateCorpusStore,
} from "./privateCorpusStore";

const fake = vi.hoisted(() => ({
  send: vi.fn(),
  destroy: vi.fn(),
  constructors: [] as Record<string, unknown>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor(config: Record<string, unknown>) {
      fake.constructors.push(config);
    }
    send = fake.send;
    destroy = fake.destroy;
  },
  GetObjectCommand: class {
    constructor(readonly input: unknown) {}
  },
}));
const descriptor: ResearchPrivateCorpusStore = {
    kind: "r2-private-immutable-research-corpus",
    account_id: "a".repeat(32),
    bucket: "synthetic-private-corpus",
    jurisdiction: "default",
    corpus_manifest_sha256: "b".repeat(64),
    custody_contract:
      "outer-controlled-private-bucket-no-public-access-or-files-route",
    credential_contract: "outer-controlled-read-only-token-for-this-bucket",
  },
  credentials = {
    accessKeyId: "synthetic-only-id",
    secretAccessKey: "synthetic-only-secret",
  },
  signal = () => new AbortController().signal;
beforeEach(() => {
  fake.send.mockReset();
  fake.destroy.mockReset();
  fake.constructors.length = 0;
});
afterEach(() => vi.restoreAllMocks());
function response(bytes = 2) {
  const cancel = vi.fn(),
    body = new ReadableStream<Uint8Array>({ cancel });
  return {
    cancel,
    body,
    value: {
      Body: body,
      ContentLength: bytes,
      $metadata: { httpStatusCode: 200 },
    },
  };
}
it("owns descriptor/credentials and makes only fixed content-addressed Get calls with one attempt", async () => {
  const mutable = { ...descriptor },
    keys = { ...credentials },
    store = createResearchPrivateCorpusStore({
      descriptor: mutable,
      credentials: keys,
    }),
    f = response();
  mutable.bucket = "changed";
  keys.secretAccessKey = "changed";
  fake.send.mockResolvedValue(f.value);
  expect(fake.send).not.toHaveBeenCalled();
  const abort = signal(),
    object = await store.readObject("manifest.json", abort);
  expect(object).toEqual({ body: f.body, bytes: 2 });
  expect(Object.isFrozen(object)).toBe(true);
  expect(fake.send.mock.calls[0][0].input).toEqual({
    Bucket: descriptor.bucket,
    Key: `private-research/v1/corpora/${descriptor.corpus_manifest_sha256}/manifest.json`,
  });
  expect(fake.send.mock.calls[0][1]).toEqual({ abortSignal: abort });
  expect(fake.constructors[0]).toMatchObject({
    endpoint: `https://${descriptor.account_id}.r2.cloudflarestorage.com`,
    credentials,
    region: "auto",
    maxAttempts: 1,
    followRegionRedirects: false,
  });
  store.destroy();
  store.destroy();
  expect(fake.destroy).toHaveBeenCalledOnce();
});
it("supports an explicitly selected EU jurisdiction and SDK web-stream conversion", async () => {
  const f = response(),
    transformToWebStream = vi.fn(() => f.body);
  fake.send.mockResolvedValue({ ...f.value, Body: { transformToWebStream } });
  const store = createResearchPrivateCorpusStore({
    descriptor: { ...descriptor, jurisdiction: "eu" },
    credentials,
  });
  expect((await store.readObject("catalog.json", signal())).body).toBe(f.body);
  expect(transformToWebStream).toHaveBeenCalledOnce();
  expect(fake.constructors[0].endpoint).toBe(
    `https://${descriptor.account_id}.eu.r2.cloudflarestorage.com`,
  );
  store.destroy();
});
it.each(["../private.pdf", "download", "toString", "__proto__"])(
  "refuses arbitrary keys before calling the SDK: %s",
  async (name) => {
    const store = createResearchPrivateCorpusStore({ descriptor, credentials });
    await expect(store.readObject(name as never, signal())).rejects.toThrow(
      "Private research corpus unavailable",
    );
    expect(fake.send).not.toHaveBeenCalled();
    store.destroy();
  },
);
it("refuses preaborted and closed stores before SDK dispatch", async () => {
  const store = createResearchPrivateCorpusStore({ descriptor, credentials }),
    controller = new AbortController();
  controller.abort();
  await expect(
    store.readObject("manifest.json", controller.signal),
  ).rejects.toThrow();
  store.destroy();
  await expect(store.readObject("manifest.json", signal())).rejects.toThrow();
  expect(fake.send).not.toHaveBeenCalled();
});
it.each([
  "missing-body",
  "range",
  "encoding",
  "length",
  "oversize",
  "status",
  "provider-error",
])(
  "refuses malformed/unsafe %s without retry or private diagnostics",
  async (kind) => {
    const f = response(),
      store = createResearchPrivateCorpusStore({ descriptor, credentials });
    const value: Record<string, unknown> = { ...f.value };
    if (kind === "missing-body") delete value.Body;
    if (kind === "range") value.ContentRange = "bytes 0-1/200";
    if (kind === "encoding") value.ContentEncoding = "gzip";
    if (kind === "length") value.ContentLength = NaN;
    if (kind === "oversize") value.ContentLength = 9000;
    if (kind === "status") value.$metadata = { httpStatusCode: 206 };
    if (kind === "provider-error")
      fake.send.mockRejectedValue(
        Error("Private bucket and credential details"),
      );
    else fake.send.mockResolvedValue(value);
    await expect(store.readObject("manifest.json", signal())).rejects.toThrow(
      /^Private research corpus unavailable$/,
    );
    expect(fake.send).toHaveBeenCalledOnce();
    if (!["missing-body", "provider-error"].includes(kind))
      expect(f.cancel).toHaveBeenCalledOnce();
    store.destroy();
  },
);
it("disposes a late successful body after cancellation and a raw SDK body whose conversion fails", async () => {
  const f = response(),
    controller = new AbortController(),
    store = createResearchPrivateCorpusStore({ descriptor, credentials });
  fake.send.mockImplementation(async () => {
    controller.abort();
    return f.value;
  });
  await expect(
    store.readObject("manifest.json", controller.signal),
  ).rejects.toThrow();
  expect(f.cancel).toHaveBeenCalledOnce();
  const destroy = vi.fn();
  fake.send.mockResolvedValue({
    ...f.value,
    Body: {
      destroy,
      transformToWebStream() {
        throw Error("Private transform detail");
      },
    },
  });
  await expect(store.readObject("manifest.json", signal())).rejects.toThrow(
    /^Private research corpus unavailable$/,
  );
  expect(destroy).toHaveBeenCalledOnce();
  store.destroy();
});
it.each([
  { bucket: "../private" },
  { bucket: "synthetic\n" },
  { account_id: "a".repeat(32) + "\n" },
  { jurisdiction: "other" },
  { corpus_manifest_sha256: "bad" },
  { extra: "https://public.example/private" },
])("refuses invalid or extended descriptors %j", (change) => {
  expect(() =>
    prepareResearchPrivateCorpusStore({ ...descriptor, ...change } as never),
  ).toThrow("Private research corpus unavailable");
  expect(fake.constructors).toHaveLength(0);
});
it("refuses missing/ambient credentials before constructing a client", () => {
  for (const keys of [
    {},
    { ...credentials, secretAccessKey: " " },
    { ...credentials, accessKeyId: "synthetic\n" },
    { ...credentials, secretAccessKey: "synthetic\n" },
    { ...credentials, sessionToken: "unsupported" },
  ])
    expect(() =>
      createResearchPrivateCorpusStore({
        descriptor,
        credentials: keys as never,
      }),
    ).toThrow();
  expect(fake.constructors).toHaveLength(0);
});

it("swallows cancellation rejection while preserving a generic transport failure", async () => {
  const cancel = vi.fn(async () => {
      throw Error("synthetic private cancellation detail");
    }),
    body = new ReadableStream<Uint8Array>({ cancel }),
    store = createResearchPrivateCorpusStore({ descriptor, credentials });
  fake.send.mockResolvedValue({
    Body: body,
    ContentLength: 1,
    $metadata: { httpStatusCode: 206 },
  });
  await expect(store.readObject("manifest.json", signal())).rejects.toThrow(
    /^Private research corpus unavailable$/,
  );
  expect(cancel).toHaveBeenCalledOnce();
  store.destroy();
});
