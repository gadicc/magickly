// @vitest-environment jsdom
import {
  PerspectiveCamera,
  Scene,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createViewer, MAX_PIXEL_RATIO, roomEnvironment } from "./viewer";

// No GPU here: the environment's prefiltering is replaced, and the rest
// runs against a stub renderer.
const pmrem = vi.hoisted(() => ({ made: 0, disposed: 0 }));
vi.mock("three", async (original) => {
  const three = await original<typeof import("three")>();
  class PMREMGenerator {
    constructor() {
      pmrem.made += 1;
    }
    fromScene() {
      return new three.WebGLRenderTarget();
    }
    dispose() {
      pmrem.disposed += 1;
    }
  }
  return { ...three, PMREMGenerator };
});

/** A `ResizeObserver` for jsdom, which has none, that a test can fire. */
class Observer {
  static all: Observer[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: () => void) {
    Observer.all.push(this);
  }
  unobserved: Element[] = [];
  observe(element: Element) {
    this.observed.push(element);
  }
  unobserve(element: Element) {
    this.unobserved.push(element);
  }
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    this.callback();
  }
}

/** A renderer that records its calls; `tick` runs the animation loop once. */
function stubRenderer() {
  let loop: (() => void) | null = null;
  const renderer = {
    domElement: document.createElement("canvas"),
    setClearColor: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
    setAnimationLoop: vi.fn((callback: (() => void) | null) => {
      loop = callback;
    }),
  };
  return {
    renderer,
    make: () => renderer as unknown as WebGLRenderer,
    tick: () => loop?.(),
    get looping() {
      return loop !== null;
    },
  };
}

function setUp() {
  const box = document.createElement("div");
  document.body.append(box);
  box.getBoundingClientRect = () => ({ width: 300, height: 200 }) as DOMRect;
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const stub = stubRenderer();
  const targets: WebGLRenderTarget[] = [];
  const environment = vi.fn(() => {
    const target = new WebGLRenderTarget();
    targets.push(target);
    return target;
  });
  const resized = vi.fn();
  const viewer = createViewer(box, {
    scene,
    camera,
    environment,
    resized,
    renderer: stub.make,
  });
  return { box, scene, camera, stub, targets, environment, resized, viewer };
}

beforeEach(() => {
  Observer.all = [];
  vi.stubGlobal("ResizeObserver", Observer);
});
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the viewer (plan 101, invariant 5)", () => {
  it("puts a transparent, full-size canvas in its box", () => {
    const { box, stub } = setUp();
    const canvas = stub.renderer.domElement;
    expect(canvas.parentElement).toBe(box);
    expect(canvas.style.width).toBe("100%");
    expect(canvas.style.height).toBe("100%");
    expect(stub.renderer.setClearColor).toHaveBeenCalledWith(0x000000, 0);
  });

  it("draws nothing until it is asked", () => {
    const { stub, viewer } = setUp();
    expect(stub.renderer.setAnimationLoop).not.toHaveBeenCalled();
    stub.tick();
    expect(stub.renderer.render).not.toHaveBeenCalled();
    expect(viewer.frames).toBe(0);
  });

  it("draws one frame for asks before it, and clears the loop", () => {
    const { stub, viewer, scene, camera } = setUp();
    viewer.invalidate();
    viewer.invalidate();
    viewer.invalidate();
    expect(stub.renderer.setAnimationLoop).toHaveBeenCalledTimes(1);
    stub.tick();
    expect(stub.renderer.render).toHaveBeenCalledTimes(1);
    expect(stub.renderer.render).toHaveBeenCalledWith(scene, camera);
    expect(stub.looping).toBe(false);
    expect(viewer.frames).toBe(1);
    // Idle again: the loop runs no more.
    stub.tick();
    expect(viewer.frames).toBe(1);
    viewer.invalidate();
    stub.tick();
    expect(viewer.frames).toBe(2);
  });

  it("sizes the canvas from its box at a density of at most 2, and draws once", () => {
    vi.stubGlobal("devicePixelRatio", 3);
    const { stub, viewer, camera, resized, box } = setUp();
    const [observer] = Observer.all;
    expect(observer.observed).toEqual([box]);
    observer.fire();
    expect(stub.renderer.setPixelRatio).toHaveBeenCalledWith(MAX_PIXEL_RATIO);
    expect(stub.renderer.setSize).toHaveBeenCalledWith(300, 200, false);
    expect(camera.aspect).toBe(1.5);
    expect(resized).toHaveBeenCalledTimes(1);
    stub.tick();
    expect(viewer.frames).toBe(1);
    // A box with no size yet draws nothing.
    box.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    observer.fire();
    stub.tick();
    expect(viewer.frames).toBe(1);
  });

  it("draws again at a new density without a resize", () => {
    const queries: { media: string; listeners: Set<() => void> }[] = [];
    vi.stubGlobal("matchMedia", (media: string) => {
      const query = { media, listeners: new Set<() => void>() };
      queries.push(query);
      return {
        addEventListener: (_: string, run: () => void) =>
          query.listeners.add(run),
        removeEventListener: (_: string, run: () => void) =>
          query.listeners.delete(run),
      };
    });
    vi.stubGlobal("devicePixelRatio", 1);
    const { stub, viewer } = setUp();
    expect(queries.map(({ media }) => media)).toEqual(["(resolution: 1dppx)"]);
    vi.stubGlobal("devicePixelRatio", 1.5);
    for (const run of queries[0].listeners) run();
    expect(stub.renderer.setPixelRatio).toHaveBeenLastCalledWith(1.5);
    stub.tick();
    expect(viewer.frames).toBe(1);
    // Watching the new density, no longer the old.
    expect(queries[0].listeners.size).toBe(0);
    expect(queries[1].media).toBe("(resolution: 1.5dppx)");
    expect(queries[1].listeners.size).toBe(1);
    viewer.dispose();
    expect(queries[1].listeners.size).toBe(0);
  });

  it("moves its one canvas into another box, and sizes it there", () => {
    const { stub, viewer, box, camera } = setUp();
    const other = document.createElement("div");
    other.getBoundingClientRect = () =>
      ({ width: 400, height: 100 }) as DOMRect;
    viewer.moveTo(other);
    expect(stub.renderer.domElement.parentElement).toBe(other);
    expect(box.querySelector("canvas")).toBeNull();
    expect(Observer.all[0].observed).toEqual([box, other]);
    expect(Observer.all[0].unobserved).toEqual([box]);
    expect(stub.renderer.setSize).toHaveBeenLastCalledWith(400, 100, false);
    expect(camera.aspect).toBe(4);
    stub.tick();
    expect(viewer.frames).toBe(1);
  });

  it("keeps its state through a lost context and draws once restored", () => {
    const { stub, viewer, scene, environment, targets } = setUp();
    expect(environment).toHaveBeenCalledTimes(1);
    expect(scene.environment).toBe(targets[0].texture);
    const canvas = stub.renderer.domElement;
    viewer.invalidate();
    canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(stub.looping).toBe(false);
    // Nothing is drawn while the context is lost.
    viewer.invalidate();
    stub.tick();
    expect(viewer.frames).toBe(0);
    // Its render target, not only its texture.
    const old = vi.spyOn(targets[0], "dispose");
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    // The environment map's render target came back empty: made again.
    expect(environment).toHaveBeenCalledTimes(2);
    expect(old).toHaveBeenCalled();
    expect(scene.environment).toBe(targets[1].texture);
    stub.tick();
    expect(viewer.frames).toBe(1);
    stub.tick();
    expect(viewer.frames).toBe(1);
  });

  it("releases what it made when disposed", () => {
    const { stub, viewer, scene, targets, environment: made } = setUp();
    const environment = vi.spyOn(targets[0], "dispose");
    viewer.invalidate();
    viewer.dispose();
    expect(Observer.all[0].disconnected).toBe(true);
    expect(stub.looping).toBe(false);
    expect(environment).toHaveBeenCalled();
    expect(scene.environment).toBeNull();
    expect(stub.renderer.dispose).toHaveBeenCalled();
    // The context goes too, after the renderer, browsers allowing few.
    expect(stub.renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(
      stub.renderer.forceContextLoss.mock.invocationCallOrder[0],
    ).toBeGreaterThan(stub.renderer.dispose.mock.invocationCallOrder[0]);
    expect(stub.renderer.domElement.isConnected).toBe(false);
    // Its loss, and any restore, are no longer heard.
    stub.renderer.domElement.dispatchEvent(new Event("webglcontextlost"));
    stub.renderer.domElement.dispatchEvent(new Event("webglcontextrestored"));
    stub.tick();
    expect(viewer.frames).toBe(0);
    expect(made).toHaveBeenCalledTimes(1);
  });

  it("needs no environment map", () => {
    const box = document.createElement("div");
    const scene = new Scene();
    const stub = stubRenderer();
    createViewer(box, {
      scene,
      camera: new PerspectiveCamera(),
      renderer: stub.make,
    });
    stub.renderer.domElement.dispatchEvent(new Event("webglcontextrestored"));
    expect(scene.environment).toBeNull();
  });

  it("throws as three does where WebGL 2 cannot be made", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      createViewer(document.createElement("div"), {
        scene: new Scene(),
        camera: new PerspectiveCamera(),
      }),
    ).toThrow();
  });
});

describe("the room environment", () => {
  it("prefilters three's RoomEnvironment and lets the generator go", () => {
    const [made, disposed] = [pmrem.made, pmrem.disposed];
    const target = roomEnvironment({} as WebGLRenderer);
    expect(target).toBeInstanceOf(WebGLRenderTarget);
    expect(pmrem.made).toBe(made + 1);
    expect(pmrem.disposed).toBe(disposed + 1);
  });
});
