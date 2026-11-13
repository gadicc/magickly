"use client";
import dynamic from "next/dynamic";

/** SSR stays enabled, with no loading fallback/Suspense wrapper. The legacy browser graph loads only when this ordinary chrome is rendered. */
const SiteChromeLoader = dynamic(() => import("./SiteChrome"));
export default SiteChromeLoader;
