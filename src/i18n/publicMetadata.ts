import { setupI18n } from "@lingui/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { messages as hebrew } from "@/locales/he/messages.js";
import { socialCardImage } from "@/seo/cards";
import { seoMetadata } from "@/seo/metadata";

/** Literal extraction sources; a test keeps these aligned with existing English SEO copy. */
export const PUBLIC_METADATA_MESSAGES = {
  "/": {
    title: /*i18n*/ "Magick.ly: Open Source Magick Reference and Tools",
    description:
      /*i18n*/ "Free, open source reference and tools for Western esoteric study: Kabbalah, the Golden Dawn, Enochian magick, astrology, geomancy and flashcards.",
    absoluteTitle: true,
  },
  "/about": {
    title: /*i18n*/ "About",
    description:
      /*i18n*/ "About Magick.ly, an open source reference app for magickal study with MIT-licensed data and components. A reference, not an instruction app.",
  },
};

/** Reject unsupported editions before rendering metadata or looking up content. */
export function localizedPageMetadata(
  path: "/" | "/about",
  locale: string,
): Metadata {
  if (locale !== "he") notFound();
  const i18n = setupI18n({ locale: "he", messages: { he: hebrew } });
  const source = PUBLIC_METADATA_MESSAGES[path];
  const page = {
    ...source,
    title: i18n._(source.title),
    description: i18n._(source.description),
  };
  return {
    ...seoMetadata(path === "/" ? "/he" : `/he${path}`, {
      ...page,
      image: socialCardImage(path, page.title),
    }),
    openGraph: {
      ...seoMetadata(path, {
        ...page,
        image: socialCardImage(path, page.title),
      }).openGraph,
      url: path === "/" ? "/he" : `/he${path}`,
      locale: "he",
      alternateLocale: ["en"],
    },
  };
}
