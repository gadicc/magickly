import { expect, it, vi } from "vitest";

const handle = vi.hoisted(() => vi.fn(async () => new Response("Synthetic")));
vi.mock("@/chat-research/webServer", () => ({
  handleResearchRequest: handle,
}));

import { POST, runtime } from "./route";

it("passes only the owned request to the internal boundary, never Next's route context as a deadline", async () => {
  const request = new Request(
    "http://localhost:4179/chat/research/answers/list",
    {
      method: "POST",
    },
  );
  const response = await Reflect.apply(POST, undefined, [
    request,
    { params: Promise.resolve({}) },
  ]);
  expect(response.status).toBe(200);
  expect(handle).toHaveBeenCalledExactlyOnceWith(request);
  expect(runtime).toBe("nodejs");
});
