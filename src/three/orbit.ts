/**
 * Turning and zooming a camera about a fixed point, by the mouse (plan
 * 101), our own rather than three's `OrbitControls`, which sets
 * `touch-action: none` and would trap a phone's scroll. A drag turns the
 * camera about the point, so a light fixed to the scene stays where it
 * is; Ctrl with the wheel, or a trackpad's pinch (Ctrl and the wheel in
 * Chromium and Firefox, `gesturechange` in Safari), zooms; the plain
 * wheel scrolls the page. There is no damping or inertia: each event
 * moves the camera once and asks for one frame. Touch is left to the
 * page, which scrolls past; turning by touch is the full window's.
 */
import { type PerspectiveCamera, Vector3 } from "three";

/** Where the camera is, about the point it looks at. */
export interface OrbitView {
  /** Radians about the vertical, 0 from +z. */
  azimuth: number;
  /** Radians above the ground, up to straight down. */
  elevation: number;
  /** The distance as a share of the one that fits the scene. */
  zoom: number;
}

export interface OrbitOptions {
  /** The view to start from and that `reset` returns to. */
  home: OrbitView;
  /** Points that must fit in the view at `home` with a zoom of 1. */
  bounds: readonly (readonly [number, number, number])[];
  /** After every move: ask for a frame. */
  changed: () => void;
  /** A press and release without a drag, at its client position. */
  clicked?: (x: number, y: number) => void;
}

export interface Orbit {
  readonly view: Readonly<OrbitView>;
  /** Moves the camera to a view at once. */
  set(view: Partial<OrbitView>): void;
  /** Back to the home view. */
  reset(): void;
  /** Fits the scene again, after a resize. */
  fit(): void;
  dispose(): void;
}

/** A movement under this many pixels is a click, not a drag. */
export const DRAG_THRESHOLD = 4;

const ELEVATION = [(12 * Math.PI) / 180, (89.5 * Math.PI) / 180] as const;
const ZOOM = [0.25, 2.5] as const;
/** The unit vector from the point toward a view's camera. */
const towards = ({ azimuth, elevation }: OrbitView) =>
  new Vector3().setFromSphericalCoords(1, Math.PI / 2 - elevation, azimuth);
const clamp = (value: number, [low, high]: readonly [number, number]) =>
  Math.min(high, Math.max(low, value));

/** Controls `camera` from pointer and wheel events on `element`. */
export function orbit(
  element: HTMLElement,
  camera: PerspectiveCamera,
  { home, bounds, changed, clicked }: OrbitOptions,
): Orbit {
  const view: OrbitView = { ...home };
  let fitted = 1;
  const place = () => {
    camera.position.copy(towards(view).multiplyScalar(fitted * view.zoom));
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  };
  /**
   * The nearest distance at which every bound lies inside the frustum at
   * the home view: for a point at (x, y) across and z toward the camera,
   * it needs the distance to exceed z + |x| / tan(half the width's angle),
   * and the same for y.
   */
  const fit = () => {
    const back = towards(home);
    const right = new Vector3(0, 1, 0).cross(back).normalize();
    const up = back.clone().cross(right);
    const tanY = Math.tan((camera.fov * Math.PI) / 360);
    const tanX = tanY * camera.aspect;
    fitted = Math.max(
      ...bounds.map((point) => {
        const p = new Vector3(...point);
        const z = p.dot(back);
        return Math.max(
          z + Math.abs(p.dot(right)) / tanX,
          z + Math.abs(p.dot(up)) / tanY,
        );
      }),
    );
    camera.near = fitted / 20;
    camera.far = fitted * 6;
    camera.updateProjectionMatrix();
    place();
  };
  const set = (next: Partial<OrbitView>) => {
    Object.assign(view, next);
    view.elevation = clamp(view.elevation, ELEVATION);
    view.zoom = clamp(view.zoom, ZOOM);
    place();
    changed();
  };

  // Mouse and pen only: a touch scrolls the page.
  let press: { id: number; x: number; y: number; from: OrbitView } | null =
    null;
  let dragging = false;
  const down = (event: PointerEvent) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    press = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      from: { ...view },
    };
    dragging = false;
    element.setPointerCapture?.(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    const [dx, dy] = [event.clientX - press.x, event.clientY - press.y];
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragging = true;
    // The box's width turns the tablet half round, its height a quarter.
    const { width, height } = element.getBoundingClientRect();
    set({
      azimuth: press.from.azimuth - (dx / (width || 1)) * Math.PI,
      elevation: press.from.elevation + (dy / (height || 1)) * (Math.PI / 2),
    });
  };
  const up = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    if (!dragging) clicked?.(event.clientX, event.clientY);
    press = null;
  };
  const cancel = () => {
    press = null;
  };
  // Not passive, so that a zoom can stop the page scrolling or zooming.
  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
    set({ zoom: view.zoom * Math.exp(clamp(delta, [-50, 50]) / 100) });
  };
  // Safari's trackpad pinch; not a touch screen's, which zooms the page.
  let pinchFrom = 1;
  const pinching = () => window.matchMedia?.("(pointer: fine)").matches;
  const gesture = (event: Event) => {
    if (!pinching()) return;
    event.preventDefault();
    const { scale } = event as Event & { scale: number };
    if (event.type === "gesturestart") pinchFrom = view.zoom;
    else set({ zoom: pinchFrom / (scale || 1) });
  };

  // One finger scrolls the page past the view, and two zoom the page.
  element.style.touchAction = "pan-y pinch-zoom";
  const listeners: [string, EventListener, AddEventListenerOptions?][] = [
    ["pointerdown", down as EventListener],
    ["pointermove", move as EventListener],
    ["pointerup", up as EventListener],
    ["pointercancel", cancel],
    ["wheel", wheel as EventListener, { passive: false }],
    ["gesturestart", gesture],
    ["gesturechange", gesture],
  ];
  for (const [type, listener, options] of listeners)
    element.addEventListener(type, listener, options);
  fit();

  return {
    view,
    set,
    reset: () => set(home),
    fit,
    dispose() {
      for (const [type, listener] of listeners)
        element.removeEventListener(type, listener);
    },
  };
}
