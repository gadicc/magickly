import type { Metadata } from "next";
import { publicAlternates } from "@/i18n/publications";
import { socialCardImage } from "./cards";
import {
  PUBLIC_PAGES,
  type PublicPath,
  type SeoPage,
  type SocialImage,
} from "./pages";
import { SITE_OPEN_GRAPH } from "./site";

/**
 * Metadata for one indexable URL: canonical, snippet and sharing fields. The
 * image defaults to the path's generated card, which exists for every
 * registry and entity page; other paths must pass their own.
 */
export function seoMetadata(path: string, page: SeoPage): Metadata {
  return {
    title: page.absoluteTitle ? { absolute: page.title } : page.title,
    description: page.description,
    alternates: {
      canonical: path,
      ...(publicAlternates(path) ? { languages: publicAlternates(path) } : {}),
    },
    openGraph: {
      ...SITE_OPEN_GRAPH,
      url: path,
      images: [page.image ?? socialCardImage(path, page.title)],
    },
  };
}

/**
 * Metadata for a static route listed in the public page registry, with
 * any of the page's own settings that aren't about search (`referrer`),
 * and any images of its own to share after its card (`images`: a kamea's
 * square, as the angels' and halls' entity pages add theirs).
 */
export function pageMetadata(
  path: PublicPath,
  {
    images,
    ...own
  }: Pick<Metadata, "referrer"> & { images?: SocialImage[] } = {},
): Metadata {
  const metadata = seoMetadata(path, PUBLIC_PAGES[path]);
  if (!images?.length) return { ...metadata, ...own };
  const card = metadata.openGraph?.images as SocialImage[];
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, images: [...card, ...images] },
    ...own,
  };
}

/** Account, administration and offline pages stay out of search results. */
export function privateMetadata(title: string): Metadata {
  return { title, robots: { index: false } };
}
