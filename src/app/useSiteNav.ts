import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import { localizedPath } from "@/i18n/locales";
import { publicEdition } from "@/i18n/publications";
import { siteNav } from "./siteNav";

/**
 * The current path's place in the site, for the bar and the footer. Both
 * render on the server, so both must resolve the static 404 the same way.
 */
export default function useSiteNav() {
  const pathname = usePathname() ?? "/";
  const segment = useSelectedLayoutSegment();
  const { t, locale } = useUiLanguage();
  const nav = siteNav(localizedPath(pathname).path, segment);
  const link = (item: { title: string; url: string }) => ({
    ...item,
    title: t(item.title),
    url: publicEdition(item.url, locale) ?? item.url,
  });
  // Sign-in returns to the path the reader actually opened.
  return {
    ...nav,
    pathname,
    title: t(nav.title),
    ancestors: nav.ancestors.map(link),
    sectionPages: nav.sectionPages.map(link),
    titleUrl: nav.titleUrl
      ? (publicEdition(nav.titleUrl, locale) ?? nav.titleUrl)
      : undefined,
  };
}
