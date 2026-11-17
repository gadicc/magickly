import { expect, it } from "vitest";
import {
  flushPendingEdits,
  hasPendingEdits,
  registerPendingEdit,
} from "./pendingEdits";

it("reports in-focus edits until they are committed and unregisters cleanly", () => {
  let dirty = false;
  const remove = registerPendingEdit(
    () => {
      const changed = dirty;
      dirty = false;
      return changed;
    },
    () => dirty,
  );
  try {
    expect(hasPendingEdits()).toBe(false);
    dirty = true;
    expect(hasPendingEdits()).toBe(true);
    expect(flushPendingEdits()).toBe(true);
    expect(hasPendingEdits()).toBe(false);
    dirty = true;
    remove();
    expect(hasPendingEdits()).toBe(false);
  } finally {
    remove();
  }
});

it("keeps legacy fields conservatively pending until they unregister", () => {
  let flushes = 0;
  const remove = registerPendingEdit(() => {
    flushes++;
    return false;
  });
  try {
    // A locale/navigation guard must not flush or discard an older mounted field
    // merely because it cannot provide the newer dirty-state callback.
    expect(hasPendingEdits()).toBe(true);
    expect(flushes).toBe(0);
    expect(flushPendingEdits()).toBe(false);
    expect(hasPendingEdits()).toBe(true);
    remove();
    expect(hasPendingEdits()).toBe(false);
    expect(flushPendingEdits()).toBe(false);
    expect(flushes).toBe(1);
  } finally {
    remove();
  }
});
