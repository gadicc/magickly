import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "@/db/schema/index";
import { createUuidV7 } from "@/lib/ids";

vi.mock("server-only", () => ({}));
const harness = await createMemoryPgliteHarness({ schema });
const db = drizzle(harness.client, { schema });
afterAll(() => harness.client.close());

const storage = vi.hoisted(() => ({
  create: vi.fn(),
  deleted: [] as string[],
  destroy: vi.fn(),
}));
vi.mock("@/db/neonFull", () => ({ db }));
vi.mock("@/files/r2Purge", () => ({
  createRitualObjectPurger: storage.create,
}));
const job = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/doc/sqlPurge", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/doc/sqlPurge")>();
  job.run.mockImplementation(real.runRitualPurgeJob);
  return { ...real, runRitualPurgeJob: job.run };
});

const { GET, maxDuration, runtime } = await import("./route");
const { cronRuns, rituals, user, auditEvents } = schema;

const call = (authorization?: string) =>
  GET(
    new Request("http://127.0.0.1/api/cron/purge-deleted-rituals", {
      headers: authorization ? { authorization } : {},
    }),
  );
const heartbeat = async () =>
  (
    await db
      .select()
      .from(cronRuns)
      .where(eq(cronRuns.job, "purge-deleted-rituals"))
  )[0];

const creator = createUuidV7();
const ritualId = createUuidV7();

beforeEach(async () => {
  vi.stubEnv("CRON_SECRET", "local-cron-secret");
  storage.deleted.length = 0;
  storage.destroy.mockReset();
  storage.create.mockReset().mockImplementation(() => ({
    bucket: "magickly-dev",
    deleteObject: async (_bucket: string, key: string) => {
      storage.deleted.push(key);
    },
    listPrefix: async () => [],
    destroy: storage.destroy,
  }));
  await db.delete(cronRuns);
  await db.delete(auditEvents);
  await db.delete(rituals);
  await db.delete(user);
  await db
    .insert(user)
    .values({ id: creator, name: "Synthetic", email: "c@example.test" });
});
afterEach(() => vi.unstubAllEnvs());

describe("the nightly purge route", () => {
  it("is a node route with a minute's budget", () => {
    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(60);
  });

  it("starts no ritual after 35 seconds and stops deleting objects at 45", async () => {
    expect((await call("Bearer local-cron-secret")).status).toBe(200);
    expect(job.run).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 5,
        deadlineMs: 35_000,
        objectDeadlineMs: 45_000,
      }),
    );
  });

  it("never runs unconfigured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(503);
    expect(await heartbeat()).toBeUndefined();
  });

  it("refuses a missing, wrong or differently sized secret", async () => {
    for (const header of [
      undefined,
      "Bearer wrong-secret-same-len",
      "Bearer local-cron-secre",
      "Bearer local-cron-secret-and-more",
      "local-cron-secret",
    ])
      expect((await call(header)).status).toBe(401);
    expect(await heartbeat()).toBeUndefined();
  });

  it("answers counts only and leaves a heartbeat", async () => {
    const response = await call("Bearer local-cron-secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      due: 0,
      purged: 0,
      deferred: 0,
      failed: 0,
    });
    expect(storage.create).not.toHaveBeenCalled();
    expect(await heartbeat()).toMatchObject({
      outcome: "ok",
      due: 0,
      finishedAt: expect.any(Date),
    });
  });

  it("purges a due ritual without naming it", async () => {
    const at = new Date(Date.now() - 2 * 86_400_000);
    await db.insert(rituals).values({
      id: ritualId,
      title: "Retired opening (sample)",
      creatorId: creator,
      scope: "public",
      createdAt: at,
      updatedAt: at,
      deletedAt: at,
      deletedById: creator,
      purgeAfter: at,
    });
    const response = await call("Bearer local-cron-secret");
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({
      due: 1,
      purged: 1,
      deferred: 0,
      failed: 0,
    });
    expect(body).not.toContain("Retired");
    expect(await db.select().from(rituals)).toEqual([]);
    expect(storage.destroy).toHaveBeenCalled();
  });

  it("records a failed run and answers 500", async () => {
    const at = new Date(Date.now() - 2 * 86_400_000);
    await db.insert(rituals).values({
      id: ritualId,
      title: "Retired opening (sample)",
      creatorId: creator,
      scope: "public",
      createdAt: at,
      updatedAt: at,
      deletedAt: at,
      deletedById: creator,
      purgeAfter: at,
    });
    storage.create.mockImplementation(() => {
      throw new TypeError("not configured");
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await call("Bearer local-cron-secret");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed" });
    expect(error).toHaveBeenCalledWith(
      "purge-deleted-rituals: run failed (TypeError)",
    );
    expect(await heartbeat()).toMatchObject({ outcome: "failed" });
    storage.create.mockImplementation(() => {
      throw "not an error";
    });
    expect((await call("Bearer local-cron-secret")).status).toBe(500);
    expect(error).toHaveBeenLastCalledWith(
      "purge-deleted-rituals: run failed (Error)",
    );
    error.mockRestore();
  });
});
