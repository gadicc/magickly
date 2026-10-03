"use client";

import { type Editor, Extension } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { roles } from "./ritualBlocks/roles";
import { RITUAL_SETTINGS_CHANGE } from "./ritualEditorHistory";
import { ritualEditorOwner } from "./ritualEditorOwner";
import { ritualRoleCatalog } from "./ritualRoleCatalog";
import { roleAliases } from "./ritualRoles";
import styles from "./ritualSlashCommands.module.css";
import { ritualTaskContent } from "./ritualTaskCommands";

type Mode = "say" | "do";
type Choice = { label: string; mode: Mode; role?: string; search: string };
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

function permitted(editor: Editor) {
  return (
    !editor.isDestroyed &&
    editor.isEditable &&
    ritualEditorOwner(editor).isEditable &&
    !editor.view.composing
  );
}

function choices(editor: Editor): Choice[] {
  if (!permitted(editor) || !insertion(editor)) return [];
  const p = paragraph(editor)!;
  if (key.getState(editor.state)?.dismissed === p.pos) return [];
  const match = /^\/(say|do)\s+([^\s]*)$/i.exec(p.text);
  if (match) {
    const mode = match[1].toLowerCase() as Mode;
    const query = match[2].toLowerCase();
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
  if (!/^\/[a-z]*$/i.test(p.text)) return [];
  const query = p.text.slice(1).toLowerCase();
  return (
    [
      { mode: "say", label: "Say · Speech", search: "say speech" },
      { mode: "do", label: "Do · Action", search: "do action" },
    ] satisfies Choice[]
  ).filter((choice) => choice.search.includes(query));
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

function convert(editor: Editor, mode: Mode, role: string) {
  if (!permitted(editor)) return false;
  const target = insertion(editor);
  const content = ritualTaskContent(mode, role);
  if (!target || !content) return false;
  const task = editor.schema.nodeFromJSON(content);
  const { pos, $from } = target.paragraph;
  const tr = closeHistory(editor.state.tr);
  let at = pos;
  if (target.sibling !== null) {
    tr.delete(pos, pos + $from.parent.nodeSize);
    at = tr.mapping.map(target.sibling);
    tr.insert(at, task);
  } else tr.replaceWith(pos, pos + $from.parent.nodeSize, task);
  tr.setSelection(TextSelection.create(tr.doc, at + 2));
  editor.view.dispatch(tr.setMeta(RITUAL_SETTINGS_CHANGE, true));
  editor.view.dispatch(
    closeHistory(editor.state.tr)
      .setMeta("addToHistory", false)
      .setMeta(key, {
        restore: { ownerDoc: ritualEditorOwner(editor).state.doc },
      }),
  );
  return true;
}

function choose(editor: Editor, choice: Choice) {
  if (!permitted(editor)) return;
  const p = paragraph(editor);
  if (
    !p ||
    !choices(editor).some(
      (item) => item.mode === choice.mode && item.role === choice.role,
    )
  )
    return;
  if (choice.role) convert(editor, choice.mode, choice.role);
  else
    editor.view.dispatch(
      editor.state.tr.insertText(
        `/${choice.mode} `,
        p.pos + 1,
        editor.state.selection.from,
      ),
    );
  editor.view.focus();
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
              state.restore &&
              state.restore.ownerDoc === ritualEditorOwner(editor).state.doc
            ) {
              return ritualEditorOwner(editor).commands.undo();
            }
            const list = choices(editor);
            if (!list.length) return false;
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
              option.textContent = choice.label;
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
              menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 280))}px`;
              menu.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 260))}px`;
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
