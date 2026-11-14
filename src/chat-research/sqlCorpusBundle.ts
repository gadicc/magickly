/** Inactive canonical SQL bundle port for the existing source-gated local BM25 pipeline. */
import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  RESEARCH_REMOTE_CORPUS_ERROR,
  type ResearchCorpusObjectName,
  type ResearchPrivateCorpusObject,
} from "./remoteCorpus";
import {
  createSqlResearchCorpusMetadataStore,
  type ResearchSqlCorpusMetadataDescriptor,
} from "./sqlCorpusMetadata";
import type { ResearchSourceDatabase } from "./sqlSourceReaders";

/** This first full-bundle control refuses larger unit files rather than truncating them. */
export const RESEARCH_SQL_UNIT_STREAM_MAX_BYTES = 32 * 1024 * 1024;
const fail = (): never => {
  throw Error(RESEARCH_REMOTE_CORPUS_ERROR);
};

/**
 * Behind canonical operator ingress, supply only to loadResearchRemoteCorpus.
 * Generation mode still requires the full current-source processing gate before
 * any object I/O and canonical compilation after the entire stream. This port
 * does not adopt a DB/native target, grant use, create model requests or cache data.
 * Prefer the separate metadata-only port for retained reads. A local full-load
 * diagnostic is not evidence this path meets a hosted cold-load deadline.
 */
export function createSqlResearchCorpusBundleStore(
  database: ResearchSourceDatabase,
  value: ResearchSqlCorpusMetadataDescriptor,
) {
  try {
    const descriptor = Object.freeze(structuredClone(value)),
      metadata = createSqlResearchCorpusMetadataStore(database, descriptor);
    let closed = false;
    const streams = new Set<() => void>();
    return Object.freeze({
      /** Fixed objects only. Every SQL await and stream pull retains the original loader end. */
      async readObject(
        name: ResearchCorpusObjectName,
        signal: AbortSignal,
        deadlineAt: number,
      ): Promise<ResearchPrivateCorpusObject> {
        const active = () => {
          signal.throwIfAborted();
          if (
            closed ||
            typeof deadlineAt !== "number" ||
            !Number.isFinite(deadlineAt) ||
            performance.now() >= deadlineAt
          )
            fail();
        };
        try {
          active();
          if (name !== "units.jsonl") {
            const object = await metadata.readObject(name, signal, deadlineAt);
            active();
            return object;
          }
          const result = await database.transaction(
            async (tx) => {
              const step = async <T>(work: () => PromiseLike<T>) => {
                active();
                const value = await work();
                active();
                return value;
              };
              await step(() => tx.execute(sql`set local lock_timeout='5s'`));
              await step(() =>
                tx.execute(sql`set local statement_timeout='8s'`),
              );
              await step(() =>
                tx.execute(sql`set local search_path=pg_catalog`),
              );
              const modes = await step(() =>
                tx
                  .select({
                    readOnly: sql<string>`pg_catalog.current_setting('transaction_read_only')`,
                    isolation: sql<string>`pg_catalog.current_setting('transaction_isolation')`,
                  })
                  .from(sql`(select 1) guard`),
              );
              if (
                modes.length !== 1 ||
                modes[0].readOnly !== "on" ||
                modes[0].isolation !== "read committed"
              )
                fail();
              const headers = await step(() =>
                tx
                  .select({
                    manifest: sql<string>`d.manifest_text`,
                    count: sql<number>`d.unit_count`,
                  })
                  .from(sql`chat_research_corpus.datasets d`)
                  .where(
                    sql`d.id=${descriptor.datasetId} and d.corpus_version=${descriptor.corpusVersion} and d.sealed_at is not null and pg_catalog.octet_length(d.manifest_text) between 1 and 8192`,
                  )
                  .limit(2),
              );
              if (
                headers.length !== 1 ||
                typeof headers[0].manifest !== "string" ||
                headers[0].manifest.length > 8192 ||
                !headers[0].manifest.isWellFormed() ||
                createHash("sha256")
                  .update(headers[0].manifest)
                  .digest("hex") !== descriptor.datasetId
              )
                fail();
              const header = JSON.parse(headers[0].manifest),
                file = header.files?.["units.jsonl"],
                count = headers[0].count;
              if (
                header.schema_version !== 1 ||
                header.purpose !== "magickli-private-runtime-corpus-v1" ||
                header.corpus_version !== descriptor.corpusVersion ||
                !Number.isSafeInteger(count) ||
                count < 1 ||
                count > 75000 ||
                header.unit_count !== count ||
                !Number.isSafeInteger(file?.bytes) ||
                file.bytes < 1 ||
                file.bytes > RESEARCH_SQL_UNIT_STREAM_MAX_BYTES ||
                typeof file?.sha256 !== "string" ||
                !/^[a-f0-9]{64}$/.test(file.sha256)
              )
                fail();
              // JSON string escaping for text IDs/bodies is native PostgreSQL text
              // to_json; +21 is the fixed canonical {"text":...,"unit_id":...}\n frame.
              // Verify this BEFORE fetching body rows, not after allocating them.
              const sizes = await step(() =>
                tx
                  .select({
                    count: sql<number>`count(*)::integer`,
                    bytes: sql<string>`sum(pg_catalog.octet_length(pg_catalog.to_json(u.body)::text)+pg_catalog.octet_length(pg_catalog.to_json(u.unit_id)::text)+21)::bigint::text`,
                  })
                  .from(sql`chat_research_corpus.units u`)
                  .where(sql`u.dataset_id=${descriptor.datasetId}`),
              );
              if (
                sizes.length !== 1 ||
                sizes[0].count !== count ||
                typeof sizes[0].bytes !== "string" ||
                !/^[0-9]+$/.test(sizes[0].bytes) ||
                Number(sizes[0].bytes) !== file.bytes
              )
                fail();
              const rows = await step(() =>
                tx
                  .select({
                    unitId: sql<string>`u.unit_id`,
                    text: sql<string>`u.body`,
                  })
                  .from(sql`chat_research_corpus.units u`)
                  .where(sql`u.dataset_id=${descriptor.datasetId}`)
                  .orderBy(sql`u.unit_id collate "C"`)
                  .limit(count + 1),
              );
              if (rows.length !== count) fail();
              active();
              return {
                rows,
                bytes: file.bytes as number,
                sha256: file.sha256 as string,
              };
            },
            { accessMode: "read only", isolationLevel: "read committed" },
          );
          active();
          const rows = result.rows,
            hash = createHash("sha256"),
            encoder = new TextEncoder();
          let index = 0,
            total = 0,
            previous = "";
          let released = false,
            owner: ReadableStreamDefaultController<Uint8Array> | undefined,
            timer: ReturnType<typeof setTimeout> | undefined;
          const release = () => {
            if (released) return;
            released = true;
            rows.length = 0;
            signal.removeEventListener("abort", stop);
            if (timer !== undefined) clearTimeout(timer);
            streams.delete(stop);
          };
          const stop = () => {
            release();
            try {
              owner?.error(Error(RESEARCH_REMOTE_CORPUS_ERROR));
            } catch {}
          };

          const body = new ReadableStream<Uint8Array>(
            {
              start(controller) {
                owner = controller;
              },
              pull(controller) {
                try {
                  active();
                  const parts: string[] = [];
                  let size = 0;
                  while (index < rows.length && size < 64 * 1024) {
                    active();
                    const row = rows[index++];
                    if (
                      typeof row.unitId !== "string" ||
                      !/^[A-Za-z0-9_.:-]{1,128}$/.test(row.unitId) ||
                      row.unitId <= previous ||
                      typeof row.text !== "string" ||
                      !row.text.length ||
                      row.text.length > 16000 ||
                      !row.text.isWellFormed()
                    )
                      fail();
                    previous = row.unitId;
                    const line =
                      JSON.stringify({ text: row.text, unit_id: row.unitId }) +
                      "\n";
                    size += Buffer.byteLength(line);
                    parts.push(line);
                  }
                  const chunk = encoder.encode(parts.join(""));
                  active();
                  total += chunk.byteLength;
                  if (
                    !chunk.length ||
                    total > result.bytes ||
                    total > RESEARCH_SQL_UNIT_STREAM_MAX_BYTES
                  )
                    fail();
                  hash.update(chunk);
                  const done = index === rows.length;
                  if (
                    done &&
                    (total !== result.bytes ||
                      hash.digest("hex") !== result.sha256)
                  )
                    fail();
                  active();
                  controller.enqueue(chunk);
                  if (done) {
                    release();
                    controller.close();
                  }
                } catch {
                  release();
                  controller.error(Error(RESEARCH_REMOTE_CORPUS_ERROR));
                }
              },
              cancel() {
                release();
              },
            },
            { highWaterMark: 0 },
          );
          streams.add(stop);
          signal.addEventListener("abort", stop, { once: true });
          timer = setTimeout(stop, Math.max(0, deadlineAt - performance.now()));
          timer.unref?.();
          try {
            active();
          } catch {
            stop();
            return fail();
          }
          return Object.freeze({ body, bytes: result.bytes });
        } catch {
          return fail();
        }
      },
      /** Invalidate this port; it does not close a shared DB pool or prove backend termination. */
      destroy() {
        closed = true;
        metadata.destroy();
        for (const stop of [...streams]) stop();
      },
    });
  } catch {
    return fail();
  }
}
