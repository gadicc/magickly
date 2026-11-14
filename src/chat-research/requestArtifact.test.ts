import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createUuidV7 } from "../lib/ids";
import {
  inspectFrozenResearchModelRequest,
  RESEARCH_REQUEST_BYTE_LIMIT,
  researchModelRequestRevision,
} from "./modelRequest";
import {
  inspectResearchRequestArtifact,
  prepareResearchRequestArtifact,
  RESEARCH_REQUEST_ARTIFACT_ERROR,
  readResearchRequestPacket,
} from "./requestArtifact";
import { artifactRequestFixture } from "./requestArtifact.fixture";
import { parseResearchSourceContext } from "./sourceAuthorization";

vi.mock("server-only", () => ({}));
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
function fixture() {
  const f = artifactRequestFixture(),
    window = createUuidV7(),
    operation = createUuidV7(),
    artifact = prepareResearchRequestArtifact(f.request, window, operation);
  return {
    ...f,
    window,
    operation,
    artifact,
    a: inspectResearchRequestArtifact(artifact),
  };
}
describe("private canonical request packet", () => {
  it("owns packet projections, retains only the original live handle, and parses data without adopting a handle", () => {
    const f = fixture(),
      a = f.a;
    expect(Object.isFrozen(f.artifact)).toBe(true);
    expect(a.packet_sha256).toBe(sha(a.packet_json));
    expect(a.request).toBe(f.request);
    expect(a.packet).toMatchObject({
      window_id: f.window,
      operation_id: f.operation,
      storage_profile: "private-research-artifacts-30d-v1",
    });
    const decoded = readResearchRequestPacket(a.packet_json, a.packet_sha256);
    expect(decoded).toEqual(a.packet);
    decoded.context.bindings.pop();
    a.packet.context.bindings.pop();
    expect(
      inspectResearchRequestArtifact(f.artifact).packet.context.bindings,
    ).toHaveLength(3);
    expect(() =>
      inspectResearchRequestArtifact({ revision: f.artifact.revision }),
    ).toThrow(RESEARCH_REQUEST_ARTIFACT_ERROR);
    expect(() =>
      prepareResearchRequestArtifact(
        { revision: f.request.revision },
        f.window,
        f.operation,
      ),
    ).toThrow(RESEARCH_REQUEST_ARTIFACT_ERROR);
    expect(() =>
      prepareResearchRequestArtifact(f.request, "not-uuid", f.operation),
    ).toThrow(RESEARCH_REQUEST_ARTIFACT_ERROR);
  });
  it("rejects changed bytes, noncanonical JSON, schema changes, oversized packets and incorrect digests", () => {
    const { a } = fixture();
    for (const [text, digest] of [
      [a.packet_json + " ", a.packet_sha256],
      [a.packet_json + " ", sha(a.packet_json + " ")],
      ["{", sha("{")],
      ["x".repeat(262145), sha("x".repeat(262145))],
      [a.packet_json, "A".repeat(64)],
      [a.packet_json, "a\n".repeat(32)],
    ])
      expect(() => readResearchRequestPacket(text, digest)).toThrow(
        RESEARCH_REQUEST_ARTIFACT_ERROR,
      );
    for (const delta of [
      { schema_version: 2 },
      { extra: true },
      { processor_profile: "other" },
      { request_revision: "a".repeat(64) },
      { query_revision: "b".repeat(64) },
      { body_json: "different" },
      { source_context_sha256: "c".repeat(64) },
      { context: {} },
    ]) {
      const text = JSON.stringify({ ...a.packet, ...delta });
      expect(() => readResearchRequestPacket(text, sha(text))).toThrow(
        RESEARCH_REQUEST_ARTIFACT_ERROR,
      );
    }
  });
  it("enforces body Unicode/UTF8 size even when internal digests have been recomputed", () => {
    const { a } = fixture();
    for (const body of [
      "\ud800",
      "😀".repeat(RESEARCH_REQUEST_BYTE_LIMIT / 4 + 1),
    ]) {
      const p = { ...a.packet, body_json: body, request_sha256: sha(body) };
      p.request_revision = researchModelRequestRevision(
        p.query_revision,
        p.answer_id,
        p.request_sha256,
        p.source_context_sha256,
      );
      const text = JSON.stringify(p);
      expect(() => readResearchRequestPacket(text, sha(text))).toThrow(
        RESEARCH_REQUEST_ARTIFACT_ERROR,
      );
    }
  });
  it("includes operation, window, question and answer request identity", () => {
    const { a, request, window, operation } = fixture();
    expect(
      prepareResearchRequestArtifact(request, window, operation).revision,
    ).toBe(a.packet_sha256);
    expect(
      prepareResearchRequestArtifact(request, createUuidV7(), operation)
        .revision,
    ).not.toBe(a.packet_sha256);
    expect(
      prepareResearchRequestArtifact(request, window, createUuidV7()).revision,
    ).not.toBe(a.packet_sha256);
    expect(
      prepareResearchRequestArtifact(
        artifactRequestFixture(undefined, "Other?").request,
        window,
        operation,
      ).revision,
    ).not.toBe(a.packet_sha256);
  });
});
describe("owned source context parser does not grant access", () => {
  it("preserves lifetime without renewal and rejects ambiguous/oversized/unknown bindings", () => {
    const c = inspectFrozenResearchModelRequest(
        artifactRequestFixture().request,
      ).context,
      parsed = parseResearchSourceContext(c);
    expect(parsed).toEqual(c);
    parsed.bindings.pop();
    expect(c.bindings).toHaveLength(3);
    for (const x of [
      null,
      {},
      { ...c, bindings: [] },
      { ...c, bindings: Array(101).fill(c.bindings[0]) },
      { ...c, bindings: [c.bindings[0], c.bindings[0]] },
      { ...c, visible_reference_ids: ["ref100"] },
      { ...c, visible_reference_ids: ["ref1", "ref1"] },
      { ...c, extra: "x".repeat(65537) },
      { ...c, subject: { ...c.subject, user_id: "wrong" } },
    ])
      expect(() => parseResearchSourceContext(x)).toThrow(
        "Private research source unavailable",
      );
    expect(
      parseResearchSourceContext({ ...c, expires_at_ms: 0 }).expires_at_ms,
    ).toBe(0);
  });
});
