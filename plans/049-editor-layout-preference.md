# Remembered ritual editor layout — 3 October 2026

New and existing ritual editors default to split: Pug source on the left,
visual editing on the right, stacked at the existing small-screen breakpoint.
Creation now offers the same three layouts as revision editing.

Manual layout choices persist in `magickli:ritual-editor-layout:v1` in
localStorage. One preference applies across rituals in this browser/origin,
including create/edit navigation and reloads. Open editors do not switch their
layout when another tab chooses a mode. No account data or ritual content is
stored in this value, and it is not sent to the server.

The shared hook restores a validated choice before client paint; both real
editor entrypoints already use `next/dynamic` with SSR disabled. Missing,
invalid or inaccessible storage falls back to split (or an explicitly provided
initial layout). Storage failures leave current layout controls functional.
Writes happen only for an explicit layout choice, so automatic source-only
fallback and recovery do not overwrite the saved preference.

Creation split mode gates visual editing during source IME composition, while
retaining toolbar appearance. Composition completion applies source before
re-enabling editing; switching to Visual also ends the composition wait.

Verification covers default pane order, persistence/remounts on both screens,
invalid and blocked storage, automatic legacy recovery retaining preferences,
IME command guards, and the existing creation/retry workflow. An older creation
test was updated from retired Ritual Text input to the current Pug contract.
Independent GPT-6.1 Sol xhigh review completed and its IME finding was fixed.
TypeScript and Loom checks pass. The manual browser reload check was blocked
by an unresponsive browser automation connection; no manual result is claimed.
The temporary synthetic route was removed. No database migration or push.
