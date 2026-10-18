"use client";

import { HALL_PRESETS, hallPreset } from "@magick-components/gd/hall/presets";
import { type Editor, Extension } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import type { Node } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  caretAfterGdHall,
  gdHallPresetAtom,
  gdHallPresetGrade,
  holdsGdHall,
} from "./gdHallInsert";
import { roles } from "./ritualBlocks/roles";
import { RITUAL_SETTINGS_CHANGE } from "./ritualEditorHistory";
import { ritualEditorOwner } from "./ritualEditorOwner";
import { createRitualNodeId } from "./ritualNodeIds";
import { ritualRoleCatalog } from "./ritualRoleCatalog";
import { roleAliases } from "./ritualRoles";
import styles from "./ritualSlashCommands.module.css";
import { ritualTaskContent } from "./ritualTaskCommands";

type Mode = "say" | "do";
type Block = "note" | "title" | "gdHall";
type Choice = {
  label: string;
  search: string;
  description?: string;
  mode?: Mode;
  role?: string;
  block?: Block;
  /** A hall preset's id: the choice inserts a copy of it. */
  preset?: string;
};

/**
 * Every visual slash command. The menu, its search and the empty-line hint
 * all read this list, so a new command needs only an entry here (and, for a
 * new kind of block, its conversion below). A command without a `hint` is
 * offered in the menu but left out of the hint, which names the everyday
 * ones.
 */
export const RITUAL_SLASH_COMMANDS: readonly (Choice & { hint?: string })[] = [
  {
    mode: "say",
    label: "Say · Speech",
    hint: "speech",
    description: "A role speaks; pick the role next",
    search: "say speech",
  },
  {
    mode: "do",
    label: "Do · Action",
    hint: "action",
    description: "A role acts; pick the role next",
    search: "do action",
  },
  {
    block: "note",
    label: "Note",
    hint: "note",
    description: "A note set apart for readers",
    search: "note",
  },
  {
    block: "title",
    label: "Section title",
    hint: "section title",
    description: "A heading that starts a section",
    search: "title section heading",
  },
  {
    // Halls are rare beside speech and action, so the hint leaves them out.
    block: "gdHall",
    label: "Temple hall",
    description: "A Golden Dawn temple floor plan; pick the grade next",
    search: "temple hall floor plan diagram",
  },
];
const hintFor = (commands: readonly { hint?: string }[]) => {
  const hints = commands.flatMap((command) =>
    command.hint ? [command.hint] : [],
  );
  return `Type / for ${hints.slice(0, -1).join(", ")} or ${hints.at(-1)}`;
};
/** Shown in an empty top-level line, where every slash command works. */
export const RITUAL_SLASH_HINT = hintFor(RITUAL_SLASH_COMMANDS);

/**
 * Blocks only go where the parent editor owns them (not in collected
 * footnotes), and a section title only at the top level of the ritual.
 */
function blockAllowed(editor: Editor, block: Block) {
  if (ritualEditorOwner(editor) !== editor) return false;
  if (block === "gdHall") return !!hallInsertion(editor);
  if (!insertion(editor)) return false;
  if (block !== "title") return true;
  const { $from } = editor.state.selection;
  return (
    $from.depth === 1 ||
    ($from.depth === 2 && $from.node(1).type.name === "ritualTask")
  );
}
const available = (editor: Editor) =>
  RITUAL_SLASH_COMMANDS.filter((command) =>
    command.block ? blockAllowed(editor, command.block) : !!insertion(editor),
  );
type Snapshot = { ownerDoc: Node };
type CommandState = {
  dismissed: number | null;
  index: number;
  restore: Snapshot | null;
};
/** State key for the visual command menu and immediate conversion reversal. */
export const ritualSlashCommandsKey = new PluginKey<CommandState>(
  "ritualSlashCommands",
);
const key = ritualSlashCommandsKey;
let menuNumber = 0;

function paragraph(editor: Editor) {
  const { selection } = editor.state;
  const { $from } = selection;
  if (
    !selection.empty ||
    $from.parent.type.name !== "paragraph" ||
    $from.parentOffset !== $from.parent.content.size ||
    $from.parent.childCount > 1 ||
    ($from.parent.firstChild && !$from.parent.firstChild.isText) ||
    $from.parent.firstChild?.marks.length
  )
    return null;
  return { pos: $from.before(), text: $from.parent.textContent, $from };
}

// A trailing direct task paragraph can become a sibling. Never split a task,
// lift a list/note, or introduce a task anywhere inside another task.
function insertion(editor: Editor) {
  const p = paragraph(editor);
  if (!p) return null;
  const owner = ritualEditorOwner(editor);
  if (owner !== editor) {
    const parent = owner.state.selection.$from;
    let boundary = parent.depth + 1;
    for (let d = 1; d <= parent.depth; d++)
      if (parent.node(d).attrs.tag === "footnote") boundary = d;
    for (let d = 1; d < boundary; d++)
      if (
        parent.node(d).type.name === "ritualTask" ||
        ["ul", "ol", "li"].includes(parent.node(d).attrs.tag)
      )
        return null;
  }
  const depth = p.$from.depth;
  for (let d = 1; d < depth; d++)
    if (["ul", "ol", "li"].includes(p.$from.node(d).attrs.tag)) return null;
  let taskDepth = 0;
  for (let d = 1; d < depth; d++) {
    if (p.$from.node(d).type.name === "ritualTask") {
      if (taskDepth) return null;
      taskDepth = d;
    }
  }
  if (taskDepth) {
    if (
      depth !== taskDepth + 1 ||
      p.$from.index(taskDepth) !== p.$from.node(taskDepth).childCount - 1
    )
      return null;
    const host = p.$from.node(taskDepth - 1);
    const index = p.$from.index(taskDepth - 1) + 1;
    if (!host.canReplaceWith(index, index, editor.schema.nodes.ritualTask))
      return null;
    return { paragraph: p, sibling: p.$from.after(taskDepth) };
  }
  const host = p.$from.node(depth - 1);
  const index = p.$from.index(depth - 1);
  if (!host.canReplaceWith(index, index + 1, editor.schema.nodes.ritualTask))
    return null;
  return { paragraph: p, sibling: null };
}

/**
 * Where a hall replaces the command paragraph: in place when a hall may
 * stand in the paragraph's container (the top level, a note, summary,
 * list item or todo); as a sibling after a task when the command is the
 * task's last paragraph and the task's own container may hold a hall, as
 * Speech and Action do. Nowhere else (a title, a list itself, a
 * footnote, an earlier task paragraph): the command is not offered, so it
 * can never produce a hall the validator refuses.
 */
function hallInsertion(editor: Editor) {
  if (ritualEditorOwner(editor) !== editor) return null;
  const p = paragraph(editor);
  if (!p) return null;
  const depth = p.$from.depth;
  const host = p.$from.node(depth - 1);
  if (holdsGdHall(host)) return { paragraph: p, sibling: null };
  if (
    host.type.name !== "ritualTask" ||
    depth < 2 ||
    p.$from.index(depth - 1) !== host.childCount - 1 ||
    !holdsGdHall(p.$from.node(depth - 2))
  )
    return null;
  return { paragraph: p, sibling: p.$from.after(depth - 1) };
}

/** Presets matching a query, by title, grade or id. */
function presetChoices(query: string, described: boolean): Choice[] {
  const wanted = query.trim().toLowerCase();
  return HALL_PRESETS.filter((preset) =>
    `${preset.title} ${preset.grade} ${preset.id}`
      .toLowerCase()
      .includes(wanted),
  ).map((preset) => ({
    preset: preset.id,
    label: preset.title,
    description: described
      ? `Temple hall · ${gdHallPresetGrade(preset)}`
      : gdHallPresetGrade(preset),
    search: preset.id,
  }));
}

function permitted(editor: Editor) {
  return (
    !editor.isDestroyed &&
    editor.isEditable &&
    ritualEditorOwner(editor).isEditable &&
    !editor.view.composing
  );
}

function roleChoices(editor: Editor, mode: Mode, query: string): Choice[] {
  const catalog = new Map([
    ["all", "Everyone"],
    ["all-officers", "All officers"],
    ...[...ritualRoleCatalog(editor)].filter(
      ([role]) => role !== "all" && role !== "all-officers",
    ),
  ]);
  return [...catalog]
    .map(([role, label]) => ({
      mode,
      role,
      label,
      search: [
        role,
        label,
        ...Object.keys(roleAliases).filter(
          (alias) => roleAliases[alias] === role,
        ),
      ].join(" "),
    }))
    .filter((choice) => choice.search.toLowerCase().includes(query));
}

function choices(editor: Editor): Choice[] {
  if (!permitted(editor)) return [];
  const tasks = !!insertion(editor);
  const halls = !!hallInsertion(editor);
  if (!tasks && !halls) return [];
  const p = paragraph(editor)!;
  if (key.getState(editor.state)?.dismissed === p.pos) return [];
  const hall = /^\/hall\s(.*)$/i.exec(p.text);
  if (hall) return halls ? presetChoices(hall[1], false) : [];
  const match = /^\/(say|do)\s+([^\s]*)$/i.exec(p.text);
  if (match)
    return tasks
      ? roleChoices(
          editor,
          match[1].toLowerCase() as Mode,
          match[2].toLowerCase(),
        )
      : [];
  if (!/^\/[a-z0-9-]*$/i.test(p.text)) return [];
  const query = p.text.slice(1).toLowerCase();
  const commands = available(editor)
    .filter((command) => command.search.includes(query))
    .map(({ hint: _hint, ...choice }) => choice);
  // A role or a hall typed first (`/ker`, `/zel`) offers that role as
  // Speech and Action, or that hall. One letter that already matches a
  // command would list half the catalog.
  if (!query || (query.length < 2 && commands.length)) return commands;
  return [
    ...commands,
    ...(halls ? presetChoices(query, true) : []),
    ...(tasks ? roleChoices(editor, "say", query) : [])
      // Names that start with the query outrank names that merely contain it.
      .sort(
        (a, b) =>
          Number(!a.label.toLowerCase().startsWith(query)) -
          Number(!b.label.toLowerCase().startsWith(query)),
      )
      .slice(0, 5)
      .flatMap((choice) => [
        { ...choice, label: `${choice.label} · Speech` },
        { ...choice, mode: "do" as const, label: `${choice.label} · Action` },
      ]),
  ];
}

function resolveRole(editor: Editor, input: string): string | null {
  const catalog = ritualRoleCatalog(editor);
  // Exact custom identities take precedence over case-insensitive standard aliases.
  if (catalog.has(input)) return input;
  if (input === "all" || input === "all-officers") return input;
  const standard = Object.keys(roles).filter(
    (role) => role.toLowerCase() === input.toLowerCase(),
  );
  return standard.length === 1
    ? (roleAliases[standard[0]] ?? standard[0])
    : null;
}

/**
 * Replace the command paragraph (or a trailing task paragraph) with `node`
 * and place the selection: by default the caret in its first paragraph,
 * with `selectLength` characters selected.
 */
function replaceCommand(
  editor: Editor,
  target: {
    paragraph: NonNullable<ReturnType<typeof paragraph>>;
    sibling: number | null;
  },
  node: Node,
  selectLength = 0,
  place = (tr: Transaction, at: number) =>
    tr.setSelection(
      TextSelection.create(tr.doc, at + 2, at + 2 + selectLength),
    ),
) {
  const { pos, $from } = target.paragraph;
  const tr = closeHistory(editor.state.tr);
  let at = pos;
  if (target.sibling !== null) {
    tr.delete(pos, pos + $from.parent.nodeSize);
    at = tr.mapping.map(target.sibling);
    tr.insert(at, node);
  } else tr.replaceWith(pos, pos + $from.parent.nodeSize, node);
  place(tr, at);
  editor.view.dispatch(tr.setMeta(RITUAL_SETTINGS_CHANGE, true));
  editor.view.dispatch(
    closeHistory(editor.state.tr)
      .setMeta("addToHistory", false)
      .setMeta(key, {
        restore: { ownerDoc: ritualEditorOwner(editor).state.doc },
      }),
  );
}

function convertBlock(editor: Editor, block: Block) {
  if (!permitted(editor) || !blockAllowed(editor, block)) return false;
  const target = insertion(editor);
  if (!target) return false;
  // A title needs text: select a placeholder that typing replaces.
  const text = block === "title" ? "Section title" : "";
  replaceCommand(
    editor,
    target,
    editor.schema.nodeFromJSON({
      type: "ritualBlock",
      attrs: {
        id: createRitualNodeId(),
        tag: block,
        attrs: text ? { text } : {},
      },
      content: [
        {
          type: "paragraph",
          ...(text ? { content: [{ type: "text", text }] } : {}),
        },
      ],
    }),
    text.length,
  );
  return true;
}

/** Replace the command paragraph with a copy of a preset; the caret follows it. */
function convertHall(editor: Editor, id: string) {
  if (!permitted(editor)) return false;
  const target = hallInsertion(editor);
  const preset = hallPreset(id);
  if (!target || !preset) return false;
  replaceCommand(
    editor,
    target,
    editor.schema.nodeFromJSON(gdHallPresetAtom(preset)),
    0,
    caretAfterGdHall,
  );
  return true;
}

function convert(editor: Editor, mode: Mode, role: string) {
  if (!permitted(editor)) return false;
  const target = insertion(editor);
  const content = ritualTaskContent(mode, role);
  if (!target || !content) return false;
  replaceCommand(editor, target, editor.schema.nodeFromJSON(content));
  return true;
}

function choose(editor: Editor, choice: Choice) {
  if (!permitted(editor)) return;
  const p = paragraph(editor);
  if (
    !p ||
    !choices(editor).some(
      (item) =>
        item.mode === choice.mode &&
        item.role === choice.role &&
        item.block === choice.block &&
        item.preset === choice.preset,
    )
  )
    return;
  if (choice.preset) convertHall(editor, choice.preset);
  // Halls come in several presets: list them next, as roles follow Speech.
  else if (choice.block === "gdHall")
    editor.view.dispatch(
      editor.state.tr.insertText(
        "/hall ",
        p.pos + 1,
        editor.state.selection.from,
      ),
    );
  else if (choice.block) convertBlock(editor, choice.block);
  else if (choice.mode && choice.role)
    convert(editor, choice.mode, choice.role);
  else if (choice.mode)
    editor.view.dispatch(
      editor.state.tr.insertText(
        `/${choice.mode} `,
        p.pos + 1,
        editor.state.selection.from,
      ),
    );
  editor.view.focus();
}

/** The empty paragraph that should show the slash hint, if the caret is in one. */
function hintPosition(editor: Editor, state: Editor["state"]): number | null {
  const { selection } = state;
  const { $from } = selection;
  if (
    !selection.empty ||
    editor.isDestroyed ||
    !editor.isEditable ||
    $from.parent.type.name !== "paragraph" ||
    $from.parent.content.size
  )
    return null;
  // An empty task body already shows its own speech/action hint.
  const parent = $from.depth > 1 ? $from.node($from.depth - 1) : null;
  if (parent?.type.name === "ritualTask" && parent.childCount === 1)
    return null;
  return insertion(editor) ? $from.before() : null;
}

/**
 * Enter on an empty last paragraph of a task leaves the task, as Enter on an
 * empty list item leaves a list: the paragraph moves after the task, where
 * the slash hint offers the next speech or action.
 */
function leaveTask(editor: Editor) {
  if (!permitted(editor) || ritualEditorOwner(editor) !== editor) return false;
  const { selection } = editor.state;
  const { $from } = selection;
  const depth = $from.depth;
  if (
    !selection.empty ||
    depth < 2 ||
    $from.parent.type.name !== "paragraph" ||
    $from.parent.content.size
  )
    return false;
  const task = $from.node(depth - 1);
  if (
    task.type.name !== "ritualTask" ||
    task.childCount < 2 ||
    $from.index(depth - 1) !== task.childCount - 1
  )
    return false;
  const host = $from.node(depth - 2);
  const index = $from.index(depth - 2) + 1;
  if (!host.canReplaceWith(index, index, editor.schema.nodes.paragraph))
    return false;
  const tr = editor.state.tr;
  const after = $from.after(depth - 1);
  tr.delete($from.before(), $from.after());
  const at = tr.mapping.map(after);
  tr.insert(at, editor.schema.nodes.paragraph.create());
  tr.setSelection(TextSelection.create(tr.doc, at + 1));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Visual-only task commands; normal source/JSON contain ordinary semantic tasks. */
export const RitualSlashCommands = Extension.create({
  name: "ritualSlashCommands",
  priority: 1100,
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin<CommandState>({
        key,
        state: {
          init: () => ({ dismissed: null, index: 0, restore: null }),
          apply(tr, previous, oldState) {
            const meta = tr.getMeta(key);
            const p = tr.selection.$from;
            const same =
              p.depth > 0 &&
              p.parent.type.name === "paragraph" &&
              p.before() === previous.dismissed;
            return {
              dismissed: meta?.dismissed ?? (same ? previous.dismissed : null),
              index:
                meta?.index ??
                (tr.docChanged || tr.selectionSet ? 0 : previous.index),
              restore:
                meta?.restore ??
                (tr.docChanged ||
                (tr.selectionSet && !tr.selection.eq(oldState.selection))
                  ? null
                  : previous.restore),
            };
          },
        },
        props: {
          decorations(state) {
            const at = hintPosition(editor, state);
            if (at === null) return null;
            const node = state.doc.nodeAt(at);
            if (!node) return null;
            return DecorationSet.create(state.doc, [
              Decoration.node(at, at + node.nodeSize, {
                class: styles.hint,
                "data-hint": hintFor(available(editor)),
              }),
            ]);
          },
          handleTextInput(view, from, to, text) {
            if (
              text !== " " ||
              from !== to ||
              from !== view.state.selection.from ||
              !permitted(editor) ||
              key.getState(view.state)?.dismissed === paragraph(editor)?.pos
            )
              return false;
            const p = paragraph(editor);
            const match =
              p && /^\/(say|do) ([A-Za-z][A-Za-z0-9-]*)$/i.exec(p.text);
            if (!match || !insertion(editor)) return false;
            const role = resolveRole(editor, match[2]);
            if (!role) return false;
            // Insert the triggering space first: ordinary Undo restores the complete literal command.
            view.dispatch(view.state.tr.insertText(text, from, to));
            convert(editor, match[1].toLowerCase() as Mode, role);
            return true;
          },
          handleKeyDown(view, event) {
            if (
              !permitted(editor) ||
              event.isComposing ||
              event.ctrlKey ||
              event.metaKey ||
              event.altKey
            )
              return false;
            const state = key.getState(view.state)!;
            if (
              event.key === "Backspace" &&
              // A selected title placeholder is cleared, not the command undone.
              view.state.selection.empty &&
              state.restore &&
              state.restore.ownerDoc === ritualEditorOwner(editor).state.doc
            ) {
              return ritualEditorOwner(editor).commands.undo();
            }
            const list = choices(editor);
            if (!list.length)
              return event.key === "Enter" && !event.shiftKey
                ? leaveTask(editor)
                : false;
            if (event.key === "Escape") {
              view.dispatch(
                view.state.tr.setMeta(key, {
                  dismissed: paragraph(editor)!.pos,
                }),
              );
              return true;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              view.dispatch(
                view.state.tr.setMeta(key, {
                  index:
                    (state.index +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      list.length) %
                    list.length,
                }),
              );
              return true;
            }
            if (event.key === "Enter") {
              choose(editor, list[Math.min(state.index, list.length - 1)]);
              return true;
            }
            return false;
          },
        },
        view(view) {
          const menu = document.createElement("div");
          menu.id = `ritual-slash-${++menuNumber}`;
          menu.className = styles.menu;
          menu.setAttribute("role", "listbox");
          menu.setAttribute("aria-label", "Ritual commands and roles");
          document.body.append(menu);
          const update = () => {
            if (view.isDestroyed || editor.isDestroyed) return;
            const list = view.hasFocus() ? choices(editor) : [];
            menu.hidden = !list.length;
            view.dom.removeAttribute("aria-activedescendant");
            view.dom.removeAttribute("aria-controls");
            menu.replaceChildren();
            if (!list.length) return;
            const index = Math.min(
              key.getState(view.state)!.index,
              list.length - 1,
            );
            list.forEach((choice, i) => {
              const option = document.createElement("div");
              option.id = `${menu.id}-${i}`;
              option.setAttribute("role", "option");
              option.setAttribute("aria-selected", String(i === index));
              const label = document.createElement("span");
              label.className = styles.label;
              label.textContent = choice.label;
              option.append(label);
              if (choice.description) {
                const description = document.createElement("span");
                description.className = styles.description;
                description.textContent = choice.description;
                option.append(description);
              }
              option.addEventListener("pointerdown", (event) =>
                event.preventDefault(),
              );
              option.addEventListener("click", () => choose(editor, choice));
              menu.append(option);
            });
            view.dom.setAttribute("aria-controls", menu.id);
            view.dom.setAttribute(
              "aria-activedescendant",
              `${menu.id}-${index}`,
            );
            try {
              const rect = view.coordsAtPos(view.state.selection.from);
              // The visual viewport excludes an on-screen keyboard and may be
              // scrolled within the layout viewport the caret is measured in.
              const visual = window.visualViewport;
              const top = visual?.offsetTop ?? 0;
              const viewport = top + (visual?.height ?? window.innerHeight);
              menu.style.maxHeight = "";
              const { offsetWidth: width, offsetHeight: natural } = menu;
              menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
              // Below the line when it fits, otherwise above it; when neither
              // fits, the roomier side with a shorter, scrolling list. Never
              // over the line itself.
              const roomBelow = viewport - 8 - (rect.bottom + 4);
              const roomAbove = rect.top - 4 - 8 - top;
              const below =
                natural <= roomBelow ||
                (natural > roomAbove && roomBelow >= roomAbove);
              const height = Math.min(natural, below ? roomBelow : roomAbove);
              if (height < natural) menu.style.maxHeight = `${height}px`;
              menu.style.top = `${below ? rect.bottom + 4 : rect.top - 4 - height}px`;
            } catch {
              menu.hidden = true;
            }
            const active = menu.children[index] as HTMLElement;
            menu.scrollTop = Math.max(
              0,
              active.offsetTop - menu.clientHeight + active.offsetHeight,
            );
          };
          // Scrolling the suggestion list must not rebuild it and reset its scroll position.
          const reposition = (event: Event) => {
            if (
              event.target instanceof globalThis.Node &&
              menu.contains(event.target)
            )
              return;
            update();
          };
          const focus = () => queueMicrotask(update);
          view.dom.addEventListener("focus", focus);
          view.dom.addEventListener("blur", focus);
          view.dom.addEventListener("compositionstart", focus);
          view.dom.addEventListener("compositionend", focus);
          window.addEventListener("resize", update);
          window.addEventListener("scroll", reposition, true);
          update();
          return {
            update,
            destroy() {
              menu.remove();
              view.dom.removeAttribute("aria-controls");
              view.dom.removeAttribute("aria-activedescendant");
              for (const event of [
                "focus",
                "blur",
                "compositionstart",
                "compositionend",
              ])
                view.dom.removeEventListener(event, focus);
              window.removeEventListener("resize", update);
              window.removeEventListener("scroll", reposition, true);
            },
          };
        },
      }),
    ];
  },
});
