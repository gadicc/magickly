# Visual task settings — 3 October 2026

## Editing

Speech/action cards expose a settings cog on hover and keyboard focus, with a
quiet persistent cog on devices without hover. The toolbar’s Edit properties
opens the same form for the selected task.

The popover edits Say / Speech or Do / Action, and assignments to selected
roles, Everyone, or All officers. Specific assignments select included roles;
group assignments select optional exceptions. Search includes standard full
names and aliases, ritual-declared `myRole` option labels, roles used elsewhere
in the ritual, and custom keys. Keys use letters/numbers and begin with a
letter. `all` is reserved for Everyone. Custom keys remain case-sensitive;
existing keys and alias spelling are preserved when other roles are added.

Apply changes role and type in one undo step, retaining the task ID, body and
selection. Cancel and unchanged Apply produce no document/history edits.
Changes follow a task by ID if its position moves; conflicting settings require
reopening the form. Deleted or read-only targets close the form. Source syncing
also closes toolbar settings. The usual source-only structure guard remains.

## Reader and footnotes

Group headings display readable names and exclusions; selected roles use
commas/“and”. Alias matching applies to both the reader’s selected role and task
expression. The existing All officers contract excludes Candidate and Member
only, so Aspirant and custom roles remain officers. Pug keeps its existing
comma-separated expression syntax, semantic JSON and server schema.

Collected footnote tasks discover roles in the canonical ritual. Their settings
metadata crosses the projection bridge so canonical undo separates settings
from prior typing. The parent document owns history and saving. Reader frames
receive a generic header-actions slot and import no Tiptap/ProseMirror code.

## Verification

- Regression tests cover role grammar, aliases, reader membership, picker
  labels/custom input, case-sensitive collisions, reserved groups, Apply/Cancel,
  body/ID/selection preservation, independent typing/settings undo, nested
  footnotes, stale/deleted targets, and source/read-only portal closure.
- A synthetic local browser journey verified root Apply/source/Undo, declared
  roles in footnotes, pending custom input on Apply, keyboard cog/Return/Escape,
  and the popover at a 390px viewport. No ritual database writes or uploads.
  The temporary route and browser tab were removed.
- Independent GPT-6.1 Sol xhigh and final GPT-6 Astra xhigh reviews completed;
  their concrete findings were fixed and retested. 753 document, semantic-editor
  and attachment-presentation tests pass; 14 existing opt-in tests are skipped.
  Production build/TypeScript and Loom check pass.
  Loom’s pnpm 11 migration warnings remain advisory.

Physical mobile keyboards/IME and screen-reader testing remain follow-up work.
No migration, dependency upgrade, push or deployment is part of this change.
