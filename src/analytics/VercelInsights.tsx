"use client";
import {
  Analytics,
  type BeforeSend as AnalyticsBeforeSend,
} from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { usePathname } from "next/navigation";
import * as React from "react";
import { insightsPath, insightsUrl, isPublicPath } from "./insightsUrl";

type SpeedInsightsBeforeSend = NonNullable<
  React.ComponentProps<typeof SpeedInsights>["beforeSend"]
>;

/**
 * Set once this document has shown a private page. Speed Insights reports
 * CLS, INP and sometimes LCP when the tab is hidden, under the URL showing
 * then, with attributions (CSS selectors) from whichever page was measured,
 * so after a private page nothing more is sent until a full load.
 */
let shownPrivatePage = false;

const analyticsBeforeSend: AnalyticsBeforeSend = (event) => {
  const url = insightsUrl(event.url);
  return url ? { ...event, url } : null;
};

const speedInsightsBeforeSend: SpeedInsightsBeforeSend = (event) => {
  const url = insightsUrl(event.url);
  if (shownPrivatePage || !url || !isPublicPath(new URL(url).pathname))
    return null;
  return { ...event, url };
};

/**
 * Vercel Web Analytics (page views, no cookies) and Speed Insights (Core
 * Web Vitals from real visits). The plain React components take the route
 * and path from here, limited by `insightsPath`; the Next ones would
 * compute a route that can keep a raw invite password.
 */
export default function VercelInsights() {
  const path = insightsPath(usePathname());
  const isPublic = isPublicPath(path);

  React.useEffect(() => {
    if (!isPublic) shownPrivatePage = true;
  }, [isPublic]);

  return (
    <>
      <Analytics
        framework="next"
        route={path}
        path={path}
        beforeSend={analyticsBeforeSend}
      />
      <SpeedInsights
        framework="next"
        route={path}
        beforeSend={speedInsightsBeforeSend}
      />
    </>
  );
}
