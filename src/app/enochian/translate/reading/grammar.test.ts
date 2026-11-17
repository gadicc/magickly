import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GRAMMAR_MODULE,
  GRAMMAR_SOURCE,
  grammarModule,
} from "../../../../../scripts/enochian-reading/grammar.ts";
import { GRAMMAR } from "./grammar.generated.ts";

describe("the reading's grammar notes", () => {
  it("are grammar.md byte for byte (run `pnpm reading:grammar` if not)", () => {
    const source = readFileSync(GRAMMAR_SOURCE, "utf8");
    expect(GRAMMAR).toBe(source);
    expect(readFileSync(GRAMMAR_MODULE, "utf8")).toBe(grammarModule(source));
  });
});
