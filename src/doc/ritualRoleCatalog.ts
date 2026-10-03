import type { Editor } from "@tiptap/core";
import { roles } from "./ritualBlocks/roles";
import { ritualEditorOwner } from "./ritualEditorOwner";
import {
  canonicalRole,
  parseRoleAssignment,
  type RitualRoleAssignment,
} from "./ritualRoles";

/** Standard, declared and already-used role names from the canonical ritual. */
export function ritualRoleCatalog(
  editor: Editor,
  assignment: RitualRoleAssignment = { basis: "roles", roles: [] },
) {
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
