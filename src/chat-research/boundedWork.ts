/** Shared server work deadline. A timeout bounds waiting, not the lifetime of non-cooperative underlying I/O. */
import "server-only";
export const RESEARCH_OPERATION_TIMEOUT_MS = 8000;
const RESEARCH_OPERATION_ERROR = "Bounded research operation unavailable";
const fail = (): never => {
  throw Error(RESEARCH_OPERATION_ERROR);
};
/** Bounds waiting, even for a non-cooperative port. An optional inherited monotonic deadline can only shorten the eight-second bound; it cannot preempt underlying I/O. */
export async function withinResearchDeadline<T>(
  signal: AbortSignal,
  work: (signal: AbortSignal) => Promise<T>,
  absoluteDeadlineAt?: number,
): Promise<T> {
  if (
    absoluteDeadlineAt !== undefined &&
    (typeof absoluteDeadlineAt !== "number" ||
      !Number.isFinite(absoluteDeadlineAt))
  )
    fail();
  const started = performance.now(),
    deadlineAt = Math.min(
      started + RESEARCH_OPERATION_TIMEOUT_MS,
      absoluteDeadlineAt ?? Infinity,
    ),
    controller = new AbortController(),
    combined = AbortSignal.any([signal, controller.signal]);
  let reject!: () => void;
  const interrupted = new Promise<never>((_resolve, r) => {
    reject = () => r(Error(RESEARCH_OPERATION_ERROR));
  });
  // An elapsed-time check can run before a delayed timeout callback. Notify cooperative ports too.
  void interrupted.catch(() => {});
  const assert = () => {
    if (combined.aborted || performance.now() >= deadlineAt) {
      controller.abort();
      fail();
    }
  };
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(0, deadlineAt - started),
  );
  combined.addEventListener("abort", reject, { once: true });
  try {
    assert();
    const value = await Promise.race([
      Promise.resolve().then(() => {
        assert();
        return work(combined);
      }),
      interrupted,
    ]);
    assert();
    return value;
  } finally {
    clearTimeout(timer);
    combined.removeEventListener("abort", reject);
  }
}
