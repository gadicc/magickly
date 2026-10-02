"use client";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import type { Editor, JSONContent } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import React from "react";
import { formatRitualFileLocator } from "@/files/ritualFileLocator";
import Upload from "@/lib/upload";
import EditorActionButton from "./EditorActionButton";
import { createRitualNodeId } from "./ritualNodeIds";
import {
  type JsonValue,
  type RitualSemanticNode,
  validateRitualSemantic,
} from "./semantic";

type Kind =
  | "title"
  | "summary"
  | "todo"
  | "var"
  | "declareVar"
  | "a"
  | "img"
  | "task";
type Element = Extract<RitualSemanticNode, { kind: "element" }>;
type Option = { id: string; value: string; label: string };
interface Fields {
  kind: Kind;
  value: string;
  name: string;
  label: string;
  varType: "text" | "select";
  defaultValue: string;
  options: Option[];
  role: string;
  taskMode: "say" | "do";
  href: string;
  linkText: string;
  alt: string;
}
interface Target {
  pos: number;
  id: string;
  node: JSONContent;
}
const editableTags = new Set<Kind>([
  "title",
  "summary",
  "var",
  "declareVar",
  "a",
  "img",
  "task",
]);
const freshFields = (kind: Kind): Fields => ({
  kind,
  value: "",
  name: "",
  label: "",
  varType: "text",
  defaultValue: "",
  options: [],
  role: "all",
  taskMode: "say",
  href: "",
  linkText: "",
  alt: "",
});

function selectionTarget(editor: Editor): Target | null {
  const { $from } = editor.state.selection;
  const after = $from.nodeAfter;
  if (after?.isAtom && editableTags.has(after.attrs.tag))
    return { pos: $from.pos, id: after.attrs.id, node: after.toJSON() };
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (editableTags.has(node.attrs.tag))
      return {
        pos: $from.before(depth),
        id: node.attrs.id,
        node: node.toJSON(),
      };
  }
  return null;
}

function fieldsFor(target: Target): Fields {
  const attrs = target.node.attrs?.attrs ?? {};
  const kind = target.node.attrs?.tag as Kind;
  return {
    ...freshFields(kind),
    value: String(attrs.text ?? attrs.summary ?? ""),
    name: String(attrs.name ?? ""),
    label: String(attrs.label ?? ""),
    varType: attrs.varType === "select" ? "select" : "text",
    defaultValue: String(attrs.default ?? ""),
    role: String(attrs.role ?? "all"),
    taskMode: attrs.do === true ? "do" : "say",
    href: String(attrs.href ?? ""),
    alt: String(attrs.alt ?? ""),
    options: (target.node.attrs?.children ?? [])
      .filter(
        (node: RitualSemanticNode) =>
          node.kind === "element" && node.tag === "option",
      )
      .map((node: Element) => ({
        id: node.id,
        value: String(node.attrs.value ?? ""),
        label: String(node.attrs.label ?? ""),
      })),
  };
}

/** Shared visual author controls; uploads require an already authorized ritual. */
export default function RitualVisualControls({
  editor,
  disabled,
  syncingSource = false,
  concealed = false,
  actorId,
  ritualId,
  title,
}: {
  editor: Editor;
  disabled: boolean;
  /** Source owns the document until its debounced parse applies; keep command presentation steady. */
  syncingSource?: boolean;
  concealed?: boolean;
  actorId?: string;
  ritualId?: string;
  title?: string;
}) {
  const blocked = disabled || syncingSource;
  const sourceWaitReason =
    "The visual panel is catching up with ritual source.";
  const selected = useEditorState({
    editor,
    selector: ({ editor: current }) => selectionTarget(current),
  });
  const [role, setRole] = React.useState("all");
  const [fields, setFields] = React.useState<Fields | null>(null);
  const [target, setTarget] = React.useState<Target | null>(null);
  const [selection, setSelection] = React.useState<{
    from: number;
    to: number;
    document: string;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [imageOpen, setImageOpen] = React.useState(false);
  const insertedUploads = React.useRef(new Set<string>());
  const imageAttempt = React.useRef<{
    token: number;
    pos: number;
    document: string;
  } | null>(null);
  const nextImageToken = React.useRef(0);
  const [uploadedImage, setUploadedImage] = React.useState<{
    token: number;
    receipt: Parameters<
      NonNullable<React.ComponentProps<typeof Upload>["onResult"]>
    >[0];
  } | null>(null);
  const mounted = React.useRef(true);
  const activeImageToken = imageAttempt.current?.token;
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const closeImage = React.useCallback(() => {
    imageAttempt.current = null;
    setUploadedImage(null);
    setImageOpen(false);
  }, []);
  const openImage = () => {
    if (blocked) return;
    imageAttempt.current = {
      token: ++nextImageToken.current,
      pos: editor.state.selection.from,
      document: JSON.stringify(editor.getJSON()),
    };
    setUploadedImage(null);
    setImageOpen(true);
  };
  React.useEffect(() => {
    if (!uploadedImage || blocked) return;
    const attempt = imageAttempt.current;
    const receipt = uploadedImage.receipt;
    if (
      !attempt ||
      attempt.token !== uploadedImage.token ||
      receipt.actorId !== actorId ||
      receipt.ritualId !== ritualId ||
      insertedUploads.current.has(receipt.operationId)
    )
      return;
    if (attempt.document !== JSON.stringify(editor.getJSON())) {
      setError(
        "The image is attached, but the ritual changed during upload. Add it from ritual source to choose its position.",
      );
      closeImage();
      return;
    }
    const inserted = editor
      .chain()
      .focus()
      .insertContentAt(attempt.pos, {
        type: "ritualAtom",
        attrs: {
          id: createRitualNodeId(),
          tag: "img",
          attrs: { src: formatRitualFileLocator(receipt), alt: "" },
          children: null,
        },
      })
      .run();
    if (inserted) {
      insertedUploads.current.add(receipt.operationId);
      closeImage();
    } else {
      setError(
        "The image is attached but could not be inserted at the selected position.",
      );
      closeImage();
    }
  }, [uploadedImage, blocked, editor, actorId, ritualId, closeImage]);

  const open = (kind: Kind, edit: Target | null = null) => {
    if (blocked) return;
    setTarget(edit);
    const next = edit ? fieldsFor(edit) : freshFields(kind);
    if (kind === "a" && !edit) {
      const { from, to, $from, $to } = editor.state.selection;
      if (!$from.sameParent($to) || !$from.parent.inlineContent) {
        setError("Select text within one paragraph to add a link.");
        return;
      }
      setSelection({ from, to, document: JSON.stringify(editor.getJSON()) });
      next.linkText = editor.state.doc.textBetween(from, to);
    }
    setFields(next);
    setError(null);
  };
  const change = (key: keyof Fields, value: string) => {
    setFields((current) => (current ? { ...current, [key]: value } : null));
    setError(null);
  };

  const insertBlock = (tag: "task" | "note", mode?: "say" | "do") => {
    if (blocked) return;
    const id = createRitualNodeId();
    const attrs =
      tag === "task" ? { [mode!]: true, role: role.trim() || "all" } : {};
    if (
      validateRitualSemantic({
        format: "magickli-ritual",
        version: 1,
        nodes: [{ kind: "element", id, tag, attrs, children: [] }],
      }).length
    ) {
      setError(
        "Use a comma-separated role list, all, all-officers, or all-except-roles.",
      );
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: tag === "task" ? "ritualTask" : "ritualBlock",
        attrs: {
          id,
          tag,
          attrs,
        },
        content: [{ type: "paragraph" }],
      })
      .run();
  };

  const apply = () => {
    if (!fields || blocked) return;
    const previous = target ? editor.state.doc.nodeAt(target.pos) : null;
    if (target && previous?.attrs.id !== target.id) {
      setError(
        "The selected structure changed. Close this dialog and select it again.",
      );
      return;
    }
    const attrs: Record<string, JsonValue> = {
      ...(previous?.attrs.attrs ?? {}),
    };
    let children = previous?.attrs.children as
      | RitualSemanticNode[]
      | null
      | undefined;
    if (fields.kind === "title") {
      if (!fields.value.trim()) {
        setError("Enter a section title.");
        return;
      }
      if (
        previous &&
        (previous.childCount !== 1 ||
          previous.firstChild?.type.name !== "paragraph" ||
          Array.from({ length: previous.firstChild.childCount }, (_, index) =>
            previous.firstChild!.child(index),
          ).some(
            (node) =>
              !node.isText ||
              node.marks.some((mark) => mark.type.name !== "ritualSegment"),
          ))
      ) {
        setError(
          "Edit this formatted title in the visual document or ritual source.",
        );
        return;
      }
      attrs.text = fields.value.trim();
    }
    if (fields.kind === "summary") attrs.summary = fields.value.trim();
    if (fields.kind === "var") {
      const name = fields.name.trim() || fields.value.trim();
      if (!/^[A-Za-z0-9_=]+$/.test(name)) {
        setError(
          "Use letters, numbers, underscores or equals in a variable name.",
        );
        return;
      }
      attrs.name = name;
    }
    if (fields.kind === "img") attrs.alt = fields.alt;
    if (fields.kind === "task") {
      if (!/^[A-Za-z][A-Za-z0-9,-]*$/.test(fields.role.trim())) {
        setError("Enter a valid task role.");
        return;
      }
      delete attrs.say;
      delete attrs.do;
      attrs[fields.taskMode] = true;
      attrs.role = fields.role.trim();
    }
    if (fields.kind === "a") {
      const href = fields.href.trim();
      if (
        !/^(https?:\/\/|mailto:|\/[^/]|#)/i.test(href) ||
        /[\u0000-\u0020]/.test(href)
      ) {
        setError("Use an http, https, mailto, site-relative or fragment link.");
        return;
      }
      attrs.href = href;
    }
    if (fields.kind === "declareVar") {
      if (!/^[A-Za-z0-9_=]+$/.test(fields.name.trim())) {
        setError(
          "Use letters, numbers, underscores or equals in a variable name.",
        );
        return;
      }
      attrs.name = fields.name.trim();
      attrs.label = fields.label;
      attrs.varType = fields.varType;
      attrs.default = fields.defaultValue;
      if (fields.varType === "select") {
        if (
          !fields.options.length ||
          new Set(fields.options.map((option) => option.value)).size !==
            fields.options.length ||
          (fields.defaultValue &&
            !fields.options.some(
              (option) => option.value === fields.defaultValue,
            ))
        ) {
          setError(
            "Add unique options and choose a default value matching an option.",
          );
          return;
        }
        const oldOptions = new Map(
          (children ?? [])
            .filter(
              (node): node is Element =>
                node.kind === "element" && node.tag === "option",
            )
            .map((node) => [node.id, node]),
        );
        const options: Element[] = fields.options.map((option) => ({
          ...oldOptions.get(option.id),
          kind: "element",
          id: option.id,
          tag: "option",
          attrs: {
            ...oldOptions.get(option.id)?.attrs,
            value: option.value,
            label: option.label,
          },
        }));
        // Preserve unrelated children from imported declarations.
        const byId = new Map(options.map((option) => [option.id, option]));
        const originalIds = new Set(
          (children ?? [])
            .filter((node) => node.kind === "element")
            .map((node) => (node as Element).id),
        );
        children = (children ?? [])
          .flatMap((node) => {
            if (node.kind !== "element" || node.tag !== "option") return [node];
            const updated = byId.get(node.id);
            return updated ? [updated] : [];
          })
          .concat(
            options.filter(
              (option) =>
                option.kind === "element" && !originalIds.has(option.id),
            ),
          );
      }
    }
    const id = target?.id ?? createRitualNodeId();
    const errors = validateRitualSemantic({
      format: "magickli-ritual",
      version: 1,
      nodes: [
        {
          kind: "element",
          id,
          tag: fields.kind,
          attrs,
          ...(children ? { children } : {}),
        },
      ],
    });
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    if (target && previous) {
      let tr = editor.state.tr.setNodeMarkup(target.pos, undefined, {
        ...previous.attrs,
        attrs,
        ...(children ? { children } : {}),
      });
      if (fields.kind === "title") {
        const paragraph = editor.schema.nodes.paragraph.create(
          null,
          editor.schema.text(fields.value.trim()),
        );
        tr = tr.replaceWith(
          target.pos + 1,
          target.pos + previous.nodeSize - 1,
          paragraph,
        );
      }
      editor.view.dispatch(tr);
    } else if (fields.kind === "a") {
      if (!selection || !fields.linkText.trim()) {
        setError("Enter link text.");
        return;
      }
      if (selection.document !== JSON.stringify(editor.getJSON())) {
        setError(
          "The selected text changed. Close this dialog and select it again.",
        );
        return;
      }
      const content =
        selection.from !== selection.to
          ? editor.state.doc
              .slice(selection.from, selection.to)
              .content.toJSON()
          : [{ type: "text", text: fields.linkText }];
      if (
        !editor
          .chain()
          .focus()
          .insertContentAt(selection, {
            type: "ritualSpan",
            attrs: { id, tag: "a", attrs },
            content,
          })
          .run()
      ) {
        setError("The link could not be inserted here.");
        return;
      }
    } else {
      const inline = fields.kind === "var";
      const atom = fields.kind === "declareVar";
      const node: JSONContent = {
        type: inline ? "ritualInline" : atom ? "ritualAtom" : "ritualBlock",
        attrs: {
          id,
          tag: fields.kind,
          attrs,
          ...(atom ? { children: children ?? null } : {}),
        },
        ...(!inline && !atom
          ? {
              content: [
                {
                  type: "paragraph",
                  ...(fields.kind === "title"
                    ? { content: [{ type: "text", text: fields.value.trim() }] }
                    : {}),
                },
              ],
            }
          : {}),
      };
      // Readers collect declarations at the root of the ritual.
      const chain = editor.chain().focus();
      const inserted = atom
        ? chain.insertContentAt(editor.state.doc.content.size, node).run()
        : chain.insertContent(node).run();
      if (!inserted) {
        setError("This structure could not be inserted here.");
        return;
      }
    }
    setFields(null);
    setError(null);
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          gap: 0.5,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <EditorActionButton
          inactive={syncingSource}
          inactiveReason={sourceWaitReason}
          size="small"
          disabled={disabled}
          onClick={() => insertBlock("task", "say")}
        >
          Speech
        </EditorActionButton>
        <EditorActionButton
          inactive={syncingSource}
          inactiveReason={sourceWaitReason}
          size="small"
          disabled={disabled}
          onClick={() => insertBlock("task", "do")}
        >
          Action
        </EditorActionButton>
        <EditorActionButton
          inactive={syncingSource}
          inactiveReason={sourceWaitReason}
          size="small"
          disabled={disabled}
          onClick={() => insertBlock("note")}
        >
          Note
        </EditorActionButton>
        <EditorActionButton
          inactive={syncingSource}
          inactiveReason={sourceWaitReason}
          size="small"
          disabled={disabled}
          onClick={() => open("title")}
        >
          Insert structure
        </EditorActionButton>
        <EditorActionButton
          inactive={syncingSource}
          inactiveReason={sourceWaitReason}
          size="small"
          disabled={disabled}
          onClick={() =>
            open("a", selected?.node.attrs?.tag === "a" ? selected : null)
          }
        >
          Link
        </EditorActionButton>
        <EditorActionButton
          inactive={syncingSource}
          inactiveReason={sourceWaitReason}
          size="small"
          disabled={disabled || !actorId || !ritualId}
          onClick={openImage}
        >
          Image
        </EditorActionButton>
        <EditorActionButton
          inactive={syncingSource}
          inactiveReason={sourceWaitReason}
          size="small"
          disabled={disabled || !selected}
          onClick={() =>
            selected && open(selected.node.attrs?.tag as Kind, selected)
          }
        >
          Edit properties
        </EditorActionButton>
        <EditorActionButton
          inactive={syncingSource}
          inactiveReason={sourceWaitReason}
          size="small"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          Bold
        </EditorActionButton>
        <EditorActionButton
          inactive={syncingSource}
          inactiveReason={sourceWaitReason}
          size="small"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          Italic
        </EditorActionButton>
        <EditorActionButton
          inactive={syncingSource}
          inactiveReason={sourceWaitReason}
          size="small"
          disabled={disabled}
          onClick={() => editor.chain().focus().undo().run()}
        >
          Undo
        </EditorActionButton>
        <EditorActionButton
          inactive={syncingSource}
          inactiveReason={sourceWaitReason}
          size="small"
          disabled={disabled}
          onClick={() => editor.chain().focus().redo().run()}
        >
          Redo
        </EditorActionButton>
        <TextField
          size="small"
          label="Role for new task"
          value={role}
          disabled={disabled}
          onChange={(event) => setRole(event.target.value)}
        />
      </Box>
      {!ritualId && (
        <Typography variant="body2">
          Images can be attached after creating the ritual.
        </Typography>
      )}
      {error && !fields && <Alert severity="error">{error}</Alert>}
      <Dialog
        sx={{ visibility: concealed ? "hidden" : undefined }}
        open={!!fields}
        onClose={() => setFields(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {target ? "Edit ritual properties" : "Insert ritual structure"}
        </DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
          {!target && fields?.kind !== "a" && (
            <TextField
              select
              slotProps={{
                select: {
                  MenuProps: {
                    sx: { visibility: concealed ? "hidden" : undefined },
                  },
                },
              }}
              label="Structure"
              value={fields?.kind ?? "title"}
              onChange={(event) => {
                setFields(freshFields(event.target.value as Kind));
                setError(null);
              }}
            >
              <MenuItem value="title">Section title</MenuItem>
              <MenuItem value="summary">Summary</MenuItem>
              <MenuItem value="todo">To-do</MenuItem>
              <MenuItem value="var">Variable reference</MenuItem>
              <MenuItem value="declareVar">Variable declaration</MenuItem>
            </TextField>
          )}
          {(fields?.kind === "title" ||
            fields?.kind === "summary" ||
            fields?.kind === "var") && (
            <TextField
              label={
                fields.kind === "title"
                  ? "Section title"
                  : fields.kind === "summary"
                    ? "Summary heading"
                    : "Variable name"
              }
              value={
                fields.kind === "var" && target ? fields.name : fields.value
              }
              onChange={(event) =>
                change(
                  fields.kind === "var" && target ? "name" : "value",
                  event.target.value,
                )
              }
            />
          )}
          {fields?.kind === "task" && (
            <>
              <TextField
                label="Task role"
                value={fields.role}
                onChange={(event) => change("role", event.target.value)}
              />
              <TextField
                select
                slotProps={{
                  select: {
                    MenuProps: {
                      sx: { visibility: concealed ? "hidden" : undefined },
                    },
                  },
                }}
                label="Task type"
                value={fields.taskMode}
                onChange={(event) => change("taskMode", event.target.value)}
              >
                <MenuItem value="say">Speech</MenuItem>
                <MenuItem value="do">Action</MenuItem>
              </TextField>
            </>
          )}
          {fields?.kind === "a" && (
            <>
              <TextField
                label="Link address"
                value={fields.href}
                onChange={(event) => change("href", event.target.value)}
              />
              {!target && (
                <TextField
                  label="Link text"
                  disabled={selection?.from !== selection?.to}
                  value={fields.linkText}
                  onChange={(event) => change("linkText", event.target.value)}
                />
              )}
            </>
          )}
          {fields?.kind === "img" && (
            <TextField
              label="Image description"
              value={fields.alt}
              onChange={(event) => change("alt", event.target.value)}
            />
          )}
          {fields?.kind === "declareVar" && (
            <>
              <TextField
                label="Variable name"
                value={fields.name}
                onChange={(event) => change("name", event.target.value)}
              />
              <TextField
                label="Variable label"
                value={fields.label}
                onChange={(event) => change("label", event.target.value)}
              />
              <TextField
                select
                slotProps={{
                  select: {
                    MenuProps: {
                      sx: { visibility: concealed ? "hidden" : undefined },
                    },
                  },
                }}
                label="Variable type"
                value={fields.varType}
                onChange={(event) => change("varType", event.target.value)}
              >
                <MenuItem value="text">Text</MenuItem>
                <MenuItem value="select">Choice</MenuItem>
              </TextField>
              <TextField
                label="Default value"
                value={fields.defaultValue}
                onChange={(event) => change("defaultValue", event.target.value)}
              />
              {fields.varType === "select" && (
                <>
                  {fields.options.map((option, index) => (
                    <Box
                      key={option.id}
                      sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}
                    >
                      <TextField
                        label={`Option ${index + 1} value`}
                        value={option.value}
                        onChange={(event) =>
                          setFields({
                            ...fields,
                            options: fields.options.map((item) =>
                              item.id === option.id
                                ? { ...item, value: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <TextField
                        label={`Option ${index + 1} label`}
                        value={option.label}
                        onChange={(event) =>
                          setFields({
                            ...fields,
                            options: fields.options.map((item) =>
                              item.id === option.id
                                ? { ...item, label: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <Button
                        onClick={() =>
                          setFields({
                            ...fields,
                            options: fields.options.filter(
                              (item) => item.id !== option.id,
                            ),
                          })
                        }
                      >
                        Remove option {index + 1}
                      </Button>
                    </Box>
                  ))}
                  <Button
                    onClick={() =>
                      setFields({
                        ...fields,
                        options: [
                          ...fields.options,
                          { id: createRitualNodeId(), value: "", label: "" },
                        ],
                      })
                    }
                  >
                    Add option
                  </Button>
                </>
              )}
            </>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFields(null)}>Cancel</Button>
          <EditorActionButton
            disabled={disabled}
            inactive={syncingSource}
            inactiveReason={sourceWaitReason}
            onClick={apply}
          >
            {target ? "Apply properties" : "Insert"}
          </EditorActionButton>
        </DialogActions>
      </Dialog>
      <Dialog
        open={imageOpen}
        onClose={closeImage}
        fullWidth
        maxWidth="sm"
        sx={{ visibility: concealed ? "hidden" : undefined }}
      >
        <DialogTitle>Insert image</DialogTitle>
        <DialogContent>
          {actorId && ritualId && (
            <Upload
              concealed={concealed}
              disabled={blocked}
              expectedActorId={actorId}
              rituals={[{ id: ritualId, title: title ?? "Current ritual" }]}
              onResult={(receipt) => {
                if (
                  !mounted.current ||
                  !activeImageToken ||
                  imageAttempt.current?.token !== activeImageToken ||
                  receipt.actorId !== actorId ||
                  receipt.ritualId !== ritualId ||
                  insertedUploads.current.has(receipt.operationId)
                )
                  return;
                setUploadedImage({ token: activeImageToken, receipt });
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeImage}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
