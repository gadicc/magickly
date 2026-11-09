import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import { siteNav } from "./siteNav";

/**
 * The current path's place in the site, for the bar and the footer. Both
 * render on the server, so both must resolve the static 404 the same way.
 */
export default function useSiteNav() {
  const pathname = usePathname() ?? "/";
  const segment = useSelectedLayoutSegment();
  // Sign-in returns to the path the reader actually opened.
  return { pathname, ...siteNav(pathname, segment) };
}
