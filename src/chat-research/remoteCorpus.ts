/** Bounded private corpus loading only. Actual storage/recipient custody and canonical operator ingress are outer requirements. */
import "server-only";
import { createHash } from "node:crypto";
import { ungrantedResearchCatalogPolicy } from "./answerProvenance";
import { parseBoundedResearchJson } from "./boundedJson";
import { withinResearchDeadline } from "./boundedWork";
import { RESEARCH_CORPUS_FILE_LIMITS } from "./corpusBundle";
import { RESEARCH_LOCAL_RETRIEVAL_PROFILE } from "./retrieval";
import {
  inspectResearchRuntimeCatalog,
  type PreparedResearchRuntimeCatalog,
  type PreparedResearchRuntimeCorpus,
  prepareResearchRuntimeCatalog,
  prepareResearchRuntimeCorpus,
} from "./runtimeCorpus";
import {
  parseResearchSourceContext,
  type ResearchSourceContext,
  type ResearchSourceReaders,
  requireResearchSourceAccess,
} from "./sourceAuthorization";
export const RESEARCH_REMOTE_MAX_CHUNKS = 32768;
export const RESEARCH_REMOTE_CORPUS_ERROR =
  "Private research corpus unavailable";
export type ResearchCorpusObjectName = keyof typeof RESEARCH_CORPUS_FILE_LIMITS;
/** One streamed private object from a separately bound read-only store, never a browser URL or signed download capability. */
export interface ResearchPrivateCorpusObject {
  readonly body: ReadableStream<Uint8Array>;
  readonly bytes: number;
}
/** Reviewed server startup ports. A claimed hash, callback or parsed source context is not permission. Actual composition must use fresh SQL source readers. */
export interface ResearchRemoteCorpusOptions {
  readonly mode: "generation" | "retained-read";
  readonly manifestSha256: string;
  /** Original route ingress deadline; may only shorten the shared eight-second load. */
  readonly ingressDeadlineAt?: number;
  readonly context: ResearchSourceContext;
  readonly createSourceReaders: () => ResearchSourceReaders;
  readonly readObject: (
    name: ResearchCorpusObjectName,
    signal: AbortSignal,
    /** Original monotonic absolute loader end; never restart a budget inside an object port. */
    deadlineAt: number,
  ) => Promise<ResearchPrivateCorpusObject>;
}
function fail(): never {
  throw Error(RESEARCH_REMOTE_CORPUS_ERROR);
}
/** One eight-second budget across fresh source gates, streaming, hashes and compilation. Metadata-only retained reads never request unit text. No cache, retry, model call or provider credential is installed. */
export function loadResearchRemoteCorpus(
  options: ResearchRemoteCorpusOptions & { mode: "generation" },
  signal: AbortSignal,
): Promise<PreparedResearchRuntimeCorpus>;
export function loadResearchRemoteCorpus(
  options: ResearchRemoteCorpusOptions & { mode: "retained-read" },
  signal: AbortSignal,
): Promise<PreparedResearchRuntimeCatalog>;
export async function loadResearchRemoteCorpus(
  options: ResearchRemoteCorpusOptions,
  signal: AbortSignal,
): Promise<PreparedResearchRuntimeCorpus | PreparedResearchRuntimeCatalog> {
  const started = performance.now();
  try {
    const inherited = options.ingressDeadlineAt;
    if (
      inherited !== undefined &&
      (typeof inherited !== "number" || !Number.isFinite(inherited))
    )
      fail();
    const end = Math.min(started + 8000, inherited ?? Infinity);
    const mode = options.mode,
      expected = options.manifestSha256,
      context = parseResearchSourceContext(structuredClone(options.context)),
      readers = options.createSourceReaders,
      readObject = options.readObject;
    if (
      !["generation", "retained-read"].includes(mode) ||
      typeof expected !== "string" ||
      expected.length !== 64 ||
      !/^[a-f0-9]{64}$/.test(expected) ||
      typeof readers !== "function" ||
      typeof readObject !== "function"
    )
      fail();
    return await withinResearchDeadline(
      signal,
      async (bounded) => {
        const active = () => {
            bounded.throwIfAborted();
            if (performance.now() >= end) fail();
          },
          source = async () => {
            active();
            const actual = readers();
            active();
            await requireResearchSourceAccess(
              context,
              mode === "generation"
                ? {
                    kind: "generation",
                    processor_profile: RESEARCH_LOCAL_RETRIEVAL_PROFILE,
                  }
                : { kind: "delivery" },
              actual,
              bounded,
              end,
            );
            active();
          },
          cancel = (object: ResearchPrivateCorpusObject | undefined) => {
            try {
              if (object?.body && !object.body.locked)
                void object.body.cancel().catch(() => {});
            } catch {}
          };
        async function text(
          name: ResearchCorpusObjectName,
          digest: string,
          expectedBytes?: number,
        ) {
          await source();
          active();
          let object: ResearchPrivateCorpusObject | undefined,
            reader: ReadableStreamDefaultReader<Uint8Array> | undefined,
            complete = false;
          const stop = () => {
            try {
              if (reader) void reader.cancel().catch(() => {});
              else cancel(object);
            } catch {}
          };
          bounded.addEventListener("abort", stop, { once: true });
          try {
            object = await Promise.resolve(readObject(name, bounded, end)).then(
              (value) => {
                try {
                  active();
                } catch {
                  cancel(value);
                  return fail();
                }
                return value;
              },
            );
            active();
            if (!object) fail();
            const body = object.body,
              declared = object.bytes,
              cap = RESEARCH_CORPUS_FILE_LIMITS[name];
            if (
              !(body instanceof ReadableStream) ||
              body.locked ||
              !Number.isSafeInteger(declared) ||
              declared < 0 ||
              declared > cap ||
              (expectedBytes !== undefined && declared !== expectedBytes)
            )
              fail();
            reader = body.getReader();
            active();
            const decoder = new TextDecoder("utf-8", {
                fatal: true,
                ignoreBOM: true,
              }),
              hash = createHash("sha256"),
              chunks: string[] = [];
            let count = 0,
              receivedChunks = 0;
            for (;;) {
              active();
              const row = await reader.read();
              active();
              if (row.done) {
                complete = true;
                break;
              }
              if (
                ++receivedChunks > RESEARCH_REMOTE_MAX_CHUNKS ||
                !(row.value instanceof Uint8Array)
              )
                fail();
              count += row.value.byteLength;
              if (count > cap || count > declared) fail();
              hash.update(row.value);
              const decoded = decoder.decode(row.value, { stream: true });
              if (decoded) chunks.push(decoded);
            }
            if (count !== declared || hash.digest("hex") !== digest) fail();
            chunks.push(decoder.decode());
            const value = chunks.join("");
            active();
            return value;
          } finally {
            bounded.removeEventListener("abort", stop);
            if (!complete) stop();
            try {
              reader?.releaseLock();
            } catch {}
          }
        }
        const manifest = await text("manifest.json", expected),
          header = parseBoundedResearchJson(
            manifest,
            RESEARCH_CORPUS_FILE_LIMITS["manifest.json"],
          ) as {
            corpus_version?: string;
            source_count?: number;
            files?: Record<string, { bytes?: number; sha256?: string }>;
          },
          meta = header.files?.["catalog.json"],
          sources = new Set(
            context.bindings.map((binding) => binding.source_id),
          );
        active();
        if (
          header.corpus_version !== context.corpus_version ||
          header.source_count !== sources.size ||
          !meta ||
          !Number.isSafeInteger(meta.bytes) ||
          meta.bytes! < 1 ||
          meta.bytes! > RESEARCH_CORPUS_FILE_LIMITS["catalog.json"] ||
          typeof meta.sha256 !== "string" ||
          meta.sha256.length !== 64 ||
          !/^[a-f0-9]{64}$/.test(meta.sha256)
        )
          fail();
        const catalog = await text("catalog.json", meta.sha256!, meta.bytes!),
          metadata = prepareResearchRuntimeCatalog({
            manifestSha256: expected,
            manifest,
            catalog,
          }),
          loaded = inspectResearchRuntimeCatalog(metadata, expected),
          policy = ungrantedResearchCatalogPolicy(loaded.catalog),
          byId = new Map(
            policy.sources.map((source) => [source.source_id, source]),
          );
        active();
        if (
          loaded.catalog.revision !== context.corpus_version ||
          byId.size !== sources.size ||
          context.bindings.some((binding) => {
            const source = byId.get(binding.source_id);
            return (
              !source ||
              source.source_version !== binding.source_version ||
              !source.evidence_versions.includes(binding.evidence_version)
            );
          })
        )
          fail();
        if (mode === "retained-read") {
          await source();
          return metadata;
        }
        const unitsMeta = loaded.files["units.jsonl"],
          units = await text("units.jsonl", unitsMeta.sha256, unitsMeta.bytes);
        active();
        const prepared = prepareResearchRuntimeCorpus({
          manifestSha256: expected,
          manifest,
          catalog,
          units,
        });
        active();
        await source();
        return prepared;
      },
      end,
    );
  } catch {
    return fail();
  }
}
