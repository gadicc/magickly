import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIMIT_POLICIES, type LimitPolicy } from "./policies.ts";

const readme = readFileSync(new URL("./README.md", import.meta.url), "utf8");
const policies = Object.entries(LIMIT_POLICIES) as [string, LimitPolicy][];

describe("the daily limit policies", () => {
  it("are each in the README's table, with their size", () => {
    for (const [name, policy] of policies) {
      const row = readme
        .split("\n")
        .find((line) => line.startsWith(`| \`${name}\` |`));
      expect(row, name).toBeDefined();
      expect(row, name).toContain(`| ${policy.limit.toLocaleString("en")} |`);
    }
  });

  it("never share a counter or a key", () => {
    const subjects = policies.flatMap(([, policy]) =>
      policy.kind === "pool"
        ? [policy.subject]
        : policy.kind === "client"
          ? [`${policy.prefix}:`]
          : ["user:"],
    );
    expect(new Set(subjects).size).toBe(subjects.length);
    const labels = policies.flatMap(([, policy]) =>
      policy.kind === "client" ? [policy.label] : [],
    );
    expect(new Set(labels).size).toBe(labels.length);
    // No pool's subject can be mistaken for a prefixed one.
    for (const [, policy] of policies)
      if (policy.kind === "pool") expect(policy.subject).not.toContain(":");
  });
});
