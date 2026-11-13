import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("nlopt-js");
  vi.resetModules();
});

describe("optimiser loading", () => {
  it("does not cache a failed load and recovers on the next call", async () => {
    vi.resetModules();
    const actual = await vi.importActual<{ default: object }>("nlopt-js");
    let failOnce = true;
    vi.doMock("nlopt-js", () => ({
      default: new Proxy(actual.default, {
        get(target, property, receiver) {
          if (property === "ready" && failOnce) {
            failOnce = false;
            return Promise.reject(new Error("wasm unavailable"));
          }
          return Reflect.get(target, property, receiver);
        },
      }),
    }));
    const { optimizeSigilPoints } = await import("./roseSigilOptimizer.ts");
    const { sigilPoints } = await import("./roseSigilGeometry.ts");
    await expect(optimizeSigilPoints(sigilPoints("אב"))).rejects.toThrow(
      "wasm unavailable",
    );
    await expect(optimizeSigilPoints(sigilPoints("אב"))).resolves.toHaveLength(
      2,
    );
  });

  /** A stand-in for nlopt-js whose `ready` runs `onReady`, as its glue's load does. */
  const fakeNlopt = (onReady: () => void) => ({
    default: {
      get ready() {
        onReady();
        return Promise.resolve();
      },
      Algorithm: { LN_COBYLA: 0 },
      Optimize: class {
        setMaxObjective() {}
        setMaxeval() {}
        optimize(start: number[]) {
          return { x: start };
        }
      },
      GC: { flush() {} },
    },
  });

  it("removes the process handlers nlopt adds in Node, and only those", async () => {
    vi.resetModules();
    const kept = () => {};
    const added = () => {};
    process.on("uncaughtException", kept);
    try {
      vi.doMock("nlopt-js", () =>
        fakeNlopt(() => process.on("uncaughtException", added)),
      );
      const { optimizeSigilPoints } = await import("./roseSigilOptimizer.ts");
      const { sigilPoints } = await import("./roseSigilGeometry.ts");
      await expect(
        optimizeSigilPoints(sigilPoints("אב")),
      ).resolves.toHaveLength(2);
      const listeners = process.listeners("uncaughtException");
      expect(listeners).toContain(kept);
      expect(listeners).not.toContain(added);
    } finally {
      process.removeListener("uncaughtException", kept);
      process.removeListener("uncaughtException", added);
    }
  });

  it("loads where there is no Node process to clean up after", async () => {
    vi.resetModules();
    vi.doMock("nlopt-js", () => fakeNlopt(() => {}));
    const { optimizeSigilPoints } = await import("./roseSigilOptimizer.ts");
    // A browser's `process` shim, if any, has no listeners().
    Object.defineProperty(process, "listeners", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      await expect(optimizeSigilPoints([{ x: 1, y: 2 }])).resolves.toEqual([
        { x: 1, y: 2 },
      ]);
    } finally {
      // The own property hid EventEmitter's method; removing it restores it.
      Reflect.deleteProperty(process, "listeners");
    }
  });
});
