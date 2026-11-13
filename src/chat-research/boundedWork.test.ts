import { afterEach, expect, it, vi } from "vitest";
import { withinResearchDeadline } from "./boundedWork";

vi.mock("server-only", () => ({}));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const active = () => new AbortController().signal;
it("inherits only the remaining parent wait and aborts the cooperative child signal", async () => {
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockReturnValue(5000);
  let child: AbortSignal | undefined;
  const pending = withinResearchDeadline(
      active(),
      async (signal) => {
        child = signal;
        return new Promise<never>(() => {});
      },
      8000,
    ),
    refused = expect(pending).rejects.toThrow(
      "Bounded research operation unavailable",
    );
  await vi.advanceTimersByTimeAsync(2999);
  expect(child?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await refused;
  expect(child?.aborted).toBe(true);
});
it("a later parent deadline cannot extend the standalone eight-second maximum", async () => {
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockReturnValue(0);
  const work = vi.fn(async () => new Promise<never>(() => {})),
    pending = withinResearchDeadline(active(), work, 99999),
    refused = expect(pending).rejects.toThrow(
      "Bounded research operation unavailable",
    );
  await vi.advanceTimersByTimeAsync(8000);
  await refused;
  expect(work).toHaveBeenCalledOnce();
});
it.each([NaN, Infinity, -Infinity, "bad"])(
  "refuses invalid inherited deadline %s before work",
  async (value) => {
    const work = vi.fn(async () => true);
    await expect(
      withinResearchDeadline(active(), work, value as number),
    ).rejects.toThrow("Bounded research operation unavailable");
    expect(work).not.toHaveBeenCalled();
  },
);
it("an expired parent or original caller abort starts no work", async () => {
  vi.spyOn(performance, "now").mockReturnValue(9000);
  for (const [signal, deadline] of [
    [active(), 8000],
    [AbortSignal.abort(), 12000],
  ] as const) {
    const work = vi.fn(async () => true);
    await expect(
      withinResearchDeadline(signal, work, deadline),
    ).rejects.toThrow();
    expect(work).not.toHaveBeenCalled();
  }
});
it("refuses a late resolved result even when timers do not fire", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const pending = withinResearchDeadline(
    active(),
    async () => {
      now = 8001;
      return "late";
    },
    8000,
  );
  await expect(pending).rejects.toThrow(
    "Bounded research operation unavailable",
  );
});
it("a successful short child is returned without aborting its caller", async () => {
  const caller = new AbortController();
  expect(
    await withinResearchDeadline(
      caller.signal,
      async () => "complete",
      performance.now() + 1000,
    ),
  ).toBe("complete");
  expect(
    await withinResearchDeadline(caller.signal, async () => "default"),
  ).toBe("default");
  expect(caller.signal.aborted).toBe(false);
});
