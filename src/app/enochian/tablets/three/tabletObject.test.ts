// @vitest-environment jsdom
import enochianTablets, { tabletVersion } from "magick-data/enochian/tablets";
import {
  type BufferGeometry,
  Color,
  DirectionalLight,
  type Mesh,
  type MeshStandardMaterial,
  NoColorSpace,
  Ray,
  ShaderLib,
  type Texture,
  Vector3,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKS_SHEET, MARKS_SHEET_MAX_CELL_PX } from "./marksSheet.generated";
import { tabletModel } from "./model";
import { PYRAMID_HEIGHT, pyramidGeometry } from "./pyramidGeometry";
import {
  DEFAULT_LOOK,
  rasteriseSheet,
  sheetCellPixels,
  sheetTexture,
  tabletObject,
} from "./tabletObject";

const fire = tabletVersion(enochianTablets.fire, "gd");
if (!fire) throw new Error("no Fire tablet in the Golden Dawn's version");
const model = tabletModel(fire, MARKS_SHEET);

function build() {
  const texture = sheetTexture(document.createElement("canvas"), 4);
  const tablet = tabletObject(model, MARKS_SHEET, texture);
  const [pyramids, ground, light] = tablet.object.children as [
    Mesh<BufferGeometry, MeshStandardMaterial>,
    Mesh<BufferGeometry, MeshStandardMaterial>,
    DirectionalLight,
  ];
  return { tablet, pyramids, ground, light, texture };
}

/**
 * The material's shader as three hands it over, patched: the standard
 * material's, `ShaderLib.physical`'s text, so that a three upgrade that
 * moves an anchor fails here.
 */
function compiled(
  material: MeshStandardMaterial,
  {
    vertexShader,
    fragmentShader,
  }: { vertexShader: string; fragmentShader: string } = ShaderLib.physical,
) {
  const shader = {
    uniforms: {},
    vertexShader,
    fragmentShader,
  } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the tablet's object (plan 101)", () => {
  it("is one mesh for the pyramids and one for the ground, with one light", () => {
    const { tablet, pyramids, ground, light } = build();
    expect(tablet.object.children).toHaveLength(4);
    expect(light).toBeInstanceOf(DirectionalLight);
    expect(tablet.object.children[3]).toBe(light.target);
    const arrays = pyramidGeometry(model, MARKS_SHEET);
    const { attributes, index } = pyramids.geometry;
    expect(attributes.position.array).toStrictEqual(arrays.positions);
    expect(attributes.color.array).toStrictEqual(arrays.colours);
    expect(attributes.markUv.array).toStrictEqual(arrays.uvs);
    expect(attributes.markCell.itemSize).toBe(4);
    expect(attributes.markInk.array).toStrictEqual(arrays.inks);
    expect(attributes.markOutline.array).toStrictEqual(arrays.outlines);
    expect(index?.array).toStrictEqual(arrays.index);
    // Across a side from ridge to ridge, and up it; a top has neither.
    const edge = attributes.markEdge;
    expect([0, 1, 2, 3].map((vertex) => edge.getX(vertex))).toEqual([
      0, 1, 1, 0,
    ]);
    expect([0, 1, 2, 3].map((vertex) => edge.getY(vertex))).toEqual(
      [0, 1, 2, 3].map((vertex) => arrays.valleys[vertex]),
    );
    expect(edge.getX(16)).toBe(0.5);
    expect(edge.getY(16)).toBe(1);
    // The ground lies flat under the bases, a margin round the tablet.
    ground.geometry.computeBoundingBox();
    const box = ground.geometry.boundingBox;
    expect(box?.max.x).toBeCloseTo(model.columns / 2 + 0.15);
    expect(box?.max.z).toBeCloseTo(model.rows / 2 + 0.15);
    expect(ground.position.y).toBeLessThan(0);
  });

  it("is satin, lit from 60° above", () => {
    const { pyramids, light } = build();
    expect(pyramids.material.roughness).toBeCloseTo(0.45);
    expect(pyramids.material.metalness).toBeCloseTo(0.05);
    expect(pyramids.material.vertexColors).toBe(true);
    const towards = light.position.clone().normalize();
    expect(Math.asin(towards.y)).toBeCloseTo(Math.PI / 3);
    expect(light.castShadow).toBe(false);
  });

  it("samples its sheet as coverage, mipmapped and sharpened", () => {
    const { pyramids } = build();
    const shader = compiled(pyramids.material);
    const sheet = (shader.uniforms.markSheet as { value: Texture }).value;
    expect(sheet.colorSpace).toBe(NoColorSpace);
    expect(sheet.flipY).toBe(false);
    expect(sheet.anisotropy).toBe(4);
    expect(shader.uniforms.markBias.value).toBeLessThanOrEqual(-0.5);
    expect(shader.uniforms.markBias.value).toBeGreaterThanOrEqual(-1);
    for (const name of ["markUv", "markCell", "markInk", "markOutline"])
      expect(shader.vertexShader).toContain(
        `attribute ${name === "markCell" ? "vec4" : name === "markUv" ? "vec2" : "vec3"} ${name};`,
      );
    expect(shader.vertexShader).toContain("vMarkUv = markUv");
    expect(shader.fragmentShader).not.toContain("attribute");
    expect(shader.fragmentShader).toContain("uniform sampler2D markSheet");
    // Sampled first, then masked by the cell, outside any branch.
    const main = shader.fragmentShader.slice(
      shader.fragmentShader.indexOf("void main"),
    );
    expect(main.indexOf("texture(markSheet")).toBeLessThan(
      main.indexOf("step(0.0, box.x)"),
    );
    expect(main).not.toMatch(/\bif\s*\(/);
    expect(pyramids.material.customProgramCacheKey()).toBe("tablet3d-marks-v1");
    // Each anchor kept, once, after the patch's own lines.
    for (const anchor of ["#include <common>", "#include <begin_vertex>"])
      expect(shader.vertexShader.split(anchor)).toHaveLength(2);
    for (const anchor of ["#include <common>", "#include <color_fragment>"])
      expect(shader.fragmentShader.split(anchor)).toHaveLength(2);
    expect(main.indexOf("#include <color_fragment>")).toBeLessThan(
      main.indexOf("texture(markSheet"),
    );
  });

  it("names an anchor the shader lacks or repeats", () => {
    const { pyramids } = build();
    const { vertexShader, fragmentShader } = ShaderLib.physical;
    expect(() =>
      compiled(pyramids.material, {
        vertexShader,
        fragmentShader: fragmentShader.replace("#include <color_fragment>", ""),
      }),
    ).toThrow("tablet3d: the shader has 0 #include <color_fragment>");
    expect(() =>
      compiled(pyramids.material, {
        vertexShader: `${vertexShader}\n#include <begin_vertex>`,
        fragmentShader,
      }),
    ).toThrow("tablet3d: the shader has 2 #include <begin_vertex>");
  });

  it("takes a look and a ground without rebuilding", () => {
    const { tablet, pyramids, ground } = build();
    const shader = compiled(pyramids.material);
    expect(shader.uniforms.markValleys.value).toBe(DEFAULT_LOOK.valleys);
    expect(shader.uniforms.markEdges.value).toBe(DEFAULT_LOOK.edges);
    tablet.setLook({ valleys: 0, edges: 1.5 });
    expect(shader.uniforms.markValleys.value).toBe(0);
    expect(shader.uniforms.markEdges.value).toBe(1.5);
    tablet.setGround("#ff0000");
    expect(ground.material.color.equals(new Color("#ff0000"))).toBe(true);
  });

  it("gives the corners of the tablet and its ground to fit a camera to", () => {
    const { tablet } = build();
    expect(tablet.bounds).toHaveLength(8);
    const xs = tablet.bounds.map(([x]) => x);
    const ys = tablet.bounds.map(([, y]) => y);
    expect(Math.max(...xs)).toBeCloseTo(model.columns / 2 + 0.15);
    expect(Math.max(...ys)).toBe(PYRAMID_HEIGHT);
  });

  it("picks the square a ray meets, wherever the tablet is placed", () => {
    const { tablet } = build();
    // Row 3, square 5's centre, from straight above.
    const centre = new Vector3(
      4.5 - model.columns / 2,
      0,
      3.5 - model.rows / 2,
    );
    const down = new Ray(centre.clone().setY(5), new Vector3(0, -1, 0));
    expect(tablet.pick(down)).toEqual({
      row: 3,
      column: 4,
      index: model.squares[3 * model.columns + 4],
    });
    // Stood up in the East, as it might be in a temple: the same square.
    tablet.object.rotation.set(Math.PI / 2, 0, 0);
    tablet.object.position.set(0, 2, -10);
    tablet.object.updateMatrixWorld();
    const placed = down.clone().applyMatrix4(tablet.object.matrixWorld);
    expect(tablet.pick(placed)?.row).toBe(3);
    expect(tablet.pick(placed)?.column).toBe(4);
    expect(
      tablet.pick(new Ray(new Vector3(100, 5, 0), new Vector3(0, -1, 0))),
    ).toBeNull();
  });

  it("releases its geometry and materials, and leaves the shared sheet", () => {
    const { tablet, pyramids, ground, texture } = build();
    expect(
      (compiled(pyramids.material).uniforms.markSheet as { value: Texture })
        .value,
    ).toBe(texture);
    const spies = [
      pyramids.geometry,
      pyramids.material,
      ground.geometry,
      ground.material,
    ].map((each) => vi.spyOn(each, "dispose"));
    const sheet = vi.spyOn(texture, "dispose");
    tablet.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    expect(sheet).not.toHaveBeenCalled();
  });
});

describe("the mark sheet's raster", () => {
  it("is 128 px a cell, more at higher densities, to the sheet's limit", () => {
    expect(sheetCellPixels(1)).toBe(128);
    expect(sheetCellPixels(1.5)).toBe(140);
    expect(sheetCellPixels(2)).toBe(MARKS_SHEET_MAX_CELL_PX);
    expect(sheetCellPixels(3)).toBe(MARKS_SHEET_MAX_CELL_PX);
  });

  /** An image that decodes, or fails to, and a 2D context to draw it in. */
  function stubImage(decodes: boolean) {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const urls = { made: [] as Blob[], revoked: [] as string[] };
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      urls.made.push(blob as Blob);
      return "blob:sheet";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
      urls.revoked.push(url);
    });
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode = () =>
          decodes ? Promise.resolve() : Promise.reject(new Error("bad SVG"));
      },
    );
    return { drawImage, urls };
  }

  it("draws the SVG over the whole canvas, a cell's pixels a cell", async () => {
    const { drawImage, urls } = stubImage(true);
    const canvas = await rasteriseSheet("<svg/>", MARKS_SHEET, 128);
    expect(canvas.width).toBe(MARKS_SHEET.columns * 128);
    expect(canvas.height).toBe(MARKS_SHEET.rows * 128);
    expect(drawImage).toHaveBeenCalledWith(
      expect.objectContaining({ src: "blob:sheet" }),
      0,
      0,
      canvas.width,
      canvas.height,
    );
    expect(urls.made[0].type).toBe("image/svg+xml");
    expect(urls.revoked).toEqual(["blob:sheet"]);
  });

  it("lets its URL go when the SVG does not decode", async () => {
    const { urls } = stubImage(false);
    await expect(rasteriseSheet("<svg/>", MARKS_SHEET, 128)).rejects.toThrow(
      "bad SVG",
    );
    expect(urls.revoked).toEqual(["blob:sheet"]);
  });

  it("fails without a 2D canvas", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(rasteriseSheet("<svg/>", MARKS_SHEET, 128)).rejects.toThrow(
      "No 2D canvas",
    );
  });
});
