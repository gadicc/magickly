"use client";
import type { ReactNode } from "react";
import VercelInsights from "@/analytics/VercelInsights";
import ClientProviders from "./clientProviders";
import MyAppBar from "./MyAppBar";
import SiteFooter from "./SiteFooter";
/** Ordinary site chrome; keep its browser database and recovery graph out of the private reader's eager entry. */
export default function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <ClientProviders>
        <MyAppBar />
        <div style={{ height: 56 }} />
        {children}
        <SiteFooter />
      </ClientProviders>
      <VercelInsights />
    </>
  );
}
