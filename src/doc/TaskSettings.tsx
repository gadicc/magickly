"use client";

import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import Alert from "@mui/material/Alert";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import type { Node } from "@tiptap/pm/model";
import { useEditorState } from "@tiptap/react";
import React from "react";
import styles from "./ritualBlocks/editing.module.css";
import { roles } from "./ritualBlocks/roles";
import { RITUAL_SETTINGS_CHANGE } from "./ritualEditorHistory";
import { ritualEditorOwner } from "./ritualEditorOwner";
import type { RitualRoleAssignment } from "./ritualRoles";
import {
  canonicalRole,
  parseRoleAssignment,
  printRoleAssignment,
  roleAliases,
  roleAssignmentLabel,
} from "./ritualRoles";
import { validateRitualSemantic } from "./semantic";

function findTask(editor: Editor, id: string) {
  let result: { node: Node; pos: number } | undefined;
  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.tag === "task" && node.attrs.id === id) {
      result = { node, pos };
      return false;
    }
  });
  return result;
}

function roleCatalog(editor: Editor, assignment: RitualRoleAssignment) {
  const names = new Map(
    Object.entries(roles).map(([key, role]) => [canonicalRole(key), role.name]),
  );
  const add = (value: unknown, label?: unknown) => {
    if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9]*$/.test(value))
      return;
    const key = canonicalRole(value);
    if (!names.has(key))
      names.set(key, key.slice(0, 1).toUpperCase() + key.slice(1));
    if (!Object.hasOwn(roles, key) && typeof label === "string" && label.trim())
      names.set(key, label.trim());
  };
  assignment.roles.forEach((value) => add(value));
  ritualEditorOwner(editor).state.doc.descendants((node) => {
    if (node.attrs.tag === "task")
      parseRoleAssignment(String(node.attrs.attrs?.role))?.roles.forEach(
        (value) => add(value),
      );
    if (
      node.attrs.tag === "declareVar" &&
      node.attrs.attrs?.name === "myRole" &&
      Array.isArray(node.attrs.children)
    )
      for (const option of node.attrs.children)
        if (option?.kind === "element" && option.tag === "option")
          add(option.attrs?.value, option.attrs?.label);
  });
  return names;
}

function SettingsForm({
  editor,
  taskId,
  onClose,
}: {
  editor: Editor;
  taskId: string;
  onClose(): void;
}) {
  const [baseline] = React.useState(() => {
    const task = findTask(editor, taskId);
    return {
      role: String(task?.node.attrs.attrs?.role ?? ""),
      mode: task?.node.attrs.attrs?.do === true ? "do" : "say",
    };
  });
  const [mode, setMode] = React.useState(baseline.mode);
  const [assignment, setAssignment] = React.useState<RitualRoleAssignment>(
    () => parseRoleAssignment(baseline.role) ?? { basis: "roles", roles: [] },
  );
  const [roleChanged, setRoleChanged] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const catalog = React.useMemo(
    () => roleCatalog(editor, assignment),
    [editor, assignment],
  );
  const roleName = (value: string) =>
    catalog.get(canonicalRole(value)) ?? value;
  const options = [...catalog.keys()].sort((a, b) =>
    roleName(a).localeCompare(roleName(b)),
  );
  const filterRoles = createFilterOptions<string>({
    stringify: (value) =>
      [
        value,
        roleName(value),
        ...Object.keys(roleAliases).filter(
          (alias) => canonicalRole(alias) === canonicalRole(value),
        ),
      ].join(" "),
  });
  const presentations = Object.fromEntries(
    [...catalog].map(([key, name]) => [key, { name }]),
  );
  const changeAssignment = (next: RitualRoleAssignment) => {
    setAssignment(next);
    setRoleChanged(true);
    setError(null);
  };
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor.isEditable || editor.isDestroyed) return;
    const current = findTask(editor, taskId);
    if (
      !current ||
      current.node.attrs.attrs.role !== baseline.role ||
      (current.node.attrs.attrs.do === true ? "do" : "say") !== baseline.mode
    ) {
      setError("This task changed. Close and reopen its settings.");
      return;
    }
    const role = roleChanged ? printRoleAssignment(assignment) : baseline.role;
    const parsed = parseRoleAssignment(role);
    if (
      !parsed ||
      (roleChanged &&
        (parsed.basis !== assignment.basis || assignment.roles.includes("all")))
    ) {
      setError(
        "Choose at least one role. Custom role keys use letters and numbers and begin with a letter; use Everyone for the reserved key all.",
      );
      return;
    }
    const attrs = { ...current.node.attrs.attrs };
    delete attrs.say;
    delete attrs.do;
    attrs[mode] = true;
    attrs.role = role;
    const errors = validateRitualSemantic({
      format: "magickli-ritual",
      version: 1,
      nodes: [
        { kind: "element", id: taskId, tag: "task", attrs, children: [] },
      ],
    });
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    if (role !== baseline.role || mode !== baseline.mode) {
      // A settings change is its own undo step, even immediately after typing.
      editor.view.dispatch(
        closeHistory(editor.state.tr)
          .setMeta(RITUAL_SETTINGS_CHANGE, true)
          .setNodeMarkup(current.pos, undefined, {
            ...current.node.attrs,
            attrs,
          }),
      );
      editor.view.dispatch(
        closeHistory(editor.state.tr).setMeta("addToHistory", false),
      );
    }
    onClose();
  };
  return (
    <Box
      component="form"
      onSubmit={apply}
      sx={{ p: 2, display: "grid", gap: 2 }}
    >
      <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
        Task settings
      </Typography>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(_event, value) => {
          if (value) setMode(value);
        }}
        aria-label="Task type"
        size="small"
        fullWidth
      >
        <ToggleButton value="say">Say / Speech</ToggleButton>
        <ToggleButton value="do">Do / Action</ToggleButton>
      </ToggleButtonGroup>
      <TextField
        select
        autoFocus
        label="Assigned to"
        value={assignment.basis}
        onChange={(event) =>
          changeAssignment({
            basis: event.target.value as RitualRoleAssignment["basis"],
            roles:
              assignment.basis !== "roles" && event.target.value !== "roles"
                ? assignment.roles
                : [],
          })
        }
      >
        <MenuItem value="roles">Selected roles</MenuItem>
        <MenuItem value="all">Everyone</MenuItem>
        <MenuItem value="officers">All officers</MenuItem>
      </TextField>
      <Autocomplete
        multiple
        freeSolo
        autoSelect
        disablePortal
        options={options}
        value={assignment.roles}
        filterOptions={filterRoles}
        getOptionLabel={roleName}
        isOptionEqualToValue={(option, value) =>
          canonicalRole(option) === canonicalRole(value)
        }
        onChange={(_event, values) => {
          const seen = new Set<string>();
          changeAssignment({
            ...assignment,
            roles: values
              .map((value) => {
                const input = value.trim();
                // Existing and declared custom keys are case-sensitive source identities.
                if (assignment.roles.includes(input) || options.includes(input))
                  return input;
                const matching = options.find(
                  (option) =>
                    Object.hasOwn(roles, option) &&
                    (option.toLowerCase() === input.toLowerCase() ||
                      roleName(option).toLowerCase() === input.toLowerCase()),
                );
                const alias = Object.keys(roleAliases).find(
                  (key) => key.toLowerCase() === input.toLowerCase(),
                );
                return matching ?? (alias ? canonicalRole(alias) : input);
              })
              .filter((value) => {
                const key = canonicalRole(value);
                if (!value || seen.has(key)) return false;
                seen.add(key);
                return true;
              }),
          });
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={assignment.basis === "roles" ? "Roles" : "Except (optional)"}
            helperText="Choose roles, or type a custom role and press Enter."
          />
        )}
      />
      {assignment.basis === "officers" && (
        <Typography variant="caption">
          All officers excludes Candidate and Member.
        </Typography>
      )}
      <Typography variant="body2" aria-live="polite">
        {roleAssignmentLabel(printRoleAssignment(assignment), presentations) ||
          "Choose the roles for this task."}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained">
          Apply
        </Button>
      </Box>
    </Box>
  );
}

/** One guarded task form shared by a node-view cog and the properties toolbar. */
export function TaskSettingsPopover({
  editor,
  taskId,
  anchor,
  onClose,
  blocked = false,
}: {
  editor: Editor;
  taskId: string;
  anchor: HTMLElement;
  onClose(): void;
  blocked?: boolean;
}) {
  const available = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current.isEditable && !!findTask(current, taskId),
  });
  React.useEffect(() => {
    if (!available || blocked) onClose();
  }, [available, blocked, onClose]);
  return (
    <Popover
      open={available && !blocked}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      sx={{ visibility: !available || blocked ? "hidden" : undefined }}
      slotProps={{
        paper: {
          role: "dialog",
          "aria-label": "Task settings",
          sx: { width: 360, maxWidth: "calc(100vw - 32px)", maxHeight: "75vh" },
        },
      }}
    >
      {available && !blocked && (
        <SettingsForm editor={editor} taskId={taskId} onClose={onClose} />
      )}
    </Popover>
  );
}

/** Touch and keyboard users can reach the same card control without hover. */
export function TaskSettingsTrigger({
  editor,
  taskId,
  role,
  editable,
}: {
  editor: Editor;
  taskId: string;
  role: string;
  editable: boolean;
}) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const close = React.useCallback(() => setAnchor(null), []);
  return (
    <>
      <IconButton
        data-task-settings
        className={styles.taskSettings}
        size="small"
        aria-label={`Task settings for ${roleAssignmentLabel(role, roles)}`}
        aria-disabled={!editable || undefined}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        onClick={(event) => {
          if (editor.isEditable) setAnchor(event.currentTarget);
        }}
      >
        <SettingsOutlined fontSize="small" />
      </IconButton>
      {anchor && (
        <TaskSettingsPopover
          editor={editor}
          taskId={taskId}
          anchor={anchor}
          onClose={close}
        />
      )}
    </>
  );
}
