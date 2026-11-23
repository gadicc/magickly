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

## Translation maintenance

`translation.mts` reads/writes catalogs through the installed Lingui PO formatter.
It selects only missing/fuzzy, non-obsolete messages and preserves existing
translations and translator context. ICU compilation checks syntax; structural
checks preserve variable names/types, select keys, exact-number plural selectors,
offsets, and balanced React component placeholders. These checks cannot establish
semantic translation quality; review the PO diff and relevant screens.

```sh
pnpm i18n:extract
pnpm i18n:translate                 # dry run: counts only, no provider calls
pnpm i18n:update                    # extract → translate --write → check
```

For the last command, configure `I18N_TRANSLATION_MODEL` with an explicitly chosen
Vercel AI Gateway model ID and the normal gateway authentication through the
project's environment. Alternatively pass `--model <id>` to
`pnpm i18n:translate --write`. Do not put credentials in command arguments. The
task uses `loom env`; framework dev/build still loads its own environment.
The model is not silently selected or upgraded by this script.

Translation uses `@gadicc/loom/i18n` with app-owned [context](context.json): site
purpose, glossary, preservation rules and file-to-section/page mappings. Source
paths are relative to this project root. Both script requests and direct agent
translation use this context; inspect all relevant source usages for ambiguity.
Descriptions are locale-neutral facts, while rules preserve source works and the
tools' working languages. Reviewed translations are never refreshed merely
because context changes. Unknown origins receive site context and appear in the
coverage report; maintain mappings as files move.

`pnpm i18n:preview` prints the SDK input and response schema locally,
without loading the provider SDK. This opt-in output contains source copy and
catalog context; it is not the provider's wire payload. `--preview` takes
precedence over `--write`. Request limits are 20 messages and 24,000 string code
units including system/prompt inputs; context grouping or size can split batches.
Technical Lingui markers are retained in PO files but omitted from requests.

Any missing/duplicate result, malformed ICU, changed placeholder or failed batch
aborts without writing. The complete locale is saved atomically after checking
that the catalog has not changed during the run. Errors omit provider request and
credential details. Only first-party catalog messages and translator context are
read; no database or runtime content is read. No AI runs in builds, CI or ordinary
compilation. `fixtures/messages.json` contains twenty offline transport examples;
these tests do not establish linguistic improvement or provider cache savings.

The coding agent can also translate the extracted delta directly in PO sources;
`pnpm i18n:check` applies the same placeholder checks either way. It additionally
uses Lingui's read-only extraction-sync check and strict compilation, so an
unextracted source change or a missing translation fails CI. Unmarked copy still
requires developer review; extraction cannot discover text it was never given.

Source syntax/placeholder validation runs before provider initialization. Explicit
message IDs resolve through the canonical English catalog; both catalogs are
checked for concurrent edits before writing. Dry runs print compact coverage
counts. Preview stdout is JSON; status goes to stderr. Local validation errors
carry an inspectable catalog identity without putting source text or provider
error details in their default message. Component identities/ancestry are retained
inside plural choices; counts outside choices are checked exactly, while plural
categories may repeat component placeholders.

## Shared package and local development

This integration uses the exact published Loom release pinned in `package.json`
and `pnpm-lock.yaml`. A clean checkout installs it from the registry.

For local Loom work, use its managed development commands. Before merging or
releasing an app that used local Loom, run `loom dev published`, follow its
printed install command, rerun `loom dev published` to verify the installed
registry copy, and pass `loom check --production` plus the app checks. Keep the
managed local state intact until that verification succeeds.

## Offline context maintenance (Loom 2.7+)

`context.json` stores the reviewed facts and mappings; `context.mts` only imports
and types that data. The CLI reads JSON without evaluating application modules.
`context.snapshot.json` is committed review evidence containing sorted relative
paths and normalized source hashes, without timestamps or machine-specific paths.

```sh
pnpm i18n:context                         # strict offline check
pnpm exec loom i18n context check --json  # complete path/hash inventory
# After inspecting source/context changes and reviewing the descriptions:
pnpm exec loom i18n context snapshot
```

A source change means review is needed; it does not prove a description is wrong.
Edit the JSON if the source's meaning or placement changed, then acknowledge the
review. Never run snapshot reflexively to clear a failed check. Both overlapping
scopes apply, and bracketed filenames are literal. JSON key order and CRLF/LF do
not create drift; rule/hierarchy order remains meaningful. Unscoped source files
are advisory source inventory, not proof of missing translation context.

Snapshots are explicit, atomic and idempotent. A failed/incomplete inventory keeps
the previous baseline. A stopped writer may leave a `.snapshot.json.lock`; inspect
its PID and confirm the writer is stopped before removing only that lock. These
commands never call a provider or change translations. Normal `loom check`,
including production mode, reports review drift as advisory; the dedicated
`i18n:context` task opts into strict review checks. Standard Loom local-dev package
refresh can still occur before CLI dispatch. Use the established published-package
proof before release; older Loom CLIs do not provide these context commands.
