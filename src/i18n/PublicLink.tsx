"use client";
import type { ComponentProps } from "react";
import Link from "@/ui/Link";
import { useUiLanguage } from "./LocaleProvider";
import { publicEdition } from "./publications";

/** Keep a translated public visit in its language wherever a real edition exists. */
export default function PublicLink(props: ComponentProps<typeof Link>) {
  const { locale } = useUiLanguage();
  const href =
    typeof props.href === "string"
      ? (publicEdition(props.href, locale) ?? props.href)
      : props.href;
  return <Link {...props} href={href} />;
}
