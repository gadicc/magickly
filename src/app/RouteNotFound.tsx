"use client";
import UiText from "@/i18n/UiText";
/** A missing page stays inside its document/theme; no resource details are shown. */
export default function RouteNotFound() {
  return (
    <section style={{ padding: "2rem" }}>
      <h1>
        <UiText message={/*i18n*/ "Page not found"} />
      </h1>
      <p>
        <UiText
          message={/*i18n*/ "The page is unavailable or does not exist."}
        />
      </p>
      <a href="/">
        <UiText message={/*i18n*/ "Return home"} />
      </a>
    </section>
  );
}
