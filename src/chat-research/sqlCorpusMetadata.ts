/** Inactive metadata-only SQL object port. No route, source grant, generation, passages or vector loading. */
import "server-only";
import { is, sql } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import * as v from "valibot";
import { RESEARCH_CORPUS_FILE_LIMITS } from "./corpusBundle";
import {
  RESEARCH_REMOTE_CORPUS_ERROR,
  type ResearchCorpusObjectName,
  type ResearchPrivateCorpusObject,
} from "./remoteCorpus";
import type { ResearchSourceDatabase } from "./sqlSourceReaders";

const sha = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const descriptorShape = v.strictObject({ datasetId: sha, corpusVersion: sha });
/** Independently bound private startup values; parsing a descriptor does not adopt a database or grant access. */
export interface ResearchSqlCorpusMetadataDescriptor {
  /** SHA-256 of the canonical corpus manifest bytes; the sealed dataset key. */
  readonly datasetId: string;
  /** Independently bound catalog revision; distinct from the dataset key. */
  readonly corpusVersion: string;
}
const fail = (): never => {
  throw Error(RESEARCH_REMOTE_CORPUS_ERROR);
};

/**
 * Construct behind canonical operator ingress, using a separately adopted DB root.
 * Supply this only to loadResearchRemoteCorpus's retained-read mode, which performs
 * fresh source gates and checks the independently pinned canonical bytes. This
 * port never serves units.jsonl and cannot prepare a generation-capable corpus.
 * Database/role/native custody remain hosted-adoption requirements; content
 * hashes or a trusted callback alone do not establish those properties.
 */
export function createSqlResearchCorpusMetadataStore(
  database: ResearchSourceDatabase,
  value: ResearchSqlCorpusMetadataDescriptor,
) {
  try {
    if (
      is(database, PgTransaction) ||
      typeof (database as { rollback?: unknown }).rollback === "function" ||
      typeof database.transaction !== "function"
    )
      fail();
    const descriptor = Object.freeze(v.parse(descriptorShape, value));
    let closed = false;
    return Object.freeze({
      /** Fixed metadata objects, fresh read-only transactions and the original loader deadline, checked around all awaits. No cache or retry. */
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
          if (name !== "manifest.json" && name !== "catalog.json") fail();
          const cap = RESEARCH_CORPUS_FILE_LIMITS[name],
            column =
              name === "manifest.json"
                ? sql`d.manifest_text`
                : sql`d.catalog_text`;
          const text = await database.transaction(
            async (tx) => {
              const step = async <T>(work: () => PromiseLike<T>) => {
                active();
                const result = await work();
                active();
                return result;
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
              const rows = await step(() =>
                tx
                  .select({ text: sql<string>`${column}` })
                  .from(sql`chat_research_corpus.datasets d`)
                  .where(
                    sql`d.id=${descriptor.datasetId} and d.corpus_version=${descriptor.corpusVersion} and d.sealed_at is not null and pg_catalog.octet_length(${column}) between 1 and ${cap}`,
                  )
                  .limit(2),
              );
              if (
                rows.length !== 1 ||
                typeof rows[0].text !== "string" ||
                rows[0].text.length > cap ||
                !rows[0].text.isWellFormed()
              )
                fail();
              active();
              return rows[0].text;
            },
            { accessMode: "read only", isolationLevel: "read committed" },
          );
          active();
          const bytes = new TextEncoder().encode(text);
          if (!bytes.length || bytes.length > cap) fail();
          const body = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          });
          active();
          return Object.freeze({ body, bytes: bytes.byteLength });
        } catch {
          return fail();
        }
      },
      /** Invalidate future/late results. This does not cancel driver work or prove backend closure; SQL statements use read-only mode and server timeouts. */
      destroy() {
        closed = true;
      },
    });
  } catch {
    return fail();
  }
}
