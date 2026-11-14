/**
 * Draws the home page's Open source tile, `src/app/img/open-source.webp`,
 * from the site's own components: the Tree of Life, an Enochian tablet and
 * a Rose Cross sigil, each drawn by the renderer behind /api/render and
 * laid on a card on a dark ground. Run it again when a drawing changes:
 *
 *   node --import tsx scripts/home-tile/build.mts [out]
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier !== "server-only") return next(specifier, context);
    // The marker's empty module, as under the react-server condition.
    return next(specifier, { ...context, conditions: ["react-server"] });
  },
});

const { default: sharp } = await import("sharp");
const { renderComponentImage } = await import("@/render/componentImage");

/** Square, like the other tiles' images; `Tiles` crops it to fit. */
const SIZE = 768;
const PAPER = "#f3ead6";
const PAD = 14;

/** A component's drawing, placed by its top left corner and height. */
async function drawing(slug: string, query: string) {
  const { bytes } = await renderComponentImage(
    slug,
    new URLSearchParams(`fmt=svg${query && `&${query}`}`),
  );
  const svg = bytes.toString("utf8");
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw new Error(`${slug}: no viewBox`);
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  const inner = svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
  return (x: number, y: number, height: number) => {
    const width = (height * w) / h;
    // The card, with a shadow, then the drawing on it.
    return [
      `<rect x="${x - PAD}" y="${y - PAD}" width="${width + 2 * PAD}" height="${height + 2 * PAD}" rx="10" fill="${PAPER}" filter="url(#shadow)"/>`,
      `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}">${inner}</svg>`,
    ].join("");
  };
}

const tree = await drawing("tree-of-life", "");
const tablet = await drawing("enochian-tablet", "");
// "Open", in Hebrew.
const sigil = await drawing("rose-sigil", "text=פתוח");

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`,
  "<defs>",
  '<filter id="shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.6"/></filter>',
  '<radialGradient id="ground" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#2c2a4a"/><stop offset="1" stop-color="#0d0c1a"/></radialGradient>',
  "</defs>",
  `<rect width="${SIZE}" height="${SIZE}" fill="url(#ground)"/>`,
  // Back to front: each card overlaps the one before.
  sigil(420, 60, 300),
  tablet(390, 330, 380),
  tree(60, 124, 520),
  "</svg>",
].join("");

const out = process.argv[2] ?? "src/app/img/open-source.webp";
await sharp(Buffer.from(svg)).webp({ quality: 88 }).toFile(out);
console.log(out);
