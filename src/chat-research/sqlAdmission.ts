import "server-only";
import { createHash } from "node:crypto";
import { and, eq, is, sql } from "drizzle-orm";
import type {
  PgDatabase,
  PgQueryResultHKT,
  PgTransactionConfig,
} from "drizzle-orm/pg-core";
import { PgTransaction } from "drizzle-orm/pg-core";
import * as v from "valibot";
import {
  parseResearchAccountingTarget,
  type ResearchAccountingScope,
  type ResearchAccountingStorage,
} from "./accountingScope";
import {
  parseResearchAnswerArchive,
  type ResearchArchiveEntry,
} from "./archive";
import {
  readResearchArchiveSummary,
  readResearchOriginalHistoryQuestion,
} from "./archiveRequest";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import {
  formatResearchHistoryCandidate,
  type ResearchCompletedHistoryCandidate,
} from "./historyCandidate";

export type {
  ResearchAccountingScope,
  ResearchAccountingStorage,
} from "./accountingScope";

import {
  chatResearchPermits as permits,
  chatResearchWindows as windows,
} from "../db/schema/chatResearch";
import { chatResearchArtifacts as artifacts } from "../db/schema/chatResearchArtifacts";
import { createUuidV7, isUuidV7 } from "../lib/ids";
import {
  inspectResearchRequestArtifact,
  type PreparedResearchRequestArtifact,
  RESEARCH_ARTIFACT_RETENTION_MS,
} from "./requestArtifact";
import {
  materializeResearchResult,
  type PreparedResearchResult,
  readResearchResultPacket,
} from "./resultArtifact";
import {
  lockResearchArtifacts,
  validateResearchRequestRow,
} from "./sqlArtifacts";

export type ResearchAdmissionTransaction = Pick<
  PgDatabase<PgQueryResultHKT>,
  "select" | "selectDistinct" | "insert" | "update" | "execute"
>;
/** Top-level commit runner, never a transaction/savepoint handle. Custom adapters must resolve only after
 * confirmed COMMIT, never retry a callback, and propagate ambiguous ACKs. No provider/auth port is present. */
export interface ResearchAdmissionDatabase {
  /** Exclude Drizzle transaction handles statically as well as at runtime. */
  readonly rollback?: never;
  transaction<T>(
    work: (tx: ResearchAdmissionTransaction) => Promise<T>,
    config?: PgTransactionConfig,
  ): Promise<T>;
}
const ERROR = "Private research admission unavailable";
function fail(): never {
  throw Error(ERROR);
}
const uuid = v.pipe(
  v.string(),
  v.check((s) => isUuidV7(s) && s === s.toLowerCase()),
);
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[0-9a-f]{64}$/));
const integer = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const money = v.pipe(integer, v.maxValue(Number.MAX_SAFE_INTEGER));
const requestShape = v.strictObject({
  operationId: uuid,
  actorId: uuid,
  sessionId: uuid,
  requestSha256: hash,
  sourceContextSha256: hash,
  upperPico: v.pipe(money, v.minValue(1), v.maxValue(350000000000)),
  quoteExpiresAtMs: integer,
});
/** All fields come from a freshly authorized server job; none proves identity/access by itself. */
export type ResearchReservationRequest = Readonly<
  v.InferOutput<typeof requestShape>
>;
const resultShape = v.variant("outcome", [
  v.strictObject({
    outcome: v.literal("completed"),
    reportedPico: money,
    responseSha256: hash,
    answerSha256: hash,
  }),
  v.strictObject({
    outcome: v.picklist(["failed", "indeterminate"]),
    reportedPico: v.nullable(money),
    responseSha256: v.nullable(hash),
  }),
]);
/** Opaque, process-local marker returned only after a confirmed dispatch-marker commit. Never a network grant. */
export interface ResearchDispatchClaim {
  readonly kind: "private_research_dispatch_claim";
}
type Row = typeof permits.$inferSelect;
/** Private accounting status, not answer content, a history record or a reusable delivery grant. */
export interface ResearchPermitStatus {
  readonly permitId: string;
  readonly state: Row["state"];
  readonly upperPico: number;
  readonly quoteExpiresAtMs: number;
  readonly reportedPico: number | null;
}
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
// Bind outcomes to their own request/dispatch identity. This detects accidental row/receipt corruption,
// not coordinated edits by a privileged database writer who can recompute every checksum.
function terminalFingerprint(
  row: Row,
  result: {
    state: Row["state"];
    reportedPico: number | null;
    responseSha256: string | null;
    answerSha256: string | null;
  },
) {
  return digest([row.id, row.descriptorSha256, row.dispatchId, result]);
}
const scopeValues = (s: ResearchAccountingScope) => [
  s.windowId,
  s.approvalSha256,
  s.actorId,
  s.corpusVersion,
  s.model,
  s.processorProfile,
  s.beginsAtMs,
  s.expiresAtMs,
  s.maxRequests,
  s.perRequestPico,
  s.totalPico,
];
const status = (r: Row): ResearchPermitStatus =>
  Object.freeze({
    permitId: r.id,
    state: r.state,
    upperPico: r.upperPico,
    quoteExpiresAtMs: r.quoteExpiresAt.getTime(),
    reportedPico: r.reportedPico,
  });

/**
 * Durable full holds with one open permit per window. No activation/renewal/refund/delete/retry API.
 * Every future dispatch/delivery still needs separate fresh app auth, source policy, reviewed activation,
 * price/code/body/expiry fences and immutable artifact storage. A DB marker does not assert HTTP was sent.
 */
export function createSqlResearchAdmission(
  database: ResearchAdmissionDatabase,
  value: ResearchAccountingScope,
  storage: ResearchAccountingStorage = {},
) {
  if (is(database, PgTransaction) || "rollback" in database) fail();
  const target = parseResearchAccountingTarget(value, storage);
  const namespace = target.storage.schemaName;
  const scopeDigest = (s: ResearchAccountingScope) =>
    digest(["private-research-accounting-v1", namespace, ...scopeValues(s)]);
  const scope = target.scope,
    scopeSha = scopeDigest(scope);
  const claims = new WeakMap<
    ResearchDispatchClaim,
    {
      permitId: string;
      dispatchId: string;
      actorId: string;
      sessionId: string;
      artifact?: PreparedResearchRequestArtifact;
      quoteDeadline?: number;
      consumed?: boolean;
      dispatchSignal?: AbortSignal;
      handedOff?: boolean;
    }
  >();
  const descriptor = (r: ResearchReservationRequest) =>
    digest([
      scopeSha,
      r.operationId,
      r.actorId,
      r.sessionId,
      r.requestSha256,
      r.sourceContextSha256,
      r.upperPico,
      r.quoteExpiresAtMs,
    ]);
  async function run<T>(
    signal: AbortSignal,
    work: (tx: ResearchAdmissionTransaction) => Promise<T>,
    assertReadReady?: () => void,
  ): Promise<T> {
    try {
      signal.throwIfAborted();
      assertReadReady?.();
      const result = await database.transaction(async (tx) => {
        assertReadReady?.();
        // Bound lock waits/work. No network or source authorization is performed while holding these locks.
        await tx.execute(sql`set local lock_timeout = '5s'`);
        assertReadReady?.();
        await tx.execute(sql`set local statement_timeout = '8s'`);
        assertReadReady?.();
        // Namespace is trusted startup config, frozen into descriptors; never chosen by a browser.
        await tx.execute(
          sql`set local search_path = pg_catalog, ${sql.identifier(namespace)}, pg_temp`,
        );
        assertReadReady?.();
        // Qualified locks fail if migration is missing and prevent concurrent table replacement.
        // Search-path order alone would still fall through to pg_temp if durable tables were absent.
        await tx.execute(
          sql`lock table ${sql.identifier(namespace)}.${sql.identifier("chat_research_windows")}, ${sql.identifier(namespace)}.${sql.identifier("chat_research_permits")} in access share mode`,
        );
        assertReadReady?.();
        const durable = await tx
          .select({ name: sql<string>`c.relname` })
          .from(
            sql`pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace`,
          )
          .where(
            sql`n.nspname=${namespace} and c.relname in ('chat_research_windows','chat_research_permits') and c.relkind='r' and c.relpersistence='p'`,
          );
        assertReadReady?.();
        if (durable.length !== 2) fail();
        signal.throwIfAborted();
        assertReadReady?.();
        const result = await work(tx);
        assertReadReady?.();
        signal.throwIfAborted();
        return result;
      });
      assertReadReady?.();
      signal.throwIfAborted();
      return result;
    } catch {
      return fail();
    }
  }
  async function load(
    tx: ResearchAdmissionTransaction,
    assertReadReady?: () => void,
  ) {
    assertReadReady?.();
    const [w] = await tx
      .select()
      .from(windows)
      .where(eq(windows.id, scope.windowId))
      .for("update");
    assertReadReady?.();
    if (
      !w ||
      scopeDigest({
        windowId: w.id,
        approvalSha256: w.approvalSha256,
        actorId: w.actorId,
        corpusVersion: w.corpusVersion,
        model: w.model,
        processorProfile: w.processorProfile,
        beginsAtMs: w.beginsAt.getTime(),
        expiresAtMs: w.expiresAt.getTime(),
        maxRequests: w.maxRequests,
        perRequestPico: w.perRequestPico,
        totalPico: w.totalPico,
      }) !== scopeSha
    )
      fail();
    assertReadReady?.();
    const rows = await tx
      .select()
      .from(permits)
      .where(eq(permits.windowId, scope.windowId));
    assertReadReady?.();
    if (
      rows.length !== w.requestsUsed ||
      rows.reduce((n, r) => n + r.upperPico, 0) !== w.heldPico
    )
      fail();
    for (const r of rows) {
      assertReadReady?.();
      const request = v.safeParse(requestShape, {
        operationId: r.operationId,
        actorId: r.actorId,
        sessionId: r.sessionId,
        requestSha256: r.requestSha256,
        sourceContextSha256: r.sourceContextSha256,
        upperPico: r.upperPico,
        quoteExpiresAtMs: r.quoteExpiresAt.getTime(),
      });
      if (
        !request.success ||
        descriptor(request.output) !== r.descriptorSha256 ||
        r.actorId !== scope.actorId ||
        r.upperPico > scope.perRequestPico ||
        r.quoteExpiresAt.getTime() > scope.expiresAtMs
      )
        fail();
      if (["completed", "failed", "indeterminate"].includes(r.state)) {
        if (
          r.resultSha256 !==
            terminalFingerprint(r, {
              state: r.state,
              reportedPico: r.reportedPico,
              responseSha256: r.responseSha256,
              answerSha256: r.answerSha256,
            }) ||
          (r.state !== "completed" && !w.stopped)
        )
          fail();
      }
    }
    assertReadReady?.();
    return { w, rows };
  }
  async function clock(tx: ResearchAdmissionTransaction) {
    const [r] = await tx
      .select({
        now: sql<Date>`date_trunc('milliseconds',pg_catalog.clock_timestamp())`.mapWith(
          (v: string | Date) => new Date(v),
        ),
      })
      .from(sql`(select 1) as clock_probe`);
    if (!r || !Number.isFinite(r.now.getTime())) fail();
    return r.now;
  }
  const owner = (r: Row, actorId: string, sessionId: string) => {
    if (
      r.actorId !== actorId ||
      actorId !== scope.actorId ||
      r.sessionId !== sessionId
    )
      fail();
  };
  const quoteShape = v.strictObject({
    upperPico: v.pipe(money, v.minValue(1), v.maxValue(350000000000)),
    quoteExpiresAtMs: integer,
  });
  function artifactRequest(
    artifact: PreparedResearchRequestArtifact,
    quote: { upperPico: number; quoteExpiresAtMs: number },
  ) {
    const a = inspectResearchRequestArtifact(artifact),
      p = a.packet,
      q = v.parse(quoteShape, quote);
    if (
      p.window_id !== scope.windowId ||
      p.model !== scope.model ||
      p.processor_profile !== scope.processorProfile ||
      p.context.corpus_version !== scope.corpusVersion ||
      p.context.subject.user_id !== scope.actorId ||
      q.quoteExpiresAtMs > p.context.expires_at_ms ||
      (p.schema_version === 2 &&
        (p.history_binding.window_begins_at_ms !== scope.beginsAtMs ||
          p.history_binding.window_expires_at_ms !== scope.expiresAtMs))
    )
      fail();
    return {
      artifact: a,
      reservation: {
        operationId: p.operation_id,
        actorId: p.context.subject.user_id,
        sessionId: p.context.subject.session_id,
        requestSha256: p.request_sha256,
        sourceContextSha256: p.source_context_sha256,
        upperPico: q.upperPico,
        quoteExpiresAtMs: q.quoteExpiresAtMs,
      },
    };
  }
  async function requestRow(
    tx: ResearchAdmissionTransaction,
    r: Row,
    assertReadReady?: () => void,
  ) {
    assertReadReady?.();
    await lockResearchArtifacts(tx, namespace, assertReadReady);
    assertReadReady?.();
    const [a] = await tx
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.permitId, r.id), eq(artifacts.kind, "request")))
      .for("update");
    assertReadReady?.();
    return a;
  }
  async function reserveInternal(
    value: ResearchReservationRequest,
    signal: AbortSignal,
    artifact?: PreparedResearchRequestArtifact,
  ): Promise<ResearchPermitStatus> {
    const parsed = v.safeParse(requestShape, value);
    if (!parsed.success || parsed.output.actorId !== scope.actorId) fail();
    const r = parsed.output,
      fingerprint = descriptor(r);
    return run(signal, async (tx) => {
      const { w, rows } = await load(tx);
      const prior = rows.find((p) => p.operationId === r.operationId);
      if (prior) {
        owner(prior, r.actorId, r.sessionId);
        if (prior.descriptorSha256 !== fingerprint) fail();
        if (artifact) {
          const row = await requestRow(tx, prior),
            expected = inspectResearchRequestArtifact(artifact);
          if (!row) fail();
          validateResearchRequestRow(row, prior, scope);
          if (
            row.packetSha256 !== expected.packet_sha256 ||
            row.packetJson !== expected.packet_json
          )
            fail();
        }
        return status(prior);
      }
      if (artifact) await lockResearchArtifacts(tx, namespace);
      const now = await clock(tx),
        ms = now.getTime();
      if (
        w.stopped ||
        ms < scope.beginsAtMs ||
        ms >= scope.expiresAtMs ||
        r.quoteExpiresAtMs <= ms ||
        r.quoteExpiresAtMs > Math.min(ms + 60000, scope.expiresAtMs) ||
        rows.some((r) => ["reserved", "dispatching"].includes(r.state)) ||
        w.requestsUsed >= scope.maxRequests ||
        r.upperPico > scope.perRequestPico ||
        w.heldPico + r.upperPico > scope.totalPico
      )
        fail();
      const [saved] = await tx
        .insert(permits)
        .values({
          id: createUuidV7(),
          windowId: scope.windowId,
          operationId: r.operationId,
          actorId: r.actorId,
          sessionId: r.sessionId,
          descriptorSha256: fingerprint,
          requestSha256: r.requestSha256,
          sourceContextSha256: r.sourceContextSha256,
          upperPico: r.upperPico,
          quoteExpiresAt: new Date(r.quoteExpiresAtMs),
          reservedAt: now,
          state: "reserved",
        })
        .returning();
      await tx
        .update(windows)
        .set({
          requestsUsed: w.requestsUsed + 1,
          heldPico: w.heldPico + r.upperPico,
        })
        .where(eq(windows.id, scope.windowId));
      if (artifact) {
        const a = inspectResearchRequestArtifact(artifact);
        await tx.insert(artifacts).values({
          permitId: saved.id,
          kind: "request",
          packetJson: a.packet_json,
          packetSha256: a.packet_sha256,
          jobCreatedAt: now,
          storedAt: now,
          retainUntil: new Date(ms + RESEARCH_ARTIFACT_RETENTION_MS),
        });
      }
      return status(saved);
    });
  }
  async function beginDispatchInternal(
    permitId: string,
    actorId: string,
    sessionId: string,
    signal: AbortSignal,
    artifact?: PreparedResearchRequestArtifact,
  ): Promise<ResearchDispatchClaim | null> {
    if (
      ![permitId, actorId, sessionId].every((s) => v.safeParse(uuid, s).success)
    )
      fail();
    const marked = await run(signal, async (tx) => {
      const { w, rows } = await load(tx),
        r = rows.find((r) => r.id === permitId);
      if (!r) fail();
      owner(r, actorId, sessionId);
      if (artifact) {
        const row = await requestRow(tx, r),
          a = inspectResearchRequestArtifact(artifact);
        if (!row) fail();
        validateResearchRequestRow(row, r, scope);
        if (
          row.packetSha256 !== a.packet_sha256 ||
          row.packetJson !== a.packet_json
        )
          fail();
      }
      if (r.state !== "reserved") return null;
      const beforeClock = performance.now();
      const now = await clock(tx),
        ms = now.getTime();
      if (
        w.stopped ||
        ms < scope.beginsAtMs ||
        ms >= scope.expiresAtMs ||
        ms >= r.quoteExpiresAt.getTime()
      )
        fail();
      const dispatchId = createUuidV7();
      const updated = await tx
        .update(permits)
        .set({ state: "dispatching", dispatchId, dispatchAt: now })
        .where(and(eq(permits.id, r.id), eq(permits.state, "reserved")))
        .returning({ id: permits.id });
      if (updated.length !== 1) fail();
      return {
        permitId: r.id,
        dispatchId,
        actorId,
        sessionId,
        artifact,
        quoteDeadline: beforeClock + r.quoteExpiresAt.getTime() - ms,
        dispatchSignal: signal,
      };
    });
    if (!marked) return null;
    if (artifact && performance.now() >= marked.quoteDeadline) fail();
    const token: ResearchDispatchClaim = Object.freeze({
      kind: "private_research_dispatch_claim",
    });
    claims.set(token, marked);
    return token;
  }
  type CandidateOwnership =
    | { kind: "same-session"; sessionId: string }
    | { kind: "same-actor" };
  // Read-only pair validation shared inside one root transaction; never open a nested root while holding the window lock.
  async function readValidatedCompletion(
    tx: ResearchAdmissionTransaction,
    r: Row | undefined,
    actorId: string,
    ownership: CandidateOwnership,
    signal: AbortSignal,
    deadlineAt = Infinity,
  ) {
    const active = () => {
      signal.throwIfAborted();
      if (performance.now() >= deadlineAt) fail();
    };
    active();
    if (!r) fail();
    if (ownership.kind === "same-session")
      owner(r, actorId, ownership.sessionId);
    else if (r.actorId !== actorId || actorId !== scope.actorId) fail();
    if (r.state !== "completed") return null;
    active();
    const request = await requestRow(tx, r, active);
    active();
    const [stored] = await tx
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.permitId, r.id), eq(artifacts.kind, "result")))
      .for("update");
    active();
    if (
      !request ||
      !stored ||
      request.packetJson === null ||
      request.purgedAt !== null ||
      stored.packetJson === null ||
      stored.purgedAt !== null
    )
      return null;
    const retainUntil = r.reservedAt.getTime() + RESEARCH_ARTIFACT_RETENTION_MS;
    if (
      stored.jobCreatedAt.getTime() !== r.reservedAt.getTime() ||
      stored.retainUntil.getTime() !== retainUntil ||
      stored.storedAt.getTime() !== r.finishedAt?.getTime() ||
      stored.packetSha256 !== r.responseSha256
    )
      fail();
    active();
    const beforeClock = performance.now();
    active();
    const now = await clock(tx);
    active();
    if (now.getTime() >= retainUntil) return null;
    const requestPacket = validateResearchRequestRow(request, r, scope),
      packet = readResearchResultPacket(
        stored.packetJson,
        stored.packetSha256,
        requestPacket,
        request.packetSha256,
      );
    if (
      packet.binding.permitId !== r.id ||
      packet.binding.dispatchId !== r.dispatchId ||
      packet.binding.descriptorSha256 !== r.descriptorSha256 ||
      packet.binding.upperPico !== r.upperPico ||
      packet.outcome !== r.state ||
      packet.reported_pico_usd !== r.reportedPico ||
      packet.answer_sha256 !== r.answerSha256 ||
      !packet.answer
    )
      fail();
    active();
    const deadline = beforeClock + retainUntil - now.getTime();
    return {
      value: {
        answer: packet.answer,
        context: requestPacket.context,
        request_revision: packet.request_revision,
        query_revision: packet.query_revision,
        answer_sha256: packet.answer_sha256,
        response_artifact_sha256: stored.packetSha256,
        retain_until_ms: retainUntil,
        retention_deadline: deadline,
      },
      deadline,
      requestBodyJson: requestPacket.body_json,
      requestArtifactSha256: request.packetSha256,
    };
  }
  async function readCompletedPair(
    permitId: string,
    actorId: string,
    ownership: CandidateOwnership,
    signal: AbortSignal,
    inheritedDeadlineAt?: number,
  ) {
    const started = performance.now();
    if (
      !v.safeParse(uuid, permitId).success ||
      actorId !== scope.actorId ||
      (ownership.kind === "same-session" &&
        !v.safeParse(uuid, ownership.sessionId).success) ||
      (inheritedDeadlineAt !== undefined &&
        !Number.isFinite(inheritedDeadlineAt))
    )
      fail();
    const end = Math.min(
      started + RESEARCH_OPERATION_TIMEOUT_MS,
      inheritedDeadlineAt ?? Infinity,
    );
    return withinResearchDeadline(
      signal,
      async (bounded) => {
        const active = () => {
          bounded.throwIfAborted();
          if (performance.now() >= end) fail();
        };
        active();
        const result = await run(
          bounded,
          async (tx) => {
            const { rows } = await load(tx, active);
            active();
            return readValidatedCompletion(
              tx,
              rows.find((r) => r.id === permitId),
              actorId,
              ownership,
              bounded,
              end,
            );
          },
          active,
        );
        active();
        // Preserve the existing null result for unavailable/expired packets; the
        // inherited operation deadline is independently enforced at every await.
        return !result || performance.now() >= result.deadline ? null : result;
      },
      end,
    );
  }
  return {
    /** Irreversibly stop this exact fixed window, preserving all holds, packets and retained reads. Trusted operator startup only. */
    async stopGeneration(signal: AbortSignal) {
      const end = performance.now() + RESEARCH_OPERATION_TIMEOUT_MS;
      return withinResearchDeadline(
        signal,
        async (bounded) => {
          const active = () => {
            bounded.throwIfAborted();
            if (performance.now() >= end) fail();
          };
          await run(
            bounded,
            async (tx) => {
              const { w } = await load(tx, active);
              active();
              if (w.stopped) return;
              const now = await clock(tx);
              active();
              await tx
                .update(windows)
                .set({ stopped: now })
                .where(eq(windows.id, scope.windowId));
              active();
            },
            active,
          );
          active();
        },
        end,
      );
    },
    /** Reconcile the caller's genuine operation/quote against one committed paired completion.
     * No dispatch/retry or delivery/history permission is created. Caller must fence current source access before and after this private read. */
    async readCompletedOperation(
      artifact: PreparedResearchRequestArtifact,
      quote: { upperPico: number; quoteExpiresAtMs: number },
      signal: AbortSignal,
      inheritedDeadlineAt?: number,
    ) {
      const started = performance.now();
      if (
        inheritedDeadlineAt !== undefined &&
        !Number.isFinite(inheritedDeadlineAt)
      )
        fail();
      const expected = artifactRequest(artifact, quote),
        end = Math.min(
          started + RESEARCH_OPERATION_TIMEOUT_MS,
          inheritedDeadlineAt ?? Infinity,
        );
      return withinResearchDeadline(
        signal,
        async (bounded) => {
          let earliest = end;
          const active = () => {
            bounded.throwIfAborted();
            if (performance.now() >= earliest) fail();
          };
          const result = await run(
            bounded,
            async (tx) => {
              const { rows } = await load(tx, active);
              active();
              const r = rows.find(
                (row) => row.operationId === expected.reservation.operationId,
              );
              if (!r) fail();
              owner(
                r,
                expected.reservation.actorId,
                expected.reservation.sessionId,
              );
              if (r.descriptorSha256 !== descriptor(expected.reservation))
                fail();
              const pair = await readValidatedCompletion(
                tx,
                r,
                expected.reservation.actorId,
                {
                  kind: "same-session",
                  sessionId: expected.reservation.sessionId,
                },
                bounded,
                end,
              );
              active();
              if (!pair) return null;
              earliest = Math.min(earliest, pair.deadline);
              active();
              if (
                pair.requestArtifactSha256 !==
                  expected.artifact.packet_sha256 ||
                pair.requestBodyJson !== expected.artifact.packet.body_json
              )
                fail();
              return { permit_id: r.id, ...pair.value };
            },
            active,
          );
          active();
          return result;
        },
        end,
      );
    },
    /** Accounting only; no request sidecar or dispatch authority is created. */
    reserve(value: ResearchReservationRequest, signal: AbortSignal) {
      return reserveInternal(value, signal);
    },
    /** Atomically holds budget and stores exact immutable private request bytes. Replay never adopts accounting-only rows. */
    async reserveWithRequest(
      artifact: PreparedResearchRequestArtifact,
      quote: { upperPico: number; quoteExpiresAtMs: number },
      signal: AbortSignal,
    ) {
      const r = artifactRequest(artifact, quote);
      return reserveInternal(r.reservation, signal, artifact);
    },
    /** Commit one durable accounting marker. A claim alone never proves an HTTP request was sent. */
    beginDispatch(
      permitId: string,
      actorId: string,
      sessionId: string,
      signal: AbortSignal,
    ) {
      return beginDispatchInternal(permitId, actorId, sessionId, signal);
    },
    /** Binds the acknowledged marker to the exact original compiled request object and persisted bytes. */
    beginDispatchWithRequest(
      permitId: string,
      artifact: PreparedResearchRequestArtifact,
      signal: AbortSignal,
    ) {
      const a = inspectResearchRequestArtifact(artifact).packet;
      return beginDispatchInternal(
        permitId,
        a.context.subject.user_id,
        a.context.subject.session_id,
        signal,
        artifact,
      );
    },
    /** Synchronous single-use handoff, immediately before a future sender's one fetch. Source/activation/price gates remain separate. */
    consumeRequestDispatchClaim(
      claim: ResearchDispatchClaim,
      artifact: PreparedResearchRequestArtifact,
      signal: AbortSignal,
    ): AbortSignal {
      const token = claims.get(claim);
      if (
        !token ||
        !token.artifact ||
        token.artifact !== artifact ||
        token.consumed
      )
        fail();
      // Cancellation cannot be replaced with a fresh signal and an attempted handoff is never retryable.
      token.consumed = true;
      if (
        !token.dispatchSignal ||
        token.dispatchSignal.aborted ||
        signal.aborted ||
        token.quoteDeadline === undefined ||
        performance.now() >= token.quoteDeadline
      )
        fail();
      // The future fetch must retain original-job cancellation even if its caller supplies an additional signal.
      const network = AbortSignal.any([token.dispatchSignal, signal]);
      token.handedOff = true;
      return network;
    },
    /** Private server data only. Reading never renews retention or creates a live compiled/dispatch handle. */
    async readRequest(
      permitId: string,
      actorId: string,
      sessionId: string,
      signal: AbortSignal,
    ) {
      const result = await run(signal, async (tx) => {
        const { rows } = await load(tx),
          r = rows.find((r) => r.id === permitId);
        if (!r) fail();
        owner(r, actorId, sessionId);
        const a = await requestRow(tx, r);
        if (!a || a.packetJson === null || a.purgedAt !== null) return null;
        const packet = validateResearchRequestRow(a, r, scope),
          beforeClock = performance.now(),
          now = await clock(tx);
        if (now.getTime() >= a.retainUntil.getTime()) return null;
        return {
          value: { packet, packet_sha256: a.packetSha256 },
          retentionDeadline:
            beforeClock + a.retainUntil.getTime() - now.getTime(),
        };
      });
      return !result || performance.now() >= result.retentionDeadline
        ? null
        : result.value;
    },
    /** Invalid/unknown billing commits indeterminate+stop. Full original holds are never refunded. */
    async finish(
      claim: ResearchDispatchClaim,
      value: unknown,
      signal: AbortSignal,
    ): Promise<ResearchPermitStatus> {
      const token = claims.get(claim);
      if (!token) fail();
      // Once settlement is attempted, this local marker can never authorize a later network handoff.
      if (token.artifact) token.consumed = true;
      const parsed = v.safeParse(resultShape, value);
      return run(signal, async (tx) => {
        const { rows } = await load(tx),
          r = rows.find((r) => r.id === token.permitId);
        if (!r || r.dispatchId !== token.dispatchId) fail();
        owner(r, token.actorId, token.sessionId);
        const result = parsed.success
          ? parsed.output
          : {
              outcome: "indeterminate" as const,
              reportedPico: null,
              responseSha256: null,
            };
        const outcome =
          result.outcome === "completed" && result.reportedPico > r.upperPico
            ? "indeterminate"
            : result.outcome;
        const terminal = {
          state: outcome,
          reportedPico: result.reportedPico,
          responseSha256: result.responseSha256,
          answerSha256:
            result.outcome === "completed" ? result.answerSha256 : null,
        };
        const resultSha256 = terminalFingerprint(r, terminal);
        if (["completed", "failed", "indeterminate"].includes(r.state)) {
          if (r.resultSha256 !== resultSha256) fail();
          return status(r);
        }
        if (r.state !== "dispatching") fail();
        const now = await clock(tx);
        const [saved] = await tx
          .update(permits)
          .set({ ...terminal, resultSha256, finishedAt: now })
          .where(
            and(
              eq(permits.id, r.id),
              eq(permits.state, "dispatching"),
              eq(permits.dispatchId, token.dispatchId),
            ),
          )
          .returning();
        if (!saved) fail();
        // Preserve an earlier native stop exactly; ledger clocks round to milliseconds.
        if (outcome !== "completed")
          await tx
            .update(windows)
            .set({ stopped: sql`coalesce(${windows.stopped}, ${now})` })
            .where(eq(windows.id, scope.windowId));
        return status(saved);
      });
    },
    /** Closed result+terminal root commit. responseSha256 fingerprints this immutable response packet, not only raw HTTP bytes.
     * Use a fresh bounded server cleanup signal; source/session revocation must not prevent accounting settlement.
     * Failure leaves the durable marker/full hold; callers may attempt metadata-only indeterminate cleanup, never completed repair. */
    async finishWithResult(
      claim: ResearchDispatchClaim,
      artifact: PreparedResearchRequestArtifact,
      prepared: PreparedResearchResult,
      signal: AbortSignal,
    ): Promise<ResearchPermitStatus> {
      const token = claims.get(claim);
      if (!token) fail();
      token.consumed = true;
      if (token.artifact !== artifact) fail();
      const expected = inspectResearchRequestArtifact(artifact);
      return run(signal, async (tx) => {
        const { rows } = await load(tx),
          r = rows.find((r) => r.id === token.permitId);
        if (!r || !r.dispatchId || r.dispatchId !== token.dispatchId) fail();
        owner(r, token.actorId, token.sessionId);
        const request = await requestRow(tx, r);
        if (!request) fail();
        validateResearchRequestRow(request, r, scope);
        if (
          request.packetSha256 !== expected.packet_sha256 ||
          request.packetJson !== expected.packet_json
        )
          fail();
        const [prior] = await tx
          .select()
          .from(artifacts)
          .where(
            and(eq(artifacts.permitId, r.id), eq(artifacts.kind, "result")),
          )
          .for("update");
        const result = materializeResearchResult(prepared, artifact, claim, {
          permitId: r.id,
          dispatchId: r.dispatchId,
          descriptorSha256: r.descriptorSha256,
          upperPico: r.upperPico,
        });
        if (result.packet.capture.attempted && !token.handedOff) fail();
        const terminal = {
          state: result.packet.outcome,
          reportedPico: result.packet.reported_pico_usd,
          responseSha256: result.packet_sha256,
          answerSha256: result.packet.answer_sha256,
        };
        const resultSha256 = terminalFingerprint(r, terminal),
          now = await clock(tx),
          retainUntil = r.reservedAt.getTime() + RESEARCH_ARTIFACT_RETENTION_MS;
        if (now.getTime() >= retainUntil) fail();
        if (["completed", "failed", "indeterminate"].includes(r.state)) {
          // A metadata-only terminal state is never repaired/adopted after the fact.
          if (
            r.resultSha256 !== resultSha256 ||
            !prior ||
            prior.packetJson !== result.packet_json ||
            prior.packetSha256 !== result.packet_sha256 ||
            prior.purgedAt !== null ||
            prior.jobCreatedAt.getTime() !== r.reservedAt.getTime() ||
            prior.retainUntil.getTime() !== retainUntil ||
            prior.storedAt.getTime() !== r.finishedAt?.getTime()
          )
            fail();
          return status(r);
        }
        if (r.state !== "dispatching" || prior) fail();
        await tx.insert(artifacts).values({
          permitId: r.id,
          kind: "result",
          packetJson: result.packet_json,
          packetSha256: result.packet_sha256,
          jobCreatedAt: r.reservedAt,
          storedAt: now,
          retainUntil: new Date(retainUntil),
        });
        const [saved] = await tx
          .update(permits)
          .set({ ...terminal, resultSha256, finishedAt: now })
          .where(
            and(
              eq(permits.id, r.id),
              eq(permits.state, "dispatching"),
              eq(permits.dispatchId, token.dispatchId),
            ),
          )
          .returning();
        if (!saved) fail();
        // Preserve an earlier native stop exactly; ledger clocks round to milliseconds.
        if (terminal.state !== "completed")
          await tx
            .update(windows)
            .set({ stopped: sql`coalesce(${windows.stopped}, ${now})` })
            .where(eq(windows.id, scope.windowId));
        return status(saved);
      });
    },
    /** Original same-session private candidate only. Omitted/invalid sessions never choose owner-only behavior. */
    async readCompletedAnswerCandidate(
      permitId: string,
      actorId: string,
      sessionId: string,
      signal: AbortSignal,
      inheritedDeadlineAt?: number,
    ) {
      const pair = await readCompletedPair(
        permitId,
        actorId,
        { kind: "same-session", sessionId },
        signal,
        inheritedDeadlineAt,
      );
      return pair?.value ?? null;
    },
    /** Retained canonical-owner candidate only. No auth, read adoption, delivery, history or generation authority; original processing context stays immutable. */
    async readOwnedCompletedAnswerCandidate(
      permitId: string,
      actorId: string,
      signal: AbortSignal,
      inheritedDeadlineAt?: number,
    ) {
      const pair = await readCompletedPair(
        permitId,
        actorId,
        { kind: "same-actor" },
        signal,
        inheritedDeadlineAt,
      );
      return pair?.value ?? null;
    },
    /** Paired completion + whole qualified text only. Current signed owner/source/generation approval must still precede history admission; no raw request body leaves this module. */
    async readOwnedCompletedHistoryCandidate(
      permitId: string,
      actorId: string,
      signal: AbortSignal,
      inheritedDeadlineAt?: number,
    ): Promise<ResearchCompletedHistoryCandidate | null> {
      const started = performance.now();
      try {
        if (
          inheritedDeadlineAt !== undefined &&
          !Number.isFinite(inheritedDeadlineAt)
        )
          fail();
        const end = Math.min(
          started + RESEARCH_OPERATION_TIMEOUT_MS,
          inheritedDeadlineAt ?? Infinity,
        );
        return await withinResearchDeadline(
          signal,
          async (bounded) => {
            const active = () => {
              bounded.throwIfAborted();
              if (performance.now() >= end) fail();
            };
            active();
            const pair = await readCompletedPair(
              permitId,
              actorId,
              { kind: "same-actor" },
              bounded,
              end,
            );
            active();
            if (!pair || performance.now() >= pair.deadline) return null;
            const display = readResearchOriginalHistoryQuestion(
                pair.requestBodyJson,
              ),
              qualified = formatResearchHistoryCandidate(
                display.question,
                pair.value.answer,
              );
            active();
            if (performance.now() >= pair.deadline || !qualified) return null;
            if (!pair.value.answer_sha256) fail();
            const { answer, ...facts } = pair.value;
            const value = Object.freeze({
              ...facts,
              ...qualified,
              window_id: scope.windowId,
              permit_id: permitId,
              answer_id: answer.answer_id,
              mode: display.mode,
              model: scope.model,
              processor_profile: scope.processorProfile,
              answer_sha256: pair.value.answer_sha256,
              reserved_at_ms:
                pair.value.retain_until_ms - RESEARCH_ARTIFACT_RETENTION_MS,
              request_artifact_sha256: pair.requestArtifactSha256,
              history_text_sha256: createHash("sha256")
                .update(qualified.text)
                .digest("hex"),
            });
            active();
            return performance.now() >= pair.deadline ? null : value;
          },
          end,
        );
      } catch {
        return fail();
      }
    },
    /** Private fixed-window candidates only: actual paired completions and literal original labels, never auth/delivery/history authority. No packet or accounting mutation. */
    async readOwnedCompletedAnswerSummaries(
      actorId: string,
      signal: AbortSignal,
      inheritedDeadlineAt?: number,
    ) {
      if (
        v.parse(uuid, actorId) !== scope.actorId ||
        (inheritedDeadlineAt !== undefined &&
          !Number.isFinite(inheritedDeadlineAt))
      )
        fail();
      const end = Math.min(
        performance.now() + RESEARCH_OPERATION_TIMEOUT_MS,
        inheritedDeadlineAt ?? Infinity,
      );
      return withinResearchDeadline(
        signal,
        async (bounded) => {
          let earliest = Infinity;
          const active = () => {
            bounded.throwIfAborted();
            if (performance.now() >= Math.min(end, earliest)) fail();
          };
          active();
          const result = await run(
            bounded,
            async (tx) => {
              const { rows } = await load(tx, active);
              active();
              const completed = rows
                .filter((r) => r.state === "completed")
                // Match the purger's global UUID ASC lock order; display ordering happens only after all pair locks.
                .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
              if (completed.length > 10) fail();
              const entries: (Omit<
                NonNullable<
                  Awaited<ReturnType<typeof readValidatedCompletion>>
                >["value"],
                "answer"
              > & { summary: ResearchArchiveEntry })[] = [];
              for (const row of completed) {
                active();
                const pair = await withinResearchDeadline(
                  bounded,
                  (s) =>
                    readValidatedCompletion(
                      tx,
                      row,
                      actorId,
                      { kind: "same-actor" },
                      s,
                      Math.min(end, earliest),
                    ),
                  Math.min(end, earliest),
                );
                active();
                if (!pair) continue;
                earliest = Math.min(earliest, pair.deadline);
                active();
                const { answer, ...facts } = pair.value;
                if (answer.origin !== "model") fail();
                const display = readResearchArchiveSummary(
                  pair.requestBodyJson,
                );
                entries.push({
                  ...facts,
                  summary: {
                    permit_id: row.id,
                    answer_id: answer.answer_id,
                    ...display,
                    model_assessment: answer.status,
                    completed_at_ms: row.finishedAt!.getTime(),
                  },
                });
              }
              entries.sort(
                (a, b) =>
                  b.summary.completed_at_ms - a.summary.completed_at_ms ||
                  (a.summary.permit_id > b.summary.permit_id
                    ? -1
                    : a.summary.permit_id < b.summary.permit_id
                      ? 1
                      : 0),
              );
              parseResearchAnswerArchive({
                contract: "magickli-private-research-archive",
                schema_version: 1,
                scope: "original_private_research_window",
                semantic_review: "unreviewed",
                entries: entries.map((e) => e.summary),
              });
              const retention_deadline = Math.min(
                ...entries.map((e) => e.retention_deadline),
              );
              active();
              if (performance.now() >= retention_deadline) fail();
              return { entries, retention_deadline };
            },
            active,
          );
          active();
          if (performance.now() >= result.retention_deadline) fail();
          return result;
        },
        end,
      );
    },
    /** Private metadata lookup only; future HTTP callers must separately authenticate and authorize access. */
    async inspect(
      permitId: string,
      actorId: string,
      sessionId: string,
      signal: AbortSignal,
    ): Promise<ResearchPermitStatus> {
      return run(signal, async (tx) => {
        const { rows } = await load(tx),
          r = rows.find((r) => r.id === permitId);
        if (!r) fail();
        owner(r, actorId, sessionId);
        return status(r);
      });
    },
  };
}
