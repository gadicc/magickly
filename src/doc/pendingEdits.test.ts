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
