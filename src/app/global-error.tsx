"use client";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import {
  COLOR_SCHEME_ATTRIBUTE,
  DEFAULT_COLOR_MODE,
  noStorageColorSchemeScript,
} from "@/colorScheme";
import "./errorDocument.css";

/** A root failure must not reveal exception details or mount the ordinary shell. */
export default function GlobalError({ reset }: { reset: () => void }) {
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
          <h1>Page temporarily unavailable</h1>
          <p>Please try again.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
