import { describe, expect, it } from "vitest";
import { forumFetchOptions, readCappedText } from "./forumHttp";

describe("forum request bounds", () => {
  it("gives every request its own timer, no redirects and no cache", () => {
    const first = forumFetchOptions();
    const second = forumFetchOptions();
    expect(first).toMatchObject({ redirect: "error", cache: "no-store" });
    expect(first.signal).not.toBe(second.signal);
    expect(first.signal.aborted).toBe(false);
  });

  it("reads a body up to the limit and refuses a larger one", async () => {
    expect(await readCappedText(new Response("hello"), 10)).toBe("hello");
    expect(await readCappedText(new Response(null))).toBe("");
    await expect(
      readCappedText(new Response("x".repeat(100)), 10),
    ).rejects.toThrow("too large");
  });

  it("stops reading a stream that never ends", async () => {
    let pulls = 0;
    const endless = new Response(
      new ReadableStream({
        pull(controller) {
          pulls++;
          controller.enqueue(new Uint8Array(1024));
        },
      }),
    );
    await expect(readCappedText(endless, 4096)).rejects.toThrow();
    expect(pulls).toBeLessThan(20);
  });
});
