import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { TREE_VIEWBOX } from "./contracts/treeOfLife";
import { IMAGE_INPUTS_PROFILE } from "./dataInputs";

/**
 * Identity of existing generated Tree of Life assets. Bytes must not change
 * under (profile, inputs hash, query): the profile names the *renderer* — the
 * engine, the fonts and this module's normalisation — and moves only when the
 * renderer changes, while an edit to the data an image draws moves that
 * image's `inputs.sha256` instead (plan 032, decision 10). Until 3b the
 * profile carried both, and a data fix was published by bumping it by hand,
 * which re-identified every image under it (plan 028).
 */
export const TREE_IMAGE_PROFILE = "magickli-tree-image-outlines-v4";
/** The other registered components share the same fonts and normalisation. */
export const COMPONENT_IMAGE_PROFILE = "magickli-component-image-outlines-v1";

/**
 * Fonts every registry component may use; the Tree's identity lists exactly
 * these. They live under public/ because the interactive Tree's SVG refers to
 * them by URL.
 */
const BASE_FONT_FILES = [
  "NotoSans-Regular.ttf",
  "NotoSansHebrew-Regular.ttf",
  "NotoSansDevanagari-Regular.ttf",
  "NotoSansSymbols-Regular.ttf",
  "NotoSansSymbols2-Regular.ttf",
] as const;
/**
 * Server-only fonts for specific components. They stay outside public/ so the
 * service worker never precaches them and no URL serves them.
 */
export const SERVER_FONT_FILES = [
  "EnochianPlain.ttf",
  "NotoEmoji-Variable.ttf",
  // The temple halls' label subsets as TrueType (plan 062), built with
  // their WOFF2 twins in public/fonts by scripts/gd-hall-fonts/build.py.
  "NotoSerif-Italic-latin1.ttf",
  "NotoSerif-BoldItalic-compass.ttf",
  "NotoSerifHebrew-Bold-letters.ttf",
] as const;
export type ServerFontFile = (typeof SERVER_FONT_FILES)[number];
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Only names from the two bundled lists resolve; nothing else becomes a path. */
function fontPath(name: string): string {
  if ((BASE_FONT_FILES as readonly string[]).includes(name))
    return path.join(process.cwd(), "public/fonts", name);
  if ((SERVER_FONT_FILES as readonly string[]).includes(name))
    return path.join(process.cwd(), "assets/fonts", name);
  throw new Error(`Unknown bundled font ${name}`);
}

// Each resource caches its own promise and evicts itself on failure, so a
// missing font never discards the WASM instance or other fonts, and
// concurrent first requests share one initialisation.
let wasm: Promise<{ sha256: string }> | undefined;
const fonts = new Map<string, Promise<{ bytes: Buffer; sha256: string }>>();

function loadWasm() {
  wasm ??= (async () => {
    // Treat WASM as a traced server file, not a webpack WASM module. Resolving
    // it from import.meta.url can also retain the build machine's absolute path.
    const bytes = await readFile(
      path.join(process.cwd(), "node_modules/@resvg/resvg-wasm/index_bg.wasm"),
    );
    try {
      await initWasm(bytes);
    } catch (error) {
      // The package is a server external, so its WASM instance outlives this
      // module when Next reloads it in development; the bytes are the same.
      if (!/Already initialized/.test(String(error))) throw error;
    }
    return { sha256: sha256(bytes) };
  })().catch((error) => {
    wasm = undefined;
    throw error;
  });
  return wasm;
}

function loadFont(name: string) {
  let font = fonts.get(name);
  if (!font) {
    font = readFile(fontPath(name))
      .then((bytes) => ({ bytes, sha256: sha256(bytes) }))
      .catch((error) => {
        fonts.delete(name);
        throw error;
      });
    fonts.set(name, font);
  }
  return font;
}

async function loadResources(files: readonly string[]) {
  const [{ sha256: wasmSha256 }, loaded] = await Promise.all([
    loadWasm(),
    Promise.all(files.map(loadFont)),
  ]);
  return {
    fonts: loaded.map((font) => font.bytes),
    fontIdentity: files.map((file, index) => ({
      file,
      sha256: loaded[index].sha256,
    })),
    wasmSha256,
  };
}

export interface OutlineOptions {
  profile: string;
  /**
   * SHA-256 of the resolved data the component drew
   * ([dataInputs.ts](./dataInputs.ts)). It is the half of the identity that a
   * data edit moves, leaving the profile to the renderer.
   */
  inputsSha256: string;
  /** The root viewBox the component must have rendered. */
  viewBox: readonly [number, number, number, number];
  /** Mirror horizontally after outlining, around the centred coordinates. */
  flip?: boolean;
  /**
   * Extra bundled font files after the base set, loaded only for components
   * that need them so other components' glyph fallback never changes.
   */
  fonts?: readonly ServerFontFile[];
  /**
   * Keep the local paint servers resvg leaves in the output (plan 062,
   * decision 5): `url(#id)` references to a `linearGradient`,
   * `radialGradient`, `pattern` or `clipPath` inside the root's `<defs>`,
   * their ids renumbered under this prefix. Every other id is stripped
   * and anything else still refused. Only the temple halls set it.
   */
  paintServers?: { idPrefix: string };
}

/** The elements a kept `url(#id)` may name. */
const PAINT_SERVERS = /^(?:linearGradient|radialGradient|pattern|clipPath)$/;

/**
 * The outlined body's ids, renumbered where a paint server keeps one and
 * removed everywhere else, and its `url(#id)` references pointed at the
 * new ids. Throws for any `url(` that is not a whole `url(#id)`, closed
 * included, for a reference that names no element or anything but a
 * paint server in the `<defs>`, and for an id two elements share.
 * Exported for its tests.
 */
export function keepPaintServers(body: string, idPrefix: string): string {
  const defs = body.match(/^\s*<defs>[\s\S]*?<\/defs>/)?.[0] ?? "";
  const servers = new Set<string>();
  for (const [, element, id] of defs.matchAll(/<(\w+)\b[^>]*? id="([^"]*)"/g))
    if (PAINT_SERVERS.test(element)) servers.add(id);
  // Every `url(` must open one of the references below, so an unclosed
  // or other form fails closed rather than going unread.
  const references = [...body.matchAll(/url\(#([A-Za-z0-9_-]+)\)/g)];
  if (references.length !== body.split("url(").length - 1)
    throw new Error("Unexpected component image dependency");
  const used = new Set<string>();
  for (const [, id] of references) {
    if (!servers.has(id))
      throw new Error("Unexpected component image dependency");
    used.add(id);
  }
  // A kept id must name one element, or two would share the new id.
  for (const id of used)
    if (body.split(` id="${id}"`).length !== 2)
      throw new Error("Unexpected component image dependency");
  // Numbered in the order the defs hold them, so the ids are the same
  // for the same drawing whatever resvg or the component called them.
  const renamed = new Map(
    [...servers]
      .filter((id) => used.has(id))
      .map((id, index) => [id, `${idPrefix}${index}`]),
  );
  return body
    .replace(/ id="([^"]*)"/g, (_, id: string) => {
      const kept = renamed.get(id);
      return kept === undefined ? "" : ` id="${kept}"`;
    })
    .replace(
      /url\(#([A-Za-z0-9_-]+)\)/g,
      (_, id: string) => `url(#${renamed.get(id)})`,
    );
}

/**
 * Outline trusted registry JSX output only. Never pass uploaded/arbitrary SVG.
 * All font input is bundled; WASM has no filesystem/network font fallback.
 */
export async function outlineComponentImage(
  svg: string,
  options: OutlineOptions,
) {
  const files = [...BASE_FONT_FILES, ...(options.fonts ?? [])];
  const { fonts, fontIdentity, wasmSha256 } = await loadResources(files);
  const image = new Resvg(svg, {
    font: {
      fontBuffers: fonts,
      defaultFontFamily: "Noto Sans",
      defaultFontSize: 16,
    },
  });
  try {
    const result = image.toString();
    const originalRoot = svg.match(/<svg\b[^>]*>/)?.[0];
    const outlinedRoot = result.match(/^<svg\b[^>]*>/)?.[0];
    const viewBox = `viewBox="${options.viewBox.join(" ")}"`;
    // usvg preserves this coordinate system but changes implicit image
    // sizing. Retain the original outer attributes without moving the geometry.
    if (
      !originalRoot ||
      !outlinedRoot ||
      !originalRoot.includes(viewBox) ||
      !outlinedRoot.includes(viewBox)
    ) {
      throw new Error("Unexpected component viewport");
    }
    let body = result.slice(outlinedRoot.length);
    const { paintServers } = options;
    if (
      /href=|<(?:text|style|image)\b/.test(body) ||
      (!paintServers && /url\(/.test(body))
    ) {
      throw new Error("Unexpected component image dependency");
    }
    // Components repeat link IDs. Outlined images have no link targets
    // but the paint servers a hall keeps; remove the inert IDs instead of
    // weakening the shared SVG validator.
    body = paintServers
      ? keepPaintServers(body, paintServers.idPrefix)
      : body.replace(/ id="[^"]*"/g, "");
    // usvg leaves invisible textPath carrier geometry after outlining. Nothing
    // references it now; display:none preserves its non-rendering behavior in
    // the existing closed SVG profile, which does not admit visibility.
    body = body.replace(/ visibility="hidden"/g, ' display="none"');
    if (options.flip)
      body = `<g transform="scale(-1 1)">${body.replace(/<\/svg>\s*$/, "</g></svg>")}`;
    const bytes = Buffer.from(originalRoot + body);
    return {
      bytes,
      identity: {
        profile: options.profile,
        resvg: "2.6.2",
        wasmSha256,
        fonts: structuredClone(fontIdentity),
        defaultFontSize: 16,
        inputs: {
          spec: IMAGE_INPUTS_PROFILE,
          sha256: options.inputsSha256,
        },
      },
      sourceSha256: sha256(Buffer.from(svg)),
    };
  } finally {
    image.free();
  }
}

/** The Tree's existing outline contract, unchanged for saved ritual references. */
export function outlineTreeImage(
  svg: string,
  flip: boolean,
  inputsSha256: string,
) {
  return outlineComponentImage(svg, {
    profile: TREE_IMAGE_PROFILE,
    inputsSha256,
    viewBox: TREE_VIEWBOX,
    flip,
  });
}
