"use client";
import { noStorageColorSchemeScript } from "@/colorScheme";
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
        {/* Global documents also serve private research failures; use device theme without storage. */}
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
