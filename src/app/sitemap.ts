import type { MetadataRoute } from "next";
import { GD_HALLS } from "@/render/contracts/gdHall";
import { entityPages } from "@/seo/entities";
import { hallFiles, hallPath } from "@/seo/halls";
import { lenainPages } from "@/seo/lenain";
import { PUBLIC_PAGES } from "@/seo/pages";
import { SITE_URL } from "@/seo/site";

/**
 * Registry pages, then data rows, spelled exactly like their canonicals.
 * No change frequency or priority (search engines ignore both) and no build
 * time posing as a modification date.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...[
      ...Object.keys(PUBLIC_PAGES),
      ...entityPages().map((page) => page.path),
      ...lenainPages().map((page) => page.path),
    ].map((path) => ({ url: path === "/" ? SITE_URL : SITE_URL + path })),
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
