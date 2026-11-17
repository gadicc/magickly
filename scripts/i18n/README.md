# Internationalization feasibility gate

Run `pnpm i18n:proof` on Node 24. It creates an isolated Next app under
`output/i18n/proof`, adopts catalog tooling through `loom add lingui`, and
installs the fixture's dependencies with the project's pinned pnpm and release
age policy. It requires registry access, subprocess permissions and Chromium.
It passes no app credentials and loads no app `.env` files.

The fixture pins the Next, React, MUI and Loom versions installed in this
worktree. Lingui core/CLI 6.12.0 and SWC plugin 6.7.1 are the exact combination
selected by Loom's supported ranges in the initial experiment. MUI's RTL plugin
is 9.5.0, Stylis 4.4.0. Changing these is an explicit compatibility check.

Both webpack and Turbopack production builds must pass HTTP status, locale,
static/offline versus private caching and root-isolation assertions. Chromium
checks React and styling hydration, actual RTL/LTR CSS switching, preservation
of an edited field and its DOM node, and document replacement across roots.
The private-reader fixture includes a synthetic database outage, not a real DB.
A rewrite serves the anonymous offline document at a synthetic UUID URL to
exercise the fallback-document shape; this does not claim to test the app's
service worker. The app's worker tests and real editor/recovery flows remain
separate gates before relocation.

`output/i18n/proof-report.json` contains results, `route-placement.json` the
explicit migration inventory, and adjacent logs retain build/server output.
An error stops the gate; it never moves production routes or silently upgrades
Next. If Next interrupts a build to report an advisory, inspect the log and
record it; a later retry is not evidence that the vulnerability was fixed.

`src/i18n/routePlacement.ts` records the proposed root per page, independently
of SEO or authorization. Its test requires every current page to be listed once
and preserves the explicit static-bundled-ritual exception to `/doc/[id]`.

Do not read a language cookie in the anonymous offline root. Do not close the
locale layout with `dynamicParams = false`: that also blocks runtime ritual
IDs. For matched runtime failures, Next may emit its generic error shell in the
initial 404 HTML. The gate checks real status/noindex and the browser fallback;
it does not claim meaningful no-JS content for that framework response.

Do not throw `notFound()` from a root layout: the fixture proved that its
own not-found boundary cannot wrap its layout. Keep a safe document and reject
unsupported locales, missing/private translations and deleted rituals inside
the page boundary before streaming or content lookup.
