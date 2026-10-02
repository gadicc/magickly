"use client";

import type { NodeViewProps } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { CSSProperties } from "react";
import { parseRitualFileLocator } from "@/files/ritualFileLocator";
import styles from "./editing.module.css";
import {
  GradeFrame,
  ImageFrame,
  NoteFrame,
  SummaryFrame,
  TaskBody,
  TaskFrame,
  TitleFrame,
} from "./Frames";
import { roles } from "./roles";

/** Adapts the common visual frames to one stable ProseMirror-owned content slot. */
export function RitualBlockForEditing({
  node,
  selected,
  selectionInside,
}: NodeViewProps & { selectionInside?: boolean }) {
  const tag = String(node.attrs.tag);
  const attrs = node.attrs.attrs;
  const content = <NodeViewContent className="ritual-content" />;
  let frame;
  switch (tag) {
    case "task":
      frame = (
        <TaskFrame
          role={String(attrs.role ?? "all")}
          roles={roles}
          audience="author"
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
    default:
      frame = (
        <div className={styles.fallback}>
          <div className={styles.label} contentEditable={false}>
            {tag === "footnote" || tag === "footnotes"
              ? "Footnote content · placed by the reader"
              : tag}
          </div>
          {content}
        </div>
      );
  }
  return (
    <NodeViewWrapper
      as="section"
      data-ritual-block={tag}
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
      className={tag === "grade" ? styles.grade : styles.token}
      data-edit-active={selected || undefined}
      contentEditable={false}
    >
      {tag === "grade" ? (
        <GradeFrame grade={String(node.attrs.attrs.grade ?? "")} />
      ) : tag === "var" ? (
        `⁨${String(node.attrs.attrs.name ?? "")}⁩`
      ) : (
        "↵"
      )}
    </NodeViewWrapper>
  );
}

/** Clipboard attributes reach node views before semantic validation; only safe sizing is previewed. */
function editorImageStyle(value: unknown): CSSProperties {
  if (value === undefined) return { width: "100%" };
  try {
    if (typeof value !== "string") return {};
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const safe: CSSProperties = {};
    for (const key of ["width", "height"] as const) {
      const size = (parsed as Record<string, unknown>)[key];
      if (
        (typeof size === "number" && Number.isFinite(size) && size >= 0) ||
        (typeof size === "string" &&
          /^(?:auto|0|\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|ch))$/.test(
            size,
          ))
      )
        safe[key] = size;
    }
    return safe;
  } catch {
    return {};
  }
}

function editorImageDimension(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0)
    return value;
  if (
    typeof value === "string" &&
    /^\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|ch)?$/.test(value)
  )
    return value;
  return undefined;
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
