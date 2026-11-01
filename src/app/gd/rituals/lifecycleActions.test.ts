import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  readDeletion: vi.fn(),
  deleteRitual: vi.fn(),
  restoreRitual: vi.fn(),
}));
vi.mock("@/auth/session", () => ({ getCurrentSqlUserId: vi.fn() }));
vi.mock("@/db/neonFull", () => ({ db: {} }));
vi.mock("@/doc/sqlLifecycle", () => ({
  createSqlRitualLifecycleService: () => service,
}));

const { deleteRitual, loadRitualDeletion, restoreRitual } = await import(
  "./lifecycleActions"
);

const ritualId = "019a0000-0000-7000-8000-000000000151";
const expectedActorId = "019a0000-0000-7000-8000-000000000001";

beforeEach(() => {
  for (const fn of Object.values(service))
    fn.mockReset().mockResolvedValue("r");
});

describe("ritual lifecycle server actions", () => {
  it("passes only the request's own fields to the service", async () => {
    expect(
      await deleteRitual({ ritualId, expectedActorId, extra: 1 } as never),
    ).toBe("r");
    expect(service.deleteRitual).toHaveBeenCalledWith({
      version: 1,
      expectedActorId,
      ritualId,
    });
    await restoreRitual({ ritualId, expectedActorId });
    expect(service.restoreRitual).toHaveBeenCalledWith({
      version: 1,
      expectedActorId,
      ritualId,
    });
  });

  it("lets the service refuse whatever the browser sent", async () => {
    await deleteRitual(null as never);
    expect(service.deleteRitual).toHaveBeenCalledWith({
      version: 1,
      expectedActorId: undefined,
      ritualId: undefined,
    });
  });

  it("loads the dialog's facts", async () => {
    await loadRitualDeletion(ritualId);
    expect(service.readDeletion).toHaveBeenCalledWith(ritualId);
  });
});
