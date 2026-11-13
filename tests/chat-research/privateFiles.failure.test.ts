/** During-read synthetic mutations must not return a successful launch-input snapshot. */
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import {
  PRIVATE_RETENTION_FILE_ERROR,
  readPrivateRetentionProfileText,
} from "../../src/chat-research/privateFiles";

const fault = vi.hoisted(() => ({
  kind: "",
  file: "",
  parent: "",
  injected: false,
}));
vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  return {
    ...real,
    readSync(
      fd: number,
      buffer: NodeJS.ArrayBufferView,
      offset: number,
      length: number,
      position: number | null,
    ) {
      const n = real.readSync(fd, buffer, offset, length, position);
      if (
        n > 0 &&
        !fault.injected &&
        real.readlinkSync(`/proc/self/fd/${fd}`) === fault.file
      ) {
        fault.injected = true;
        if (fault.kind === "grow") real.appendFileSync(fault.file, "extra");
        else if (fault.kind === "replace") {
          real.renameSync(fault.file, fault.file + ".old");
          real.writeFileSync(fault.file, "synthetic input", { mode: 0o600 });
        } else if (fault.kind === "file-mode")
          real.chmodSync(fault.file, 0o644);
        else if (fault.kind === "parent-mode")
          real.chmodSync(fault.parent, 0o755);
      }
      return n;
    },
  };
});
const dirs: string[] = [];
afterEach(() => {
  fault.file = "";
  fault.kind = "";
  fault.parent = "";
  fault.injected = false;
  for (const dir of dirs.splice(0)) {
    chmodSync(dir, 0o700);
    rmSync(dir, { recursive: true, force: true });
  }
});
it.each(["grow", "replace", "file-mode", "parent-mode"])(
  "refuses reached-once%s mutation during the actual bounded read",
  (kind) => {
    const parent = mkdtempSync(
      join(tmpdir(), "magickli-retention-read-race-unit-"),
    );
    chmodSync(parent, 0o700);
    dirs.push(parent);
    const file = join(parent, "profile.json");
    writeFileSync(file, "synthetic input", { mode: 0o600 });
    Object.assign(fault, { kind, file, parent, injected: false });
    expect(() => readPrivateRetentionProfileText(file)).toThrow(
      PRIVATE_RETENTION_FILE_ERROR,
    );
    expect(fault.injected).toBe(true);
  },
);
