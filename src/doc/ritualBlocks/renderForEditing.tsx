"use client";

import type { HallNode } from "@magick-components/gd/hall/types";
import EditOutlined from "@mui/icons-material/EditOutlined";
import { Button } from "@mui/material";
import type { NodeViewProps } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import {
  NodeViewContent,
  NodeViewWrapper,
  useEditorState,
} from "@tiptap/react";
import dynamic from "next/dynamic";
import {
  Component,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

/**
 * The visual hall editor, its renderer and the app's art load only when an
 * author edits a hall (plan 061, decision 11); the hall's drawing stands
 * in while they load.
 */
const GdHallAtomEditor = dynamic(() => import("./GdHallAtomEditor"), {
  loading: () => (
    <p className={styles.hallLoading} role="status">
      Opening the hall editor…
    </p>
  ),
});

/**
 * Catches the hall editor failing, its chunk not loading above all (offline
 * before it was cached, or a deploy that replaced it), so that it ends the
 * editing instead of taking down the whole ritual editor; `onFailed` tells
 * the atom, which drops back to the drawing and says so.
 */
class HallEditorBoundary extends Component<
  { onFailed: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailed();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * How many warnings `validateHall` has for a hall, for the badge on a hall
 * outside edit mode (plan 061, Stage E notes): 0 until known. The
 * validator loads lazily, after a pause, and only in the editor; a hall
 * changed meanwhile drops the older count.
 */
function useHallWarningCount(hall: HallNode | null): number {
  const [found, setFound] = useState<{ hall: HallNode; count: number } | null>(
    null,
  );
  useEffect(() => {
    if (!hall) return;
    let current = true;
    const timer = window.setTimeout(() => {
      import("./gdHallWarningCount")
        .then(({ countHallWarnings }) => {
          if (current) setFound({ hall, count: countHallWarnings(hall) });
        })
        // Without the chunk (offline before it was cached) there is no
        // badge; the editor lists the warnings when it opens.
        .catch(() => {});
    }, 250);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [hall]);
  return found?.hall === hall ? found.count : 0;
}

export function RitualAtomForEditing({
  node,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  const tag = String(node.attrs.tag);
  const attrs = node.attrs.attrs;
  const [editingHall, setEditingHall] = useState(false);
  /** The hall editor could not load or failed: say so beside Edit hall. */
  const [hallEditorFailed, setHallEditorFailed] = useState(false);
  /** The badge opened the editor: it starts at the warnings. */
  const [toWarnings, setToWarnings] = useState(false);
  const editHallButton = useRef<HTMLButtonElement>(null);
  const finishedEditing = useRef(false);
  const editable = useEditorState({
    editor,
    selector: ({ editor: current }) => current.isEditable,
  });
  // Done gives the focus back to the button that began editing.
  useEffect(() => {
    if (editingHall || !finishedEditing.current) return;
    finishedEditing.current = false;
    editHallButton.current?.focus({ preventScroll: true });
  }, [editingHall]);
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
  // The hall as the reader will draw it, shown until Edit hall opens the
  // hall editor in its place.
  const hall = useMemo(
    () => (tag === "gdHall" ? gdHallRow(node.attrs) : null),
    [tag, node.attrs],
  );
  const warningCount = useHallWarningCount(hall);
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
      // While its hall editor is open (loading included), the ritual
      // editor's split gives the visual panel three parts to the source's
      // two, through :has() in SemanticEditor.module.css.
      data-gd-hall-editing={(tag === "gdHall" && editingHall) || undefined}
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
      {tag === "gdHall" && editingHall ? (
        <HallEditorBoundary
          onFailed={() => {
            finishedEditing.current = true;
            setHallEditorFailed(true);
            setEditingHall(false);
          }}
        >
          <GdHallAtomEditor
            editor={editor}
            getPos={getPos}
            node={node}
            initialFocus={toWarnings ? "warnings" : "drawing"}
            onDone={() => {
              finishedEditing.current = true;
              setEditingHall(false);
            }}
          />
        </HallEditorBoundary>
      ) : (
        hall && <GdHallFrame hall={hall} />
      )}
      {tag === "hr" ? (
        <hr />
      ) : (
        <div className={styles.label}>
          {caption}
          {tag === "gdHall" && hall && !editingHall && (
            // Disabled, not hidden, while the ritual takes no changes (a
            // save or source sync), so the label does not flicker.
            <Button
              ref={editHallButton}
              size="small"
              variant="outlined"
              startIcon={<EditOutlined fontSize="small" />}
              className={styles.hallEdit}
              disabled={!editable}
              data-gd-hall-controls
              onClick={() => {
                setToWarnings(false);
                setHallEditorFailed(false);
                setEditingHall(true);
              }}
            >
              Edit hall
            </Button>
          )}
          {tag === "gdHall" && hallEditorFailed && !editingHall && (
            <span role="alert" className={styles.hallFailed}>
              The hall editor failed; reload to try again.
            </span>
          )}
          {tag === "gdHall" && hall && !editingHall && warningCount > 0 && (
            <Button
              size="small"
              color="warning"
              className={styles.hallWarnings}
              disabled={!editable}
              data-gd-hall-controls
              aria-label={`${warningCount} hall ${warningCount === 1 ? "warning" : "warnings"}: edit the hall to see them`}
              onClick={() => {
                setToWarnings(true);
                setHallEditorFailed(false);
                setEditingHall(true);
              }}
            >
              <span aria-hidden="true">⚠</span>&nbsp;{warningCount}{" "}
              {warningCount === 1 ? "warning" : "warnings"}
            </Button>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
