/** Alternate names remain valid source keys; comparisons use their canonical role. */
export const roleAliases: Record<string, string> = {
  hiero: "hierophant",
  pastHiero: "pastHierophant",
  phylax: "sentinel",
};

/** A role list includes participants; group lists exclude participants. */
export interface RitualRoleAssignment {
  basis: "roles" | "all" | "officers";
  roles: string[];
}

export function canonicalRole(role: string): string {
  return Object.hasOwn(roleAliases, role) ? roleAliases[role] : role;
}

/** Decode the existing comma-separated role grammar without rewriting its keys. */
export function parseRoleAssignment(
  value: string,
): RitualRoleAssignment | null {
  let basis: RitualRoleAssignment["basis"] = "roles";
  let list = value;
  if (value === "all" || value.startsWith("all-except-")) {
    basis = "all";
    list = value === "all" ? "" : value.slice(11);
  } else if (
    value === "all-officers" ||
    value.startsWith("all-officers-except-")
  ) {
    basis = "officers";
    list = value === "all-officers" ? "" : value.slice(20);
  }
  if (list && !/^[A-Za-z][A-Za-z0-9]*(?:,[A-Za-z][A-Za-z0-9]*)*$/.test(list))
    return null;
  if (!list && (basis === "roles" || value.endsWith("-except-"))) return null;
  return { basis, roles: list ? list.split(",") : [] };
}

/** Serialize a picker draft; an empty specific-role list remains invalid until selected. */
export function printRoleAssignment(assignment: RitualRoleAssignment): string {
  const list = assignment.roles.join(",");
  if (assignment.basis === "roles") return list;
  const group = assignment.basis === "all" ? "all" : "all-officers";
  return list ? `${group}-except-${list}` : group;
}

/** Preserve legacy group membership while matching aliases on both sides. */
export function roleAssignmentIncludes(
  expression: string,
  selected: string | undefined,
): boolean {
  const assignment = parseRoleAssignment(expression);
  if (!assignment) return false;
  const role = selected === undefined ? undefined : canonicalRole(selected);
  const listed = assignment.roles.some(
    (entry) => canonicalRole(entry) === role,
  );
  if (assignment.basis === "roles") return listed;
  if (
    assignment.basis === "officers" &&
    (role === "candidate" || role === "member")
  )
    return false;
  return !listed;
}

/** Human-readable labels are shared by the reader, card heading and settings preview. */
export function roleAssignmentLabel(
  expression: string,
  roles: Record<string, { name: string }>,
): string {
  const assignment = parseRoleAssignment(expression);
  if (!assignment) return expression;
  const names = [
    ...new Set(assignment.roles.map((entry) => canonicalRole(entry))),
  ].map((entry) =>
    Object.hasOwn(roles, entry)
      ? roles[entry].name
      : entry.slice(0, 1).toUpperCase() + entry.slice(1),
  );
  const list =
    names.length > 1
      ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
      : (names[0] ?? "");
  if (assignment.basis === "roles") return list;
  const group = assignment.basis === "all" ? "Everyone" : "All officers";
  return list ? `${group} except ${list}` : group;
}
