"use client";
import createCache, { type EmotionCache, type Options } from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import rtlPlugin from "@mui/stylis-plugin-rtl";
import { type ReactNode, useState } from "react";
import { prefixer } from "stylis";
import { DEFAULT_COLOR_MODE } from "@/colorScheme";
import theme, { hebrewTheme } from "@/theme";
import { useUiLanguage } from "./LocaleProvider";
import type { UiLocale } from "./locales";

const options = (locale: UiLocale) => ({
  key: locale === "he" ? "muirtl" : "mui",
  enableCssLayer: true,
  stylisPlugins: locale === "he" ? [prefixer, rtlPlugin] : [prefixer],
});

function DirectionCache({
  value,
  children,
}: {
  value: EmotionCache;
  children: ReactNode;
}) {
  const { locale } = useUiLanguage();
  const [caches] = useState(() => new Map([[locale, value]]));
  if (!caches.has(locale)) {
    // MUI streams the first cache. Later client caches preserve its layer and
    // use distinct class names, without keying/remounting the editor subtree.
    const cache = createCache(options(locale) as Options);
    const insert = cache.insert;
    cache.insert = (...args) => {
      if (!args[1].styles.startsWith("@layer"))
        args[1].styles = `@layer mui {${args[1].styles}}`;
      return insert(...args);
    };
    caches.set(locale, cache);
  }
  return <CacheProvider value={caches.get(locale)!}>{children}</CacheProvider>;
}

export default function LocaleTheme({ children }: { children: ReactNode }) {
  const { locale } = useUiLanguage();
  return (
    <AppRouterCacheProvider
      options={options(locale)}
      CacheProvider={DirectionCache}
    >
      <ThemeProvider
        theme={locale === "he" ? hebrewTheme : theme}
        defaultMode={DEFAULT_COLOR_MODE}
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
