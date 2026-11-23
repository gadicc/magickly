import type { MetadataRoute } from "next";
import { indexableLocalizedPaths, publicAlternates } from "@/i18n/publications";
import { GD_HALLS } from "@/render/contracts/gdHall";
import { allAngelSigilStyleFiles } from "@/seo/angelSigils";
import { componentPages } from "@/seo/components";
import { entityPages } from "@/seo/entities";
import { hallFiles, hallPath } from "@/seo/halls";
import { allKameaFiles } from "@/seo/kameas";
import { lenainPages } from "@/seo/lenain";
import { PUBLIC_PAGES } from "@/seo/pages";
import { allPlanetaryNameSigilFiles } from "@/seo/planetaryNames";
import { SITE_URL } from "@/seo/site";

/**
 * Registry pages, then data rows, spelled exactly like their canonicals.
 * No change frequency or priority (search engines ignore both) and no build
 * time posing as a modification date.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Each angel's page with its sigil's files, the PNG first (plan 088, S4),
  // as the halls' below: the band's, then every other style's (plan 096,
  // decision 4). Next writes them unescaped, so the URLs carry no query.
  // Each kamea's page with its square's two files likewise, and each
  // planetary intelligence's and spirit's with its sigil's (plan 093, K4).
  const images = new Map<string, string[]>();
  for (const { file } of [
    ...allKameaFiles(),
    ...allAngelSigilStyleFiles(),
    ...allPlanetaryNameSigilFiles(),
  ]) {
    const page = file.path.slice(0, file.path.lastIndexOf("/"));
    images.set(page, [...(images.get(page) ?? []), SITE_URL + file.path]);
  }
  return [
    ...[
      ...Object.keys(PUBLIC_PAGES),
      ...entityPages().map((page) => page.path),
      ...lenainPages().map((page) => page.path),
      ...componentPages().map((page) => page.path),
      ...indexableLocalizedPaths(),
    ].map((path) => ({
      url: path === "/" ? SITE_URL : SITE_URL + path,
      ...(images.has(path) && { images: images.get(path) }),
      ...(publicAlternates(path)
        ? {
            alternates: {
              languages: Object.fromEntries(
                Object.entries(publicAlternates(path)!).map(([locale, url]) => [
                  locale,
                  SITE_URL + (url === "/" ? "" : url),
                ]),
              ),
            },
          }
        : {}),
    })),
    // Each temple hall with its two indexable images, the PNG first (plan
    // 062). Next writes them unescaped, so the URLs carry no query.
    ...GD_HALLS.map((hall) => {
      const { png, svg } = hallFiles(hall);
      return {
        url: SITE_URL + hallPath(hall),
        images: [png, svg].map((file) => SITE_URL + file.path),
      };
    }),
  ];
}
