import {
  createSecrets,
  SecretsKeyError,
  secretKeyFingerprint,
  staticKeyring,
} from "@gadicc/loom/secrets";
import type { SecretLocation } from "@gadicc/loom/secrets/maintenance";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSecretsMaintenance } from "./secretsMaintenance";
import { SqlAdminError } from "./sqlAdmin";

vi.mock("server-only", () => ({}));

// Obviously synthetic keys: thirty-two copies of one byte.
const keys = { 1: new Uint8Array(32).fill(1), 2: new Uint8Array(32).fill(2) };
const recorded = async (active: 1 | 2) =>
  Promise.all(
    ([1, 2] as const).map(async (id) => ({
      id,
      fingerprint: await secretKeyFingerprint(keys[id]),
      state: id === active ? ("active" as const) : ("decrypt-only" as const),
    })),
  );
const first = createSecrets({ keys: staticKeyring(keys, 1) }).purpose("test");
// Keys checked against a recorded list, as in production.
const verified = createSecrets({
  keys: staticKeyring(keys, 2),
  expectedKeys: await recorded(2),
}).purpose("test");
const unverified = createSecrets({ keys: staticKeyring(keys, 2) }).purpose(
  "test",
);

type Rows = Map<string, string>;
const binding = (id: string) => ({ row: id });
const reads = vi.fn();
const location = (purpose: typeof first): SecretLocation<Rows> => ({
  name: "things.sealed",
  purpose,
  async read(rows, cursor, limit) {
    reads();
    return [...rows]
      .filter(([id]) => cursor === null || id > cursor)
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .slice(0, limit)
      .map(([id, sealed]) => ({ id, sealed, binding: binding(id) }));
  },
  async write(rows, id, expected, next) {
    if (rows.get(id) !== expected) return false;
    rows.set(id, next);
    return true;
  },
});

const actor = "actor";
let rows: Rows;
const requireAdmin = vi.fn(async (_expected: string) => actor);
const run = (operation: string, purpose = verified) =>
  createSecretsMaintenance(rows, requireAdmin, [location(purpose)]).run({
    expectedActorId: actor,
    operation,
  });

let logged: ReturnType<typeof vi.spyOn>;
afterEach(() => logged.mockRestore());
beforeEach(async () => {
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  reads.mockClear();
  requireAdmin.mockClear();
  rows = new Map([
    ["a", await first.seal("plain-alpha", binding("a"))],
    ["b", await first.seal("plain-beta", binding("b"))],
    // Sealed for another row: it authenticates nowhere.
    ["c", await first.seal("plain-gamma", binding("elsewhere"))],
  ]);
});

describe("secrets maintenance for administrators", () => {
  it("is for global administrators, checked before anything runs", async () => {
    requireAdmin.mockRejectedValueOnce(new SqlAdminError("FORBIDDEN"));
    const before = new Map(rows);
    await expect(run("reseal")).rejects.toMatchObject({ code: "FORBIDDEN" });
    // A check that resolves to nothing is not permission either.
    requireAdmin.mockResolvedValueOnce(null as unknown as string);
    await expect(run("verify")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(reads).not.toHaveBeenCalled();
    expect(rows).toEqual(before);
    await run("report");
    expect(requireAdmin).toHaveBeenLastCalledWith(actor);
  });

  it("refuses an operation it does not know before asking who is there", async () => {
    for (const operation of ["", "delete", "toString", "Reseal"])
      await expect(run(operation)).rejects.toMatchObject({ code: "INVALID" });
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it("reports by key version without opening anything", async () => {
    expect(await run("report")).toEqual({
      ok: true,
      operation: "report",
      clean: true,
      message: "Report finished: nothing was opened.",
      lines: [
        {
          location: "things.sealed",
          rows: 3,
          done: true,
          counts: [["under key 1", 3]],
          failureCount: 0,
          failures: [],
          changed: 0,
          changedIds: [],
        },
      ],
    });
    rows.set("d", "not a sealed string");
    expect(await run("report")).toMatchObject({
      clean: false,
      lines: [{ failures: [{ id: "d", reason: "malformed" }] }],
    });
  });

  it("verifies each row and names the ones that do not open", async () => {
    const result = await run("verify");
    expect(result).toMatchObject({
      ok: true,
      clean: false,
      message: "Verify finished. Some rows could not be handled: see below.",
      lines: [
        {
          counts: [["opened", 2]],
          failureCount: 1,
          failures: [{ id: "c", reason: "authentication" }],
        },
      ],
    });
    // Nothing but counts, ids and reasons comes back.
    expect(JSON.stringify(result)).not.toMatch(/ls1\.|plain-/);
  });

  it("rehearses a reseal without writing, then moves the rows", async () => {
    const before = new Map(rows);
    expect(await run("rehearse")).toMatchObject({
      ok: true,
      operation: "rehearse",
      message: expect.stringContaining("nothing was written"),
      lines: [
        {
          counts: [
            ["already under the active key", 0],
            ["would be resealed", 2],
          ],
          failureCount: 1,
        },
      ],
    });
    expect(rows).toEqual(before);

    rows.delete("c");
    expect(await run("reseal")).toMatchObject({
      ok: true,
      operation: "reseal",
      clean: true,
      message: "Reseal finished.",
      lines: [{ counts: [expect.anything(), ["resealed", 2]] }],
    });
    rows.set("c", before.get("c") ?? "");
    expect(await verified.tryOpen(rows.get("a") ?? "", binding("a"))).toBe(
      "plain-alpha",
    );
    expect(rows.get("a")).toMatch(/^ls1\.2\./);
    // The row that does not open is left exactly as it was.
    expect(rows.get("c")).toBe(before.get("c"));
    expect(await run("report")).toMatchObject({
      lines: [
        {
          counts: [
            ["under key 1", 1],
            ["under key 2", 2],
          ],
        },
      ],
    });
  });

  it("does not call a reseal clean when a row changed underneath it", async () => {
    rows.delete("c");
    // Someone saves row "b" again between the read and the write.
    const racing: SecretLocation<Rows> = {
      ...location(verified),
      async write(target, id, expected, next) {
        if (id === "b") return false;
        if (target.get(id) !== expected) return false;
        target.set(id, next);
        return true;
      },
    };
    const result = await createSecretsMaintenance(rows, requireAdmin, [
      racing,
    ]).run({ expectedActorId: actor, operation: "reseal" });
    expect(result).toMatchObject({
      ok: true,
      clean: false,
      message: expect.stringContaining("run it again"),
      lines: [
        {
          counts: [expect.anything(), ["resealed", 1]],
          failureCount: 0,
          changed: 1,
          changedIds: ["b"],
        },
      ],
    });
    expect(rows.get("b")).toMatch(/^ls1\.1\./);
  });

  it("says so when nothing is declared, and when a run stops short", async () => {
    expect(
      await createSecretsMaintenance(rows, requireAdmin, []).run({
        expectedActorId: actor,
        operation: "reseal",
      }),
    ).toEqual({ ok: false, message: "No secret locations are declared." });
    // Loom reads to the end unless told to stop; a result that did not is
    // still never called clean.
    const partial: SecretLocation<Rows> = {
      ...location(verified),
      purpose: {
        ...verified,
        keyId: () => {
          throw new Error("synthetic");
        },
      },
    };
    const stopped = await createSecretsMaintenance(rows, requireAdmin, [
      partial,
    ]).run({ expectedActorId: actor, operation: "report" });
    expect(stopped.ok).toBe(false);
  });

  it("will not reseal onto keys nothing has verified, but will rehearse", async () => {
    const before = new Map(rows);
    expect(await run("reseal", unverified)).toEqual({
      ok: false,
      message: expect.stringContaining("nothing was resealed"),
    });
    expect(rows).toEqual(before);
    expect(await run("rehearse", unverified)).toMatchObject({ ok: true });
    expect(rows).toEqual(before);
    // One unverified location is enough to stop the whole run.
    expect(
      await createSecretsMaintenance(rows, requireAdmin, [
        location(verified),
        { ...location(unverified), name: "others.sealed" },
      ]).run({ expectedActorId: actor, operation: "reseal" }),
    ).toMatchObject({ ok: false });
    expect(rows).toEqual(before);
  });

  it("lists only the first failures but counts them all", async () => {
    for (let index = 0; index < 30; index += 1)
      rows.set(`bad-${String(index).padStart(2, "0")}`, "not a sealed string");
    const result = await run("verify");
    expect(result).toMatchObject({ ok: true, lines: [{ failureCount: 31 }] });
    expect(result.ok && result.lines[0].failures).toHaveLength(20);
  });

  it("gives the reason when the keys fail, and only the place when the database does", async () => {
    const failing = (error: unknown): typeof first => ({
      ...verified,
      assertReady: async () => {
        throw error;
      },
    });
    expect(
      await run("reseal", failing(new SecretsKeyError("Key 2 is missing."))),
    ).toEqual({ ok: false, message: "Key 2 is missing." });
    await expect(run("reseal", failing(new Error("down")))).rejects.toThrow(
      "down",
    );
    expect(logged).toHaveBeenLastCalledWith(
      "Secrets maintenance failed:",
      "Error",
    );
    await expect(run("reseal", failing("not an error"))).rejects.toBe(
      "not an error",
    );
    expect(logged).toHaveBeenLastCalledWith(
      "Secrets maintenance failed:",
      "unknown error",
    );

    const stopping = (error: unknown): SecretLocation<Rows> => ({
      ...location(verified),
      read: async () => {
        throw error;
      },
    });
    const verify = (error: unknown) =>
      createSecretsMaintenance(rows, requireAdmin, [stopping(error)]).run({
        expectedActorId: actor,
        operation: "verify",
      });
    const lost = await verify(
      new TypeError("connection lost: password=synthetic"),
    );
    expect(lost).toEqual({
      ok: false,
      message: 'Secret maintenance stopped in "things.sealed".',
    });
    // The driver's own words stay out of the page and the log.
    expect(logged).toHaveBeenLastCalledWith(
      "Secrets maintenance stopped:",
      'Secret maintenance stopped in "things.sealed".',
      "TypeError",
    );
    expect(JSON.stringify(logged.mock.calls)).not.toContain("synthetic");
    await verify("not an error");
    expect(logged).toHaveBeenLastCalledWith(
      "Secrets maintenance stopped:",
      expect.any(String),
      "unknown cause",
    );
    // Keys refused part-way through are a reason worth giving.
    expect(await verify(new SecretsKeyError("Key 1 is refused."))).toEqual({
      ok: false,
      message:
        'Secret maintenance stopped in "things.sealed". Key 1 is refused.',
    });
  });
});
