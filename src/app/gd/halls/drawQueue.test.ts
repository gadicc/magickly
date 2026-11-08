import { expect, it } from "vitest";
import { createDrawQueue } from "./drawQueue";

function frames() {
  const pending: (() => void)[] = [];
  return {
    requestFrame: (callback: () => void) => {
      pending.push(callback);
    },
    get waiting() {
      return pending.length;
    },
    run() {
      for (const callback of pending.splice(0)) callback();
    },
  };
}

it("runs a few jobs per frame, in order", () => {
  const frame = frames();
  const queue = createDrawQueue({
    perFrame: 2,
    requestFrame: frame.requestFrame,
  });
  const ran: number[] = [];
  for (const job of [1, 2, 3, 4, 5]) queue.enqueue(() => ran.push(job));
  expect(ran).toEqual([]);
  expect(frame.waiting).toBe(1);
  frame.run();
  expect(ran).toEqual([1, 2]);
  frame.run();
  expect(ran).toEqual([1, 2, 3, 4]);
  frame.run();
  expect(ran).toEqual([1, 2, 3, 4, 5]);
  expect(frame.waiting).toBe(0);
  expect(queue.size).toBe(0);
});

it("never runs a cancelled job, and survives a failing one", () => {
  const frame = frames();
  const queue = createDrawQueue({
    perFrame: 3,
    requestFrame: frame.requestFrame,
  });
  const ran: string[] = [];
  queue.enqueue(() => {
    throw new Error("drawing failed");
  });
  const cancel = queue.enqueue(() => ran.push("cancelled"));
  queue.enqueue(() => ran.push("kept"));
  cancel();
  cancel();
  frame.run();
  expect(ran).toEqual(["kept"]);
});

it("falls back to a timer without requestAnimationFrame", async () => {
  const original = globalThis.requestAnimationFrame;
  // @ts-expect-error: removed for this test
  delete globalThis.requestAnimationFrame;
  try {
    const queue = createDrawQueue({ perFrame: 1 });
    const ran = await new Promise<boolean>((resolve) =>
      queue.enqueue(() => resolve(true)),
    );
    expect(ran).toBe(true);
  } finally {
    if (original) globalThis.requestAnimationFrame = original;
  }
});
