/**
 * A three.js scene drawn into a box on the page, on demand (plan 101):
 * one `WebGLRenderer` (WebGL 2), a frame only when something asks for one,
 * sized by a `ResizeObserver` at a pixel density of at most 2, kept
 * through a lost and restored context, and disposed of as a whole. No
 * React and nothing of the tablets here.
 */
import {
  NeutralToneMapping,
  type PerspectiveCamera,
  PMREMGenerator,
  type Scene,
  SRGBColorSpace,
  type Texture,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** The highest pixel density drawn: past 2 the canvas costs memory unseen. */
export const MAX_PIXEL_RATIO = 2;

export interface ViewerOptions {
  scene: Scene;
  camera: PerspectiveCamera;
  /**
   * The scene's environment map, made at the start and again after a
   * restored context, whose render target comes back empty.
   */
  environment?: (renderer: WebGLRenderer) => Texture;
  /** After a resize, before its frame: refit the camera. */
  resized?: () => void;
  /** Makes the renderer; a stub in tests. */
  renderer?: () => WebGLRenderer;
}

export interface Viewer {
  readonly renderer: WebGLRenderer;
  /** Frames drawn so far. */
  readonly frames: number;
  /** Draws one frame soon; asks before it is drawn share it. */
  invalidate(): void;
  /** Stops drawing and releases the renderer, the canvas and the map. */
  dispose(): void;
}

/** three's `RoomEnvironment`, prefiltered for soft reflections. */
export function roomEnvironment(renderer: WebGLRenderer): Texture {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const texture = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  return texture;
}

/**
 * A viewer in `box`, whose canvas it appends. Throws as `WebGLRenderer`
 * does when the browser cannot make a WebGL 2 context.
 */
export function createViewer(
  box: HTMLElement,
  {
    scene,
    camera,
    environment,
    resized,
    renderer: make = () => new WebGLRenderer({ antialias: true, alpha: true }),
  }: ViewerOptions,
): Viewer {
  const renderer = make();
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  // Transparent: the box's own background shows, and follows the theme.
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  box.append(canvas);

  const makeEnvironment = () => {
    if (!environment) return;
    scene.environment?.dispose();
    scene.environment = environment(renderer);
  };
  makeEnvironment();

  let frames = 0;
  let pending = false;
  let lost = false;
  // One frame through the animation loop, which is cleared as it runs, so
  // that nothing is drawn while idle; the loop is what WebXR drives.
  const draw = () => {
    renderer.setAnimationLoop(null);
    pending = false;
    renderer.render(scene, camera);
    frames += 1;
  };
  const invalidate = () => {
    if (pending || lost) return;
    pending = true;
    renderer.setAnimationLoop(draw);
  };

  const resize = () => {
    const { width, height } = box.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    resized?.();
    invalidate();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(box);

  // three re-uploads buffers and textures by itself after a restore.
  const onLost = () => {
    lost = true;
    pending = false;
    renderer.setAnimationLoop(null);
  };
  const onRestored = () => {
    lost = false;
    makeEnvironment();
    invalidate();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  return {
    renderer,
    get frames() {
      return frames;
    },
    invalidate,
    dispose() {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      scene.environment?.dispose();
      scene.environment = null;
      renderer.dispose();
      canvas.remove();
    },
  };
}
