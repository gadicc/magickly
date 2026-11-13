import { afterEach, expect, it, vi } from "vitest";
import { RESEARCH_ARCHIVE_BYTE_LIMIT, RESEARCH_ARCHIVE_ERROR } from "./archive";
import { archiveFixture } from "./archive.fixture";
import { requestResearchAnswerArchive } from "./browserArchive";
import {
  RESEARCH_PRIVATE_JSON_TIMEOUT_MS,
  requestPrivateResearchMetadata,
} from "./browserPrivateJson";
import { RESEARCH_ARCHIVE_API_PATH } from "./paths";

const signal = () => new AbortController().signal;
const json = (value = archiveFixture()) => Response.json(value);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("requests only the fixed private archive and owns its complete original-window metadata", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => json()),
    value = await requestResearchAnswerArchive(signal(), fetch);
  expect(value).toEqual(archiveFixture());
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toBe(RESEARCH_ARCHIVE_API_PATH);
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: "POST",
    body: "{}",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  });
});
it("uses the archive's larger cap for all ten maximal escaped questions, never the catalog cap", async () => {
  const value = archiveFixture(10);
  for (const entry of value.entries) entry.question = "\0".repeat(4000);
  expect(
    new TextEncoder().encode(JSON.stringify(value)).byteLength,
  ).toBeGreaterThan(128 * 1024);
  expect(
    await requestResearchAnswerArchive(signal(), async () => json(value)),
  ).toEqual(value);
});
it.each(["size", "duplicate", "extra", "utf8", "tail"])(
  "rejects archive wire %s atomically",
  async (kind) => {
    let body: BodyInit = JSON.stringify(archiveFixture());
    if (kind === "size") body = "x".repeat(RESEARCH_ARCHIVE_BYTE_LIMIT + 1);
    if (kind === "duplicate")
      body = body.replace(
        '"schema_version":1',
        '"schema_version":2,"schema_version":1',
      );
    if (kind === "extra")
      body = body.replace(
        '"schema_version":1',
        '"private_path":"secret","schema_version":1',
      );
    if (kind === "utf8") body = Uint8Array.from([0xff]);
    if (kind === "tail") body += "{";
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(body, { headers: { "content-type": "application/json" } }),
    );
    await expect(requestResearchAnswerArchive(signal(), fetch)).rejects.toThrow(
      RESEARCH_ARCHIVE_ERROR,
    );
    expect(fetch).toHaveBeenCalledOnce();
  },
);
it("a noncooperative archive response cannot outlive the original header+body deadline", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn(),
    response = new Response(
      new ReadableStream({ cancel }, { highWaterMark: 0 }),
      { headers: { "content-type": "application/json" } },
    ),
    fetch = vi.fn<typeof globalThis.fetch>(async () => response),
    pending = requestResearchAnswerArchive(signal(), fetch),
    rejected = expect(pending).rejects.toThrow(RESEARCH_ARCHIVE_ERROR);
  await vi.advanceTimersByTimeAsync(RESEARCH_PRIVATE_JSON_TIMEOUT_MS);
  await rejected;
  expect(cancel).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledOnce();
});
it("unsupported metadata lanes cannot choose an endpoint", async () => {
  const fetch = vi.fn();
  await expect(
    requestPrivateResearchMetadata("provider" as "archive", signal(), fetch),
  ).rejects.toThrow(/^Private research metadata unavailable$/);
  expect(fetch).not.toHaveBeenCalled();
});
