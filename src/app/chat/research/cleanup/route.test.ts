import { expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("@/chat-research/managedCleanupServer", () => ({
  handleManagedResearchCleanup: m.handle,
}));

import { GET, maxDuration, runtime } from "./route";

it("keeps framework context out of the cleanup deadline and reserves platform headroom", async () => {
  const request = new Request(
    "https://synthetic.example/chat/research/cleanup",
  );
  const response = Response.json({});
  m.handle.mockResolvedValue(response);
  expect(
    await (GET as unknown as (...args: unknown[]) => Promise<Response>)(
      request,
      { params: {} },
    ),
  ).toBe(response);
  expect(m.handle).toHaveBeenCalledExactlyOnceWith(request);
  expect(runtime).toBe("nodejs");
  expect(maxDuration).toBe(60);
});
