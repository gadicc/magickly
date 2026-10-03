# Shared ritual presentation — 2 October 2026

The JRT reader and Tiptap editor now use common presentation components in
`src/doc/ritualBlocks/Frames.tsx` and a shared stylesheet. Task cards, officer
symbols/names/colours, speech quotes, action italics, titles, notes, summary
headings, grades and attached-image presentation share formatting. The role map
is neutral rather than exported from the reader, removing the reader/block
import cycle.

The existing JRT classes adapt reader children into these frames.
`renderForEditing.tsx` pairs them with client-only React NodeViews and a stable
ProseMirror-owned content slot. Selection and task-property changes do not
replace that slot. `tiptapRitualClient.ts` adds presentation to the existing
extensions; the server schema and clipboard HTML remain unchanged. Semantic
JSON, source IDs, SQL writes and database schemas are unchanged.

## Deliberate reading/authoring differences

- Author task cards are neutral and show each role header. The reader retains
  selected-role highlighting/indentation, consecutive-role grouping and page
  markers used during performance.
- Summary children remain visible while authoring. The reader retains native
  collapse behaviour.
- Variables remain selectable author tokens. The reader resolves their values.
- Footnotes remain editable in their document position. The reader still
  collects and places them outside the speech/action body, after children render.
  Matching that placement in the editor is a separate content-DOM design task.
- Images preview only canonical same-origin attachment locators. Arbitrary URLs
  remain metadata placeholders in the editor. Preview CSS accepts safe width and
  height only, with maximum displayed bounds; malformed clipboard styles or
  dimensions cannot crash rendering or introduce remote CSS fetches. Other
  authored image styling remains reader-specific.
- Lists, to-dos, declarations and unusual/opaque structures keep existing
  authoring affordances. The actual reader preview remains available for exact
  performance output and unsupported legacy structures.

## Verification

Affected source/editor/reader/clipboard tests pass, including stable child DOM
and selection through task-property changes and undo, exact semantic round trips,
clipboard schema parity, malformed/unsafe image metadata, retained reader heading
semantics, audience/navigation effects and implicit/explicit footnotes. A graph
regression keeps Tiptap/ProseMirror out of shared reader presentation imports.
TypeScript, production build and Loom check pass; Loom reports only existing
advisory pnpm 11 migration warnings.

A real Chromium synthetic fixture compared the actual reader and creation editor.
Visual text edits, undo and Pug-to-visual synchronisation worked with the shared
cards. At 390px, the page measured 375px and editor 317px: no document horizontal
overflow. Physical mobile keyboards and IME remain unverified. The temporary
fixture and browser tab were removed; the viewport override was reset. No SQL
rows, stored files, private production content or user drafts were changed.
The earlier full local database create/save browser recheck remains separate
from this rendering check because of the previously reported creation-endpoint
issue.

This completes the currently planned core editor work. Future work includes
footnote placement parity, full offline authoring, collaboration and physical
mobile/assistive-technology testing. No deployment or push was performed.

The footnote placement and remaining list/TODO/break presentation follow-up
was completed in [closer ritual WYSIWYG](047-ritual-wysiwyg-completion.md).
