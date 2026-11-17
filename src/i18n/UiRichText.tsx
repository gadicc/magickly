"use client";
import { setupI18n } from "@lingui/core";
import {
  I18nProvider,
  LinguiContext,
  Trans,
  type TransProps,
} from "@lingui/react";
import { Children, useContext } from "react";
import { messages as english } from "@/locales/en/messages.js";
import { useUiLanguage } from "./LocaleProvider";

const fallback = setupI18n({ locale: "en", messages: { en: english } });

/** Whole messages with code-owned React links/formatting; translations never supply HTML or URLs. */
export default function UiRichText({
  message,
  components,
  values,
}: {
  message: string;
  components?: TransProps["components"];
  values?: Record<string, string | number>;
}) {
  const context = useContext(LinguiContext);
  const { locale, t } = useUiLanguage();
  const translated = t(message, values);
  // Flight can stream component props as lazy React nodes. Normalize them with
  // React's public children API before Lingui clones their types/props.
  const resolvedComponents =
    components &&
    Object.fromEntries(
      Object.entries(components).map(([key, element]) => [
        key,
        Children.toArray(element)[0],
      ]),
    );
  const safeValues =
    values &&
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        typeof value === "string" && /[<>]/.test(value) ? <>{value}</> : value,
      ]),
    );
  const isHebrew =
    Boolean(context?.i18n.messages[message]) &&
    /[\u0590-\u05ff]/.test(translated);
  const content = (
    <Trans
      id={message}
      message={message}
      components={resolvedComponents}
      values={safeValues}
    />
  );
  // Standalone component tests have the same fixed English fallback as UiText.
  const result = context ? (
    content
  ) : (
    <I18nProvider i18n={fallback}>{content}</I18nProvider>
  );
  return locale === "en" ? (
    result
  ) : (
    <span lang={isHebrew ? locale : "en"} dir={isHebrew ? "rtl" : "ltr"}>
      {result}
    </span>
  );
}
