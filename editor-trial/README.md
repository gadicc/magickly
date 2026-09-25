# Ritual editor trial

Disposable, synthetic browser trial for the [editor decision](../plans/037-ritual-editor-decision.md). No production API, database, private ritual, or Loom feature is used. The later `/production.html` fixture imports the app-local adapter to check its actual ProseMirror schema. Dependencies and lockfile live here; `node_modules`, `dist`, and Playwright captures are ignored.

## Reproduce

From this directory, with Node 25.2.1 and pnpm 10.18.0 as tested:

```sh
pnpm install --frozen-lockfile --ignore-workspace
pnpm test
pnpm build
pnpm dev
```

Open `http://127.0.0.1:5173/` for the Slate/Tiptap comparison, `/lexical.html` for the focused boundary check, and `/reader.html` for the editor-free reader. With root dependencies installed, `/production.html` checks the production adapter on synthetic content. `pnpm build` makes a separate Vite entry for each. Nothing here should be imported by production code.

On 25 September 2026, Chromium loaded `/production.html` without application errors. Backspace at the start of the second speech left the `hiero` and `keryx` tasks separate; the reader JSON remained unchanged. This is one browser boundary observation, not physical-device or full-editor validation.

To repeat the legacy compiler fixture, use the main checkout's installed dependencies and point at the isolated trial fixture:

```sh
cd /home/dragon/www/projects/magickli
MAGICKLI_TRIAL=/home/dragon/.codex/worktrees/ritual-editor-research/magickli/editor-trial pnpm exec tsx -e 'import { readFileSync } from "node:fs"; import { prepare } from "./src/doc/prepare.js"; for (const name of ["legacy-supported", "legacy-unsupported", "legacy-malformed"]) { try { const source = readFileSync(`${process.env.MAGICKLI_TRIAL}/fixtures/${name}.pug`, "utf8"); console.log(name, JSON.stringify(prepare(source))); } catch (error) { console.log(name, "ERROR", error.message); } }'
```

`fixtures/legacy-supported.jrt.json` records the supported compiler output; unknown source compiled into an unknown JRT node, while malformed syntax failed.

## What to exercise

The same `src/model.js` fixture drives both full spikes and the pure read-only preview. It includes role aliases and audience expressions, speech/actions, variable declaration/options/reference, grade, nested note/summary, footnote, image, heading/anchor, Hebrew/Enochian spans, and an opaque legacy block. `Load long document` repeats the fixture 200 times. Source mode is **semantic JSON** in this trial, not a proposed final author-facing syntax.

1. Choose an engine. Use the toolbar to insert a task or special node; use `Edit selected task` to change mode, role scope, or exclusions. Move/delete the selected whole node. The reader role and candidate name controls show derived reader behavior.
2. Select text across a variable and grade, delete it, then Undo/Redo. Paste plain text and HTML. Split a paragraph with Enter. At the start of `Make the sign.`, press Backspace and inspect whether it crosses into the preceding `officers` task. `Reset fixture` restores the sample.
3. Switch to `Source JSON`, change a semantic value, apply, and return to WYSIWYG. Malformed JSON and invalid semantic values should stay in source mode with an error. Save locally, reset, reload, and inspect the read-only preview. Browser storage uses only `magickli-editor-trial-v1`.
4. Open `/lexical.html`; at the start of `Make the sign.`, press Backspace. This focused spike intentionally covers the role boundary and serialization only; it does not implement the full feature set.
5. Open `/reader.html` and inspect Network: it has no editor engine dependency. Load the long fixture in the full trial and measure one edit in a production build (`pnpm build && pnpm exec vite preview --host 127.0.0.1`).

`pnpm test` checks semantic round-trips, repeated conversion stability, invalid documents and split identity. It is not a substitute for browser selection or usability tests.

## Separate bundle samples

These deliberately small React entry points let us avoid attributing the combined ritual trial's editor bundle to one engine. Rebuild with:

```sh
EDITOR_BENCH=react pnpm exec vite build --config bench/vite.config.js --configLoader runner
EDITOR_BENCH=slate pnpm exec vite build --config bench/vite.config.js --configLoader runner
EDITOR_BENCH=lexical pnpm exec vite build --config bench/vite.config.js --configLoader runner
EDITOR_BENCH=tiptap pnpm exec vite build --config bench/vite.config.js --configLoader runner
```

Vite 8.3.1 on Node 25.2.1 emitted one minified entry per sample (gzip): React-only **68.56 kB**, Slate + React/history **125.86 kB**, Lexical + React/rich-text/history **142.58 kB**, and Tiptap + React/StarterKit **191.26 kB**. These are **not feature-equivalent**: the Slate and Lexical samples omit lists and tables; StarterKit includes more rich-text behavior, while images and tables are absent from all four. They include React, omit our toolbar/uploads/validation, and are Vite builds rather than Next route measurements. Use them only as a rough sizing comparison, not a claim about final production cost or mobile responsiveness.

## Still requires manual verification

Use a physical iOS and Android device with Hebrew and another composing keyboard. In both, insert and edit inside a role-scoped task, accept candidate suggestions, move the caret across the variable/grade, undo, paste, save, reload, and compare semantic JSON and reader output. Repeat with a hardware keyboard using Tab/Shift+Tab, arrow keys and a screen reader (VoiceOver and TalkBack, plus a desktop screen reader). Ask an unfamiliar, nontechnical ritual author to complete a speech/action edit and role change without showing source syntax; observe whether they can find and understand the controls. These checks were not available in the recorded trial.
