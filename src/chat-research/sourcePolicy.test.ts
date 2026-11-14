import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  RESEARCH_SOURCE_ERROR,
  type ResearchSourceContext,
} from "./sourceAuthorization";
import {
  MAX_RESEARCH_POLICY_BYTES,
  MAX_RESEARCH_POLICY_EVIDENCE,
  prepareResearchSourcePolicy,
  type ResearchSourcePolicyInput,
  readResearchSourcePolicy,
  researchPolicySnapshot,
} from "./sourcePolicy";
import {
  POLICY_OTHER,
  POLICY_OWNER,
  sourcePolicyFixture,
} from "./sourcePolicy.fixture";

vi.mock("server-only", () => ({}));
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const subject = {
  kind: "user" as const,
  user_id: POLICY_OWNER,
  session_id: "019aa111-0000-7000-8000-000000000002",
};
function fixture() {
  const input = sourcePolicyFixture(),
    prepared = prepareResearchSourcePolicy(input),
    document = readResearchSourcePolicy(
      prepared.policyJson,
      prepared.policySha256,
      prepared.corpusVersion,
    );
  const context: ResearchSourceContext = {
    subject: structuredClone(subject),
    corpus_version: prepared.corpusVersion,
    expires_at_ms: Date.now() + 60000,
    bindings: input.sources.map((s, n) => ({
      reference_id: `ref${n + 1}`,
      source_id: s.source_id,
      source_version: s.source_version,
      evidence_version: s.evidence_versions[0],
    })),
    visible_reference_ids: ["ref1", "ref2", "ref3"],
  };
  return { input, prepared, document, context };
}
describe("private source policy metadata", () => {
  it("owns deterministic canonical bytes and separates corpus identity from permissions", () => {
    const f = fixture();
    const perm = structuredClone(f.input);
    perm.sources[0].rights.answer = false;
    const changed = prepareResearchSourcePolicy(perm);
    expect(changed.corpusVersion).toBe(f.prepared.corpusVersion);
    expect(changed.policySha256).not.toBe(f.prepared.policySha256);
    f.input.sources[0].source_id = "caller_mutated";
    expect(
      readResearchSourcePolicy(
        f.prepared.policyJson,
        f.prepared.policySha256,
        f.prepared.corpusVersion,
      ),
    ).toEqual(f.document);
    expect(Object.isFrozen(f.prepared)).toBe(true);
  });
  it("canonicalizes source, evidence, grant and profile order", () => {
    const input = sourcePolicyFixture();
    input.sources[0].rights.processor_profiles = ["z_profile", "a_profile"];
    input.sources[0].grants.push({
      ...structuredClone(input.sources[0].grants[0]),
      user_id: POLICY_OTHER,
    });
    input.sources[0].grants[0].capabilities.processor_profiles = [
      "z_profile",
      "a_profile",
    ];
    const a = prepareResearchSourcePolicy(input),
      reordered = structuredClone(input);
    for (const s of reordered.sources) {
      s.evidence_versions.reverse();
      s.grants.reverse();
      s.rights.processor_profiles?.reverse();
      for (const g of s.grants) g.capabilities.processor_profiles?.reverse();
    }
    reordered.sources.reverse();
    expect(prepareResearchSourcePolicy(reordered)).toEqual(a);
  });
  it.each(["source_id", "source_version", "evidence_versions"] as const)(
    "binds %s into the domain-separated corpus identity",
    (key) => {
      const f = fixture(),
        next = structuredClone(f.input);
      if (key === "source_id") next.sources[0].source_id = "different";
      else if (key === "source_version")
        next.sources[0].source_version = "e".repeat(64);
      else next.sources[0].evidence_versions.push("e".repeat(64));
      expect(prepareResearchSourcePolicy(next).corpusVersion).not.toBe(
        f.prepared.corpusVersion,
      );
    },
  );
  const bad: [string, (p: ResearchSourcePolicyInput) => void][] = [
    [
      "empty sources",
      (p) => {
        p.sources = [];
      },
    ],
    [
      "duplicate source",
      (p) => {
        p.sources.push(structuredClone(p.sources[0]));
      },
    ],
    [
      "duplicate evidence",
      (p) => {
        p.sources[0].evidence_versions.push(p.sources[0].evidence_versions[0]);
      },
    ],
    [
      "duplicate actor grant",
      (p) => {
        p.sources[0].grants.push(structuredClone(p.sources[0].grants[0]));
      },
    ],
    [
      "duplicate profile",
      (p) => {
        p.sources[0].rights.processor_profiles = ["same", "same"];
      },
    ],
    [
      "image grant",
      (p) => {
        Object.assign(p.sources[0].grants[0].capabilities, { image: true });
      },
    ],
    [
      "download right",
      (p) => {
        Object.assign(p.sources[0].rights, { download: true });
      },
    ],
    [
      "bad actor",
      (p) => {
        p.sources[0].grants[0].user_id = "email@example.test";
      },
    ],
    [
      "bad source identity",
      (p) => {
        p.sources[0].source_id += "\n";
      },
    ],
    [
      "invalid source interval",
      (p) => {
        p.sources[0].valid_from_ms = 100;
        p.sources[0].valid_until_ms = 100;
      },
    ],
    [
      "invalid grant interval",
      (p) => {
        p.sources[0].grants[0].valid_from_ms = 200;
        p.sources[0].grants[0].valid_until_ms = 100;
      },
    ],
    [
      "unexpected source text",
      (p) => {
        Object.assign(p.sources[0], { passage: "synthetic forbidden text" });
      },
    ],
    [
      "too many sources",
      (p) => {
        p.sources = Array.from({ length: 33 }, (_, i) => ({
          ...structuredClone(p.sources[0]),
          source_id: `source_${i}`,
        }));
      },
    ],
  ];
  it.each(bad)("rejects %s", (_n, mutate) => {
    const p = sourcePolicyFixture();
    mutate(p);
    expect(() => prepareResearchSourcePolicy(p)).toThrow(RESEARCH_SOURCE_ERROR);
  });
  it("rejects raw corruption, noncanonical encoding, unknown fields, wrong hashes and wrong corpus", () => {
    const f = fixture();
    for (const [body, digest, corpus] of [
      [
        f.prepared.policyJson + " ",
        sha(f.prepared.policyJson + " "),
        f.prepared.corpusVersion,
      ],
      ["{}", "e".repeat(64), f.prepared.corpusVersion],
      [f.prepared.policyJson, f.prepared.policySha256, "e".repeat(64)],
      [f.prepared.policyJson, "e".repeat(64), f.prepared.corpusVersion],
      ["not JSON", sha("not JSON"), f.prepared.corpusVersion],
    ])
      expect(() => readResearchSourcePolicy(body, digest, corpus)).toThrow(
        RESEARCH_SOURCE_ERROR,
      );
    const extra = JSON.stringify({
      ...JSON.parse(f.prepared.policyJson),
      secret: "synthetic",
    });
    expect(() =>
      readResearchSourcePolicy(extra, sha(extra), f.prepared.corpusVersion),
    ).toThrow(RESEARCH_SOURCE_ERROR);
    const wrong = JSON.stringify({
      ...JSON.parse(f.prepared.policyJson),
      corpus_version: "e".repeat(64),
    });
    expect(() =>
      readResearchSourcePolicy(wrong, sha(wrong), "e".repeat(64)),
    ).toThrow(RESEARCH_SOURCE_ERROR);
  });
  it("supports 75,000 registered evidence IDs within the explicit eight-MiB byte cap", () => {
    const p = sourcePolicyFixture();
    for (let i = 0; i < 3; i++)
      p.sources[i].evidence_versions = Array.from({ length: 25000 }, (_, n) =>
        (n + i * 25000).toString(16).padStart(64, "0"),
      );
    const prepared = prepareResearchSourcePolicy(p),
      bytes = Buffer.byteLength(prepared.policyJson, "utf8");
    expect(bytes).toBeGreaterThan(5_000_000);
    expect(bytes).toBeLessThan(MAX_RESEARCH_POLICY_BYTES);
    expect(
      readResearchSourcePolicy(
        prepared.policyJson,
        prepared.policySha256,
        prepared.corpusVersion,
      ).sources.reduce((n, s) => n + s.evidence_versions.length, 0),
    ).toBe(MAX_RESEARCH_POLICY_EVIDENCE);
    p.sources[0].evidence_versions.push("e".repeat(64));
    expect(() => prepareResearchSourcePolicy(p)).toThrow(RESEARCH_SOURCE_ERROR);
    const tooLarge = "x".repeat(MAX_RESEARCH_POLICY_BYTES + 1);
    expect(() =>
      readResearchSourcePolicy(tooLarge, sha(tooLarge), prepared.corpusVersion),
    ).toThrow(RESEARCH_SOURCE_ERROR);
  });
  it("maps exact tuples and never silently omits missing/cross-source evidence", () => {
    const f = fixture();
    expect(
      researchPolicySnapshot(f.document, subject, f.context, "1").sources,
    ).toHaveLength(3);
    for (const key of [
      "source_id",
      "source_version",
      "evidence_version",
    ] as const) {
      const ctx = structuredClone(f.context);
      if (key === "source_id") ctx.bindings[0].source_id = "missing";
      else if (key === "source_version")
        ctx.bindings[0].source_version = f.input.sources[1].source_version;
      else
        ctx.bindings[0].evidence_version =
          f.input.sources[1].evidence_versions[0];
      expect(() =>
        researchPolicySnapshot(f.document, subject, ctx, "1"),
      ).toThrow(RESEARCH_SOURCE_ERROR);
    }
    const ctx = structuredClone(f.context);
    ctx.corpus_version = "e".repeat(64);
    expect(() => researchPolicySnapshot(f.document, subject, ctx, "1")).toThrow(
      RESEARCH_SOURCE_ERROR,
    );
  });
  it("missing actor grants give no capabilities and preserve all rows", () => {
    const f = fixture(),
      snapshot = researchPolicySnapshot(
        f.document,
        { ...subject, user_id: POLICY_OTHER },
        f.context,
        "1",
      );
    expect(snapshot.sources).toHaveLength(3);
    for (const s of snapshot.sources)
      expect(s.grants).toMatchObject({
        answer: false,
        generation: false,
        metadata: false,
        processor_profiles: [],
      });
  });
  it.each([
    [null, null, null, null, null, null],
    [100, null, null, 500, 100, 500],
    [null, 900, 200, null, 200, 900],
    [100, 900, 200, 800, 200, 800],
    [200, 800, 100, 900, 200, 800],
  ] as const)(
    "intersects source and grant windows %j/%j with %j/%j",
    (sf, su, gf, gu, from, until) => {
      const f = fixture(),
        s = f.document.sources[0];
      s.valid_from_ms = sf;
      s.valid_until_ms = su;
      s.grants[0].valid_from_ms = gf;
      s.grants[0].valid_until_ms = gu;
      const row = researchPolicySnapshot(f.document, subject, f.context, "1")
        .sources[0];
      expect(row.valid_from_ms).toBe(from);
      expect(row.valid_until_ms).toBe(until);
    },
  );
});
