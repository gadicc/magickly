import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ANSWER_ID } from "./answer.fixture";
import {
  parseResearchGatewayEnvelope,
  projectResearchGatewayCandidate,
  RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT,
  RESEARCH_GATEWAY_RESPONSE_ERROR,
  researchResponseUsdToPico,
} from "./gatewayResponse";
import { gatewayResponseFixture } from "./gatewayResponse.fixture";
import {
  inspectFrozenResearchModelRequest,
  RESEARCH_MODEL_ID,
} from "./modelRequest";
import { passageDraft } from "./query.fixture";
import { artifactRequestFixture } from "./requestArtifact.fixture";

vi.mock("server-only", () => ({}));
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
// biome-ignore lint/suspicious/noExplicitAny: Adversarial JSON mutations intentionally violate every production field type.
type Receipt = Record<string, any>;
const sha = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const metadata = (r: Receipt) => r.provider_metadata.gateway;
const route = (r: Receipt) => metadata(r).routing;
const message = (r: Receipt) => r.output[1];
const content = (r: Receipt) => message(r).content[0];

describe("inactive provider envelope candidate", () => {
  it("accepts a complete standard system-credential single-route receipt and binds the exact UTF8 bytes", () => {
    const raw = gatewayResponseFixture(),
      body = bytes(raw),
      parsed = parseResearchGatewayEnvelope(body);
    expect(parsed).toEqual({
      response_sha256: sha(body),
      text: content(raw).text,
      generation_id: raw.id,
      model: RESEARCH_MODEL_ID,
      provider: "openai",
      service_tier: "default",
      reasoning_effort: "high",
      input_tokens: 1000,
      output_tokens: 100,
      reported_pico_usd: 3000000000,
    });
    raw.output[1].content![0].text = "changed";
    expect(parsed.text).not.toBe("changed");
    expect(
      parseResearchGatewayEnvelope(
        Buffer.from(JSON.stringify(gatewayResponseFixture(), null, 2)),
      ).response_sha256,
    ).not.toBe(parsed.response_sha256);
  });
  it("supports known metadata/token aliases only when unambiguous, and optional empty fields", () => {
    const r: Receipt = gatewayResponseFixture();
    r.model = "gpt-6.1-sol";
    r.providerMetadata = r.provider_metadata;
    delete r.provider_metadata;
    r.usage = { inputTokens: 1000, outputTokens: 100, totalTokens: 1100 };
    delete r.warnings;
    delete r.background;
    delete r.error;
    delete r.incomplete_details;
    r.providerMetadata.openai = {};
    r.providerMetadata.gateway.warnings = [];
    delete r.providerMetadata.gateway.routing.resolvedProvider;
    delete r.providerMetadata.gateway.routing.originalModelId;
    delete r.providerMetadata.gateway.routing.canonicalSlug;
    r.output_text = content(r).text;
    delete content(r).annotations;
    expect(parseResearchGatewayEnvelope(bytes(r))).toMatchObject({
      input_tokens: 1000,
      output_tokens: 100,
    });
    r.previous_response_id = null;
    r.conversation = null;
    r.prompt = null;
    r.truncation = "disabled";
    r.tools = [];
    r.allowed_tools = [];
    r.tool_choice = "auto";
    r.output[0].status = null;
    expect(parseResearchGatewayEnvelope(bytes(r)).provider).toBe("openai");
    r.tool_choice = "none";
    r.output[0].status = "completed";
    expect(parseResearchGatewayEnvelope(bytes(r)).provider).toBe("openai");
    const both: Receipt = gatewayResponseFixture();
    both.usage.inputTokens = 1000;
    both.usage.outputTokens = 100;
    both.usage.totalTokens = 1100;
    expect(parseResearchGatewayEnvelope(bytes(both)).input_tokens).toBe(1000);
  });
  it.each<[string, (r: Receipt) => void]>([
    [
      "response type",
      (r) => {
        r.object = "other";
      },
    ],
    [
      "incomplete status",
      (r) => {
        r.status = "incomplete";
      },
    ],
    [
      "error",
      (r) => {
        r.error = { message: "Synthetic failure" };
      },
    ],
    [
      "false error",
      (r) => {
        r.error = false;
      },
    ],
    [
      "incomplete details",
      (r) => {
        r.incomplete_details = { reason: "max_output_tokens" };
      },
    ],
    [
      "previous response context",
      (r) => {
        r.previous_response_id = "resp_synthetic";
      },
    ],
    [
      "conversation context",
      (r) => {
        r.conversation = { id: "conv_synthetic" };
      },
    ],
    [
      "stored prompt context",
      (r) => {
        r.prompt = { id: "pmpt_synthetic" };
      },
    ],
    [
      "automatic input truncation",
      (r) => {
        r.truncation = "auto";
      },
    ],
    [
      "model array",
      (r) => {
        r.model = [RESEARCH_MODEL_ID];
      },
    ],
    [
      "model object",
      (r) => {
        r.model = { name: RESEARCH_MODEL_ID };
      },
    ],
    [
      "model number",
      (r) => {
        r.model = 6;
      },
    ],
    [
      "model mismatch",
      (r) => {
        r.model = "openai/other";
      },
    ],
    [
      "priority tier",
      (r) => {
        r.service_tier = "priority";
      },
    ],
    [
      "provider storage",
      (r) => {
        r.store = true;
      },
    ],
    [
      "background",
      (r) => {
        r.background = true;
      },
    ],
    [
      "output cap",
      (r) => {
        r.max_output_tokens = 8193;
      },
    ],
    [
      "reasoning",
      (r) => {
        r.reasoning.effort = "low";
      },
    ],
    [
      "declared tools",
      (r) => {
        r.tools = [{ type: "web_search" }];
      },
    ],
    [
      "malformed tools",
      (r) => {
        r.tools = null;
      },
    ],
    [
      "allowed tool subset",
      (r) => {
        r.allowed_tools = ["synthetic_tool"];
      },
    ],
    [
      "required tool selection",
      (r) => {
        r.tool_choice = "required";
      },
    ],
    [
      "warnings",
      (r) => {
        r.warnings = ["Unsupported option"];
      },
    ],
    [
      "malformed warnings",
      (r) => {
        r.warnings = null;
      },
    ],
    [
      "gateway warnings",
      (r) => {
        metadata(r).warnings = ["Fallback"];
      },
    ],
    [
      "ambiguous metadata aliases",
      (r) => {
        r.providerMetadata = r.provider_metadata;
      },
    ],
    [
      "missing metadata",
      (r) => {
        delete r.provider_metadata;
      },
    ],
    [
      "resolved provider contradiction",
      (r) => {
        route(r).resolvedProvider = "azure";
      },
    ],
    [
      "provider fallback",
      (r) => {
        route(r).finalProvider = "azure";
      },
    ],
    [
      "provider attempt count",
      (r) => {
        route(r).totalProviderAttemptCount = 2;
      },
    ],
    [
      "model attempt count",
      (r) => {
        route(r).modelAttemptCount = 2;
      },
    ],
    [
      "available fallback",
      (r) => {
        route(r).fallbacksAvailable = ["azure"];
      },
    ],
    [
      "missing fallback proof",
      (r) => {
        delete route(r).fallbacksAvailable;
      },
    ],
    [
      "multiple model receipts",
      (r) => {
        route(r).modelAttempts.push(route(r).modelAttempts[0]);
      },
    ],
    [
      "original model",
      (r) => {
        route(r).originalModelId = "openai/other";
      },
    ],
    [
      "canonical model",
      (r) => {
        route(r).canonicalSlug = "openai/other";
      },
    ],
    [
      "attempt slug",
      (r) => {
        route(r).modelAttempts[0].canonicalSlug = "openai/other";
      },
    ],
    [
      "failed model attempt",
      (r) => {
        route(r).modelAttempts[0].success = false;
      },
    ],
    [
      "model error",
      (r) => {
        route(r).modelAttempts[0].error = "failure";
      },
    ],
    [
      "nested provider attempt count",
      (r) => {
        route(r).modelAttempts[0].providerAttemptCount = 2;
      },
    ],
    [
      "missing provider receipts",
      (r) => {
        route(r).modelAttempts[0].providerAttempts = [];
      },
    ],
    [
      "attempt provider",
      (r) => {
        route(r).modelAttempts[0].providerAttempts[0].provider = "azure";
      },
    ],
    [
      "failed provider",
      (r) => {
        route(r).modelAttempts[0].providerAttempts[0].success = false;
      },
    ],
    [
      "provider error",
      (r) => {
        route(r).modelAttempts[0].providerAttempts[0].error = {
          message: "failure",
        };
      },
    ],
    [
      "BYOK billing",
      (r) => {
        route(r).modelAttempts[0].providerAttempts[0].credentialType = "byok";
      },
    ],
    [
      "contradictory provider tier",
      (r) => {
        r.provider_metadata.openai.serviceTier = "priority";
      },
    ],
    [
      "contradictory snake tier",
      (r) => {
        r.provider_metadata.openai.service_tier = "priority";
      },
    ],
    [
      "contradictory provider effort",
      (r) => {
        r.provider_metadata.openai.reasoningEffort = "low";
      },
    ],
    [
      "mismatched generation ID",
      (r) => {
        r.id = "gen_other";
      },
    ],
    [
      "invalid generation ID",
      (r) => {
        metadata(r).generationId = "https://synthetic.invalid";
        r.id = metadata(r).generationId;
      },
    ],
    [
      "numeric reported cost",
      (r) => {
        metadata(r).cost = 0.003;
      },
    ],
    [
      "missing reported cost",
      (r) => {
        delete metadata(r).cost;
      },
    ],
  ])(
    "rejects %s rather than accepting the request's intent as a receipt",
    (_name, mutate) => {
      const r: Receipt = gatewayResponseFixture();
      mutate(r);
      expect(() => parseResearchGatewayEnvelope(bytes(r))).toThrow(
        RESEARCH_GATEWAY_RESPONSE_ERROR,
      );
    },
  );
  it.each<[string, (r: Receipt) => void]>([
    [
      "incomplete reasoning",
      (r) => {
        r.output[0].status = "incomplete";
      },
    ],
    [
      "in-progress reasoning",
      (r) => {
        r.output[0].status = "in_progress";
      },
    ],
    [
      "missing output",
      (r) => {
        delete r.output;
      },
    ],
    [
      "empty output",
      (r) => {
        r.output = [];
      },
    ],
    [
      "multiple messages",
      (r) => {
        r.output.push(message(r));
      },
    ],
    [
      "tool call",
      (r) => {
        r.output[0] = { type: "function_call", name: "synthetic" };
      },
    ],
    [
      "nonassistant",
      (r) => {
        message(r).role = "user";
      },
    ],
    [
      "incomplete message",
      (r) => {
        message(r).status = "incomplete";
      },
    ],
    [
      "content parts",
      (r) => {
        message(r).content.push(content(r));
      },
    ],
    [
      "malformed message",
      (r) => {
        message(r).content = null;
      },
    ],
    [
      "refusal",
      (r) => {
        content(r).type = "refusal";
        content(r).refusal = "Cannot answer";
      },
    ],
    [
      "empty text",
      (r) => {
        content(r).text = "";
      },
    ],
    [
      "nontext",
      (r) => {
        content(r).text = 12;
      },
    ],
    [
      "too much text",
      (r) => {
        content(r).text = "😀".repeat(32769);
      },
    ],
    [
      "provider annotations",
      (r) => {
        content(r).annotations = [
          { type: "url_citation", url: "https://synthetic.invalid" },
        ];
      },
    ],
    [
      "contradictory output_text",
      (r) => {
        r.output_text = "different";
      },
    ],
    [
      "zero input",
      (r) => {
        r.usage.input_tokens = 0;
      },
    ],
    [
      "zero output",
      (r) => {
        r.usage.output_tokens = 0;
      },
    ],
    [
      "negative usage",
      (r) => {
        r.usage.input_tokens = -1;
      },
    ],
    [
      "fractional usage",
      (r) => {
        r.usage.output_tokens = 1.5;
      },
    ],
    [
      "missing usage",
      (r) => {
        r.usage = {};
      },
    ],
    [
      "unsafe usage",
      (r) => {
        r.usage.input_tokens = Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      "unsafe total",
      (r) => {
        r.usage.input_tokens = Number.MAX_SAFE_INTEGER;
        r.usage.output_tokens = 1;
      },
    ],
    [
      "over-cap usage",
      (r) => {
        r.usage.output_tokens = 8193;
      },
    ],
    [
      "token alias mismatch",
      (r) => {
        r.usage.inputTokens = 999;
      },
    ],
    [
      "incorrect total",
      (r) => {
        r.usage.total_tokens = 1099;
      },
    ],
    [
      "cache exceeds input",
      (r) => {
        r.usage.input_tokens_details.cached_tokens = 1001;
      },
    ],
    [
      "reasoning exceeds output",
      (r) => {
        r.usage.output_tokens_details.reasoning_tokens = 101;
      },
    ],
    [
      "invalid details",
      (r) => {
        r.usage.output_tokens_details = null;
      },
    ],
  ])("rejects %s without exposing partial answer text", (_name, mutate) => {
    const r: Receipt = gatewayResponseFixture();
    mutate(r);
    expect(() => parseResearchGatewayEnvelope(bytes(r))).toThrow(
      RESEARCH_GATEWAY_RESPONSE_ERROR,
    );
  });
  it("accepts no-detail and no-provider-detail receipts without inventing missing extra counts", () => {
    const r: Receipt = gatewayResponseFixture();
    delete r.provider_metadata.openai;
    delete r.usage.total_tokens;
    r.usage.input_tokens_details = {};
    r.usage.output_tokens_details = {};
    expect(parseResearchGatewayEnvelope(bytes(r)).reported_pico_usd).toBe(
      3000000000,
    );
    delete r.usage.input_tokens_details;
    delete r.usage.output_tokens_details;
    expect(parseResearchGatewayEnvelope(bytes(r)).output_tokens).toBe(100);
  });
});
describe("wire JSON boundaries", () => {
  it("rejects malformed/truncated/duplicate-key/BOM/invalid UTF8 data and out-of-profile structures", () => {
    const valid = JSON.stringify(gatewayResponseFixture());
    const invalid = [
      Buffer.alloc(0),
      Buffer.from([255]),
      Buffer.from("\ufeff" + valid),
      Buffer.from(valid.slice(0, -1)),
      Buffer.from(valid + "x"),
      Buffer.alloc(RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT + 1),
      Buffer.from(
        valid.replace(
          '"status":"completed"',
          '"status":"failed","status":"completed"',
        ),
      ),
      Buffer.from(valid.replace('"model":', '"\\u006dodel":"other","model":')),
      Buffer.from('{"extra":1e309,' + valid.slice(1)),
      Buffer.from('{"\\ud800":1,' + valid.slice(1)),
      Buffer.from('{"extra":"\\ud800",' + valid.slice(1)),
      Buffer.from(
        '{"extra":' +
          "[".repeat(65) +
          "0" +
          "]".repeat(65) +
          "," +
          valid.slice(1),
      ),
      Buffer.from(
        '{"extra":' +
          JSON.stringify(Array(100001).fill(0)) +
          "," +
          valid.slice(1),
      ),
    ];
    for (const b of invalid)
      expect(() => parseResearchGatewayEnvelope(b)).toThrow(
        RESEARCH_GATEWAY_RESPONSE_ERROR,
      );
    for (const x of [null, [], "x", 1, true])
      expect(() => parseResearchGatewayEnvelope(bytes(x))).toThrow(
        RESEARCH_GATEWAY_RESPONSE_ERROR,
      );
    expect(() => parseResearchGatewayEnvelope("not bytes" as never)).toThrow(
      RESEARCH_GATEWAY_RESPONSE_ERROR,
    );
  });
  it("handles quotes, braces, array scopes, escaped keys and valid Unicode without requiring canonical provider JSON", () => {
    const r: Receipt = gatewayResponseFixture();
    r.extra = {
      'quo"te': "brace } and colon : and \\",
      arr: ["é", "שלום", "😀", null, true, 12],
    };
    const wire = Buffer.from(JSON.stringify(r, null, 2));
    expect(parseResearchGatewayEnvelope(wire).text).toBe(content(r).text);
    const boundary = Buffer.concat([
      bytes(gatewayResponseFixture()),
      Buffer.alloc(
        RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT -
          bytes(gatewayResponseFixture()).length,
        32,
      ),
    ]);
    expect(parseResearchGatewayEnvelope(boundary).response_sha256).toBe(
      sha(boundary),
    );
  });
});
describe("exact reported inference cost", () => {
  it.each([
    ["0", 0],
    ["0.003", 3000000000],
    ["1e-13", 1],
    ["123e-14", 2],
    ["0.000000000001", 1],
    ["0.0000000000011", 2],
    ["0.35", 350000000000],
    ["9007.199254740991", Number.MAX_SAFE_INTEGER],
  ] as const)("rounds %s upward once", (value, result) =>
    expect(researchResponseUsdToPico(value)).toBe(result),
  );
  it.each([
    null,
    undefined,
    0,
    0.003,
    -1,
    "",
    "-0.1",
    "+1",
    "1 ",
    "1\n",
    ".1",
    "NaN",
    "Infinity",
    "1e-1000",
    "1e9999999999999999999999999",
    "9".repeat(65),
    "9007.199254740992",
  ])("rejects invalid or unsafe cost %s", (value) =>
    expect(() => researchResponseUsdToPico(value)).toThrow(
      RESEARCH_GATEWAY_RESPONSE_ERROR,
    ),
  );
});
describe("typed answer projection remains a candidate", () => {
  it("projects against the original request identity and derives citations on the server", () => {
    const f = artifactRequestFixture(),
      body = bytes(gatewayResponseFixture()),
      candidate = projectResearchGatewayCandidate(body, f.request),
      request = inspectFrozenResearchModelRequest(f.request);
    expect(candidate.bound).toMatchObject({
      request_revision: f.request.revision,
      request_sha256: request.request_sha256,
      source_context_sha256: request.source_context_sha256,
      payload: {
        answer_id: ANSWER_ID,
        origin: "model",
        validation: "structural-only",
        semantic_review: "unreviewed",
      },
    });
    expect(candidate.bound.payload.citations).toHaveLength(1);
    expect(candidate.envelope.response_sha256).toBe(sha(body));
    expect(candidate).not.toHaveProperty("completed");
    expect(candidate).not.toHaveProperty("history");
    expect(candidate).not.toHaveProperty("dispatch_claim");
  });
  it("rejects malformed/ambiguous model JSON, foreign aliases, invented metadata and copied request handles", () => {
    for (const text of [
      "not JSON",
      JSON.stringify({ ...passageDraft(), extra: true }),
      JSON.stringify(passageDraft()).replace(
        '"status":"partial"',
        '"status":"supported","status":"partial"',
      ),
      JSON.stringify({
        ...passageDraft(),
        statements: [
          {
            type: "passage_statement",
            id: "s1",
            kind: "answer",
            text: "Synthetic",
            evidence_ids: ["passage4"],
          },
        ],
      }),
      JSON.stringify({ ...passageDraft(), citations: [] }),
    ]) {
      const r: Receipt = gatewayResponseFixture();
      content(r).text = text;
      expect(() =>
        projectResearchGatewayCandidate(
          bytes(r),
          artifactRequestFixture().request,
        ),
      ).toThrow(RESEARCH_GATEWAY_RESPONSE_ERROR);
    }
    expect(() =>
      projectResearchGatewayCandidate(bytes(gatewayResponseFixture()), {
        revision: "a".repeat(64),
      }),
    ).toThrow(RESEARCH_GATEWAY_RESPONSE_ERROR);
  });
});
