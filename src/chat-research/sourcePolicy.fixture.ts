/** Synthetic-only policy metadata shared by focused tests; no account/book/provider material. */
import { createHash } from "node:crypto";
import type { ResearchSourcePolicyInput } from "./sourcePolicy";
export const POLICY_OWNER = "019aa111-0000-7000-8000-000000000001";
export const POLICY_OTHER = "019aa111-0000-7000-8000-000000000003";
export const POLICY_PROFILE = "synthetic_profile";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
export function sourcePolicyFixture(): ResearchSourcePolicyInput {
  const capabilities = {
    generation: true,
    answer: true,
    metadata: true,
    excerpt: false as const,
    image: false as const,
    download: false as const,
    processor_profiles: [POLICY_PROFILE],
  };
  return {
    schema_version: 1,
    scope: "private-operator-research",
    sources: [1, 2, 3].map((n) => ({
      source_id: `synthetic_source_${n}`,
      source_version: sha(`synthetic-source-${n}`),
      evidence_versions: [
        sha(`synthetic-evidence-${n}-a`),
        sha(`synthetic-evidence-${n}-b`),
      ],
      state: "active",
      valid_from_ms: null,
      valid_until_ms: null,
      rights: structuredClone(capabilities),
      grants: [
        {
          user_id: POLICY_OWNER,
          capabilities: structuredClone(capabilities),
          valid_from_ms: null,
          valid_until_ms: null,
        },
      ],
    })),
  };
}
