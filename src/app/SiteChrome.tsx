"use client";
import { GlobalStyles } from "@mui/material";
import type { CSSObject, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import VercelInsights from "@/analytics/VercelInsights";
import ClientProviders from "./clientProviders";
import MyAppBar from "./MyAppBar";
import { PageShareProvider } from "./pageShare";
import SiteFooter from "./SiteFooter";
import useSiteNav from "./useSiteNav";

/**
 * The app bar's height as `--app-bar`, from the toolbar's own sizes (56px
 * on a phone, 48px on one turned sideways, 64px from 600px wide), so the
 * spacer under the fixed bar, and pages that fill the room below it,
 * follow the bar rather than a number of their own.
 */
function appBarHeight(style: CSSObject): CSSObject {
  return Object.fromEntries(
    Object.entries(style).map(([key, value]) =>
      key === "minHeight"
        ? ["--app-bar", typeof value === "number" ? `${value}px` : value]
        : [
            key,
            value && typeof value === "object"
              ? appBarHeight(value as CSSObject)
              : value,
          ],
    ),
  );
}
const appBarStyles = (theme: Theme) => ({
  ":root": appBarHeight(theme.mixins.toolbar),
});

/**
 * The page-share provider, titled as the app bar titles the page, so the
 * app bar's Share and the export box's share row send the same sheet.
 */
function SharedPage({ children }: { children: ReactNode }) {
  const { title } = useSiteNav();
  return <PageShareProvider title={title}>{children}</PageShareProvider>;
}

/** Ordinary site chrome; keep its browser database and recovery graph out of the private reader's eager entry. */
export default function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <ClientProviders>
        <GlobalStyles styles={appBarStyles} />
        <SharedPage>
          <MyAppBar />
          <div style={{ height: "var(--app-bar, 56px)" }} />
          {children}
        </SharedPage>
        <SiteFooter />
      </ClientProviders>
      <VercelInsights />
    </>
  );
}
