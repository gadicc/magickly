"use client";
import UiText from "@/i18n/UiText";
import { templeFeedback } from "./feedback";

/** Localize app-owned feedback while keeping transport results independent of UI locale. */
export default function TempleFeedback({ text }: { text: unknown }) {
  return <UiText {...templeFeedback(text)} />;
}
