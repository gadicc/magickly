/**
 * Draws a few thumbnails per animation frame (plan 069, decision 7): the
 * spike drew sixteen halls at once on a CPU slowed 4× with one task blocking
 * for 560 ms. Each job runs once, in order; a cancelled one never runs.
 */
export function createDrawQueue(options: {
  perFrame: number;
  requestFrame?: (callback: () => void) => void;
}) {
  const requestFrame =
    options.requestFrame ??
    ((callback: () => void) => {
      if (typeof requestAnimationFrame === "function")
        requestAnimationFrame(() => callback());
      else setTimeout(callback, 16);
    });
  const queue: (() => void)[] = [];
  let scheduled = false;
  const schedule = () => {
    if (scheduled || queue.length === 0) return;
    scheduled = true;
    requestFrame(run);
  };
  const run = () => {
    scheduled = false;
    for (let drawn = 0; drawn < options.perFrame && queue.length > 0; drawn++) {
      const job = queue.shift() as () => void;
      try {
        job();
      } catch {
        // One thumbnail's failure does not stop the others.
      }
    }
    schedule();
  };
  return {
    /** Queue a job; the returned function cancels it if it has not run. */
    enqueue(job: () => void): () => void {
      const entry = () => job();
      queue.push(entry);
      schedule();
      return () => {
        const index = queue.indexOf(entry);
        if (index >= 0) queue.splice(index, 1);
      };
    },
    /** Jobs waiting, for tests. */
    get size() {
      return queue.length;
    },
  };
}

export type DrawQueue = ReturnType<typeof createDrawQueue>;
