import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import {
  COLOR_SCHEME_ATTRIBUTE,
  DEFAULT_COLOR_MODE,
  noStorageColorSchemeScript,
} from "@/colorScheme";
import "./errorDocument.css";

export const metadata = {
  title: "Page not found | Magick.ly",
  robots: { index: false },
};

/** Unmatched routes need no account, database, telemetry or service worker. */
export default function GlobalNotFound() {
  return (
    <html
      lang="en"
      dir="ltr"
      className="error-document"
      suppressHydrationWarning
    >
      <body>
        <InitColorSchemeScript
          attribute={COLOR_SCHEME_ATTRIBUTE}
          defaultMode={DEFAULT_COLOR_MODE}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: fixed app-owned theme fallback, no input
          dangerouslySetInnerHTML={{ __html: noStorageColorSchemeScript }}
        />
        <main>
          <h1>Page not found</h1>
          <p>The page is unavailable or does not exist.</p>
          <a href="/">Return home</a>
        </main>
      </body>
    </html>
  );
}
