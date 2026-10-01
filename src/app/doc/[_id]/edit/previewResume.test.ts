// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { capturePreview, restorePreview } from "./previewResume";

afterEach(() => vi.unstubAllGlobals());

function clampedPreview(max: () => number) {
  const preview = document.createElement("div");
  let top = 0;
  Object.defineProperty(preview, "scrollTop", {
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, max()));
    },
  });
  return preview;
}

it("restores expanded summaries before assigning scroll to avoid layout clamping", () => {
  const details = document.createElement("details");
  const preview = clampedPreview(() => (details.open ? 2000 : 0));
  preview.append(details);
  details.open = true;
  preview.scrollTop = 700;
  const saved = capturePreview(preview);
  details.open = false;
  preview.scrollTop = 0;
  const restore = restorePreview(preview, saved);
  expect(details.open).toBe(true);
  expect(preview.scrollTop).toBe(700);
  expect(restore.pending()).toBe(false);
});

it("retries a clamped position when an unsized image finishes loading", () => {
  let loaded = false;
  const preview = clampedPreview(() => (loaded ? 2000 : 0));
  const image = document.createElement("img");
  Object.defineProperty(image, "complete", { get: () => loaded });
  preview.append(image);
  const restore = restorePreview(preview, { top: 700, left: 0, details: [] });
  expect(preview.scrollTop).toBe(0);
  expect(restore.pending()).toBe(true);
  loaded = true;
  image.dispatchEvent(new Event("load"));
  expect(preview.scrollTop).toBe(700);
  expect(restore.pending()).toBe(false);
});

it.each(["wheel", "touchstart", "pointerdown", "keydown"])(
  "respects user %s input while images are pending",
  (event) => {
    let loaded = false;
    const preview = clampedPreview(() => (loaded ? 2000 : 0));
    const image = document.createElement("img");
    Object.defineProperty(image, "complete", { get: () => loaded });
    preview.append(image);
    const restore = restorePreview(preview, { top: 700, left: 0, details: [] });
    preview.dispatchEvent(new Event(event));
    loaded = true;
    image.dispatchEvent(new Event("load"));
    expect(preview.scrollTop).toBe(0);
    expect(restore.pending()).toBe(false);
  },
);

it("retries after content grows and disconnects observers on completion or cancellation", () => {
  let height = 0;
  let resized!: () => void;
  const disconnect = vi.fn();
  const observe = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  const preview = clampedPreview(() => height);
  preview.append(document.createElement("div"));
  const restore = restorePreview(preview, { top: 700, left: 0, details: [] });
  expect(observe).toHaveBeenCalledOnce();
  height = 2000;
  resized();
  expect(preview.scrollTop).toBe(700);
  expect(disconnect).toHaveBeenCalledOnce();
  expect(restore.pending()).toBe(false);
  const cancelled = restorePreview(preview, {
    top: 3000,
    left: 0,
    details: [],
  });
  cancelled.stop();
  height = 4000;
  resized();
  expect(preview.scrollTop).toBe(2000);
  expect(cancelled.pending()).toBe(false);
});
