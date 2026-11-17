"use client";
import type { ReactNode } from "react";
import { useUiLanguage } from "./LocaleProvider";

/** Untranslated explanatory copy retains its language/direction during incremental rollout. */
export default function EnglishText({ children }: { children: ReactNode }) {
  if (useUiLanguage().locale === "en") return <>{children}</>;
  return (
    <span lang="en" dir="ltr">
      {children}
    </span>
  );
}
