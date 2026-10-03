"use client";

import type { NodeViewProps } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  useEditorState,
} from "@tiptap/react";
import { parseRitualFileLocator } from "@/files/ritualFileLocator";
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
  const content = (
    <NodeViewContent
      className="ritual-content"
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
        : tag === "img"
          ? `Image · ${String(attrs.alt ?? attrs.src ?? "")}`
          : tag === "declareVar"
            ? `Variable · ${String(attrs.label ?? attrs.name ?? "")}`
            : tag;
  const imageStyle = editorImageStyle(attachedImage ? attrs.style : undefined);
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
      {tag === "hr" ? <hr /> : <div className={styles.label}>{caption}</div>}
    </NodeViewWrapper>
  );
}
