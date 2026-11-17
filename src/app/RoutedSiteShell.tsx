"use client";
import CssBaseline from "@mui/material/CssBaseline";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { isResearchPath } from "@/chat-research/paths";
import {
  COLOR_SCHEME_ATTRIBUTE,
  DEFAULT_COLOR_MODE,
  noStorageColorSchemeScript,
} from "@/colorScheme";
import LocaleTheme from "@/i18n/LocaleTheme";
import theme from "@/theme";
import PrintInLight from "./PrintInLight";
import SiteChromeLoader from "./SiteChromeLoader";
import StyledJsxRegistry from "./StyledJsxRegistry";
import { reloadResearchShellDocument } from "./shellNavigation";
import ThemeColorMeta from "./ThemeColorMeta";

const lightScript =
  'try{document.documentElement.classList.remove("dark");document.documentElement.classList.add("light")}catch(e){}';
/** Select the entire side-effectful shell, including the outer theme/init script, before ordinary chrome can mount. This is UI isolation, never operator/source authorization. */
export default function RoutedSiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    mode =
      pathname === null ? null : isResearchPath(pathname) ? "research" : "site",
    [originalMode, setOriginalMode] = useState(mode),
    reloading = useRef(false),
    crossing = originalMode !== null && mode !== null && originalMode !== mode;
  useEffect(() => {
    if (originalMode === null && mode !== null) {
      setOriginalMode(mode);
      return;
    }
    if (crossing && !reloading.current) {
      reloading.current = true;
      try {
        reloadResearchShellDocument();
      } catch {}
    }
  }, [mode, originalMode, crossing]);
  // No private child can mount or start API work during a cross-shell reload or
  // an unresolved compatibility pathname. No app state/cache is erased.
  if (mode === null || originalMode === null || crossing || reloading.current)
    return <p role="status">Opening page…</p>;
  if (mode === "research")
    return (
      <>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: fixed light-only script with no storage or input
          dangerouslySetInnerHTML={{ __html: lightScript }}
        />
        <AppRouterCacheProvider
          key="research"
          options={{ enableCssLayer: true }}
        >
          <ThemeProvider
            theme={theme}
            defaultMode="light"
            storageManager={null}
          >
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </>
    );
  return (
    <>
      <InitColorSchemeScript
        attribute={COLOR_SCHEME_ATTRIBUTE}
        defaultMode={DEFAULT_COLOR_MODE}
      />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: unchanged fixed public-site theme fallback
        dangerouslySetInnerHTML={{ __html: noStorageColorSchemeScript }}
      />
      <StyledJsxRegistry>
        <LocaleTheme>
          <CssBaseline />
          <PrintInLight />
          <ThemeColorMeta />
          <SiteChromeLoader>{children}</SiteChromeLoader>
        </LocaleTheme>
      </StyledJsxRegistry>
    </>
  );
}
