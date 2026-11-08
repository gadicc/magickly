import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { OfflineRitualRepository } from "./repository";
import { RitualOfflineDatabase } from "./storage";

const A = "019947c5-abcd-7000-8000-00000000000a";
const B = "019947c5-abcd-7000-8000-00000000000b";
const databases: RitualOfflineDatabase[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function open(
  name = `halls-tab-${crypto.randomUUID()}`,
  factory = new IDBFactory(),
) {
  const db = new RitualOfflineDatabase(name, {
    indexedDB: factory,
    IDBKeyRange,
  });
  databases.push(db);
  return { db, repository: new OfflineRitualRepository(db), name, factory };
}

describe("the remembered temple tab", () => {
  it("survives a reread from a fresh connection", async () => {
    const first = open();
    const account = await first.repository.activateAccount(A);
    expect(await first.repository.readHallsTab(account)).toBeNull();
    await first.repository.writeHallsTab(account, "synthetic");
    first.db.close();
    const again = open(first.name, first.factory);
    expect(await again.repository.readHallsTab(account)).toBe("synthetic");
    expect(await again.db.device.get(`hallsTab:${A}`)).toEqual({
      key: `hallsTab:${A}`,
      slug: "synthetic",
    });
    await again.repository.clearHallsTab(account);
    expect(await again.repository.readHallsTab(account)).toBeNull();
  });

  it("is kept per account and only for the active one", async () => {
    const { db, repository } = await open();
    const a = await repository.activateAccount(A);
    await repository.writeHallsTab(a, "synthetic");
    // Another account's record, as a previous session might have left it.
    await db.device.put({ key: `hallsTab:${B}`, slug: "other" });
    expect(await repository.readHallsTab(a)).toBe("synthetic");
    const notActive = { ownerId: B, epoch: a.epoch };
    await expect(repository.readHallsTab(notActive)).rejects.toThrow();
    await expect(repository.writeHallsTab(notActive, "x")).rejects.toThrow();
    // The server's slug rule: 1–200 characters, not blank, no "/" or NUL.
    for (const slug of ["", "   ", "a/b", "a\0b", "x".repeat(201)])
      await expect(repository.writeHallsTab(a, slug)).rejects.toThrow();
    await repository.writeHallsTab(a, "x".repeat(200));
    await repository.writeHallsTab(a, "synthetic");
    expect(await db.device.get(`hallsTab:${B}`)).toMatchObject({
      slug: "other",
    });
  });

  it("is deleted with the account's other stores on sign-out", async () => {
    const { db, repository } = await open();
    const a = await repository.activateAccount(A);
    await repository.writeHallsTab(a, "synthetic");
    await db.device.put({ key: `hallsTab:${B}`, slug: "other" });
    await repository.signOut(a);
    expect(await db.device.get(`hallsTab:${A}`)).toBeUndefined();
    expect(await db.device.get(`hallsTab:${B}`)).toMatchObject({
      slug: "other",
    });
    expect(await db.device.get("active")).toEqual({
      key: "active",
      account: null,
      cleanupOwnerId: null,
    });
    const b = await repository.activateAccount(B);
    expect(await repository.readHallsTab(b)).toBe("other");
  });
});
