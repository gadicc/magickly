import {
  defaultHallArt,
  GD_HALL_FONT_STACKS,
  GdHallSvg,
  type HallArtRegistry,
  hallRoot,
  resolveHall,
  tabletArt,
} from "@magick-components/gd/hall";
import {
  type HallPreset,
  hallPreset,
  hallSourceCitation,
} from "@magick-components/gd/hall/presets";
import { pngWithText, XMP_KEYWORD } from "@/export/pngText";
import { SITE_URL } from "@/seo/site";
import {
  GD_HALL_LICENCE,
  type GdHallEntry,
  type GdHallImageProps,
  gdHall,
  gdHallPagePath,
  gdHallPixels,
  gdHallTitle,
} from "./contracts/gdHall";

/**
 * The temple halls' images (plan 062): what the image route draws for the
 * `gd-hall` contract, and the licence the files carry.
 */

/** The renderer's identity for the halls' images; moves only when it does. */
export const GD_HALL_IMAGE_PROFILE = "magickli-gd-hall-image-v1";

/**
 * The art the images draw with: the package's, the tablets in the bundled
 * Enochian Plain (`EnochianPlain.ttf`'s family), as the `enochian-tablet`
 * image draws them. The app's registry gives the tablets the same font
 * through `next/font`, which a server route cannot load; a test holds the
 * two to one layout.
 */
export const hallImageArt: HallArtRegistry = new Map([
  ...defaultHallArt,
  ["tablet", tabletArt({ fontFamily: "Enochian" })],
]);

function entryOf(props: GdHallImageProps): {
  entry: GdHallEntry;
  preset: HallPreset;
} {
  const entry = gdHall(props.hall) as GdHallEntry;
  return { entry, preset: hallPreset(entry.preset) as HallPreset };
}

/** A hall's drawing for the image route, sized as its PNG is drawn. */
export function renderGdHallImage(props: GdHallImageProps) {
  const { preset } = entryOf(props);
  const resolved = resolveHall(hallRoot(preset.hall), { art: hallImageArt });
  const { width, height } = gdHallPixels(props);
  return (
    <GdHallSvg
      resolved={resolved}
      art={hallImageArt}
      idPrefix="gdhall"
      image
      width={width}
      height={height}
    />
  );
}

/**
 * The hall names its fonts by stacks headed by its own family names, which
 * the page's `@font-face` rules define; resvg resolves neither those nor
 * the quoted stack (plan 061; the spike of plan 062 found its output
 * identical to having no Noto Serif at all), but it does resolve the bare
 * family of the TrueType twins it is given.
 */
const BARE_FAMILIES: readonly [string, string][] = [
  [GD_HALL_FONT_STACKS.serif, "Noto Serif"],
  [GD_HALL_FONT_STACKS.hebrew, "Noto Serif Hebrew"],
].map(([stack, family]) => [
  `font-family="${stack.replaceAll('"', "&quot;")}"`,
  `font-family="${family}"`,
]);

/** The rendered hall with its fonts named as resvg resolves them. */
export function bareHallFonts(svg: string): string {
  let out = svg;
  for (const [stack, family] of BARE_FAMILIES)
    out = out.replaceAll(stack, family);
  return out;
}

/**
 * The outlined SVG without the whitespace resvg indents it with, between
 * tags and around path commands. Exact: the numbers are left as they are,
 * since rounding them, even in path data at a thousandth of a unit,
 * moved antialiased pixels visibly (the glyph outlines are drawn through
 * scaling transforms), and the raster is tested to match the uncompacted
 * one exactly.
 */
export function compactHallSvg(svg: Buffer): Buffer {
  const text = svg
    .toString("utf8")
    .replace(/>\s+</g, "><")
    .replace(
      / d="([^"]*)"/g,
      (_, d: string) =>
        ` d="${d.replace(/ ?([MLHVCSQTAZ]) ?/gi, "$1").trim()}"`,
    );
  return Buffer.from(text, "utf8");
}

const escapeXml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** What the files say about a hall: its title, page and sources. */
function licenceFacts(props: GdHallImageProps) {
  const { entry, preset } = entryOf(props);
  return {
    title: escapeXml(gdHallTitle(entry)),
    page: escapeXml(`${SITE_URL}${gdHallPagePath(entry.slug)}`),
    source: escapeXml(
      preset.sources
        .filter((source) => source.kind === "book")
        .map(hallSourceCitation)
        .join("; "),
    ),
  };
}

/**
 * The SVG with a `<title>` and the licence as RDF in `<metadata>`, after
 * the root element (plan 062, decision 8).
 */
export function svgWithLicence(svg: Buffer, props: GdHallImageProps): Buffer {
  const { title, page, source } = licenceFacts(props);
  const L = GD_HALL_LICENCE;
  const metadata =
    `<title>${title}</title>` +
    "<metadata>" +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#">' +
    `<cc:Work rdf:about="">` +
    `<dc:title>${title}</dc:title>` +
    `<dc:creator>${L.creator}</dc:creator>` +
    `<dc:rights>${escapeXml(L.copyrightNotice)}</dc:rights>` +
    `<dc:source>${source}</dc:source>` +
    `<cc:license rdf:resource="${L.url}"/>` +
    `<cc:attributionName>${L.creator}</cc:attributionName>` +
    `<cc:attributionURL rdf:resource="${page}"/>` +
    "</cc:Work></rdf:RDF></metadata>";
  const text = svg.toString("utf8");
  const root = text.match(/^<svg\b[^>]*>/)?.[0];
  if (!root) throw new Error("Unexpected hall image root");
  return Buffer.from(root + metadata + text.slice(root.length), "utf8");
}

/** The XMP packet with the IPTC fields Google reads for image licences. */
export function hallXmp(props: GdHallImageProps): string {
  const { title, page, source } = licenceFacts(props);
  const L = GD_HALL_LICENCE;
  const alt = (text: string) =>
    `<rdf:Alt><rdf:li xml:lang="x-default">${text}</rdf:li></rdf:Alt>`;
  return (
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about=""' +
    ' xmlns:dc="http://purl.org/dc/elements/1.1/"' +
    ' xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"' +
    ' xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"' +
    ' xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/"' +
    ' xmlns:cc="http://creativecommons.org/ns#">' +
    `<dc:title>${alt(title)}</dc:title>` +
    `<dc:creator><rdf:Seq><rdf:li>${L.creator}</rdf:li></rdf:Seq></dc:creator>` +
    `<dc:rights>${alt(escapeXml(L.copyrightNotice))}</dc:rights>` +
    `<dc:source>${source}</dc:source>` +
    `<photoshop:Credit>${escapeXml(L.creditText)}</photoshop:Credit>` +
    "<xmpRights:Marked>True</xmpRights:Marked>" +
    `<xmpRights:WebStatement>${L.url}</xmpRights:WebStatement>` +
    `<xmpRights:UsageTerms>${alt("CC BY 4.0: free to reuse with credit")}</xmpRights:UsageTerms>` +
    '<plus:Licensor><rdf:Seq><rdf:li rdf:parseType="Resource">' +
    `<plus:LicensorURL>${escapeXml(L.acquireLicensePage)}</plus:LicensorURL>` +
    "</rdf:li></rdf:Seq></plus:Licensor>" +
    `<cc:license rdf:resource="${L.url}"/>` +
    `<cc:attributionName>${L.creator}</cc:attributionName>` +
    `<cc:attributionURL rdf:resource="${page}"/>` +
    "</rdf:Description></rdf:RDF></x:xmpmeta>" +
    '<?xpacket end="r"?>'
  );
}

export { XMP_KEYWORD };

/**
 * The PNG with an uncompressed `iTXt` chunk holding the XMP packet,
 * inserted right after `IHDR`, ahead of the image data, where readers
 * that stop at the data still find it: the form the XMP specification
 * names for PNG. sharp's `withXmp` writes `zTXt` instead, and a later
 * encode drops it, so this runs after the last encode.
 */
export function pngWithXmp(png: Buffer, xmp: string): Buffer {
  return Buffer.from(pngWithText(png, XMP_KEYWORD, xmp));
}

/** The registration's last step: the licence in either format. */
export function finishGdHallImage(
  bytes: Buffer,
  format: "svg" | "png",
  props: GdHallImageProps,
): Buffer {
  return format === "svg"
    ? svgWithLicence(bytes, props)
    : pngWithXmp(bytes, hallXmp(props));
}
