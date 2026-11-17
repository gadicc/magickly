// @vitest-environment jsdom
import { expect, it } from "vitest";
import { LockedRecoveryQueue, watchRecoveryDeparture } from "./recovery";

it("keeps opaque recovery guarded after its editor leaves and removes the warning after persistence", async () => {
  const queue = new LockedRecoveryQueue();
  const remove = watchRecoveryDeparture(queue, window);
  let finish!: () => void;
  const work = new Promise<void>((resolve) => {
    finish = resolve;
  });
  try {
    const idle = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);
    queue.add({ persist: () => work });
    const pending = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(pending);
    expect(pending.defaultPrevented).toBe(true);
    expect(queue.state.pending).toBe(1);
    finish();
    await queue.retry();
    const durable = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(durable);
    expect(durable.defaultPrevented).toBe(false);
  } finally {
    finish();
    remove();
  }
});
