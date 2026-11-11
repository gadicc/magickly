import CssBaseline from "@mui/material/CssBaseline";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import type { Metadata, Viewport } from "next";
import * as React from "react";
import VercelInsights from "@/analytics/VercelInsights";
import {
  COLOR_SCHEME_ATTRIBUTE,
  DEFAULT_COLOR_MODE,
  noStorageColorSchemeScript,
  THEME_COLOR,
} from "@/colorScheme";
import { earlyPlaceLookupScript } from "@/geo/earlyPlaceLookup";

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OPEN_GRAPH,
  SITE_TITLE,
  SITE_URL,
} from "@/seo/site";
import theme from "@/theme";
import ClientProviders from "./clientProviders";
import MyAppBar from "./MyAppBar";
import PrintInLight from "./PrintInLight";
import SiteFooter from "./SiteFooter";
import StyledJsxRegistry from "./StyledJsxRegistry";
import ThemeColorMeta from "./ThemeColorMeta";
import "@/db";
// The Hebrew text font (plan 079), for every page that names it: the
// browser fetches the file only where it draws Hebrew in that family.
import "@/../public/fonts/FrankRuhlLibre.css";

// No canonical here: every page below would inherit it. Open Graph titles and
// descriptions are left unset so Next fills them from each page's own.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.json",
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
    // startUpImage: [],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: SITE_OPEN_GRAPH,
  twitter: {
    card: "summary_large_image",
  },
  /*
  icons: {
    icon: "/favicons/android-chrome-512x512.png",
    shortcut: "/favicons/favicon.ico",
    apple: "/favicons/apple-touch-icon.png",
  },
  */
  verification: {
    google: "guHt3hzkAJ0hYCli_eD_e28PDoClPOQyvuAiJvGFo9k",
  },
};

// Follows the device; ThemeColorMeta overrides both for an explicit choice.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    // The colour-scheme script sets a class on <html> before React hydrates.
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: our own constant script, no input
          dangerouslySetInnerHTML={{ __html: earlyPlaceLookupScript }}
        />
        <link
          rel="apple-touch-icon"
          sizes="57x57"
          href="/favicons/apple-icon-57x57.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="60x60"
          href="/favicons/apple-icon-60x60.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="72x72"
          href="/favicons/apple-icon-72x72.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="76x76"
          href="/favicons/apple-icon-76x76.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="114x114"
          href="/favicons/apple-icon-114x114.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="120x120"
          href="/favicons/apple-icon-120x120.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="144x144"
          href="/favicons/apple-icon-144x144.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="/favicons/apple-icon-152x152.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/favicons/apple-icon-180x180.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="192x192"
          href="/favicons/android-icon-192x192.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicons/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="96x96"
          href="/favicons/favicon-96x96.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicons/favicon-16x16.png"
        />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta
          name="msapplication-TileImage"
          content="/favicons/ms-icon-144x144.png"
        />
        <meta property="fb:admins" content="gadicohen" />
      </head>
      <body>
        <InitColorSchemeScript
          attribute={COLOR_SCHEME_ATTRIBUTE}
          defaultMode={DEFAULT_COLOR_MODE}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: our own constant script, no input
          dangerouslySetInnerHTML={{ __html: noStorageColorSchemeScript }}
        />
        <StyledJsxRegistry>
          <AppRouterCacheProvider options={{ enableCssLayer: true }}>
            <ThemeProvider
              theme={theme}
              defaultMode={DEFAULT_COLOR_MODE}
              disableTransitionOnChange
            >
              {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
              <CssBaseline />
              <PrintInLight />
              <ThemeColorMeta />
              <ClientProviders>
                {/* Part of the shell: a Suspense boundary here would let React
                  outline the bar after large pages and reveal it by script. */}
                <MyAppBar />
                {/* same height as floating AppBar, so page starts beneath it */}
                <div style={{ height: 56 }}></div>
                {props.children}
                <SiteFooter />
              </ClientProviders>
            </ThemeProvider>
          </AppRouterCacheProvider>
        </StyledJsxRegistry>
        <VercelInsights />
      </body>
    </html>
  );
}
