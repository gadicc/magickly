import { describe, expect, it, vi } from "vitest";
import { createPreferenceSync, type PendingLocale } from "./preferenceSync";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function fixture(initial: PendingLocale | null = null) {
  let marker = initial;
  const deps = {
    read: vi.fn(async () => ({
      userId: "a",
      locale: null as "en" | "he" | null,
    })),
    save: vi.fn(async (_value: PendingLocale) => {}),
    pending: () => marker,
    persist: vi.fn((value: PendingLocale | null) => {
      marker = value;
      return true;
    }),
    apply: vi.fn(),
    status: vi.fn(),
  };
  return { deps, sync: createPreferenceSync(deps), marker: () => marker };
}

describe("account language synchronization", () => {
  it("does not initialize an account from an inherited browser preference", async () => {
    const { deps, sync } = fixture();
    await sync.settle("a");
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.apply).not.toHaveBeenCalled();
    deps.read.mockResolvedValue({ userId: "a", locale: "he" });
    await sync.retry();
    expect(deps.apply).toHaveBeenCalledWith("he");
    expect(deps.save).not.toHaveBeenCalled();
  });
  it("serializes and coalesces rapid explicit choices", async () => {
    const { deps, sync, marker } = fixture();
    await sync.settle("a");
    const first = deferred<void>();
    deps.save.mockImplementationOnce(() => first.promise);
    sync.choose("he");
    sync.choose("en");
    sync.choose("he");
    sync.choose("en");
    expect(deps.save).toHaveBeenCalledTimes(1);
    first.resolve();
    await tick();
    expect(deps.save.mock.calls.map(([value]) => value.locale)).toEqual([
      "he",
      "en",
    ]);
    expect(marker()).toBeNull();
  });
  it("a delayed account read cannot replace an explicit choice", async () => {
    const { deps, sync } = fixture();
    const read = deferred<{ userId: string; locale: "en" }>();
    deps.read.mockImplementationOnce(() => read.promise);
    const settling = sync.settle("a");
    sync.choose("he");
    read.resolve({ userId: "a", locale: "en" });
    await settling;
    expect(deps.apply).not.toHaveBeenCalled();
    expect(deps.save).toHaveBeenCalledWith({ userId: "a", locale: "he" });
  });
  it("retries a reload-persistent action only after the same identity is verified", async () => {
    const { deps, sync, marker } = fixture({ userId: "a", locale: "he" });
    deps.read.mockRejectedValueOnce(new Error("offline"));
    await sync.settle("a");
    expect(marker()).toEqual({ userId: "a", locale: "he" });
    expect(deps.save).not.toHaveBeenCalled();
    await sync.retry();
    expect(deps.save).toHaveBeenCalledWith({ userId: "a", locale: "he" });
    expect(marker()).toBeNull();
  });
  it("clears the previous identity's marker and ignores its delayed response", async () => {
    const { deps, sync, marker } = fixture();
    await sync.settle("a");
    const saving = deferred<void>();
    deps.save.mockImplementationOnce(() => saving.promise);
    sync.choose("he");
    deps.read.mockResolvedValue({ userId: "b", locale: "en" });
    await sync.settle("b");
    expect(marker()).toBeNull();
    expect(deps.apply).toHaveBeenCalledWith("en");
    saving.resolve();
    await tick();
    expect(deps.save).toHaveBeenCalledTimes(1);
    expect(deps.apply).toHaveBeenCalledTimes(1);
  });
  it("ignores wrong identities, pending authentication and responses after disposal", async () => {
    const { deps, sync, marker } = fixture({ userId: "a", locale: "he" });
    await sync.settle(undefined);
    expect(marker()).not.toBeNull();
    deps.read.mockResolvedValue({ userId: "b", locale: "en" });
    await sync.settle("a");
    expect(deps.apply).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
    await sync.settle(null);
    expect(marker()).toBeNull();
    sync.dispose();
    await sync.settle("a");
    expect(deps.apply).not.toHaveBeenCalled();
  });
  it("reports failures without discarding the newer pending choice", async () => {
    const { deps, sync, marker } = fixture();
    await sync.settle("a");
    deps.save.mockRejectedValueOnce(new Error("offline"));
    sync.choose("he");
    await tick();
    expect(marker()).toEqual({ userId: "a", locale: "he" });
    expect(deps.status).toHaveBeenLastCalledWith("failed");
    await sync.retry();
    expect(marker()).toBeNull();
    deps.persist.mockReturnValue(false);
    sync.choose("en");
    await tick();
    expect(deps.status).toHaveBeenLastCalledWith("storage-failed");
  });
});
