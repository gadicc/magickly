// @vitest-environment jsdom

import { forEachDiagnostic } from "@codemirror/lint";
import { act, cleanup, render } from "@testing-library/react";
import { EditorView } from "@uiw/react-codemirror";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RitualSourceEditor from "./RitualSourceEditor";
import { RITUAL_PUG_HEADER } from "./ritualPug";

// Each source's one warning names its length, so a stale one shows.
const warnings = vi.hoisted(() =>
  vi.fn((source: string) => [
    { line: 2, column: 1, message: `for ${source.length}` },
  ]),
);
vi.mock("./gdHallDiagnostics", () => ({ gdHallSourceWarnings: warnings }));

Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(),
});

// Idle callbacks run only when a test says so.
let idle: Map<number, () => void>;
let serial = 0;
beforeEach(() => {
  vi.useFakeTimers();
  warnings.mockClear();
  idle = new Map();
  window.requestIdleCallback = (task) => {
    const handle = ++serial;
    idle.set(handle, () =>
      task({ didTimeout: false, timeRemaining: () => 50 }),
    );
    return handle;
  };
  window.cancelIdleCallback = (handle) => {
    idle.delete(handle);
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const first = `${RITUAL_PUG_HEADER}\ngdHall\n  floor\n`;
const second = `${RITUAL_PUG_HEADER}\ngdHall\n  floor\n  floor\n`;
const props = { dialect: "pug" as const, onChange: vi.fn(), disabled: false };

/** The pause in typing, then the lazy import of the diagnostics. */
async function pause() {
  await act(async () => {
    vi.advanceTimersByTime(300);
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}
async function runIdle() {
  await act(async () => {
    const tasks = [...idle.values()];
    idle.clear();
    for (const task of tasks) task();
  });
}
const shown = (container: HTMLElement) => {
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  const messages: string[] = [];
  forEachDiagnostic(view.state, (diagnostic) =>
    messages.push(diagnostic.message),
  );
  return messages;
};

it("checks the source in idle time after a pause in typing", async () => {
  const { container } = render(<RitualSourceEditor {...props} value={first} />);
  await pause();
  expect(warnings).not.toHaveBeenCalled();
  expect(idle.size).toBe(1);
  await runIdle();
  expect(warnings).toHaveBeenCalledWith(first, { headerless: false });
  expect(shown(container)).toEqual([`for ${first.length}`]);
});

it("drops a check for source that has since changed", async () => {
  const { container, rerender } = render(
    <RitualSourceEditor {...props} value={first} />,
  );
  await pause();
  // The author types before the idle check of the first source runs.
  rerender(<RitualSourceEditor {...props} value={second} />);
  expect(idle.size).toBe(0);
  await runIdle();
  expect(warnings).not.toHaveBeenCalled();
  expect(shown(container)).toEqual([]);
  await pause();
  await runIdle();
  expect(warnings.mock.calls).toEqual([[second, { headerless: false }]]);
  expect(shown(container)).toEqual([`for ${second.length}`]);
});

it("does not show warnings for older source while newer is checked", async () => {
  const { container, rerender } = render(
    <RitualSourceEditor {...props} value={first} />,
  );
  await pause();
  await runIdle();
  expect(shown(container)).toEqual([`for ${first.length}`]);
  // Until the new source is checked, the old warnings no longer apply.
  rerender(<RitualSourceEditor {...props} value={second} />);
  expect(shown(container)).toEqual([]);
});

it("does nothing after unmounting", async () => {
  const waiting = render(<RitualSourceEditor {...props} value={first} />);
  await pause();
  expect(idle.size).toBe(1);
  waiting.unmount();
  expect(idle.size).toBe(0);

  const loading = render(<RitualSourceEditor {...props} value={first} />);
  loading.unmount();
  await pause();
  await runIdle();
  expect(warnings).not.toHaveBeenCalled();
});

it("waits for a later task where idle callbacks are missing", async () => {
  const request = window.requestIdleCallback;
  // @ts-expect-error Safari has no requestIdleCallback.
  delete window.requestIdleCallback;
  try {
    const { container } = render(
      <RitualSourceEditor {...props} value={first} />,
    );
    await pause();
    expect(warnings).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    expect(shown(container)).toEqual([`for ${first.length}`]);
  } finally {
    window.requestIdleCallback = request;
  }
});

it("checks a hall's own source, without the header, as such", async () => {
  const text = "gdHall\n  floor\n";
  render(<RitualSourceEditor {...props} value={text} headerless />);
  await pause();
  await runIdle();
  expect(warnings).toHaveBeenCalledWith(text, { headerless: true });
});
