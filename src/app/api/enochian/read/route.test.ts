import { expect, it, vi } from "vitest";

const respond = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/db/neon", () => ({ db: {} }));
vi.mock("@/app/enochian/translate/reading/dependencies", () => ({
  readingDependencies: { marker: "deps" },
}));
vi.mock("@/app/enochian/translate/reading/respond", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/app/enochian/translate/reading/respond")
  >()),
  respondToReading: respond,
}));

const { POST, maxDuration, runtime } = await import("./route");
const { READING_MAX_DURATION, CALL_TIMEOUT_MS } = await import(
  "@/app/enochian/translate/reading/respond"
);

it("is a node route with an explicit budget for its two calls", () => {
  expect(runtime).toBe("nodejs");
  expect(maxDuration).toBe(READING_MAX_DURATION);
  expect(2 * CALL_TIMEOUT_MS).toBeLessThan(maxDuration * 1000);
});

it("hands the request to the reading with the real dependencies", async () => {
  respond.mockResolvedValue(new Response("ok"));
  const request = new Request("http://localhost/api/enochian/read", {
    method: "POST",
  });
  await POST(request);
  expect(respond).toHaveBeenCalledWith(request, { marker: "deps" });
});
