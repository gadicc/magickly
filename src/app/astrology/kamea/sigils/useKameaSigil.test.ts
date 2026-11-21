// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { KameaSigilFigure } from "magick-components/astrology/KameaSigil";
import type { KameaPlanetId } from "magick-data/astrology/kameas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  KAMEA_SIGIL_DEBOUNCE,
  type KameaSigilRequest,
  useKameaSigil,
} from "./useKameaSigil";

/** A worker the test answers by hand. */
class FakeWorker {
  static made: FakeWorker[] = [];
  static throws = false;
  posted: KameaSigilRequest[] = [];
  terminated = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  constructor() {
    if (FakeWorker.throws) throw new Error("blocked by policy");
    FakeWorker.made.push(this);
  }
  postMessage(request: KameaSigilRequest) {
    this.posted.push(request);
  }
  terminate() {
    this.terminated = true;
  }
  /** Answers a request with a stand-in figure for its text. */
  answer(request: KameaSigilRequest) {
    this.onmessage?.({ data: { id: request.id, sigil: figure(request) } });
  }
}

const figure = ({ planet, text, finals }: Omit<KameaSigilRequest, "id">) =>
  ({ planet, text, finals, failed: false }) as unknown as KameaSigilFigure;

type Props = { planet: KameaPlanetId; text: string; finals: boolean };
const start = (props: Props) =>
  renderHook((p: Props) => useKameaSigil(p.planet, p.text, p.finals), {
    initialProps: props,
  });
const settle = () =>
  act(() => {
    vi.advanceTimersByTime(KAMEA_SIGIL_DEBOUNCE + 1);
  });

beforeEach(() => {
  vi.useFakeTimers();
  FakeWorker.made = [];
  FakeWorker.throws = false;
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useKameaSigil's worker", () => {
  it("places after the pause, and only then says it is placing", () => {
    const hook = start({ planet: "saturn", text: "אגיאל", finals: false });
    expect(hook.result.current).toMatchObject({
      sigil: null,
      pending: true,
      placing: false,
    });
    expect(FakeWorker.made).toHaveLength(0);
    settle();
    expect(hook.result.current.placing).toBe(true);
    const [worker] = FakeWorker.made;
    expect(worker.posted).toEqual([
      { id: 1, planet: "saturn", text: "אגיאל", finals: false },
    ]);
    act(() => worker.answer(worker.posted[0]));
    expect(hook.result.current).toMatchObject({
      pending: false,
      placing: false,
      sigil: { text: "אגיאל" },
    });
  });

  it("ends a busy worker for newer input, drops its stale answer and keeps it", () => {
    const hook = start({ planet: "luna", text: "מלכא", finals: true });
    settle();
    const [first] = FakeWorker.made;
    hook.rerender({ planet: "luna", text: "אלים", finals: true });
    settle();
    // The first is still placing, so it is ended and a second started.
    expect(first.terminated).toBe(true);
    const second = FakeWorker.made[1];
    expect(second.posted.map((r) => r.text)).toEqual(["אלים"]);
    // An answer to the superseded request is not drawn...
    act(() => first.answer(first.posted[0]));
    expect(hook.result.current.sigil).toBeNull();
    act(() => second.answer(second.posted[0]));
    expect(hook.result.current.sigil?.text).toBe("אלים");
    // ...but it is kept: going back draws it without placing again.
    hook.rerender({ planet: "luna", text: "מלכא", finals: true });
    expect(hook.result.current).toMatchObject({
      pending: false,
      sigil: { text: "מלכא" },
    });
    settle();
    expect(second.posted).toHaveLength(1);
    expect(FakeWorker.made).toHaveLength(2);
  });

  it("reuses an idle worker", () => {
    const hook = start({ planet: "saturn", text: "א", finals: false });
    settle();
    const [worker] = FakeWorker.made;
    act(() => worker.answer(worker.posted[0]));
    hook.rerender({ planet: "saturn", text: "אב", finals: false });
    settle();
    expect(FakeWorker.made).toHaveLength(1);
    expect(worker.posted.map((r) => r.text)).toEqual(["א", "אב"]);
  });

  it.each(["onerror", "onmessageerror"] as const)(
    "places on the main thread when the worker's %s fires",
    (handler) => {
      const hook = start({ planet: "saturn", text: "זאזל", finals: false });
      settle();
      const [worker] = FakeWorker.made;
      act(() => {
        worker[handler]?.({});
        vi.advanceTimersByTime(1);
      });
      expect(worker.terminated).toBe(true);
      expect(hook.result.current).toMatchObject({
        pending: false,
        placing: false,
        sigil: { planet: "saturn", text: "זאזל", failed: false },
      });
      // From then on the main thread places, and no worker is started.
      hook.rerender({ planet: "saturn", text: "אגיאל", finals: false });
      settle();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(FakeWorker.made).toHaveLength(1);
      expect(hook.result.current.sigil?.text).toBe("אגיאל");
    },
  );

  it("places on the main thread when no worker can be started", () => {
    FakeWorker.throws = true;
    const hook = start({ planet: "jupiter", text: "הסמאל", finals: false });
    settle();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hook.result.current).toMatchObject({
      pending: false,
      sigil: { planet: "jupiter", text: "הסמאל" },
    });
  });

  it("draws a seed at once and ends its worker when unmounted", () => {
    const seed = figure({ planet: "saturn", text: "אגיאל", finals: false });
    const hook = renderHook(
      (p: Props) => useKameaSigil(p.planet, p.text, p.finals, seed),
      { initialProps: { planet: "saturn", text: "אגיאל", finals: false } },
    );
    expect(hook.result.current).toMatchObject({ pending: false, sigil: seed });
    settle();
    expect(FakeWorker.made).toHaveLength(0);
    hook.rerender({ planet: "saturn", text: "זאזל", finals: false });
    settle();
    const [worker] = FakeWorker.made;
    hook.unmount();
    expect(worker.terminated).toBe(true);
  });
});
