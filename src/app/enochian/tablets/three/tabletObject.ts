/**
 * A tablet's pyramids as a three.js object (plan 101): one merged mesh
 * from `pyramidGeometry`, its marks painted from the sheet by one patched
 * `MeshStandardMaterial`, a satin finish, one light 60° up fixed to the
 * tablet, and the ground under it, in two draw calls. It is built in
 * tablet-local axes (`pyramidGeometry.ts`), so that it can be placed by
 * a transform, and knows nothing of the page.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  type ColorRepresentation,
  DirectionalLight,
  Group,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  PlaneGeometry,
  type Ray,
  type Texture,
} from "three";
import {
  MARKS_SHEET_FLIP_Y,
  MARKS_SHEET_MAX_CELL_PX,
} from "./marksSheet.generated";
import type { MarksSheet, Tablet3DModel } from "./model";
import {
  type PickedSquare,
  PYRAMID_HEIGHT,
  pickSquare,
  pyramidGeometry,
  type Vec3,
} from "./pyramidGeometry";

/**
 * How much darker a side is at its foot than at its top, where pyramids
 * meet: Gadi's choice from stage 3's frames (27 November 2026), without
 * lines along the ridges.
 */
export const VALLEYS = 0.35;

/** The scene's environment's strength, for the soft reflections of satin. */
export const ENVIRONMENT_INTENSITY = 0.6;

/** The ground's margin round the tablet, in squares. */
const MARGIN = 0.15;

export interface TabletObject {
  readonly object: Group;
  /** The tablet's and its ground's corners, to fit a camera to. */
  readonly bounds: readonly Vec3[];
  /** The square a ray in the object's parent's space meets first. */
  pick(ray: Ray): PickedSquare | null;
  /**
   * Each pyramid's tint (`squareTints`), in place; whether it changed, so
   * that only a change is drawn.
   */
  setTints(tints: Float32Array): boolean;
  setGround(colour: ColorRepresentation): void;
  dispose(): void;
}

/** A sheet cell's pixels for a pixel density: 128 to the sheet's limit. */
export const sheetCellPixels = (pixelRatio: number) =>
  Math.round(Math.min(MARKS_SHEET_MAX_CELL_PX, Math.max(128, 93 * pixelRatio)));

/** The outlined sheet rasterised at `cell` pixels a cell. */
export async function rasteriseSheet(
  svg: string,
  sheet: MarksSheet,
  cell: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = sheet.columns * cell;
  canvas.height = sheet.rows * cell;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas for the mark sheet");
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
  return canvas;
}

// Each mark's coverage is sampled before the cell masks it, outside any
// branch, so that the mipmap's derivatives stay whole. Red is the ink's
// coverage and green the outline's (`marksSheet.generated.ts`).
const VERTEX = `#include <common>
attribute vec2 markUv;
attribute vec4 markCell;
attribute vec3 markInk;
attribute vec3 markOutline;
attribute float markValley;
attribute vec4 markTint;
varying vec2 vMarkUv;
varying vec4 vMarkCell;
varying vec3 vMarkInk;
varying vec3 vMarkOutline;
varying float vMarkValley;
varying vec4 vMarkTint;`;
const VERTEX_MAIN = `#include <begin_vertex>
vMarkUv = markUv; vMarkCell = markCell; vMarkInk = markInk;
vMarkOutline = markOutline; vMarkValley = markValley; vMarkTint = markTint;`;
const FRAGMENT = VERTEX.replace(/attribute [^\n]*\n/g, "").concat(`
uniform sampler2D markSheet;
uniform float markBias;
uniform float markValleys;`);
const FRAGMENT_MAIN = `#include <color_fragment>
vec2 cover = texture(markSheet, vMarkUv, markBias).rg;
vec4 box = vMarkCell;
cover *= step(0.0, box.x) * step(box.x, vMarkUv.x) * step(vMarkUv.x, box.z)
  * step(box.y, vMarkUv.y) * step(vMarkUv.y, box.w);
diffuseColor.rgb = diffuseColor.rgb * (1.0 - cover.r - cover.g)
  + vMarkInk * cover.r + vMarkOutline * cover.g;
diffuseColor.rgb = mix(diffuseColor.rgb, vMarkTint.rgb, vMarkTint.a);
float foot = 1.0 - vMarkValley;
diffuseColor.rgb *= 1.0 - markValleys * foot * foot;`;

/**
 * The rasterised sheet as a texture, filtered at up to `anisotropy`: made
 * once for the view, shared by every tablet drawn in it, and disposed of
 * by the view, not by a tablet.
 */
export const sheetTexture = (image: HTMLCanvasElement, anisotropy: number) =>
  Object.assign(new CanvasTexture(image), {
    colorSpace: NoColorSpace,
    flipY: MARKS_SHEET_FLIP_Y,
    minFilter: LinearMipmapLinearFilter,
    anisotropy,
  });

/** `source` with its one `anchor` replaced; three moving it is an error. */
function patch(source: string, anchor: string, text: string) {
  const parts = source.split(anchor);
  if (parts.length !== 2)
    throw new Error(`tablet3d: the shader has ${parts.length - 1} ${anchor}`);
  return parts.join(text);
}

/** The tablet's object, its marks painted from `texture` (`sheetTexture`). */
export function tabletObject(
  model: Tablet3DModel,
  sheet: MarksSheet,
  texture: Texture,
  { ground = "#8f8a80" }: { ground?: ColorRepresentation } = {},
): TabletObject {
  const arrays = pyramidGeometry(model, sheet);
  const geometry = new BufferGeometry();
  const attributes = {
    position: [arrays.positions, 3],
    normal: [arrays.normals, 3],
    color: [arrays.colours, 3],
    markUv: [arrays.uvs, 2],
    markCell: [arrays.cells, 4],
    markInk: [arrays.inks, 3],
    markOutline: [arrays.outlines, 3],
    markValley: [arrays.valleys, 1],
    markTint: [new Float32Array(arrays.squares.length * 4), 4],
  } as const;
  for (const [name, [array, size]] of Object.entries(attributes))
    geometry.setAttribute(name, new BufferAttribute(array, size));
  geometry.setIndex(new BufferAttribute(arrays.index, 1));

  const uniforms = {
    markSheet: { value: texture },
    // Sharper than the mipmap would choose, for the far rows.
    markBias: { value: -0.75 },
    markValleys: { value: VALLEYS },
  };
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    metalness: 0.05,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = patch(
      patch(shader.vertexShader, "#include <common>", VERTEX),
      "#include <begin_vertex>",
      VERTEX_MAIN,
    );
    shader.fragmentShader = patch(
      patch(shader.fragmentShader, "#include <common>", FRAGMENT),
      "#include <color_fragment>",
      FRAGMENT_MAIN,
    );
  };
  material.customProgramCacheKey = () => "tablet3d-marks-v3";

  const groundGeometry = new PlaneGeometry(
    model.columns + 2 * MARGIN,
    model.rows + 2 * MARGIN,
  ).rotateX(-Math.PI / 2);
  const groundMaterial = new MeshStandardMaterial({
    color: ground,
    roughness: 0.9,
  });
  const groundMesh = new Mesh(groundGeometry, groundMaterial);
  // Just under the pyramids' bases, which have no faces of their own.
  groundMesh.position.y = -1e-3;

  // 60° above the tablet (30° from straight up), from its far left, and
  // turning with it.
  const light = new DirectionalLight(0xffffff, 2.4);
  light.position.setFromSphericalCoords(1, Math.PI / 6, (-5 * Math.PI) / 6);
  const object = new Group();
  object.add(new Mesh(geometry, material), groundMesh, light, light.target);

  const [x, z] = [model.columns / 2 + MARGIN, model.rows / 2 + MARGIN];
  const bounds = [-x, x].flatMap((cx) =>
    [-z, z].flatMap((cz) =>
      [0, PYRAMID_HEIGHT].map((cy): Vec3 => [cx, cy, cz]),
    ),
  );
  const toLocal = new Matrix4();
  return {
    object,
    bounds,
    pick(ray) {
      object.updateMatrix();
      const local = ray
        .clone()
        .applyMatrix4(toLocal.copy(object.matrix).invert());
      return pickSquare(
        model,
        local.origin.toArray(),
        local.direction.toArray(),
      );
    },
    setTints(tints) {
      const { array } = geometry.attributes.markTint;
      let changed = false;
      arrays.squares.forEach((square, vertex) => {
        for (let at = 0; at < 4; at += 1)
          if (array[vertex * 4 + at] !== tints[square * 4 + at]) {
            array[vertex * 4 + at] = tints[square * 4 + at];
            changed = true;
          }
      });
      if (changed) geometry.attributes.markTint.needsUpdate = true;
      return changed;
    },
    setGround: (colour) => groundMaterial.color.set(colour),
    dispose() {
      for (const each of [geometry, material, groundGeometry, groundMaterial])
        each.dispose();
    },
  };
}
