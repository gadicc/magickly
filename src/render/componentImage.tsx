import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  type ComponentImageRequest,
  parseComponentImageRequest,
} from "./componentImageRequest";
import { CONTRACTS, type ComponentImageSlug } from "./contracts";
import { contractRasterDefault, contractViewBox } from "./contracts/types";
import { outlineComponentImage } from "./outlineTreeImage";
import { COMPONENT_IMAGE_REGISTRY, componentInputsHash } from "./registry";

type Outlined = Awaited<ReturnType<typeof outlineComponentImage>>;

export interface RenderedComponentImage<
  S extends ComponentImageSlug = ComponentImageSlug,
> extends Omit<Outlined, "bytes"> {
  request: ComponentImageRequest<S>;
  bytes: Buffer<ArrayBuffer>;
  byteSize: number;
  sha256: string;
  contentType: "image/svg+xml" | "image/png";
  /** The registration's response headers for this markup (`X-` names). */
  headers: Readonly<Record<string, string>>;
}

/** Render only the closed registry; callers cannot provide JSX, URLs or SVG. */
export function renderComponentImage<S extends ComponentImageSlug>(
  slug: S,
  searchParams: URLSearchParams,
): Promise<RenderedComponentImage<S>>;
export function renderComponentImage(
  slug: string,
  searchParams: URLSearchParams,
): Promise<RenderedComponentImage>;
export async function renderComponentImage(
  slug: string,
  searchParams: URLSearchParams,
): Promise<RenderedComponentImage> {
  const request = parseComponentImageRequest(slug, searchParams);
  const contract = CONTRACTS[request.slug];
  const registration = COMPONENT_IMAGE_REGISTRY[request.slug];
  // Dynamic import keeps React's document serializer out of Next's static RSC
  // import check, as in the previous image route.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const element = await registration.render(request.props as never);
  // Every image's root declares the xlink prefix, as it always has: the
  // Tree's declares it itself, and the others gain it here. The exact
  // root is part of the recorded source digest and of the image's bytes.
  const rendered = renderToStaticMarkup(element);
  const root = rendered.match(/^<svg\b[^>]*>/)?.[0] ?? "";
  const markup = root.includes(" xmlns:xlink=")
    ? rendered
    : rendered.replace(
        'xmlns="http://www.w3.org/2000/svg"',
        'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"',
      );
  const svg = registration.source ? registration.source(markup) : markup;
  const outlined = await outlineComponentImage(svg, {
    profile: registration.profile,
    inputsSha256: componentInputsHash(request.slug),
    viewBox: contractViewBox(
      contract as Parameters<typeof contractViewBox>[0],
      request.props,
    ),
    flip: registration.flip?.(request.props as never) ?? false,
    fonts: registration.fonts,
    paintServers: registration.paintServers,
    reuse: registration.reuse,
  });
  let bytes = (registration.outlined?.(outlined.bytes) ??
    outlined.bytes) as Buffer<ArrayBuffer>;
  if (request.format === "png") {
    const { width, height } = request.props;
    const image = sharp(bytes, { limitInputPixels: 4_194_304 });
    const raster = contractRasterDefault(
      contract as Parameters<typeof contractRasterDefault>[0],
      request.props,
    );
    if (width || height) image.resize(width, height);
    else if (raster) image.resize(raster.width, raster.height);
    bytes = await image
      .png(registration.palette ? { palette: true } : undefined)
      .toBuffer();
  }
  if (registration.finish)
    bytes = registration.finish(
      bytes,
      request.format,
      request.props as never,
    ) as Buffer<ArrayBuffer>;
  return {
    ...outlined,
    request,
    bytes,
    byteSize: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    headers: registration.headers?.(markup) ?? {},
    contentType:
      request.format === "svg"
        ? ("image/svg+xml" as const)
        : ("image/png" as const),
  };
}
