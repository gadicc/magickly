"use client";
import { useUiLanguage } from "./LocaleProvider";
import { LOCALE_INFO } from "./locales";

/** Presentation text only. Stored documents, source code and domain identifiers never pass here. */
export default function UiText({
  message,
  children,
  values,
}: {
  message?: string | null;
  children?: string;
  values?: Record<string, string | number>;
}) {
  const { t, locale } = useUiLanguage();
  const source = message ?? children;
  if (!source) return null;
  const text = t(source, values);
  if (locale === "en") return <>{text}</>;
  // Untranslated copy stays accurately labelled while translation batches grow.
  const language = /[\u0590-\u05ff]/.test(text) ? locale : "en";
  return (
    <span lang={language} dir={LOCALE_INFO[language].direction}>
      {text}
    </span>
  );
}
