// @vitest-environment jsdom
import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAG_THRESHOLD, type OrbitView, orbit } from "./orbit";

const HOME: OrbitView = { azimuth: 0, elevation: Math.PI / 4, zoom: 1 };
/** A 12 by 13 tablet, a sixth high. */
const BOUNDS = [-6, 6].flatMap((x) =>
  [-6.5, 6.5].flatMap((z) =>
    [0, 1 / 6].map((y): [number, number, number] => [x, y, z]),
  ),
);

function setUp(aspect = 2) {
  const element = document.createElement("div");
  element.getBoundingClientRect = () =>
    ({ width: 200, height: 100 }) as DOMRect;
  document.body.append(element);
  const camera = new PerspectiveCamera(30, aspect);
  const changed = vi.fn();
  const clicked = vi.fn();
  const controls = orbit(element, camera, {
    home: HOME,
    bounds: BOUNDS,
    changed,
    clicked,
  });
  return { element, camera, changed, clicked, controls };
}

const pointer = (
  element: Element,
  type: string,
  x: number,
  y: number,
  { pointerType = "mouse", pointerId = 1, button = 0 } = {},
) =>
  element.dispatchEvent(
    new PointerEvent(type, {
      clientX: x,
      clientY: y,
      pointerType,
      pointerId,
      button,
      bubbles: true,
    }),
  );

const wheel = (element: Element, init: WheelEventInit) => {
  const event = new WheelEvent("wheel", { cancelable: true, ...init });
  element.dispatchEvent(event);
  return event;
};

/** Where the bounds land on screen, from −1 to 1 across and up. */
const projected = (camera: PerspectiveCamera) =>
  BOUNDS.map((point) => new Vector3(...point).project(camera));

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("orbit (plan 101)", () => {
  it("fits the bounds in the view at home, filling it one way", () => {
    for (const aspect of [0.5, 1, 2]) {
      const { camera } = setUp(aspect);
      const points = projected(camera);
      for (const { x, y } of points) {
        expect(Math.abs(x)).toBeLessThanOrEqual(1 + 1e-9);
        expect(Math.abs(y)).toBeLessThanOrEqual(1 + 1e-9);
      }
      const reach = Math.max(
        ...points.flatMap(({ x, y }) => [Math.abs(x), Math.abs(y)]),
      );
      expect(reach).toBeCloseTo(1, 6);
      expect(camera.near).toBeGreaterThan(0);
      expect(camera.far).toBeGreaterThan(camera.position.length());
    }
  });

  it("leaves a touch to the page, which scrolls by one finger", () => {
    const { element, changed, clicked, controls } = setUp();
    expect(element.style.touchAction).toBe("pan-y pinch-zoom");
    pointer(element, "pointerdown", 10, 10, { pointerType: "touch" });
    pointer(element, "pointermove", 90, 10, { pointerType: "touch" });
    pointer(element, "pointerup", 90, 10, { pointerType: "touch" });
    expect(controls.view).toEqual(HOME);
    expect(changed).not.toHaveBeenCalled();
    expect(clicked).not.toHaveBeenCalled();
  });

  it("tells a click from a drag by a threshold", () => {
    const { element, changed, clicked, controls } = setUp();
    pointer(element, "pointerdown", 50, 50);
    pointer(element, "pointermove", 50 + DRAG_THRESHOLD - 1, 50);
    pointer(element, "pointerup", 50 + DRAG_THRESHOLD - 1, 50);
    expect(controls.view).toEqual(HOME);
    expect(changed).not.toHaveBeenCalled();
    expect(clicked).toHaveBeenCalledWith(50 + DRAG_THRESHOLD - 1, 50);
  });

  it("turns about the point by a drag, one move a frame", () => {
    const { element, camera, changed, clicked, controls } = setUp();
    const distance = camera.position.length();
    pointer(element, "pointerdown", 50, 50);
    // Another pointer, or a release elsewhere, does nothing.
    pointer(element, "pointermove", 90, 50, { pointerId: 2 });
    pointer(element, "pointerup", 90, 50, { pointerId: 2 });
    expect(changed).not.toHaveBeenCalled();
    // Half the box's width turns a quarter round; a quarter of its height
    // raises the camera by an eighth of a turn.
    pointer(element, "pointermove", 150, 50);
    pointer(element, "pointermove", 150, 75);
    expect(changed).toHaveBeenCalledTimes(2);
    expect(controls.view.azimuth).toBeCloseTo(-Math.PI / 2);
    expect(controls.view.elevation).toBeCloseTo(Math.PI / 4 + Math.PI / 8);
    expect(camera.position.length()).toBeCloseTo(distance);
    expect(camera.position.x).toBeLessThan(0);
    pointer(element, "pointerup", 150, 75);
    expect(clicked).not.toHaveBeenCalled();
    // Released, the pointer moves nothing.
    pointer(element, "pointermove", 10, 10);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("keeps the camera above the ground and short of straight down", () => {
    const { element, controls } = setUp();
    pointer(element, "pointerdown", 50, 50);
    pointer(element, "pointermove", 50, -1000);
    expect(controls.view.elevation).toBeGreaterThan(0.2);
    pointer(element, "pointermove", 50, 1000);
    expect(controls.view.elevation).toBeLessThan(Math.PI / 2);
    pointer(element, "pointercancel", 50, 1000);
    pointer(element, "pointermove", 50, 50);
    expect(controls.view.elevation).toBeLessThan(Math.PI / 2);
  });

  it("ignores buttons other than the main one", () => {
    const { element, changed } = setUp();
    pointer(element, "pointerdown", 50, 50, { button: 2 });
    pointer(element, "pointermove", 150, 50, { button: 2 });
    expect(changed).not.toHaveBeenCalled();
  });

  it("zooms with Ctrl and the wheel, and leaves the plain wheel to the page", () => {
    const { element, changed, controls } = setUp();
    const plain = wheel(element, { deltaY: 100 });
    expect(plain.defaultPrevented).toBe(false);
    expect(changed).not.toHaveBeenCalled();
    const zoom = wheel(element, { deltaY: -20, ctrlKey: true });
    expect(zoom.defaultPrevented).toBe(true);
    expect(controls.view.zoom).toBeCloseTo(Math.exp(-0.2));
    // A mouse's notch counts no more than half an e-fold; lines count
    // as pixels.
    controls.reset();
    wheel(element, { deltaY: 120, ctrlKey: true });
    expect(controls.view.zoom).toBeCloseTo(Math.exp(0.5));
    controls.reset();
    wheel(element, { deltaY: 1, deltaMode: 1, ctrlKey: true });
    expect(controls.view.zoom).toBeCloseTo(Math.exp(0.33));
    // Never closer or further than its limits.
    for (let i = 0; i < 20; i += 1)
      wheel(element, { deltaY: 100, ctrlKey: true });
    expect(controls.view.zoom).toBe(2.5);
  });

  it("zooms by a trackpad's pinch in Safari, not a touch screen's", () => {
    let fine = true;
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(pointer: fine)" && fine,
    }));
    const { element, controls } = setUp();
    const gesture = (type: string, scale?: number) => {
      const event = Object.assign(new Event(type, { cancelable: true }), {
        scale,
      });
      element.dispatchEvent(event);
      return event;
    };
    expect(gesture("gesturestart", 1).defaultPrevented).toBe(true);
    expect(gesture("gesturechange", 2).defaultPrevented).toBe(true);
    expect(controls.view.zoom).toBeCloseTo(0.5);
    gesture("gesturechange", 0);
    expect(controls.view.zoom).toBeCloseTo(1);
    fine = false;
    expect(gesture("gesturechange", 4).defaultPrevented).toBe(false);
    expect(controls.view.zoom).toBeCloseTo(1);
  });

  it("sets a view, resets to home, and fits again after a resize", () => {
    const { camera, changed, controls } = setUp(2);
    controls.set({ azimuth: 1, zoom: 0.5 });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(controls.view).toEqual({ ...HOME, azimuth: 1, zoom: 0.5 });
    controls.reset();
    expect(controls.view).toEqual(HOME);
    const wide = camera.position.length();
    camera.aspect = 0.5;
    controls.fit();
    expect(camera.position.length()).toBeGreaterThan(wide);
  });

  it("stops listening when disposed", () => {
    const { element, changed, controls } = setUp();
    controls.dispose();
    pointer(element, "pointerdown", 50, 50);
    pointer(element, "pointermove", 150, 50);
    wheel(element, { deltaY: 10, ctrlKey: true });
    expect(changed).not.toHaveBeenCalled();
  });
});
