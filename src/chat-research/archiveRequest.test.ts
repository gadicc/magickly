import { expect, it, vi } from "vitest";
import { readResearchArchiveQuestion } from "./archiveRequest";
import {
  inspectFrozenResearchModelRequest,
  RESEARCH_REQUEST_BYTE_LIMIT,
} from "./modelRequest";
import { artifactRequestFixture } from "./requestArtifact.fixture";

vi.mock("server-only", () => ({}));
const body = () =>
  inspectFrozenResearchModelRequest(artifactRequestFixture().request).body_json;
it("projects only the original literal question/mode from fixed validated-request-shaped bytes", () => {
  const value = readResearchArchiveQuestion(body());
  expect(value).toEqual({ question: "Synthetic question?", mode: "passage" });
  expect(JSON.stringify(value)).not.toMatch(
    /passages|history|instructions|source_id/,
  );
});
it.each([
  "body",
  "input",
  "schema",
  "history",
  "question",
  "mode",
  "duplicate",
  "size",
])(
  "refuses unsupported archive label %s without exposing request contents",
  (kind) => {
    const value = JSON.parse(body()),
      packet = JSON.parse(value.input);
    if (kind === "schema") packet.schema_version = 2;
    if (kind === "history")
      packet.history = [
        { role: "user", content: "Private history must not escape" },
      ];
    if (kind === "question") packet.question = "";
    if (kind === "mode") packet.mode = "tools";
    value.input = kind === "input" ? "{" : JSON.stringify(packet);
    if (kind === "duplicate")
      value.input = value.input.replace(
        '"schema_version":1',
        '"schema_version":2,"schema_version":1',
      );
    const text =
      kind === "body"
        ? "{"
        : kind === "size"
          ? "x".repeat(RESEARCH_REQUEST_BYTE_LIMIT + 1)
          : JSON.stringify(value);
    expect(() => readResearchArchiveQuestion(text)).toThrow(
      /^Private answer archive unavailable$/,
    );
  },
);
