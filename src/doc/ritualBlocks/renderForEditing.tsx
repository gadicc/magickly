"use client";

import type { NodeViewProps } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import {
  NodeViewContent,
  NodeViewWrapper,
  useEditorState,
} from "@tiptap/react";
import { useMemo } from "react";
import { parseRitualFileLocator } from "@/files/ritualFileLocator";
import { gdHallRow } from "../gdHallRows";
import { ritualEditorOwner } from "../ritualEditorOwner";
import { ritualFootnotesKey } from "../ritualFootnotesClient";
import { TaskSettingsTrigger } from "../TaskSettings";
import styles from "./editing.module.css";
import { FootnotesForEditing } from "./FootnotesForEditing";
import {
  FootnoteReferenceFrame,
  GradeFrame,
  ImageFrame,
  ListFrame,
  ListItemFrame,
  NoteFrame,
  SummaryFrame,
  TaskBody,
  TaskFrame,
  TitleFrame,
  TodoFrame,
} from "./Frames";
import { GdHallFrame } from "./GdHallFrame";
import { editorImageDimension, editorImageStyle } from "./imagePresentation";
import { roles } from "./roles";

/** Adapts the common visual frames to one stable ProseMirror-owned content slot. */
export function RitualBlockForEditing({
  node,
  selected,
  selectionInside,
  editor,
  getPos,
}: NodeViewProps & { selectionInside?: boolean }) {
  const tag = String(node.attrs.tag);
  const attrs = node.attrs.attrs;
  const presentation = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const pos = getPos();
      const plan = ritualFootnotesKey.getState(current.state);
      let explicitHost: number | undefined;
      if (typeof pos === "number" && tag === "task")
        current.state.doc.nodeAt(pos)?.forEach((child, offset) => {
          if (child.attrs.tag === "footnotes" && explicitHost === undefined)
            explicitHost = pos + 1 + offset;
        });
      const footerHost = explicitHost ?? pos;
      const taskCollection =
        tag === "footnotes" &&
        typeof pos === "number" &&
        current.state.doc.resolve(pos).parent.attrs.tag === "task";
      return {
        pos,
        footerHost,
        explicitHost,
        taskCollection,
        reference:
          typeof pos === "number" ? plan?.references.get(pos) : undefined,
        isEditable: current.isEditable,
        hasCollection:
          typeof footerHost === "number" &&
          !!plan?.collections.get(footerHost)?.length,
      };
    },
  });
  const collected = presentation.reference?.host != null;
  const emptyTask =
    tag === "task" &&
    (node.childCount === 0 ||
      (node.childCount === 1 &&
        node.firstChild?.type.name === "paragraph" &&
        !node.firstChild.content.size));
  const content = (
    <NodeViewContent
      className={`ritual-content${emptyTask ? ` ${styles.emptyTaskContent}` : ""}`}
      data-placeholder={
        emptyTask && presentation.isEditable
          ? attrs.do === true
            ? "Type an action…"
            : "Type speech…"
          : undefined
      }
      onPointerDown={(event) => {
        if (
          !emptyTask ||
          event.button !== 0 ||
          !editor.isEditable ||
          !ritualEditorOwner(editor).isEditable
        )
          return;
        const pos = getPos();
        if (typeof pos !== "number") return;
        const current = editor.state.doc.nodeAt(pos);
        if (!current || current.attrs.id !== node.attrs.id) return;
        // Raw clipboard/undo content can still contain a zero-child task.
        // Repair only this empty slot, never redirect clicks in a populated body.
        if (current.childCount === 0) {
          const tr = editor.state.tr.insert(
            pos + 1,
            editor.schema.nodes.paragraph.create(),
          );
          tr.setSelection(TextSelection.create(tr.doc, pos + 2));
          editor.view.dispatch(tr.setMeta("addToHistory", false));
        } else if (
          current.childCount === 1 &&
          current.firstChild?.type.name === "paragraph" &&
          !current.firstChild.content.size
        ) {
          editor.commands.setTextSelection(pos + 2);
        }
      }}
      style={collected || tag === "footnotes" ? { display: "none" } : undefined}
    />
  );
  const footer =
    typeof presentation.footerHost === "number" &&
    (presentation.hasCollection ||
      presentation.explicitHost !== undefined ||
      (tag === "footnotes" && !presentation.taskCollection)) &&
    !presentation.taskCollection ? (
      <FootnotesForEditing editor={editor} host={presentation.footerHost} />
    ) : undefined;
  let frame;
  switch (tag) {
    case "task":
      frame = (
        <TaskFrame
          role={String(attrs.role ?? "all")}
          roles={roles}
          audience="author"
          footer={footer}
          headerActions={
            <TaskSettingsTrigger
              editor={editor}
              taskId={String(node.attrs.id)}
              editable={presentation.isEditable}
              role={String(attrs.role ?? "all")}
            />
          }
        >
          <TaskBody action={attrs.do === true}>{content}</TaskBody>
        </TaskFrame>
      );
      break;
    case "title":
      frame = <TitleFrame editing>{content}</TitleFrame>;
      break;
    case "note":
      frame = <NoteFrame>{content}</NoteFrame>;
      break;
    case "summary":
      frame = (
        <SummaryFrame title={String(attrs.summary ?? "")} editing>
          {content}
        </SummaryFrame>
      );
      break;
    case "ul":
    case "ol":
      frame = (
        <ListFrame editing ordered={tag === "ol"}>
          {content}
        </ListFrame>
      );
      break;
    case "li":
      frame = <ListItemFrame editing>{content}</ListItemFrame>;
      break;
    case "todo":
      frame = <TodoFrame>{content}</TodoFrame>;
      break;
    case "footnote":
      frame = collected ? (
        <>
          <FootnoteReferenceFrame number={presentation.reference!.number}>
            <button
              type="button"
              data-footnote-reference
              aria-disabled={!presentation.isEditable || undefined}
              className={styles.footnoteButton}
              aria-label={`Edit footnote ${presentation.reference!.number}`}
              onClick={() => {
                if (editor.isEditable && typeof presentation.pos === "number")
                  editor.commands.setNodeSelection(presentation.pos);
              }}
            >
              {presentation.reference!.number}
            </button>
          </FootnoteReferenceFrame>
          {content}
        </>
      ) : (
        <div className={styles.fallback}>
          <div className={styles.label} contentEditable={false}>
            Footnote · no active reader destination; edit or move its collection
            in source
          </div>
          {content}
        </div>
      );
      break;
    case "footnotes":
      frame = (
        <>
          {content}
          {footer}
        </>
      );
      break;
    default:
      frame = (
        <div className={styles.fallback}>
          <div className={styles.label} contentEditable={false}>
            {tag}
          </div>
          {content}
        </div>
      );
  }
  return (
    <NodeViewWrapper
      as="section"
      data-ritual-block={tag}
      data-collected={collected || undefined}
      data-task-collection={presentation.taskCollection || undefined}
      data-ritual-meta={JSON.stringify(node.attrs)}
      data-edit-active={selected || selectionInside || undefined}
      className={styles.block}
    >
      {frame}
    </NodeViewWrapper>
  );
}

export function RitualInlineForEditing({ node, selected }: NodeViewProps) {
  const tag = String(node.attrs.tag);
  return (
    <NodeViewWrapper
      as="span"
      data-ritual-inline={tag}
      data-ritual-meta={JSON.stringify(node.attrs)}
      className={tag === "grade" || tag === "br" ? styles.grade : styles.token}
      data-edit-active={selected || undefined}
      contentEditable={false}
    >
      {tag === "grade" ? (
        <GradeFrame grade={String(node.attrs.attrs.grade ?? "")} />
      ) : tag === "var" ? (
        `⁨${String(node.attrs.attrs.name ?? "")}⁩`
      ) : tag === "br" ? (
        <br />
      ) : (
        "↵"
      )}
    </NodeViewWrapper>
  );
}

/** Render attached images only; arbitrary source URLs retain a metadata placeholder. */
/**
 * A path on this origin. URL parsing drops tabs and newlines, so `/\t/host`
 * would otherwise resolve to another host; reject controls and confirm the
 * resolved origin.
 */
function sameOriginPath(src: unknown): src is string {
  if (
    typeof src !== "string" ||
    !/^\/(?![/\\])/.test(src) ||
    /[\u0000-\u001f\u007f\\]/.test(src)
  )
    return false;
  try {
    return (
      new URL(src, window.location.origin).origin === window.location.origin
    );
  } catch {
    return false;
  }
}

/** Name a verbatim source-only node by its tag and the text that identifies it. */
function sourceOnlyLabel(raw: unknown): string {
  try {
    const node = JSON.parse(String(raw));
    if (node?.kind !== "element") return String(node?.kind ?? "structure");
    const name = node.attrs?.text ?? node.attrs?.summary ?? node.attrs?.role;
    // Say how much a single Delete would remove.
    const count = (children: { children?: unknown[] }[] = []): number =>
      children.reduce(
        (sum, child) =>
          sum + 1 + count(child.children as { children?: unknown[] }[]),
        0,
      );
    const inside = count(node.children);
    return `${node.tag}${name ? ` · ${String(name)}` : ""}${inside ? ` · ${inside} inside` : ""}`;
  } catch {
    return "structure";
  }
}

export function RitualAtomForEditing({ node, selected }: NodeViewProps) {
  const tag = String(node.attrs.tag);
  const attrs = node.attrs.attrs;
  const attachedImage = tag === "img" && parseRitualFileLocator(attrs.src);
  const caption =
    tag === "sourceAnnotation"
      ? attrs.style === "blank"
        ? "Source separator · omitted from reader"
        : `Author comment · ${String(attrs.text ?? "")}`
      : tag === "legacy"
        ? "Unsupported legacy content · preserved"
        : tag === "sourceOnly"
          ? `Needs source editing · ${sourceOnlyLabel(node.attrs.raw)}`
          : tag === "img"
            ? `Image · ${String(attrs.alt ?? attrs.src ?? "")}`
            : tag === "declareVar"
              ? `Variable · ${String(attrs.label ?? attrs.name ?? "")}`
              : tag === "gdHall"
                ? "Temple hall"
                : tag;
  // The hall as the reader will draw it; the visual sub-editor is stage D.
  const hall = useMemo(
    () => (tag === "gdHall" ? gdHallRow(node.attrs) : null),
    [tag, node.attrs],
  );
  const imageStyle = editorImageStyle(attachedImage ? attrs.style : undefined);
  // Site assets (such as /pics/…) preview like the reader; other URLs stay
  // captions so the editor never fetches arbitrary hosts.
  const siteImage =
    tag === "img" && !attachedImage && sameOriginPath(attrs.src)
      ? (attrs.src as string)
      : null;
  return (
    <NodeViewWrapper
      data-ritual-atom={tag}
      data-ritual-meta={JSON.stringify(node.attrs)}
      className={styles.atom}
      data-edit-active={selected || undefined}
      contentEditable={false}
    >
      {attachedImage && (
        <ImageFrame
          src={String(attrs.src)}
          alt={typeof attrs.alt === "string" ? attrs.alt : undefined}
          width={editorImageDimension(attrs.width)}
          height={editorImageDimension(attrs.height)}
          style={imageStyle}
          editing
        />
      )}
      {siteImage && (
        // biome-ignore lint/performance/noImgElement: a same-origin preview of the reader's own asset.
        <img
          src={siteImage}
          alt={typeof attrs.alt === "string" ? attrs.alt : ""}
          className={styles.sitePreview}
        />
      )}
      {hall && <GdHallFrame hall={hall} />}
      {tag === "hr" ? <hr /> : <div className={styles.label}>{caption}</div>}
    </NodeViewWrapper>
  );
}
