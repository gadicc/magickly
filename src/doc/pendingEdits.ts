/**
 * Fields that write their value only when left, such as the hall editor's
 * panel (plan 061, decision 11), register here while mounted, so that a
 * save can write what is still being typed first: Ctrl+S from such a field
 * does not leave it, and a Save button pressed without taking the focus
 * (Safari's buttons do not) does not either.
 */
const pending = new Map<() => boolean, () => boolean>();

/**
 * Registers a field's `flush`, which writes its typed value now and
 * returns true when that changed something. Returns the unregistration.
 */
export function registerPendingEdit(
  flush: () => boolean,
  dirty: () => boolean = () => true,
): () => void {
  pending.set(flush, dirty);
  return () => {
    pending.delete(flush);
  };
}

/** Writes every registered field's typed value; true when any changed. */
export function flushPendingEdits(): boolean {
  let changed = false;
  for (const flush of [...pending.keys()]) if (flush()) changed = true;
  return changed;
}

/** Whether an in-focus field still holds a value outside the saved document. */
export function hasPendingEdits(): boolean {
  return [...pending.values()].some((dirty) => dirty());
}
