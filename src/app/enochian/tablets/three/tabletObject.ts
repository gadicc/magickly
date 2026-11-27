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

/** The choices of look still open (plan 101, stage 3's frames). */
export interface TabletLook {
  /** How much darker a side is at its foot than at its top; 0 for none. */
  valleys: number;
  /** Lines along the ridges and round the tops, in pixels; 0 for none. */
  edges: number;
}

/** The look until Gadi chooses from the frames: valleys, no lines. */
export const DEFAULT_LOOK: Readonly<TabletLook> = Object.freeze({
  valleys: 0.35,
  edges: 0,
});

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
  setLook(look: TabletLook): void;
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
// coverage and green the outline's (`marksSheet.generated.ts`). A top's
// height is the same everywhere but for rounding, which a line must not
// take for an edge.
const VERTEX = `#include <common>
attribute vec2 markUv;
attribute vec4 markCell;
attribute vec3 markInk;
attribute vec3 markOutline;
attribute vec2 markEdge;
varying vec2 vMarkUv;
varying vec4 vMarkCell;
varying vec3 vMarkInk;
varying vec3 vMarkOutline;
varying vec2 vMarkEdge;`;
const VERTEX_MAIN = `#include <begin_vertex>
vMarkUv = markUv; vMarkCell = markCell; vMarkInk = markInk;
vMarkOutline = markOutline; vMarkEdge = markEdge;`;
const FRAGMENT = VERTEX.replace(/attribute [^\n]*\n/g, "").concat(`
uniform sampler2D markSheet;
uniform float markBias;
uniform float markValleys;
uniform float markEdges;`);
const FRAGMENT_MAIN = `#include <color_fragment>
vec2 cover = texture(markSheet, vMarkUv, markBias).rg;
vec4 box = vMarkCell;
cover *= step(0.0, box.x) * step(box.x, vMarkUv.x) * step(vMarkUv.x, box.z)
  * step(box.y, vMarkUv.y) * step(vMarkUv.y, box.w);
diffuseColor.rgb = diffuseColor.rgb * (1.0 - cover.r - cover.g)
  + vMarkInk * cover.r + vMarkOutline * cover.g;
float foot = 1.0 - vMarkEdge.y;
diffuseColor.rgb *= 1.0 - markValleys * foot * foot;
vec2 width = fwidth(vMarkEdge);
vec2 away = vec2(min(vMarkEdge.x, 1.0 - vMarkEdge.x), foot) / max(width, 1e-6);
away.y = width.y > 1e-4 ? away.y : 1e6;
diffuseColor.rgb *= 1.0 - 0.6 * step(0.5, markEdges)
  * (1.0 - smoothstep(markEdges - 0.5, markEdges + 0.5, min(away.x, away.y)));`;

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
  {
    look = DEFAULT_LOOK,
    ground = "#8f8a80",
  }: { look?: TabletLook; ground?: ColorRepresentation } = {},
): TabletObject {
  const arrays = pyramidGeometry(model, sheet);
  // Across a side from one ridge to the other, and its height, for the
  // lines; a top is in the middle and has none of its own.
  const edge = new Float32Array(arrays.valleys.length * 2);
  arrays.valleys.forEach((valley, vertex) => {
    const top = Math.floor(vertex / 4) % 5 === 4;
    edge.set([top ? 0.5 : [0, 1, 1, 0][vertex % 4], valley], vertex * 2);
  });
  const geometry = new BufferGeometry();
  const attributes = {
    position: [arrays.positions, 3],
    normal: [arrays.normals, 3],
    color: [arrays.colours, 3],
    markUv: [arrays.uvs, 2],
    markCell: [arrays.cells, 4],
    markInk: [arrays.inks, 3],
    markOutline: [arrays.outlines, 3],
    markEdge: [edge, 2],
  } as const;
  for (const [name, [array, size]] of Object.entries(attributes))
    geometry.setAttribute(name, new BufferAttribute(array, size));
  geometry.setIndex(new BufferAttribute(arrays.index, 1));

  const uniforms = {
    markSheet: { value: texture },
    // Sharper than the mipmap would choose, for the far rows.
    markBias: { value: -0.75 },
    markValleys: { value: look.valleys },
    markEdges: { value: look.edges },
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
  material.customProgramCacheKey = () => "tablet3d-marks-v1";

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
    setLook({ valleys, edges }) {
      uniforms.markValleys.value = valleys;
      uniforms.markEdges.value = edges;
    },
    setGround: (colour) => groundMaterial.color.set(colour),
    dispose() {
      for (const each of [geometry, material, groundGeometry, groundMaterial])
        each.dispose();
    },
  };
}
