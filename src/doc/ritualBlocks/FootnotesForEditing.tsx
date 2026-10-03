"use client";

import { type Editor, Extension } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { Mark } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import React from "react";
import { parseRitualFileLocator } from "@/files/ritualFileLocator";
import { Render } from "../blocks";
import DocContext from "../context";
import EditorActionButton from "../EditorActionButton";
import { RITUAL_SETTINGS_CHANGE } from "../ritualEditorHistory";
import { registerRitualEditorOwner } from "../ritualEditorOwner";
import {
  type EditorFootnote,
  ritualFootnotesKey,
} from "../ritualFootnotesClient";
import { RITUAL_TASK_DELETED } from "../ritualTaskCommands";
import { semanticToJrt } from "../semantic";
import { semanticFromTiptap } from "../tiptapRitual";
import { ritualTiptapClientExtensions } from "../tiptapRitualClient";
import styles from "./editing.module.css";
import { FootnotesFrame } from "./Frames";
import { editorImageDimension, editorImageStyle } from "./imagePresentation";
import { roles } from "./roles";

/** Never send opaque legacy HTML, arbitrary URLs or unreviewed styling to a reader preview. */
function preview(entry: EditorFootnote) {
  const document = semanticFromTiptap({
    type: "doc",
    content: entry.node.content.toJSON(),
  });
  const vars: Record<string, { value: string }> = {};
  const sanitize = (nodes: typeof document.nodes): typeof document.nodes =>
    nodes.flatMap<(typeof document.nodes)[number]>((node) => {
      if (node.kind === "annotation") return [];
      if (node.kind === "legacy")
        return [
          { kind: "text", text: "Unsupported legacy content · preserved" },
        ];
      if (node.kind === "text") return [node];
      if (node.tag === "var")
        vars[String(node.attrs.name)] = { value: `⁨${String(node.attrs.name)}⁩` };
      if (node.tag === "img") {
        if (!parseRitualFileLocator(node.attrs.src))
          return [
            { kind: "text", text: `Image · ${String(node.attrs.alt ?? "")}` },
          ];
        return [
          {
            ...node,
            attrs: {
              src: node.attrs.src,
              alt: String(node.attrs.alt ?? ""),
              ...(editorImageDimension(node.attrs.width) !== undefined
                ? { width: editorImageDimension(node.attrs.width)! }
                : {}),
              ...(editorImageDimension(node.attrs.height) !== undefined
                ? { height: editorImageDimension(node.attrs.height)! }
                : {}),
              style: JSON.stringify(editorImageStyle(node.attrs.style)),
            },
          },
        ];
      }
      return [
        {
          ...node,
          ...(node.children ? { children: sanitize(node.children) } : {}),
        },
      ];
    });
  return {
    doc: semanticToJrt({ ...document, nodes: sanitize(document.nodes) }),
    vars,
  };
}

function FootnotePreview({ entry }: { entry: EditorFootnote }) {
  const model = React.useMemo(() => {
    try {
      return preview(entry);
    } catch {
      return null;
    }
  }, [entry]);
  return model ? (
    <DocContext.Provider value={{ roles, vars: model.vars }}>
      {/* JRT invokes hookful block renders directly; changed preview structure
          needs a fresh reader component to keep its hook order valid. */}
      <Render
        key={JSON.stringify(entry.node.toJSON())}
        doc={model.doc}
        onChange={undefined}
      />
    </DocContext.Provider>
  ) : (
    <span>Content requires source editing.</span>
  );
}

function locate(editor: Editor, id: string) {
  let found: { node: EditorFootnote["node"]; pos: number } | undefined;
  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.tag === "footnote" && node.attrs.id === id) {
      found = { node, pos };
      return false;
    }
  });
  return found;
}

/** The parent document/history owns every change; this view has no independent draft or undo stack. */
function FootnoteEditor({
  parent,
  entry,
  number,
}: {
  parent: Editor;
  entry: EditorFootnote;
  number: number;
}) {
  const id = String(entry.node.attrs.id);
  const bridging = React.useRef(false);
  const extensions = React.useMemo(
    () => [
      ...ritualTiptapClientExtensions.map((extension) =>
        extension.name === "starterKit"
          ? extension.configure({ undoRedo: false })
          : extension,
      ),
      Extension.create({
        name: "parentFootnoteHistory",
        priority: 1000,
        addKeyboardShortcuts: () => ({
          "Mod-z": () => parent.commands.undo(),
          "Shift-Mod-z": () => parent.commands.redo(),
          "Mod-y": () => parent.commands.redo(),
        }),
      }),
    ],
    [parent],
  );
  const mirrorSelection = React.useCallback(
    (inner: Editor) => {
      if (bridging.current) return;
      const current = locate(parent, id);
      if (!current || parent.isDestroyed || !current.node.content.size) return;
      const offset = current.pos + 1;
      const selection =
        inner.state.selection instanceof NodeSelection
          ? NodeSelection.create(
              parent.state.doc,
              offset + inner.state.selection.from,
            )
          : TextSelection.create(
              parent.state.doc,
              offset + inner.state.selection.anchor,
              offset + inner.state.selection.head,
            );
      const marks =
        inner.state.storedMarks?.map((mark) =>
          parent.schema.markFromJSON(mark.toJSON()),
        ) ?? null;
      if (
        parent.state.selection.eq(selection) &&
        (parent.state.storedMarks === null) === (marks === null) &&
        Mark.sameSet(parent.state.storedMarks ?? [], marks ?? [])
      )
        return;
      parent.view.dispatch(
        parent.state.tr
          .setSelection(selection)
          .setStoredMarks(marks)
          .setMeta("addToHistory", false),
      );
    },
    [parent, id],
  );
  const inner = useEditor({
    extensions,
    immediatelyRender: false,
    content: { type: "doc", content: entry.node.content.toJSON() },
    editable: parent.isEditable,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": `Footnote ${number} editor`,
        "aria-multiline": "true",
      },
    },
    onSelectionUpdate: ({ editor, transaction }) => {
      // A text transaction has not reached onUpdate yet. Do not let a selection
      // mirror pull the parent's older content back into this view mid-dispatch.
      if (!transaction.docChanged) mirrorSelection(editor);
    },
    onTransaction: ({ editor, transaction }) => {
      if (!transaction.docChanged && transaction.storedMarksSet)
        mirrorSelection(editor);
    },
    onUpdate: ({ editor, transaction }) => {
      if (bridging.current) return;
      const current = locate(parent, id);
      if (!current) return;
      if (!parent.isEditable) {
        bridging.current = true;
        try {
          editor.commands.setContent(
            { type: "doc", content: current.node.content.toJSON() },
            { emitUpdate: false },
          );
        } finally {
          bridging.current = false;
        }
        return;
      }
      // Each editor has its own NodeType identities, even with equal schemas.
      // Convert through the parent's schema before diffing or replacing content.
      const proposed = parent.schema.nodeFromJSON(editor.getJSON());
      const start = current.node.content.findDiffStart(proposed.content);
      if (start == null) return;
      const end = current.node.content.findDiffEnd(proposed.content)!;
      const overlap = start - Math.min(end.a, end.b);
      if (overlap > 0) {
        end.a += overlap;
        end.b += overlap;
      }
      const offset = current.pos + 1;
      const tr = parent.state.tr.replaceRange(
        offset + start,
        offset + end.a,
        proposed.slice(start, end.b),
      );
      tr.setSelection(
        editor.state.selection instanceof NodeSelection
          ? NodeSelection.create(tr.doc, offset + editor.state.selection.from)
          : TextSelection.create(
              tr.doc,
              offset + editor.state.selection.anchor,
              offset + editor.state.selection.head,
            ),
      );
      tr.setStoredMarks(
        editor.state.storedMarks?.map((mark) =>
          parent.schema.markFromJSON(mark.toJSON()),
        ) ?? null,
      );
      if (transaction.getMeta(RITUAL_SETTINGS_CHANGE)) {
        parent.view.dispatch(
          closeHistory(tr)
            .setMeta(RITUAL_SETTINGS_CHANGE, true)
            .setMeta(
              RITUAL_TASK_DELETED,
              transaction.getMeta(RITUAL_TASK_DELETED),
            ),
        );
        parent.view.dispatch(
          closeHistory(parent.state.tr).setMeta("addToHistory", false),
        );
      } else parent.view.dispatch(tr);
    },
  });
  React.useEffect(() => {
    if (inner) return registerRitualEditorOwner(inner, parent);
  }, [inner, parent]);
  React.useEffect(() => {
    if (!inner) return;
    let synchronizing = false;
    const sync = () => {
      if (synchronizing || inner.isDestroyed || parent.isDestroyed) return;
      const current = locate(parent, id);
      if (!current) {
        inner.setEditable(false, false);
        return;
      }
      synchronizing = true;
      bridging.current = true;
      try {
        inner.setEditable(parent.isEditable, false);
        const projection = inner.schema.nodeFromJSON({
          type: "doc",
          content: current.node.content.toJSON(),
        });
        const start = projection.content.findDiffStart(inner.state.doc.content);
        if (start != null)
          inner.commands.setContent(
            { type: "doc", content: current.node.content.toJSON() },
            { emitUpdate: false },
          );
        const { from, to } = parent.state.selection;
        const offset = current.pos + 1;
        if (from >= offset && to <= current.pos + current.node.nodeSize - 1) {
          inner.view.dispatch(
            inner.state.tr
              .setSelection(
                parent.state.selection instanceof NodeSelection
                  ? NodeSelection.create(inner.state.doc, from - offset)
                  : TextSelection.create(
                      inner.state.doc,
                      parent.state.selection.anchor - offset,
                      parent.state.selection.head - offset,
                    ),
              )
              .setStoredMarks(
                parent.state.storedMarks?.map((mark) =>
                  inner.schema.markFromJSON(mark.toJSON()),
                ) ?? null,
              )
              .setMeta("addToHistory", false),
          );
          if (parent.view.hasFocus()) inner.view.focus();
        }
      } finally {
        synchronizing = false;
        bridging.current = false;
      }
    };
    parent.on("transaction", sync);
    parent.on("update", sync);
    parent.on("focus", sync);
    // The inner root requires a paragraph. Materialize its empty slot in the
    // parent too, so a first caret/toolbar mark has a real canonical position.
    // Empty paragraphs disappear from semantic JSON; this creates no source edit.
    const current = locate(parent, id);
    if (parent.isEditable && current && !current.node.content.size)
      parent.view.dispatch(
        parent.state.tr
          .insert(current.pos + 1, parent.schema.nodes.paragraph.create())
          .setMeta("addToHistory", false),
      );
    sync();
    if (parent.isEditable) {
      inner.view.focus();
      mirrorSelection(inner);
    }
    return () => {
      parent.off("transaction", sync);
      parent.off("update", sync);
      parent.off("focus", sync);
    };
  }, [parent, inner, id, mirrorSelection]);
  return (
    <div className={styles.footnoteEditor}>
      <EditorContent editor={inner} />
    </div>
  );
}

/** Collected bodies are lazy editor views of the original, unmoved footnote nodes. */
export function FootnotesForEditing({
  editor,
  host,
}: {
  editor: Editor;
  host: number;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const entries =
        ritualFootnotesKey.getState(current.state)?.collections.get(host) ?? [];
      const selection = current.state.selection;
      const active = entries.find(
        (entry) =>
          selection.from >= entry.pos &&
          selection.to <= entry.pos + entry.node.nodeSize,
      );
      return {
        entries,
        activeId: active?.node.attrs.id,
        isEditable: current.isEditable,
      };
    },
  });
  if (!state.entries.length)
    return (
      <div data-footnote-footer contentEditable={false}>
        <FootnotesFrame editing>
          <li>No preceding footnotes.</li>
        </FootnotesFrame>
      </div>
    );
  return (
    <div data-footnote-footer contentEditable={false}>
      <FootnotesFrame editing>
        {state.entries.map((entry, index) => (
          <li key={entry.node.attrs.id}>
            {state.activeId === entry.node.attrs.id ? (
              <FootnoteEditor
                parent={editor}
                entry={entry}
                number={index + 1}
              />
            ) : (
              <>
                <div className={styles.footnotePreview}>
                  <FootnotePreview entry={entry} />
                </div>
                <EditorActionButton
                  size="small"
                  inactive={!state.isEditable}
                  inactiveReason="The visual panel is catching up with ritual source."
                  onClick={() => {
                    if (editor.isEditable)
                      editor.commands.setNodeSelection(entry.pos);
                  }}
                >
                  Edit footnote {index + 1}
                </EditorActionButton>
              </>
            )}
          </li>
        ))}
      </FootnotesFrame>
    </div>
  );
}
