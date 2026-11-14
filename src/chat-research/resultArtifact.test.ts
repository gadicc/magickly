import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createUuidV7 } from "../lib/ids";
import { createResearchGatewayCapture } from "./gatewayCapture";
import { gatewayResponseFixture } from "./gatewayResponse.fixture";
import {
  inspectResearchRequestArtifact,
  prepareResearchRequestArtifact,
} from "./requestArtifact";
import { artifactRequestFixture } from "./requestArtifact.fixture";
import {
  materializeResearchResult,
  prepareResearchResult,
  RESEARCH_RESULT_ARTIFACT_BYTE_LIMIT,
  RESEARCH_RESULT_ARTIFACT_ERROR,
  readResearchResultPacket,
} from "./resultArtifact";
import type { ResearchDispatchClaim } from "./sqlAdmission";

vi.mock("server-only", () => ({}));
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
async function fixture(
  kind:
    | "valid"
    | "not_attempted"
    | "transport"
    | "http"
    | "envelope"
    | "draft" = "valid",
) {
  const f = artifactRequestFixture(),
    artifact = prepareResearchRequestArtifact(
      f.request,
      createUuidV7(),
      createUuidV7(),
    ),
    claim: ResearchDispatchClaim = { kind: "private_research_dispatch_claim" },
    response = gatewayResponseFixture();
  if (kind === "draft")
    response.output[1].content![0].text =
      '{"status":"supported","statements":[{"type":"passage_statement","id":"s1","kind":"answer","text":"Synthetic unsupported alias","evidence_ids":["passage4"]}],"issues":[]}';
  const send = createResearchGatewayCapture({
    apiKey: "synthetic-result-packet-api-key",
    handoff: { consumeRequestDispatchClaim: (_c, _a, s) => s },
    beforeDispatch: async () => {
      if (kind === "not_attempted") throw Error("Synthetic preflight denial");
    },
    requestFetch: async () => {
      if (kind === "transport") throw Error("Synthetic request failure");
      return new Response(
        kind === "envelope" ? "{" : JSON.stringify(response),
        {
          status: kind === "http" ? 500 : 200,
          headers: { "content-type": "application/json" },
        },
      );
    },
  });
  const capture = await send(artifact, claim, new AbortController().signal),
    result = prepareResearchResult(capture, artifact, claim),
    binding = {
      permitId: createUuidV7(),
      dispatchId: createUuidV7(),
      descriptorSha256: "a".repeat(64),
      upperPico: 10000000000,
    };
  const a = inspectResearchRequestArtifact(artifact),
    packet = materializeResearchResult(result, artifact, claim, binding);
  const read = (text = packet.packet_json, digest = sha(text)) =>
    readResearchResultPacket(text, digest, a.packet, a.packet_sha256);
  return { ...f, artifact, claim, capture, result, binding, a, packet, read };
}
describe("private deterministic response artifact packet", () => {
  it("observes genuine matching captures, projects a typed answer and canonicalizes deterministic locked-permit bytes", async () => {
    const f = await fixture(),
      p = f.packet;
    expect(Object.isFrozen(f.result)).toBe(true);
    expect(p.packet).toMatchObject({
      binding: f.binding,
      request_artifact_sha256: f.artifact.revision,
      request_revision: f.request.revision,
      outcome: "completed",
      reason: "validated_answer",
      reported_pico_usd: 3000000000,
    });
    expect(p.packet.answer!.answer_id).toBe(f.a.packet.answer_id);
    expect(p.packet.answer!.semantic_review).toBe("unreviewed");
    expect(p.packet.answer_sha256).toBe(sha(JSON.stringify(p.packet.answer)));
    expect(p.packet_sha256).toBe(sha(p.packet_json));
    expect(f.read()).toEqual(p.packet);
    expect(
      materializeResearchResult(f.result, f.artifact, f.claim, f.binding),
    ).toEqual(p);
    expect(
      materializeResearchResult(f.result, f.artifact, f.claim, {
        ...f.binding,
        permitId: createUuidV7(),
      }).packet_sha256,
    ).not.toBe(p.packet_sha256);
    expect(p.packet).not.toHaveProperty("packet_sha256");
    expect(p.packet).not.toHaveProperty("resultSha256");
  });
  it("owns inspection/serialization values and never creates a prepared result from parsed/copied handles", async () => {
    const f = await fixture(),
      out = f.read();
    out.answer!.statements[0].text = "changed";
    expect(f.read().answer!.statements[0].text).not.toBe("changed");
    f.packet.packet.capture.complete = false;
    expect(
      materializeResearchResult(f.result, f.artifact, f.claim, f.binding).packet
        .capture.complete,
    ).toBe(true);
    expect(() =>
      materializeResearchResult(
        { revision: f.result.revision },
        f.artifact,
        f.claim,
        f.binding,
      ),
    ).toThrow(RESEARCH_RESULT_ARTIFACT_ERROR);
    expect(() =>
      prepareResearchResult(
        { revision: f.capture.revision },
        f.artifact,
        f.claim,
      ),
    ).toThrow(RESEARCH_RESULT_ARTIFACT_ERROR);
    expect(() =>
      materializeResearchResult(
        f.result,
        f.artifact,
        { kind: "private_research_dispatch_claim" },
        f.binding,
      ),
    ).toThrow(RESEARCH_RESULT_ARTIFACT_ERROR);
    const equal = prepareResearchRequestArtifact(
      f.request,
      f.a.packet.window_id,
      f.a.packet.operation_id,
    );
    expect(() => prepareResearchResult(f.capture, equal, f.claim)).toThrow(
      RESEARCH_RESULT_ARTIFACT_ERROR,
    );
    expect(() =>
      materializeResearchResult(f.result, equal, f.claim, f.binding),
    ).toThrow(RESEARCH_RESULT_ARTIFACT_ERROR);
  });
  it.each(["valid", "draft"] as const)(
    "classifies over-held known cost as indeterminate for %s output, without retaining a deliverable answer",
    async (kind) => {
      const f = await fixture(kind),
        p = materializeResearchResult(f.result, f.artifact, f.claim, {
          ...f.binding,
          upperPico: 1,
        });
      expect(p.packet).toMatchObject({
        outcome: "indeterminate",
        reason: "cost_exceeded",
        reported_pico_usd: 3000000000,
        answer: null,
        draft: null,
        answer_sha256: null,
      });
      expect(f.read(p.packet_json)).toEqual(p.packet);
    },
  );
  it.each([
    ["not_attempted", "failed", "not_attempted", 0],
    ["transport", "indeterminate", "transport_failure", null],
    ["http", "indeterminate", "transport_failure", null],
    ["envelope", "indeterminate", "invalid_response", null],
    ["draft", "failed", "invalid_answer", 3000000000],
  ] as const)(
    "preserves %s evidence with %s/%s and exact known-or-unknown cost",
    async (kind, outcome, reason, cost) => {
      const f = await fixture(kind);
      expect(f.packet.packet).toMatchObject({
        outcome,
        reason,
        reported_pico_usd: cost,
        answer: null,
        draft: null,
        answer_sha256: null,
      });
      expect(f.read()).toEqual(f.packet.packet);
    },
  );
  it("bounds and validates real binding data before materialization", async () => {
    const f = await fixture();
    for (const delta of [
      { permitId: "bad" },
      { dispatchId: "bad" },
      { descriptorSha256: "not a hash" },
      { upperPico: 0 },
      { upperPico: 350000000001 },
    ])
      expect(() =>
        materializeResearchResult(f.result, f.artifact, f.claim, {
          ...f.binding,
          ...delta,
        }),
      ).toThrow(RESEARCH_RESULT_ARTIFACT_ERROR);
  });
});
describe("canonical persisted packet consistency", () => {
  it("rejects malformed/oversized/noncanonical bytes and wrong hashes without reifying a completion handle", async () => {
    const f = await fixture();
    for (const text of [
      "{",
      "null",
      f.packet.packet_json + " ",
      "x".repeat(RESEARCH_RESULT_ARTIFACT_BYTE_LIMIT + 1),
    ])
      expect(() => f.read(text)).toThrow(RESEARCH_RESULT_ARTIFACT_ERROR);
    expect(() => f.read(f.packet.packet_json, "a".repeat(64))).toThrow(
      RESEARCH_RESULT_ARTIFACT_ERROR,
    );
    expect(() => f.read(f.packet.packet_json, "a\n".repeat(32))).toThrow(
      RESEARCH_RESULT_ARTIFACT_ERROR,
    );
  });
  it("rejects swapped request/capture/receipt/answer fields even when the outer packet digest is recomputed", async () => {
    const f = await fixture();
    for (const mutate of [
      (p: typeof f.packet.packet) => {
        p.request_revision = "b".repeat(64);
      },
      (p: typeof f.packet.packet) => {
        p.query_revision = "b".repeat(64);
      },
      (p: typeof f.packet.packet) => {
        p.prepared_revision = "b".repeat(64);
      },
      (p: typeof f.packet.packet) => {
        p.source_context_sha256 = "b".repeat(64);
      },
      (p: typeof f.packet.packet) => {
        p.answer_id = createUuidV7();
      },
      (p: typeof f.packet.packet) => {
        p.capture.request_artifact_sha256 = "b".repeat(64);
      },
      (p: typeof f.packet.packet) => {
        p.capture.captured_bytes++;
      },
      (p: typeof f.packet.packet) => {
        p.capture.captured_sha256 = "b".repeat(64);
      },
      (p: typeof f.packet.packet) => {
        p.capture.received_bytes = 0;
      },
      (p: typeof f.packet.packet) => {
        p.capture_revision = "b".repeat(64);
      },
      (p: typeof f.packet.packet) => {
        p.raw_base64 += "=";
      },
      (p: typeof f.packet.packet) => {
        p.reported_pico_usd = 0;
      },
      (p: typeof f.packet.packet) => {
        p.receipt!.input_tokens++;
      },
      (p: typeof f.packet.packet) => {
        p.answer_sha256 = "b".repeat(64);
      },
      (p: typeof f.packet.packet) => {
        p.outcome = "failed";
      },
      (p: typeof f.packet.packet) => {
        p.answer = null;
      },
      (p: typeof f.packet.packet) => {
        p.draft = null;
      },
      (p: typeof f.packet.packet) => {
        p.binding.upperPico = 1;
      },
    ]) {
      const packet = structuredClone(f.packet.packet);
      mutate(packet);
      expect(() => f.read(JSON.stringify(packet))).toThrow(
        RESEARCH_RESULT_ARTIFACT_ERROR,
      );
    }
    const other = await fixture();
    expect(() =>
      readResearchResultPacket(
        f.packet.packet_json,
        f.packet.packet_sha256,
        other.a.packet,
        other.a.packet_sha256,
      ),
    ).toThrow(RESEARCH_RESULT_ARTIFACT_ERROR);
  });
  it("keeps failed observations from acquiring an answer or completed outcome", async () => {
    const f = await fixture("draft"),
      good = await fixture();
    for (const delta of [
      {
        answer: good.packet.packet.answer,
        answer_sha256: good.packet.packet.answer_sha256,
      },
      { outcome: "completed" },
      { reason: "not_attempted" },
      { reason: "transport_failure" },
      { reason: "invalid_response" },
      { reason: "cost_exceeded" },
    ])
      expect(() =>
        f.read(JSON.stringify({ ...f.packet.packet, ...delta })),
      ).toThrow(RESEARCH_RESULT_ARTIFACT_ERROR);
  });
});
it("rejects internally contradictory failure classifications and altered drafts after recomputing local checksums", async () => {
  const none = await fixture("not_attempted"),
    unknown = await fixture("envelope"),
    transport = await fixture("transport"),
    valid = await fixture();
  const badNone = structuredClone(none.packet.packet);
  badNone.capture.complete = true;
  badNone.capture_revision = sha(JSON.stringify(badNone.capture));
  expect(() => none.read(JSON.stringify(badNone))).toThrow(
    RESEARCH_RESULT_ARTIFACT_ERROR,
  );
  const badResponse = structuredClone(unknown.packet.packet);
  badResponse.capture.failure = "read";
  badResponse.capture_revision = sha(JSON.stringify(badResponse.capture));
  expect(() => unknown.read(JSON.stringify(badResponse))).toThrow(
    RESEARCH_RESULT_ARTIFACT_ERROR,
  );
  const noPrice = structuredClone(transport.packet.packet);
  noPrice.reason = "cost_exceeded";
  expect(() => transport.read(JSON.stringify(noPrice))).toThrow(
    RESEARCH_RESULT_ARTIFACT_ERROR,
  );
  const below = structuredClone(valid.packet.packet);
  below.reason = "cost_exceeded";
  below.outcome = "indeterminate";
  below.answer = null;
  below.draft = null;
  below.answer_sha256 = null;
  expect(() => valid.read(JSON.stringify(below))).toThrow(
    RESEARCH_RESULT_ARTIFACT_ERROR,
  );
  const wrongDraft = structuredClone(valid.packet.packet);
  const statement = wrongDraft.draft!.statements[0];
  if (statement.type !== "passage_statement")
    throw Error("Synthetic draft mismatch");
  statement.text = "Different supplied draft";
  expect(() => valid.read(JSON.stringify(wrongDraft))).toThrow(
    RESEARCH_RESULT_ARTIFACT_ERROR,
  );
});
