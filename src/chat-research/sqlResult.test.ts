import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { shortResearchArtifactsDdl } from "../../tests/chat-research/shortRetentionDdl";
import {
  chatResearchPermits as permits,
  chatResearchWindows as windows,
} from "../db/schema/chatResearch";
import { chatResearchArtifacts as artifacts } from "../db/schema/chatResearchArtifacts";
import { createUuidV7 } from "../lib/ids";
import * as boundedModule from "./boundedWork";
import {
  createResearchGatewayCapture,
  type ResearchGatewayHandoff,
} from "./gatewayCapture";
import { gatewayResponseFixture } from "./gatewayResponse.fixture";
import * as historyModule from "./historyCandidate";
import {
  freezeResearchModelRequest,
  inspectFrozenResearchModelRequest,
  RESEARCH_MODEL_ID,
  RESEARCH_PROCESSOR_PROFILE,
} from "./modelRequest";
import {
  inspectResearchRequestArtifact,
  prepareResearchRequestArtifact,
  RESEARCH_ARTIFACT_RETENTION_MS,
} from "./requestArtifact";
import { artifactRequestFixture } from "./requestArtifact.fixture";
import {
  materializeResearchResult,
  prepareResearchResult,
} from "./resultArtifact";
import {
  createSqlResearchAdmission,
  type ResearchAccountingScope,
  type ResearchAdmissionDatabase,
  type ResearchAdmissionTransaction,
} from "./sqlAdmission";
import { createSqlResearchArtifactPurger } from "./sqlArtifacts";

vi.mock("server-only", () => ({}));
const h = await createMemoryPgliteHarness({ schema: { windows, permits } }),
  { db, client } = h;
beforeAll(async () => {
  await client.exec(
    readFileSync(
      new URL("../../drizzle/0023_lethal_hydra.sql", import.meta.url),
      "utf8",
    ),
  );
  await client.exec(shortResearchArtifactsDdl);
});
afterAll(() => client.close());
const active = () => new AbortController().signal;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
let scope: ResearchAccountingScope,
  f: ReturnType<typeof artifactRequestFixture>,
  artifact: ReturnType<typeof prepareResearchRequestArtifact>,
  store: ReturnType<typeof createSqlResearchAdmission>,
  quote: { upperPico: number; quoteExpiresAtMs: number };
async function initialize(
  now = Date.now(),
  database: ResearchAdmissionDatabase = db,
) {
  f = artifactRequestFixture(now + 600000);
  const p = inspectFrozenResearchModelRequest(f.request);
  scope = {
    windowId: createUuidV7(),
    approvalSha256: sha(createUuidV7()),
    actorId: p.context.subject.user_id,
    corpusVersion: p.context.corpus_version,
    model: RESEARCH_MODEL_ID,
    processorProfile: RESEARCH_PROCESSOR_PROFILE,
    beginsAtMs: now - 1000,
    expiresAtMs: now + 3599000,
    maxRequests: 3,
    perRequestPico: 10000000000,
    totalPico: 30000000000,
  };
  await db.insert(windows).values({
    id: scope.windowId,
    approvalSha256: scope.approvalSha256,
    actorId: scope.actorId,
    corpusVersion: scope.corpusVersion,
    model: scope.model,
    processorProfile: scope.processorProfile,
    beginsAt: new Date(scope.beginsAtMs),
    expiresAt: new Date(scope.expiresAtMs),
    maxRequests: scope.maxRequests,
    perRequestPico: scope.perRequestPico,
    totalPico: scope.totalPico,
  });
  artifact = prepareResearchRequestArtifact(
    f.request,
    scope.windowId,
    createUuidV7(),
  );
  quote = { upperPico: 10000000000, quoteExpiresAtMs: now + 50000 };
  store = createSqlResearchAdmission(database, scope);
}
beforeEach(() => initialize());
async function prepare(
  kind: "valid" | "not_attempted" | "transport" | "draft" = "valid",
  handoff?: ResearchGatewayHandoff,
  transform?: (raw: ReturnType<typeof gatewayResponseFixture>) => void,
) {
  const receipt = await store.reserveWithRequest(artifact, quote, active()),
    claim = await store.beginDispatchWithRequest(
      receipt.permitId,
      artifact,
      active(),
    );
  if (!claim) throw Error("Synthetic missing marker");
  const raw = gatewayResponseFixture();
  transform?.(raw);
  if (kind === "draft") raw.output[1].content![0].text = "not JSON";
  const requestFetch = vi.fn<typeof fetch>(async () => {
    if (kind === "transport") throw Error("Synthetic failure");
    return new Response(JSON.stringify(raw), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  const capture = await createResearchGatewayCapture({
    apiKey: "synthetic-sql-result-capture-key",
    handoff: handoff ?? store,
    beforeDispatch: async () => {
      if (kind === "not_attempted") throw Error("Synthetic denied final fence");
    },
    requestFetch,
  })(artifact, claim, active());
  return {
    receipt,
    claim,
    capture,
    prepared: prepareResearchResult(capture, artifact, claim),
    requestFetch,
  };
}
const permit = async (id: string) =>
  (await db.select().from(permits).where(eq(permits.id, id)))[0];
const resultRow = async (id: string) =>
  (
    await db
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.permitId, id), eq(artifacts.kind, "result")))
  )[0];
const windowRow = async () =>
  (await db.select().from(windows).where(eq(windows.id, scope.windowId)))[0];
const read = (id: string) => {
  const p = inspectFrozenResearchModelRequest(f.request).context.subject;
  return store.readCompletedAnswerCandidate(
    id,
    p.user_id,
    p.session_id,
    active(),
  );
};

it("reconciles one genuine operation and quote to its committed paired result", async () => {
  const j = await prepare();
  expect(
    await store.readCompletedOperation(artifact, quote, active()),
  ).toBeNull();
  await store.finishWithResult(j.claim, artifact, j.prepared, active());
  const value = await store.readCompletedOperation(artifact, quote, active());
  expect(value?.permit_id).toBe(j.receipt.permitId);
  expect(value?.answer).toEqual((await read(j.receipt.permitId))!.answer);
  expect(value?.answer_sha256).toBe(sha(JSON.stringify(value!.answer)));
  expect(value?.request_revision).toBe(
    inspectFrozenResearchModelRequest(f.request).request_revision,
  );
});

it("refuses a copied artifact, another operation or quote drift when reconciling completion", async () => {
  const j = await prepare();
  await store.finishWithResult(j.claim, artifact, j.prepared, active());
  await expect(
    store.readCompletedOperation(
      { revision: artifact.revision },
      quote,
      active(),
    ),
  ).rejects.toThrow();
  const sameBody = prepareResearchRequestArtifact(
    f.request,
    scope.windowId,
    createUuidV7(),
  );
  await expect(
    store.readCompletedOperation(sameBody, quote, active()),
  ).rejects.toThrow();
  await expect(
    store.readCompletedOperation(
      artifact,
      { ...quote, upperPico: quote.upperPico - 1 },
      active(),
    ),
  ).rejects.toThrow();
  await expect(
    store.readCompletedOperation(artifact, quote, active(), NaN),
  ).rejects.toThrow();
});

it("stopping generation is idempotent, preserves all spending and paired bytes, and leaves completed reads available", async () => {
  const j = await prepare();
  await store.finishWithResult(j.claim, artifact, j.prepared, active());
  const before = await permit(j.receipt.permitId),
    packets = await db.select().from(artifacts);
  await store.stopGeneration(active());
  const stopped = (await windowRow()).stopped;
  expect(stopped).not.toBeNull();
  await store.stopGeneration(active());
  expect((await windowRow()).stopped).toEqual(stopped);
  expect(await permit(j.receipt.permitId)).toEqual(before);
  expect(await db.select().from(artifacts)).toEqual(packets);
  expect((await read(j.receipt.permitId))?.answer.answer_id).toBe(
    inspectFrozenResearchModelRequest(f.request).answer_id,
  );
  const fresh = prepareResearchRequestArtifact(
    f.request,
    scope.windowId,
    createUuidV7(),
  );
  await expect(
    store.reserveWithRequest(fresh, quote, active()),
  ).rejects.toThrow();
});

it("a cancelled stop or changed scope never mutates the fixed window", async () => {
  const c = new AbortController();
  c.abort();
  await expect(store.stopGeneration(c.signal)).rejects.toThrow();
  const other = createSqlResearchAdmission(db, {
    ...scope,
    corpusVersion: sha("wrong scope"),
  });
  await expect(other.stopGeneration(active())).rejects.toThrow();
  expect((await windowRow()).stopped).toBeNull();
});

it("commits response packet and terminal permit together, with a packet-bound digest and no raw delivery fields", async () => {
  const j = await prepare(),
    saved = await store.finishWithResult(
      j.claim,
      artifact,
      j.prepared,
      active(),
    ),
    p = await permit(j.receipt.permitId),
    r = await resultRow(p.id);
  expect(saved).toMatchObject({ state: "completed", reportedPico: 3000000000 });
  expect(r.packetSha256).toBe(sha(r.packetJson!));
  expect(p.responseSha256).toBe(r.packetSha256);
  expect(r.storedAt).toEqual(p.finishedAt);
  expect(r.jobCreatedAt).toEqual(p.reservedAt);
  const answer = (await read(p.id))!;
  expect(answer.answer.answer_id).toBe(
    inspectFrozenResearchModelRequest(f.request).answer_id,
  );
  expect(answer.response_artifact_sha256).toBe(r.packetSha256);
  expect(answer).not.toHaveProperty("raw_base64");
  expect(answer).not.toHaveProperty("draft");
  expect(answer).not.toHaveProperty("packet");
  expect(answer.retention_deadline).toBeGreaterThan(performance.now());
  expect(j.requestFetch).toHaveBeenCalledTimes(1);
  expect(await windowRow()).toMatchObject({
    requestsUsed: 1,
    heldPico: quote.upperPico,
    stopped: null,
  });
});
it("replays exact concurrent finalization deterministically without changing storage clocks or charging another hold", async () => {
  const j = await prepare(),
    all = await Promise.all(
      Array.from({ length: 4 }, () =>
        store.finishWithResult(j.claim, artifact, j.prepared, active()),
      ),
    );
  expect(all.every((x) => x.state === "completed")).toBe(true);
  const before = await resultRow(j.receipt.permitId),
    p = await permit(j.receipt.permitId);
  expect(
    await store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).toEqual(all[0]);
  expect(await resultRow(p.id)).toEqual(before);
  expect(await permit(p.id)).toEqual(p);
  expect(j.requestFetch).toHaveBeenCalledTimes(1);
});
it("recovers a lost terminal COMMIT acknowledgment by exact replay; metadata-only fallback cannot overwrite completion", async () => {
  let lose = false;
  const database: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      const r = await db.transaction(work, config);
      if (lose) {
        lose = false;
        throw Error("Synthetic ACK lost");
      }
      return r;
    },
  };
  await initialize(Date.now(), database);
  const j = await prepare();
  lose = true;
  await expect(
    store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).rejects.toThrow();
  expect((await permit(j.receipt.permitId)).state).toBe("completed");
  expect(await resultRow(j.receipt.permitId)).toBeTruthy();
  await expect(
    store.finish(
      j.claim,
      { outcome: "indeterminate", reportedPico: null, responseSha256: null },
      active(),
    ),
  ).rejects.toThrow();
  expect(
    await store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).toMatchObject({ state: "completed" });
  expect(await read(j.receipt.permitId)).not.toBeNull();
  expect(j.requestFetch).toHaveBeenCalledTimes(1);
});
it("rolls back packet and terminal writes after late transaction failure, retaining one held dispatch marker", async () => {
  let fail = false;
  const database: ResearchAdmissionDatabase = {
    transaction: (work, config) =>
      db.transaction(async (tx) => {
        const r = await work(tx);
        if (fail) throw Error("Synthetic before COMMIT");
        return r;
      }, config),
  };
  await initialize(Date.now(), database);
  const j = await prepare();
  fail = true;
  await expect(
    store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).rejects.toThrow();
  expect((await permit(j.receipt.permitId)).state).toBe("dispatching");
  expect(await resultRow(j.receipt.permitId)).toBeUndefined();
  expect(await windowRow()).toMatchObject({
    requestsUsed: 1,
    heldPico: quote.upperPico,
  });
  fail = false;
  expect(
    await store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).toMatchObject({ state: "completed" });
  expect(j.requestFetch).toHaveBeenCalledTimes(1);
});
it("rolls back a sidecar when the native terminal CAS returns no row", async () => {
  const j = await prepare();
  await client.exec(
    "create function public.synthetic_skip_research_terminal() returns trigger language plpgsql as $$ begin return null; end $$; create trigger synthetic_skip_research_terminal before update of state on public.chat_research_permits for each row execute function public.synthetic_skip_research_terminal()",
  );
  try {
    await expect(
      store.finishWithResult(j.claim, artifact, j.prepared, active()),
    ).rejects.toThrow();
    expect(await resultRow(j.receipt.permitId)).toBeUndefined();
    expect((await permit(j.receipt.permitId)).state).toBe("dispatching");
  } finally {
    await client.exec(
      "drop trigger synthetic_skip_research_terminal on public.chat_research_permits; drop function public.synthetic_skip_research_terminal()",
    );
  }
  expect(
    await store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).toMatchObject({ state: "completed" });
});
it("never repairs a metadata-only completed row even when its fingerprints match the prepared packet", async () => {
  const j = await prepare(),
    p = await permit(j.receipt.permitId),
    packet = materializeResearchResult(j.prepared, artifact, j.claim, {
      permitId: p.id,
      dispatchId: p.dispatchId!,
      descriptorSha256: p.descriptorSha256,
      upperPico: p.upperPico,
    });
  await store.finish(
    j.claim,
    {
      outcome: "completed",
      reportedPico: packet.packet.reported_pico_usd,
      responseSha256: packet.packet_sha256,
      answerSha256: packet.packet.answer_sha256,
    },
    active(),
  );
  expect(await read(p.id)).toBeNull();
  await expect(
    store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).rejects.toThrow();
  expect(await resultRow(p.id)).toBeUndefined();
});
it("does not upgrade an old failed terminal state or change a packet-bound completed result", async () => {
  const j = await prepare();
  await store.finish(
    j.claim,
    { outcome: "failed", reportedPico: 0, responseSha256: null },
    active(),
  );
  await expect(
    store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).rejects.toThrow();
  expect(await read(j.receipt.permitId)).toBeNull();
  await initialize();
  const second = await prepare();
  await store.finishWithResult(
    second.claim,
    artifact,
    second.prepared,
    active(),
  );
  await expect(
    store.finish(
      second.claim,
      {
        outcome: "completed",
        reportedPico: 3000000001,
        responseSha256: "b".repeat(64),
        answerSha256: "c".repeat(64),
      },
      active(),
    ),
  ).rejects.toThrow();
  expect(await read(second.receipt.permitId)).not.toBeNull();
});
it.each([
  ["not_attempted", "failed", 0],
  ["transport", "indeterminate", null],
  ["draft", "failed", 3000000000],
] as const)(
  "stores %s evidence atomically with %s and full holds",
  async (kind, state, reported) => {
    const j = await prepare(kind),
      saved = await store.finishWithResult(
        j.claim,
        artifact,
        j.prepared,
        active(),
      );
    expect(saved).toMatchObject({ state, reportedPico: reported });
    expect(await resultRow(j.receipt.permitId)).toBeTruthy();
    expect(await read(j.receipt.permitId)).toBeNull();
    expect((await windowRow()).stopped).not.toBeNull();
    expect(await windowRow()).toMatchObject({
      heldPico: quote.upperPico,
      requestsUsed: 1,
    });
  },
);
it("stops on reported cost exceeding the real reserved hold without an eligible answer", async () => {
  quote = { ...quote, upperPico: 1 };
  const j = await prepare();
  expect(
    await store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).toMatchObject({ state: "indeterminate", reportedPico: 3000000000 });
  expect(await read(j.receipt.permitId)).toBeNull();
  expect(
    JSON.parse((await resultRow(j.receipt.permitId)).packetJson!).reason,
  ).toBe("cost_exceeded");
  expect((await windowRow()).stopped).not.toBeNull();
});
it("requires the real acknowledged marker handoff, not a fake port or a settlement burn", async () => {
  const fake: ResearchGatewayHandoff = {
      consumeRequestDispatchClaim: (_c, _a, s) => s,
    },
    j = await prepare("valid", fake),
    cancelled = new AbortController();
  cancelled.abort();
  await expect(store.finish(j.claim, {}, cancelled.signal)).rejects.toThrow();
  await expect(
    store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).rejects.toThrow();
  expect((await permit(j.receipt.permitId)).state).toBe("dispatching");
  expect(await resultRow(j.receipt.permitId)).toBeUndefined();
});
it("burns a valid unused marker before rejecting an invalid result and cannot resume dispatch", async () => {
  const receipt = await store.reserveWithRequest(artifact, quote, active()),
    claim = await store.beginDispatchWithRequest(
      receipt.permitId,
      artifact,
      active(),
    );
  await expect(
    store.finishWithResult(
      claim!,
      artifact,
      { revision: "a".repeat(64) },
      active(),
    ),
  ).rejects.toThrow();
  expect(() =>
    store.consumeRequestDispatchClaim(claim!, artifact, active()),
  ).toThrow();
  expect((await permit(receipt.permitId)).state).toBe("dispatching");
  expect(await resultRow(receipt.permitId)).toBeUndefined();
});
it("rejects copied/foreign claim, artifact, result and owner identities without upgrading a marker", async () => {
  const j = await prepare(),
    other = createSqlResearchAdmission(db, scope);
  await expect(
    other.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).rejects.toThrow();
  await expect(
    store.finishWithResult(
      { kind: "private_research_dispatch_claim" },
      artifact,
      j.prepared,
      active(),
    ),
  ).rejects.toThrow();
  const otherArtifact = prepareResearchRequestArtifact(
    f.request,
    scope.windowId,
    createUuidV7(),
  );
  await expect(
    store.finishWithResult(j.claim, otherArtifact, j.prepared, active()),
  ).rejects.toThrow();
  await expect(
    store.finishWithResult(
      j.claim,
      artifact,
      { revision: j.prepared.revision },
      active(),
    ),
  ).rejects.toThrow();
  await store.finishWithResult(j.claim, artifact, j.prepared, active());
  const p = inspectFrozenResearchModelRequest(f.request).context.subject;
  for (const who of [
    [createUuidV7(), p.session_id],
    [p.user_id, createUuidV7()],
  ])
    await expect(
      store.readCompletedAnswerCandidate(
        j.receipt.permitId,
        who[0],
        who[1],
        active(),
      ),
    ).rejects.toThrow();
  await expect(read(createUuidV7())).rejects.toThrow();
});
it("returns owned completed answer/context data and keeps an unfinished marker non-deliverable", async () => {
  const j = await prepare();
  expect(await read(j.receipt.permitId)).toBeNull();
  await store.finishWithResult(j.claim, artifact, j.prepared, active());
  const first = (await read(j.receipt.permitId))!;
  first.answer.statements[0].text = "changed";
  first.context.bindings.pop();
  const next = (await read(j.receipt.permitId))!;
  expect(next.answer.statements[0].text).not.toBe("changed");
  expect(next.context.bindings).toHaveLength(3);
});
/** Test-only clock interception; no production accounting or retention clock is injectable. */
function clockDatabase(
  readNow: () => number | undefined,
): ResearchAdmissionDatabase {
  return {
    transaction: (work, config) =>
      db.transaction(
        (tx) =>
          work(
            new Proxy(tx, {
              get(target, key) {
                if (key === "select")
                  return (fields: object) => {
                    const now = readNow();
                    return now !== undefined &&
                      Object.keys(fields ?? {}).join() === "now"
                      ? { from: async () => [{ now: new Date(now) }] }
                      : target.select(fields as never);
                  };
                const x = Reflect.get(target, key);
                return typeof x === "function" ? x.bind(target) : x;
              },
            }) as ResearchAdmissionTransaction,
          ),
        config,
      ),
  };
}
it("rejects finalization after the original retention deadline and still permits independent accounting cleanup", async () => {
  const old = Date.now() - RESEARCH_ARTIFACT_RETENTION_MS - 10000;
  let override: number | undefined = old;
  await initialize(
    old,
    clockDatabase(() => override),
  );
  const j = await prepare();
  override = undefined;
  await expect(
    store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).rejects.toThrow();
  expect(await resultRow(j.receipt.permitId)).toBeUndefined();
  expect((await permit(j.receipt.permitId)).state).toBe("dispatching");
  await store.finish(
    j.claim,
    {
      outcome: "indeterminate",
      reportedPico: 3000000000,
      responseSha256: null,
    },
    active(),
  );
  expect((await windowRow()).stopped).not.toBeNull();
});
it("expires and purges both packets without returning completed content or renewing a late replay", async () => {
  // Immutable in-memory fixtures survive between cases; isolate this bounded-batch assertion.
  await createSqlResearchArtifactPurger(db)(100, active());
  const old = Date.now() - RESEARCH_ARTIFACT_RETENTION_MS - 10000;
  let override: number | undefined = old;
  await initialize(
    old,
    clockDatabase(() => override),
  );
  const j = await prepare();
  await store.finishWithResult(j.claim, artifact, j.prepared, active());
  override = undefined;
  expect(await read(j.receipt.permitId)).toBeNull();
  await expect(
    store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).rejects.toThrow();
  expect(await createSqlResearchArtifactPurger(db)(1, active())).toEqual({
    permits: 1,
    packets: 2,
  });
  expect(await read(j.receipt.permitId)).toBeNull();
  expect((await permit(j.receipt.permitId)).state).toBe("completed");
});
it("does not return completed data when a delayed read acknowledgment crosses retention", async () => {
  const j = await prepare();
  await store.finishWithResult(j.claim, artifact, j.prepared, active());
  const r = await resultRow(j.receipt.permitId),
    real = performance.now.bind(performance);
  let advance = 0;
  vi.spyOn(performance, "now").mockImplementation(() => real() + advance);
  const database: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      const value = await clockDatabase(
        () => r.retainUntil.getTime() - 1,
      ).transaction(work, config);
      advance = 100;
      return value;
    },
  };
  try {
    const reader = createSqlResearchAdmission(database, scope),
      p = inspectFrozenResearchModelRequest(f.request).context.subject;
    expect(
      await reader.readCompletedAnswerCandidate(
        j.receipt.permitId,
        p.user_id,
        p.session_id,
        active(),
      ),
    ).toBeNull();
  } finally {
    vi.restoreAllMocks();
  }
});
it("detects a response sidecar rewritten with its own valid hash but no matching ledger digest", async () => {
  const j = await prepare();
  await store.finishWithResult(j.claim, artifact, j.prepared, active());
  const r = await resultRow(j.receipt.permitId),
    packet = JSON.parse(r.packetJson!);
  packet.binding.dispatchId = createUuidV7();
  const text = JSON.stringify(packet);
  await client.exec(
    "alter table public.chat_research_artifacts disable trigger chat_research_artifact_update",
  );
  try {
    await db
      .update(artifacts)
      .set({ packetJson: text, packetSha256: sha(text) })
      .where(
        and(
          eq(artifacts.permitId, j.receipt.permitId),
          eq(artifacts.kind, "result"),
        ),
      );
  } finally {
    await client.exec(
      "alter table public.chat_research_artifacts enable trigger chat_research_artifact_update",
    );
  }
  await expect(read(j.receipt.permitId)).rejects.toThrow();
});
it("never adopts an orphan response sidecar into a later terminal commit", async () => {
  const j = await prepare(),
    p = await permit(j.receipt.permitId),
    packet = materializeResearchResult(j.prepared, artifact, j.claim, {
      permitId: p.id,
      dispatchId: p.dispatchId!,
      descriptorSha256: p.descriptorSha256,
      upperPico: p.upperPico,
    });
  await db.insert(artifacts).values({
    permitId: p.id,
    kind: "result",
    packetJson: packet.packet_json,
    packetSha256: packet.packet_sha256,
    jobCreatedAt: p.reservedAt,
    storedAt: new Date(),
    retainUntil: new Date(
      p.reservedAt.getTime() + RESEARCH_ARTIFACT_RETENTION_MS,
    ),
  });
  await expect(
    store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).rejects.toThrow();
  expect((await permit(p.id)).state).toBe("dispatching");
  expect(await read(p.id)).toBeNull();
});
it("does not certify a result after its original request sidecar has been lost", async () => {
  const j = await prepare();
  await client.exec(
    "alter table public.chat_research_artifacts disable trigger chat_research_artifact_delete",
  );
  try {
    await db
      .delete(artifacts)
      .where(
        and(
          eq(artifacts.permitId, j.receipt.permitId),
          eq(artifacts.kind, "request"),
        ),
      );
  } finally {
    await client.exec(
      "alter table public.chat_research_artifacts enable trigger chat_research_artifact_delete",
    );
  }
  await expect(
    store.finishWithResult(j.claim, artifact, j.prepared, active()),
  ).rejects.toThrow();
  expect(await resultRow(j.receipt.permitId)).toBeUndefined();
  expect((await permit(j.receipt.permitId)).state).toBe("dispatching");
  await store.finish(
    j.claim,
    { outcome: "indeterminate", reportedPico: null, responseSha256: null },
    active(),
  );
  expect((await windowRow()).stopped).not.toBeNull();
});

it("keeps strict sessions separate from explicitly canonical-owner retained candidates", async () => {
  const result = await prepare();
  await store.finishWithResult(
    result.claim,
    artifact,
    result.prepared,
    active(),
  );
  const candidate = await store.readOwnedCompletedAnswerCandidate(
    result.receipt.permitId,
    scope.actorId,
    active(),
  );
  expect(candidate?.answer).toBeDefined();
  await expect(
    store.readCompletedAnswerCandidate(
      result.receipt.permitId,
      scope.actorId,
      undefined as never,
      active(),
    ),
  ).rejects.toThrow();
  await expect(
    store.readCompletedAnswerCandidate(
      result.receipt.permitId,
      scope.actorId,
      createUuidV7(),
      active(),
    ),
  ).rejects.toThrow();
  await expect(
    store.readOwnedCompletedAnswerCandidate(
      result.receipt.permitId,
      createUuidV7(),
      active(),
    ),
  ).rejects.toThrow();
});

it("lists only actual paired completions with original display fields and no payload mutation", async () => {
  const job = await prepare();
  await store.finishWithResult(job.claim, artifact, job.prepared, active());
  const before = JSON.stringify([
    await windowRow(),
    await permit(job.receipt.permitId),
    await resultRow(job.receipt.permitId),
  ]);
  const saved = await store.readOwnedCompletedAnswerSummaries(
    scope.actorId,
    active(),
  );
  expect(saved.entries).toHaveLength(1);
  expect(saved.entries[0].summary).toMatchObject({
    permit_id: job.receipt.permitId,
    answer_id: inspectFrozenResearchModelRequest(f.request).answer_id,
    question: "Synthetic question?",
    mode: "passage",
    model_assessment: "partial",
    completed_at_ms: (await permit(job.receipt.permitId)).finishedAt!.getTime(),
  });
  expect(saved.retention_deadline).toBeGreaterThan(performance.now());
  expect(JSON.stringify(saved)).not.toContain("Synthetic source one.");
  expect(saved.entries[0]).not.toHaveProperty("requestBodyJson");
  expect(saved.entries[0]).not.toHaveProperty("answer");
  expect(
    JSON.stringify([
      await windowRow(),
      await permit(job.receipt.permitId),
      await resultRow(job.receipt.permitId),
    ]),
  ).toBe(before);
});
it("never presents an accounting hold or uncompleted packet as a saved answer", async () => {
  expect(
    (await store.readOwnedCompletedAnswerSummaries(scope.actorId, active()))
      .entries,
  ).toEqual([]);
  await store.reserveWithRequest(artifact, quote, active());
  expect(
    (await store.readOwnedCompletedAnswerSummaries(scope.actorId, active()))
      .entries,
  ).toEqual([]);
});
it.each([NaN, Infinity, -1])(
  "rejects invalid/elapsed archive candidate end %s",
  async (end) => {
    await expect(
      store.readOwnedCompletedAnswerSummaries(scope.actorId, active(), end),
    ).rejects.toThrow();
  },
);
it("refuses another canonical actor before starting archive SQL", async () => {
  const transaction = vi.spyOn(db, "transaction");
  await expect(
    store.readOwnedCompletedAnswerSummaries(createUuidV7(), active()),
  ).rejects.toThrow();
  expect(transaction).not.toHaveBeenCalled();
  transaction.mockRestore();
});

// Actual RAM query builders execute unchanged; the wrapper observes only the
// precise await boundary and optionally simulates a timer-starved native ACK.
function archiveAuditRoot(afterAck: (hop: number) => void) {
  const events: {
    kind: "execute" | "select";
    at: number;
    sql: string;
    params: unknown[];
  }[] = [];
  let hop = 0;
  const record = (
    kind: "execute" | "select",
    query: { sql: string; params: unknown[] },
  ) => {
    events.push({ kind, at: performance.now(), ...query });
  };
  const wrap = (node: object): object =>
    new Proxy(node, {
      get(target, key) {
        const value = Reflect.get(target, key, target);
        if (key === "then" && typeof value === "function")
          return (
            resolve: (v: unknown) => unknown,
            reject: (e: unknown) => unknown,
          ) => {
            const query = (
              target as { toSQL: () => { sql: string; params: unknown[] } }
            ).toSQL();
            record("select", query);
            return Reflect.apply(value, target, [
              (rows: unknown) => {
                afterAck(++hop);
                return resolve(rows);
              },
              reject,
            ]);
          };
        return typeof value === "function"
          ? (...args: unknown[]) => {
              const result = Reflect.apply(value, target, args);
              return result && typeof result === "object"
                ? wrap(result)
                : result;
            }
          : value;
      },
    });
  const root: ResearchAdmissionDatabase = {
    transaction: (work, config) =>
      db.transaction(
        (tx) =>
          work(
            new Proxy(tx, {
              get(target, key) {
                if (key === "execute")
                  return async (...args: unknown[]) => {
                    record("execute", {
                      sql: "root/setup or table lock",
                      params: [],
                    });
                    const result = await Reflect.apply(
                      target.execute,
                      target,
                      args,
                    );
                    afterAck(++hop);
                    return result;
                  };
                if (key === "select")
                  return (...args: unknown[]) =>
                    wrap(Reflect.apply(target.select, target, args));
                const value = Reflect.get(target, key, target);
                return typeof value === "function" ? value.bind(target) : value;
              },
            }) as ResearchAdmissionTransaction,
          ),
        config,
      ),
  };
  return { root, events };
}
it("operation reconciliation preserves its inherited deadline after every actual native ACK", async () => {
  const job = await prepare();
  await store.finishWithResult(job.claim, artifact, job.prepared, active());
  const baseline = archiveAuditRoot(() => {});
  expect(
    await createSqlResearchAdmission(
      baseline.root,
      scope,
    ).readCompletedOperation(artifact, quote, active()),
  ).not.toBeNull();
  expect(baseline.events.length).toBeGreaterThan(5);
  for (let lateHop = 1; lateHop <= baseline.events.length; lateHop++) {
    let now = 0;
    const observed = vi.spyOn(performance, "now").mockImplementation(() => now),
      audit = archiveAuditRoot((hop) => {
        if (hop === lateHop) now = 101;
      });
    try {
      await expect(
        createSqlResearchAdmission(audit.root, scope).readCompletedOperation(
          artifact,
          quote,
          active(),
          100,
        ),
      ).rejects.toThrow();
      expect(audit.events).toHaveLength(lateHop);
      expect(audit.events.every((e) => e.at < 100)).toBe(true);
    } finally {
      observed.mockRestore();
    }
  }
});
it.each(["stop", "reconcile"])(
  "a committed but late %s transaction ACK reports uncertainty without another SQL operation",
  async (kind) => {
    const job = await prepare();
    await store.finishWithResult(job.claim, artifact, job.prepared, active());
    let now = 0;
    const observed = vi.spyOn(performance, "now").mockImplementation(() => now),
      transaction = vi.fn(
        async (...args: Parameters<typeof db.transaction>) => {
          const result = await db.transaction(...args);
          now = 8000;
          return result;
        },
      ),
      owner = createSqlResearchAdmission(
        { transaction } as ResearchAdmissionDatabase,
        scope,
      );
    try {
      await expect(
        kind === "stop"
          ? owner.stopGeneration(active())
          : owner.readCompletedOperation(artifact, quote, active()),
      ).rejects.toThrow();
      expect(transaction).toHaveBeenCalledOnce();
    } finally {
      observed.mockRestore();
    }
    expect((await windowRow()).stopped === null).toBe(kind !== "stop");
    expect((await permit(job.receipt.permitId)).state).toBe("completed");
    expect((await read(job.receipt.permitId))?.answer).toBeDefined();
  },
);
it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
  "archive SQL issues no follow-up after late native ACK %i",
  async (lateHop) => {
    const job = await prepare();
    await store.finishWithResult(job.claim, artifact, job.prepared, active());
    let now = 0;
    const observed = vi.spyOn(performance, "now").mockImplementation(() => now),
      audit = archiveAuditRoot((hop) => {
        if (hop === lateHop) now = 8001;
      }),
      reader = createSqlResearchAdmission(audit.root, scope);
    try {
      await expect(
        reader.readOwnedCompletedAnswerSummaries(scope.actorId, active(), 8000),
      ).rejects.toThrow();
      expect(audit.events).toHaveLength(lateHop);
      expect(audit.events.every((e) => e.at < 8000)).toBe(true);
    } finally {
      observed.mockRestore();
    }
  },
);
it("archive packet locks match the purger's ascending UUID order, then summaries sort independently for display", async () => {
  const first = await prepare();
  await store.finishWithResult(first.claim, artifact, first.prepared, active());
  const next = artifactRequestFixture(
    scope.expiresAtMs,
    "Second saved synthetic question",
  );
  artifact = prepareResearchRequestArtifact(
    freezeResearchModelRequest(next.query, createUuidV7()),
    scope.windowId,
    createUuidV7(),
  );
  const second = await prepare();
  await store.finishWithResult(
    second.claim,
    artifact,
    second.prepared,
    active(),
  );
  const audit = archiveAuditRoot(() => {}),
    reader = createSqlResearchAdmission(audit.root, scope),
    saved = await reader.readOwnedCompletedAnswerSummaries(
      scope.actorId,
      active(),
    ),
    ids = [first.receipt.permitId, second.receipt.permitId].sort();
  const packetLocks = audit.events
    .filter(
      (e) =>
        e.kind === "select" &&
        e.sql.includes('"chat_research_artifacts"') &&
        e.sql.includes("for update"),
    )
    .map((e) => String(e.params[0]) + ":" + e.params[1]);
  expect(packetLocks).toEqual(
    ids.flatMap((id) => [id + ":request", id + ":result"]),
  );
  expect(saved.entries.map((e) => e.summary.permit_id)).toEqual([
    second.receipt.permitId,
    first.receipt.permitId,
  ]);
});
it("list-only elapsed checks do not alter the existing direct accounting writer semantics", async () => {
  let now = 0;
  const observed = vi.spyOn(performance, "now").mockImplementation(() => now),
    audit = archiveAuditRoot((hop) => {
      if (hop === 1) now = 8001;
    }),
    writer = createSqlResearchAdmission(audit.root, scope);
  try {
    const result = await writer.reserveWithRequest(artifact, quote, active());
    expect(result.state).toBe("reserved");
    expect(audit.events.length).toBeGreaterThan(1);
  } finally {
    observed.mockRestore();
  }
});
it("a malformed rehashed response sidecar fails the whole archive instead of becoming empty history", async () => {
  const job = await prepare();
  await store.finishWithResult(job.claim, artifact, job.prepared, active());
  const row = await resultRow(job.receipt.permitId),
    packet = JSON.parse(row.packetJson!);
  packet.binding.dispatchId = createUuidV7();
  const text = JSON.stringify(packet);
  await client.exec(
    "alter table public.chat_research_artifacts disable trigger chat_research_artifact_update",
  );
  try {
    await db
      .update(artifacts)
      .set({ packetJson: text, packetSha256: sha(text) })
      .where(
        and(
          eq(artifacts.permitId, job.receipt.permitId),
          eq(artifacts.kind, "result"),
        ),
      );
  } finally {
    await client.exec(
      "alter table public.chat_research_artifacts enable trigger chat_research_artifact_update",
    );
  }
  await expect(
    store.readOwnedCompletedAnswerSummaries(scope.actorId, active()),
  ).rejects.toThrow();
});
it("a missing pair is unavailable under existing null semantics, never a fabricated completion", async () => {
  const job = await prepare();
  await store.finishWithResult(job.claim, artifact, job.prepared, active());
  await client.exec(
    "alter table public.chat_research_artifacts disable trigger chat_research_artifact_delete",
  );
  try {
    await db
      .delete(artifacts)
      .where(
        and(
          eq(artifacts.permitId, job.receipt.permitId),
          eq(artifacts.kind, "request"),
        ),
      );
  } finally {
    await client.exec(
      "alter table public.chat_research_artifacts enable trigger chat_research_artifact_delete",
    );
  }
  expect(
    (await store.readOwnedCompletedAnswerSummaries(scope.actorId, active()))
      .entries,
  ).toEqual([]);
});
it("archive candidates do not return expired or actually purged immutable packets", async () => {
  const old = Date.now() - RESEARCH_ARTIFACT_RETENTION_MS - 10000;
  let observed: number | undefined = old;
  await initialize(
    old,
    clockDatabase(() => observed),
  );
  const job = await prepare();
  await store.finishWithResult(job.claim, artifact, job.prepared, active());
  observed = undefined;
  expect(
    (await store.readOwnedCompletedAnswerSummaries(scope.actorId, active()))
      .entries,
  ).toEqual([]);
  await createSqlResearchArtifactPurger(db)(100, active());
  expect(
    (await store.readOwnedCompletedAnswerSummaries(scope.actorId, active()))
      .entries,
  ).toEqual([]);
});

it.each(["later-packet", "commit-ack"])(
  "an earlier packet's retention end cannot be renewed by %s",
  async (stage) => {
    const first = await prepare();
    await store.finishWithResult(
      first.claim,
      artifact,
      first.prepared,
      active(),
    );
    const firstRow = await resultRow(first.receipt.permitId),
      next = artifactRequestFixture(
        scope.expiresAtMs,
        "Second synthetic retained question",
      );
    artifact = prepareResearchRequestArtifact(
      freezeResearchModelRequest(next.query, createUuidV7()),
      scope.windowId,
      createUuidV7(),
    );
    const second = await prepare();
    await store.finishWithResult(
      second.claim,
      artifact,
      second.prepared,
      active(),
    );
    let now = 0,
      clockReads = 0;
    const observed = vi.spyOn(performance, "now").mockImplementation(() => now),
      root: ResearchAdmissionDatabase = {
        transaction: async (work, config) => {
          const saved = await db.transaction(
            (tx) =>
              work(
                new Proxy(tx, {
                  get(target, key) {
                    if (key === "select")
                      return (fields: object) => {
                        if (Object.keys(fields ?? {}).join() !== "now")
                          return target.select(fields as never);
                        return {
                          from: async () => {
                            if (++clockReads === 2 && stage === "later-packet")
                              now = 11;
                            return [
                              {
                                now: new Date(
                                  firstRow.retainUntil.getTime() - 10,
                                ),
                              },
                            ];
                          },
                        };
                      };
                    const value = Reflect.get(target, key, target);
                    return typeof value === "function"
                      ? value.bind(target)
                      : value;
                  },
                }) as ResearchAdmissionTransaction,
              ),
            config,
          );
          if (stage === "commit-ack") now = 11;
          return saved;
        },
      },
      reader = createSqlResearchAdmission(root, scope);
    try {
      await expect(
        reader.readOwnedCompletedAnswerSummaries(scope.actorId, active(), 8000),
      ).rejects.toThrow();
      expect(clockReads).toBe(2);
    } finally {
      observed.mockRestore();
    }
  },
);

it.each(["owner", "same-session"] as const)(
  "%s single-answer reads stop after each late native ACK",
  async (kind) => {
    const job = await prepare();
    await store.finishWithResult(job.claim, artifact, job.prepared, active());
    for (let lateHop = 1; lateHop <= 12; lateHop++) {
      let now = 0;
      const observed = vi
          .spyOn(performance, "now")
          .mockImplementation(() => now),
        audit = archiveAuditRoot((hop) => {
          if (hop === lateHop) now = 101;
        }),
        reader = createSqlResearchAdmission(audit.root, scope),
        subject = inspectFrozenResearchModelRequest(f.request).context.subject;
      try {
        await expect(
          kind === "owner"
            ? reader.readOwnedCompletedAnswerCandidate(
                job.receipt.permitId,
                scope.actorId,
                active(),
                100,
              )
            : reader.readCompletedAnswerCandidate(
                job.receipt.permitId,
                scope.actorId,
                subject.session_id,
                active(),
                100,
              ),
        ).rejects.toThrow();
        expect(audit.events).toHaveLength(lateHop);
        expect(audit.events.every((e) => e.at < 100)).toBe(true);
      } finally {
        observed.mockRestore();
      }
    }
  },
);
it.each(["owner", "same-session"] as const)(
  "%s single-answer reads reject an inherited end crossed only by confirmed root return",
  async (kind) => {
    const job = await prepare();
    await store.finishWithResult(job.claim, artifact, job.prepared, active());
    let now = 0;
    const observed = vi.spyOn(performance, "now").mockImplementation(() => now),
      audit = archiveAuditRoot(() => {}),
      root: ResearchAdmissionDatabase = {
        transaction: async (work, config) => {
          const result = await audit.root.transaction(work, config);
          now = 101;
          return result;
        },
      },
      reader = createSqlResearchAdmission(root, scope),
      subject = inspectFrozenResearchModelRequest(f.request).context.subject;
    try {
      await expect(
        kind === "owner"
          ? reader.readOwnedCompletedAnswerCandidate(
              job.receipt.permitId,
              scope.actorId,
              active(),
              100,
            )
          : reader.readCompletedAnswerCandidate(
              job.receipt.permitId,
              scope.actorId,
              subject.session_id,
              active(),
              100,
            ),
      ).rejects.toThrow();
      expect(audit.events.length).toBeGreaterThan(1);
      expect(audit.events.every((e) => e.at < 100)).toBe(true);
    } finally {
      observed.mockRestore();
    }
  },
);
it.each(["default", "long-parent"])(
  "a %s single-answer read cannot exceed its original eight seconds",
  async (kind) => {
    const job = await prepare();
    await store.finishWithResult(job.claim, artifact, job.prepared, active());
    let now = 0;
    const observed = vi.spyOn(performance, "now").mockImplementation(() => now),
      audit = archiveAuditRoot((hop) => {
        if (hop === 1) now = 8001;
      }),
      reader = createSqlResearchAdmission(audit.root, scope);
    try {
      await expect(
        reader.readOwnedCompletedAnswerCandidate(
          job.receipt.permitId,
          scope.actorId,
          active(),
          kind === "default" ? undefined : 1000000,
        ),
      ).rejects.toThrow();
      expect(audit.events).toHaveLength(1);
    } finally {
      observed.mockRestore();
    }
  },
);
it.each([
  "bad-permit",
  "other-owner",
  "missing-session",
  "nan",
  "infinite",
  "elapsed",
])("invalid single-answer %s starts no SQL", async (kind) => {
  const transaction = vi.spyOn(db, "transaction");
  try {
    await expect(
      kind === "missing-session"
        ? store.readCompletedAnswerCandidate(
            createUuidV7(),
            scope.actorId,
            undefined as never,
            active(),
          )
        : store.readOwnedCompletedAnswerCandidate(
            kind === "bad-permit" ? "bad" : createUuidV7(),
            kind === "other-owner" ? createUuidV7() : scope.actorId,
            active(),
            kind === "nan"
              ? NaN
              : kind === "infinite"
                ? Infinity
                : kind === "elapsed"
                  ? performance.now() - 1
                  : undefined,
          ),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  } finally {
    transaction.mockRestore();
  }
});

it("recreates a whole qualified history candidate from actual paired packets without old opaque answer handles or mutation", async () => {
  const job = await prepare();
  await store.finishWithResult(job.claim, artifact, job.prepared, active());
  await db
    .update(windows)
    .set({ stopped: new Date() })
    .where(eq(windows.id, scope.windowId));
  const before = JSON.stringify([
      await windowRow(),
      await permit(job.receipt.permitId),
      await db.select().from(artifacts),
    ]),
    coldStore = createSqlResearchAdmission(db, scope),
    saved = await coldStore.readOwnedCompletedHistoryCandidate(
      job.receipt.permitId,
      scope.actorId,
      active(),
    ),
    original = await read(job.receipt.permitId);
  expect(saved).not.toBeNull();
  expect(saved).toMatchObject({
    window_id: scope.windowId,
    permit_id: job.receipt.permitId,
    answer_id: original!.answer.answer_id,
    question: "Synthetic question?",
    mode: "passage",
    model: scope.model,
    processor_profile: scope.processorProfile,
    context: original!.context,
    request_revision: original!.request_revision,
    query_revision: original!.query_revision,
    answer_sha256: original!.answer_sha256,
    response_artifact_sha256: original!.response_artifact_sha256,
  });
  expect(saved!.text).toBe(
    historyModule.formatResearchHistoryCandidate(
      saved!.question,
      original!.answer,
    )!.text,
  );
  expect(saved!.history_text_sha256).toBe(sha(saved!.text));
  expect(saved!.retain_until_ms).toBe(original!.retain_until_ms);
  expect(saved!.retention_deadline).toBeGreaterThan(performance.now());
  for (const key of [
    "answer",
    "requestBodyJson",
    "body_json",
    "draft",
    "raw_base64",
  ])
    expect(saved).not.toHaveProperty(key);
  expect(
    JSON.stringify([
      await windowRow(),
      await permit(job.receipt.permitId),
      await db.select().from(artifacts),
    ]),
  ).toBe(before);
});
it("never treats a pending or missing durable pair as completed history", async () => {
  const job = await prepare();
  expect(
    await store.readOwnedCompletedHistoryCandidate(
      job.receipt.permitId,
      scope.actorId,
      active(),
    ),
  ).toBeNull();
  await expect(
    store.readOwnedCompletedHistoryCandidate(
      createUuidV7(),
      scope.actorId,
      active(),
    ),
  ).rejects.toThrow();
});
it("declines a genuinely completed oversized qualified answer while preserving the complete retrievable answer", async () => {
  const job = await prepare("valid", undefined, (raw) => {
    raw.output[1].content![0].text = JSON.stringify({
      status: "supported",
      statements: [1, 2, 3].map((n) => ({
        type: "passage_statement",
        id: "s" + n,
        kind: "answer",
        text: "x".repeat(3000),
        evidence_ids: ["passage1"],
      })),
      issues: [],
    });
  });
  await store.finishWithResult(job.claim, artifact, job.prepared, active());
  const before = JSON.stringify([
    await windowRow(),
    await permit(job.receipt.permitId),
    await resultRow(job.receipt.permitId),
  ]);
  expect(
    await store.readOwnedCompletedHistoryCandidate(
      job.receipt.permitId,
      scope.actorId,
      active(),
    ),
  ).toBeNull();
  expect(
    (await read(job.receipt.permitId))!.answer.statements.map(
      (s) => s.text.length,
    ),
  ).toEqual([3000, 3000, 3000]);
  expect(
    JSON.stringify([
      await windowRow(),
      await permit(job.receipt.permitId),
      await resultRow(job.receipt.permitId),
    ]),
  ).toBe(before);
});
it.each(["body-end", "packet-end"])(
  "history formatting cannot renew the original %s",
  async (kind) => {
    const job = await prepare();
    await store.finishWithResult(job.claim, artifact, job.prepared, active());
    const r = await resultRow(job.receipt.permitId),
      format = historyModule.formatResearchHistoryCandidate;
    let now = 0;
    const observed = vi.spyOn(performance, "now").mockImplementation(() => now),
      formatter = vi
        .spyOn(historyModule, "formatResearchHistoryCandidate")
        .mockImplementation((...args) => {
          const value = format(...args);
          now = kind === "body-end" ? 101 : 2;
          return value;
        }),
      reader = createSqlResearchAdmission(
        kind === "packet-end"
          ? clockDatabase(() => r.retainUntil.getTime() - 1)
          : db,
        scope,
      );
    try {
      const pending = reader.readOwnedCompletedHistoryCandidate(
        job.receipt.permitId,
        scope.actorId,
        active(),
        100,
      );
      if (kind === "body-end") await expect(pending).rejects.toThrow();
      else expect(await pending).toBeNull();
      expect(formatter).toHaveBeenCalledOnce();
    } finally {
      formatter.mockRestore();
      observed.mockRestore();
    }
  },
);
it("history candidates preserve all twelve original ACK boundaries", async () => {
  const job = await prepare();
  await store.finishWithResult(job.claim, artifact, job.prepared, active());
  for (let lateHop = 1; lateHop <= 12; lateHop++) {
    let now = 0;
    const observed = vi.spyOn(performance, "now").mockImplementation(() => now),
      audit = archiveAuditRoot((hop) => {
        if (hop === lateHop) now = 101;
      }),
      reader = createSqlResearchAdmission(audit.root, scope);
    try {
      await expect(
        reader.readOwnedCompletedHistoryCandidate(
          job.receipt.permitId,
          scope.actorId,
          active(),
          100,
        ),
      ).rejects.toThrow();
      expect(audit.events).toHaveLength(lateHop);
      expect(audit.events.every((e) => e.at < 100)).toBe(true);
    } finally {
      observed.mockRestore();
    }
  }
});
it.each(["owner", "permit", "nan", "infinite", "elapsed", "aborted"])(
  "invalid history candidate %s starts no SQL",
  async (kind) => {
    const transaction = vi.spyOn(db, "transaction"),
      controller = new AbortController();
    if (kind === "aborted") controller.abort();
    try {
      await expect(
        store.readOwnedCompletedHistoryCandidate(
          kind === "permit" ? "invalid" : createUuidV7(),
          kind === "owner" ? createUuidV7() : scope.actorId,
          controller.signal,
          kind === "nan"
            ? NaN
            : kind === "infinite"
              ? Infinity
              : kind === "elapsed"
                ? performance.now() - 1
                : undefined,
        ),
      ).rejects.toThrow();
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      transaction.mockRestore();
    }
  },
);

it("does no history formatting when the already validated pair expires at its fulfilled-wrapper boundary", async () => {
  const job = await prepare();
  await store.finishWithResult(job.claim, artifact, job.prepared, active());
  const row = await resultRow(job.receipt.permitId),
    original = boundedModule.withinResearchDeadline;
  let now = 0;
  const observed = vi.spyOn(performance, "now").mockImplementation(() => now),
    formatter = vi.spyOn(historyModule, "formatResearchHistoryCandidate"),
    bounded = vi
      .spyOn(boundedModule, "withinResearchDeadline")
      .mockImplementation(
        async <T>(
          signal: AbortSignal,
          work: (s: AbortSignal) => Promise<T>,
          end?: number,
        ): Promise<T> => {
          const value = await original(signal, work, end);
          if (
            value &&
            typeof value === "object" &&
            Object.hasOwn(value, "requestBodyJson")
          )
            now = 2;
          return value;
        },
      ),
    reader = createSqlResearchAdmission(
      clockDatabase(() => row.retainUntil.getTime() - 1),
      scope,
    );
  try {
    expect(
      await reader.readOwnedCompletedHistoryCandidate(
        job.receipt.permitId,
        scope.actorId,
        active(),
        100,
      ),
    ).toBeNull();
    expect(formatter).not.toHaveBeenCalled();
  } finally {
    bounded.mockRestore();
    formatter.mockRestore();
    observed.mockRestore();
  }
});

it("completes an explicit history child from actual paired data, binds private identity on replay, and never admits a chain", async () => {
  const parent = await prepare();
  await store.finishWithResult(
    parent.claim,
    artifact,
    parent.prepared,
    active(),
  );
  const parentPacket = inspectResearchRequestArtifact(artifact),
    candidate = await store.readOwnedCompletedHistoryCandidate(
      parent.receipt.permitId,
      scope.actorId,
      active(),
    );
  expect(candidate).not.toBeNull();
  expect(candidate!.request_artifact_sha256).toBe(parentPacket.packet_sha256);
  expect(candidate!.reserved_at_ms + RESEARCH_ARTIFACT_RETENTION_MS).toBe(
    candidate!.retain_until_ms,
  );
  const current = artifactRequestFixture(
      Date.now() + 60000,
      "What about that?",
    ),
    answerId = createUuidV7(),
    operation = createUuidV7(),
    history = { candidate: candidate!, scope },
    request = freezeResearchModelRequest(current.query, answerId, history),
    childArtifact = prepareResearchRequestArtifact(
      request,
      scope.windowId,
      operation,
    ),
    receipt = await store.reserveWithRequest(childArtifact, quote, active()),
    claim = await store.beginDispatchWithRequest(
      receipt.permitId,
      childArtifact,
      active(),
    );
  expect(claim).not.toBeNull();
  const capture = await createResearchGatewayCapture({
    apiKey: "synthetic-history-child-key",
    handoff: store,
    beforeDispatch: async () => {},
    requestFetch: async () =>
      new Response(JSON.stringify(gatewayResponseFixture()), {
        headers: { "content-type": "application/json" },
      }),
  })(childArtifact, claim!, active());
  const result = prepareResearchResult(capture, childArtifact, claim!);
  await store.finishWithResult(claim!, childArtifact, result, active());
  const saved = await store.readOwnedCompletedAnswerCandidate(
    receipt.permitId,
    scope.actorId,
    active(),
  );
  expect(saved?.answer.answer_id).toBe(answerId);
  const archived = await store.readOwnedCompletedAnswerSummaries(
    scope.actorId,
    active(),
  );
  expect(archived.entries.map((e) => e.summary)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        permit_id: receipt.permitId,
        input_kind: "follow_up",
      }),
      expect.objectContaining({
        permit_id: parent.receipt.permitId,
        input_kind: "original_question",
      }),
    ]),
  );
  await expect(
    store.readOwnedCompletedHistoryCandidate(
      receipt.permitId,
      scope.actorId,
      active(),
    ),
  ).rejects.toThrow();
  // Pure compiler data can be copied; the actual immutable packet must still bind it.
  // Here only the private parent locator differs. Hosted bytes/operation remain identical.
  const changed = freezeResearchModelRequest(current.query, answerId, {
      ...history,
      candidate: { ...candidate!, permit_id: createUuidV7() },
    }),
    otherArtifact = prepareResearchRequestArtifact(
      changed,
      scope.windowId,
      operation,
    );
  expect(inspectFrozenResearchModelRequest(changed).body_json).toBe(
    inspectFrozenResearchModelRequest(request).body_json,
  );
  expect(otherArtifact.revision).not.toBe(childArtifact.revision);
  await expect(
    store.reserveWithRequest(otherArtifact, quote, active()),
  ).rejects.toThrow();
  expect((await windowRow()).requestsUsed).toBe(2);
  const audit = archiveAuditRoot(() => {}),
    cold = createSqlResearchAdmission(audit.root, scope);
  const reread = await cold.readOwnedCompletedAnswerCandidate(
    receipt.permitId,
    scope.actorId,
    active(),
  );
  expect(reread?.answer.answer_id).toBe(answerId);
  expect(
    audit.events.some((e) => e.params.includes(parent.receipt.permitId)),
  ).toBe(false);
});

it.each(["metadata", "paired-result"] as const)(
  "preserves a native microsecond stop through actual %s terminal settlement under the window guard",
  async (kind) => {
    await client.exec(
      readFileSync(
        new URL(
          "../../drizzle/0026_chat_research_window_guard.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    try {
      const [{ at }] = (
        await client.query<{ at: string }>(
          "select (date_trunc('milliseconds',clock_timestamp()-interval '250 milliseconds')+interval '500 microseconds')::text at",
        )
      ).rows;
      // Freeze only native ledger clock probes in the SAME millisecond. All actual
      // reserve/dispatch/stop/settlement SQL and the migration trigger still run.
      const precise: ResearchAdmissionDatabase = {
        transaction: (work, config) =>
          db.transaction(async (tx) => {
            const controlled = new Proxy(tx, {
              get(target, key) {
                if (key === "select")
                  return (fields?: Record<string, unknown>) =>
                    Reflect.apply(target.select, target, [
                      fields &&
                      Object.keys(fields).length === 1 &&
                      "now" in fields
                        ? {
                            now: sql<Date>`date_trunc('milliseconds',${at}::timestamptz)`.mapWith(
                              (value: string | Date) => new Date(value),
                            ),
                          }
                        : fields,
                    ]);
                const value = Reflect.get(target, key, target);
                return typeof value === "function" ? value.bind(target) : value;
              },
            });
            return work(controlled);
          }, config),
      };
      store = createSqlResearchAdmission(precise, scope);
      const job = await prepare("transport");
      await store.stopGeneration(active());
      await client.query(
        "update public.chat_research_windows set stopped_at=$1::timestamptz where id=$2",
        [at, scope.windowId],
      );
      // This is precisely the old rounded-down overwrite: ensure it is rejected,
      // then require the genuine terminal path to commit without changing the stop.
      await expect(
        client.query(
          "update public.chat_research_windows set stopped_at=date_trunc('milliseconds',stopped_at) where id=$1",
          [scope.windowId],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      if (kind === "metadata")
        await store.finish(
          job.claim,
          { outcome: "failed", reportedPico: null, responseSha256: null },
          active(),
        );
      else
        await store.finishWithResult(
          job.claim,
          artifact,
          job.prepared,
          active(),
        );
      const [{ same }] = (
        await client.query<{ same: boolean }>(
          "select stopped_at=$1::timestamptz same from public.chat_research_windows where id=$2",
          [at, scope.windowId],
        )
      ).rows;
      expect(same).toBe(true);
      expect((await permit(job.receipt.permitId)).state).toBe(
        kind === "metadata" ? "failed" : "indeterminate",
      );
      expect(await windowRow()).toMatchObject({
        requestsUsed: 1,
        heldPico: quote.upperPico,
      });
    } finally {
      await client.exec(
        "drop trigger chat_research_window_update on public.chat_research_windows;drop function public.chat_research_window_change();",
      );
    }
  },
);
