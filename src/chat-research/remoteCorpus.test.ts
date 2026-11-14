/** Actual source gate and streamed synthetic bytes; no provider, file, database or live corpus. */
import { afterEach, expect, it, vi } from "vitest";
import { inspectPreparedResearchEvidence } from "./answerProvenance";
import { prepareResearchCorpusBundle } from "./corpusBundle";
import { queryFixture } from "./query.fixture";
import {
  loadResearchRemoteCorpus,
  RESEARCH_REMOTE_CORPUS_ERROR,
  RESEARCH_REMOTE_MAX_CHUNKS,
  type ResearchCorpusObjectName,
  type ResearchPrivateCorpusObject,
} from "./remoteCorpus";
import { RESEARCH_LOCAL_RETRIEVAL_PROFILE } from "./retrieval";
import * as runtime from "./runtimeCorpus";
import type { ResearchSourceSnapshot } from "./sourceAuthorization";

vi.mock("server-only", () => ({}));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function fixture() {
  const q = queryFixture(),
    context = inspectPreparedResearchEvidence(q.evidence).context,
    texts = [
      "Synthetic source one.",
      "Synthetic source two.",
      "Synthetic source three.",
    ],
    bundle = prepareResearchCorpusBundle(
      q.input,
      texts.map((text, i) => ({ unit_id: "unit" + (i + 1), text })),
    ),
    caps = {
      generation: true,
      answer: true,
      metadata: true,
      excerpt: false as const,
      image: false as const,
      download: false as const,
      processor_profiles: [RESEARCH_LOCAL_RETRIEVAL_PROFILE],
    },
    principal = {
      subject: context.subject,
      session_binding_sha256: "b".repeat(64),
      expires_at_ms: 20000,
    },
    snapshot: ResearchSourceSnapshot = {
      subject: context.subject,
      corpus_version: context.corpus_version,
      authorization_version: "1",
      publication_state: "published",
      sources: context.bindings.map((binding) => ({
        binding: structuredClone(binding),
        state: "active",
        valid_from_ms: null,
        valid_until_ms: null,
        rights: structuredClone(caps),
        grants: structuredClone(caps),
      })),
    },
    readers = {
      readPrincipal: vi.fn(async () => principal),
      loadSnapshot: vi.fn(async () => snapshot),
      readFence: vi.fn(async () => ({ principal, authorization_version: "1" })),
      now: () => 1000,
    },
    files = {
      "manifest.json": bundle.manifest,
      "catalog.json": bundle.catalog,
      "units.jsonl": bundle.units,
    },
    canceled: string[] = [],
    bodies: ReadableStream<Uint8Array>[] = [];
  const object = (
      name: ResearchCorpusObjectName,
      changes: { bytes?: number; data?: Uint8Array } = {},
    ): ResearchPrivateCorpusObject => {
      const data = changes.data ?? new TextEncoder().encode(files[name]),
        body = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(data);
            c.close();
          },
          cancel() {
            canceled.push(name);
          },
        });
      bodies.push(body);
      return {
        body,
        bytes:
          changes.bytes ?? new TextEncoder().encode(files[name]).byteLength,
      };
    },
    readObject = vi.fn(
      async (name: ResearchCorpusObjectName, _signal: AbortSignal) =>
        object(name),
    ),
    options = {
      mode: "generation" as const,
      manifestSha256: bundle.manifestSha256,
      context,
      createSourceReaders: vi.fn(() => readers),
      readObject,
    };
  return {
    options,
    bundle,
    readers,
    snapshot,
    principal,
    files,
    object,
    readObject,
    canceled,
    bodies,
  };
}
const signal = () => new AbortController().signal;
it("freshly authorizes every stage and returns genuine canonical search/materialization ports", async () => {
  const f = fixture(),
    prepared = await loadResearchRemoteCorpus(f.options, signal()),
    loaded = runtime.inspectResearchRuntimeCorpus(
      prepared,
      f.bundle.manifestSha256,
    );
  expect(f.readObject.mock.calls.map((call) => call[0])).toEqual([
    "manifest.json",
    "catalog.json",
    "units.jsonl",
  ]);
  expect(f.readers.readPrincipal).toHaveBeenCalledTimes(4);
  expect(f.readers.readFence).toHaveBeenCalledTimes(4);
  expect(loaded.catalog.revision).toBe(f.options.context.corpus_version);
  expect(
    await loaded.materialize(
      { catalog_revision: loaded.catalog.revision, unit_ids: ["unit1"] },
      signal(),
    ),
  ).toEqual([{ unit_id: "unit1", text: "Synthetic source one." }]);
  expect(f.bodies.every((body) => !body.locked)).toBe(true);
});
it("loads only metadata for retained reads even when generation rights have been removed", async () => {
  const f = fixture();
  for (const source of f.snapshot.sources) {
    source.rights.generation = source.grants.generation = false;
    source.rights.processor_profiles = source.grants.processor_profiles = [];
  }
  const prepared = await loadResearchRemoteCorpus(
    { ...f.options, mode: "retained-read" },
    signal(),
  );
  expect(
    runtime.inspectResearchRuntimeCatalog(prepared, f.bundle.manifestSha256)
      .stats.source_count,
  ).toBe(3);
  expect(f.readObject.mock.calls.map((call) => call[0])).toEqual([
    "manifest.json",
    "catalog.json",
  ]);
  expect(f.readers.readPrincipal).toHaveBeenCalledTimes(3);
});
it.each([
  "revoked",
  "no-generation",
  "wrong-subject",
  "wrong-manifest",
  "invalid-mode",
  "aborted",
])("refuses %s before private object loading", async (kind) => {
  const f = fixture(),
    controller = new AbortController();
  if (kind === "revoked") f.snapshot.sources[0].state = "revoked";
  if (kind === "no-generation") f.snapshot.sources[0].rights.generation = false;
  if (kind === "wrong-subject")
    f.principal.subject = {
      ...f.principal.subject,
      user_id: "019aa111-0000-7000-8000-000000000003",
    };
  if (kind === "wrong-manifest") f.options.manifestSha256 = "../private";
  if (kind === "invalid-mode") Object.assign(f.options, { mode: "download" });
  if (kind === "aborted") controller.abort();
  await expect(
    loadResearchRemoteCorpus(f.options, controller.signal),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(f.readObject).not.toHaveBeenCalled();
});
it("does not start principal or storage I/O after a reader factory consumes the entire shared budget", async () => {
  const f = fixture(),
    clock = vi.spyOn(performance, "now").mockReturnValue(0);
  f.options.createSourceReaders.mockImplementation(() => {
    clock.mockReturnValue(8000);
    return f.readers;
  });
  await expect(loadResearchRemoteCorpus(f.options, signal())).rejects.toThrow(
    RESEARCH_REMOTE_CORPUS_ERROR,
  );
  expect(f.readers.readPrincipal).not.toHaveBeenCalled();
  expect(f.readObject).not.toHaveBeenCalled();
});
it("rechecks source revocation between catalog and unit text without starting another object request", async () => {
  const f = fixture();
  f.readObject.mockImplementation(async (name) => {
    if (name === "catalog.json") f.snapshot.sources[0].state = "revoked";
    return f.object(name);
  });
  await expect(loadResearchRemoteCorpus(f.options, signal())).rejects.toThrow(
    RESEARCH_REMOTE_CORPUS_ERROR,
  );
  expect(f.readObject.mock.calls.map((call) => call[0])).toEqual([
    "manifest.json",
    "catalog.json",
  ]);
});
it.each(["incomplete-context", "corpus-mismatch", "source-version"])(
  "requires the complete approved source influence before unit loading: %s",
  async (kind) => {
    const f = fixture();
    if (kind === "incomplete-context") {
      const first = f.options.context.bindings[0];
      f.options.context.bindings = [first];
      f.options.context.visible_reference_ids = [first.reference_id];
      f.snapshot.sources = f.snapshot.sources.filter(
        (source) => source.binding.reference_id === first.reference_id,
      );
    }
    if (kind === "corpus-mismatch")
      f.options.context.corpus_version = f.snapshot.corpus_version = "f".repeat(
        64,
      );
    if (kind === "source-version") {
      f.options.context.bindings[0].source_version = "f".repeat(64);
      f.snapshot.sources[0].binding.source_version = "f".repeat(64);
    }
    await expect(loadResearchRemoteCorpus(f.options, signal())).rejects.toThrow(
      RESEARCH_REMOTE_CORPUS_ERROR,
    );
    expect(
      f.readObject.mock.calls.some((call) => call[0] === "units.jsonl"),
    ).toBe(false);
  },
);
it.each([
  "manifest-bytes",
  "catalog-bytes",
  "units-bytes",
  "short-body",
  "bad-utf8",
  "declared-oversize",
  "bad-body",
  "provider-error",
])("refuses bad transport/integrity %s with no retry", async (kind) => {
  const f = fixture();
  f.readObject.mockImplementation(async (name) => {
    if (kind === "provider-error")
      throw Error("Private bucket and credential diagnostics");
    if (kind === "declared-oversize") return f.object(name, { bytes: 9000 });
    if (kind === "bad-body") return { bytes: 1, body: null as never };
    if (
      kind === name.split(".")[0] + "-bytes" ||
      (kind === "units-bytes" && name === "units.jsonl")
    ) {
      const data = new TextEncoder().encode(f.files[name]);
      data[0] ^= 1;
      return f.object(name, { data });
    }
    if (kind === "short-body" && name === "units.jsonl")
      return f.object(name, {
        data: new TextEncoder().encode(f.files[name].slice(0, -1)),
      });
    if (kind === "bad-utf8" && name === "units.jsonl")
      return f.object(name, { data: Uint8Array.of(255) });
    return f.object(name);
  });
  await expect(loadResearchRemoteCorpus(f.options, signal())).rejects.toThrow(
    RESEARCH_REMOTE_CORPUS_ERROR,
  );
  expect(f.readObject.mock.calls.length).toBeLessThanOrEqual(3);
  expect(f.bodies.every((body) => !body.locked)).toBe(true);
});
it("cancels a stalled body on caller abort and releases its reader lock", async () => {
  const f = fixture(),
    controller = new AbortController(),
    cancel = vi.fn(),
    body = new ReadableStream<Uint8Array>({
      pull: () => new Promise(() => {}),
      cancel,
    });
  f.readObject.mockResolvedValue({ body, bytes: f.bundle.manifest.length });
  const pending = loadResearchRemoteCorpus(f.options, controller.signal),
    rejected = expect(pending).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  await vi.waitFor(() => expect(body.locked).toBe(true));
  controller.abort();
  await rejected;
  await vi.waitFor(() => expect(body.locked).toBe(false));
  expect(cancel).toHaveBeenCalledOnce();
  expect(f.readObject).toHaveBeenCalledOnce();
});
it("cancels a late object response after timeout instead of starting another stage", async () => {
  const f = fixture(),
    controller = new AbortController();
  let resolve!: (value: ResearchPrivateCorpusObject) => void;
  f.readObject.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const pending = loadResearchRemoteCorpus(f.options, controller.signal),
    rejected = expect(pending).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  await vi.waitFor(() => expect(f.readObject).toHaveBeenCalledOnce());
  controller.abort();
  await rejected;
  const cancel = vi.fn(),
    body = new ReadableStream<Uint8Array>({ cancel });
  resolve({ body, bytes: 1 });
  await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  expect(f.readObject).toHaveBeenCalledOnce();
});
it("checks the original deadline after synchronous compilation before final authority I/O", async () => {
  const f = fixture(),
    clock = vi.spyOn(performance, "now").mockReturnValue(0),
    original = runtime.prepareResearchRuntimeCorpus;
  vi.spyOn(runtime, "prepareResearchRuntimeCorpus").mockImplementation(
    (bundle) => {
      const value = original(bundle);
      clock.mockReturnValue(8001);
      return value;
    },
  );
  await expect(loadResearchRemoteCorpus(f.options, signal())).rejects.toThrow(
    RESEARCH_REMOTE_CORPUS_ERROR,
  );
  expect(f.readers.readPrincipal).toHaveBeenCalledTimes(3);
});

it("bounds empty-chunk work/allocation independently of bytes and cancels before another object", async () => {
  const f = fixture(),
    cancel = vi.fn();
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled++;
      controller.enqueue(new Uint8Array(0));
    },
    cancel,
  });
  f.readObject.mockResolvedValue({ body, bytes: f.bundle.manifest.length });
  await expect(loadResearchRemoteCorpus(f.options, signal())).rejects.toThrow(
    RESEARCH_REMOTE_CORPUS_ERROR,
  );
  expect(cancel).toHaveBeenCalledOnce();
  expect(pulled).toBeLessThanOrEqual(RESEARCH_REMOTE_MAX_CHUNKS + 2);
  expect(body.locked).toBe(false);
  expect(f.readObject).toHaveBeenCalledOnce();
});

it.each([-1, NaN, Infinity])(
  "refuses expired/invalid inherited ingress end before source or object I/O: %s",
  async (ingressDeadlineAt) => {
    const f = fixture();
    vi.spyOn(performance, "now").mockReturnValue(0);
    await expect(
      loadResearchRemoteCorpus({ ...f.options, ingressDeadlineAt }, signal()),
    ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
    expect(f.readers.readPrincipal).not.toHaveBeenCalled();
    expect(f.readObject).not.toHaveBeenCalled();
  },
);
it("does not reset a shorter inherited budget after earlier route work", async () => {
  const f = fixture(),
    clock = vi.spyOn(performance, "now").mockReturnValue(900);
  f.options.createSourceReaders.mockImplementation(() => {
    clock.mockReturnValue(1000);
    return f.readers;
  });
  await expect(
    loadResearchRemoteCorpus(
      { ...f.options, ingressDeadlineAt: 1000 },
      signal(),
    ),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(f.readers.readPrincipal).not.toHaveBeenCalled();
  expect(f.readObject).not.toHaveBeenCalled();
});

it("swallows failed late-body and locked-reader cancellation without leaking private errors", async () => {
  const f = fixture(),
    controller = new AbortController();
  let resolve!: (value: ResearchPrivateCorpusObject) => void;
  f.readObject.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const pending = loadResearchRemoteCorpus(f.options, controller.signal),
    rejected = expect(pending).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  await vi.waitFor(() => expect(f.readObject).toHaveBeenCalledOnce());
  controller.abort();
  await rejected;
  const cancel = vi.fn(async () => {
    throw Error("synthetic private cancellation detail");
  });
  resolve({ body: new ReadableStream<Uint8Array>({ cancel }), bytes: 1 });
  await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  const next = fixture(),
    readerCancel = vi.fn(async () => {
      throw Error("synthetic reader cancellation detail");
    }),
    body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(Uint8Array.of(255));
      },
      cancel: readerCancel,
    });
  next.readObject.mockResolvedValue({ body, bytes: 1 });
  await expect(
    loadResearchRemoteCorpus(next.options, signal()),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(readerCancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});
