import { afterEach, expect, it, vi } from "vitest";
import { readBody } from "./httpIngress";

vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());
it("cancels after the first timer-starved late chunk without another pull or parser", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const pull = vi.fn((c) => {
      now = 8001;
      c.enqueue(new TextEncoder().encode("{}"));
    }),
    cancel = vi.fn(),
    parse = vi.fn(),
    body = new ReadableStream({ pull, cancel }, { highWaterMark: 0 }),
    request = new Request("http://localhost/chat/research/answers/read", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
  await expect(
    readBody(
      request,
      body,
      new Headers(),
      new AbortController().signal,
      8000,
      parse,
      128,
      16,
    ),
  ).rejects.toThrow();
  expect(pull).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
  expect(parse).not.toHaveBeenCalled();
});
it("rejects a parser crossing the original end even when timer callbacks are starved", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const request = new Request("http://localhost", {
      method: "POST",
      body: "{}",
    }),
    parse = vi.fn((value) => {
      now = 8001;
      return value;
    });
  await expect(
    readBody(
      request,
      request.body,
      new Headers(),
      new AbortController().signal,
      8000,
      parse,
      128,
      16,
    ),
  ).rejects.toThrow();
  expect(parse).toHaveBeenCalledOnce();
});
