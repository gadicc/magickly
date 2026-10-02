/** Non-content preview state; callers must authorize the matching draft first. */
export interface PreviewPresentation {
  top: number;
  left: number;
  details: boolean[];
}

/** Capture expanded summaries as well as scroll, since collapsing them changes height. */
export function capturePreview(
  preview: HTMLElement | null,
): PreviewPresentation {
  return {
    top: preview?.scrollTop ?? 0,
    left: preview?.scrollLeft ?? 0,
    details: Array.from(
      preview?.querySelectorAll("details") ?? [],
      (node) => node.open,
    ),
  };
}

/** Restore after layout, retrying for images; user interaction ends restoration. */
export function restorePreview(
  preview: HTMLElement,
  saved: PreviewPresentation,
) {
  for (const [index, node] of Array.from(
    preview.querySelectorAll("details"),
  ).entries())
    node.open = saved.details[index] ?? false;
  let stopped = false;
  let observer: ResizeObserver | undefined;
  const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
  const stop = () => {
    stopped = true;
    observer?.disconnect();
    preview.removeEventListener("load", apply, true);
    preview.removeEventListener("error", apply, true);
    for (const event of events) preview.removeEventListener(event, stop);
  };
  const apply = () => {
    if (stopped) return;
    preview.scrollTop = saved.top;
    preview.scrollLeft = saved.left;
    const pendingImage = Array.from(preview.querySelectorAll("img")).some(
      (image) => !image.complete,
    );
    if (
      !pendingImage &&
      Math.abs(preview.scrollTop - saved.top) < 1 &&
      Math.abs(preview.scrollLeft - saved.left) < 1
    )
      stop();
  };
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(apply);
    for (const child of preview.children) observer.observe(child);
  }
  preview.addEventListener("load", apply, true);
  preview.addEventListener("error", apply, true);
  for (const event of events)
    preview.addEventListener(event, stop, { passive: true });
  apply();
  return { stop, pending: () => !stopped, saved };
}
