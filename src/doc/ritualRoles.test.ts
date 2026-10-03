import { expect, it } from "vitest";
import {
  parseRoleAssignment,
  printRoleAssignment,
  roleAssignmentIncludes,
  roleAssignmentLabel,
} from "./ritualRoles";

it.each([
  "hiero",
  "hierophant,keryx",
  "all",
  "all-officers",
  "all-except-hiero,keryx",
  "all-officers-except-pastHiero,phylax",
])("round-trips existing role keys: %s", (expression) => {
  expect(printRoleAssignment(parseRoleAssignment(expression)!)).toBe(
    expression,
  );
});
it.each([
  "",
  "all-except-",
  "all-officers-except-",
  "hiero,",
  "all-officers-except-hiero-keryx",
  "role_name",
])("rejects incomplete or unsupported expressions: %s", (expression) => {
  expect(parseRoleAssignment(expression)).toBeNull();
});
it.each([
  ["hiero", "hierophant"],
  ["hierophant", "hiero"],
  ["pastHiero,keryx", "pastHierophant"],
  ["phylax", "sentinel"],
])("matches aliases on either side: %s / %s", (expression, role) => {
  expect(roleAssignmentIncludes(expression, role)).toBe(true);
  expect(roleAssignmentIncludes(`all-except-${expression}`, role)).toBe(false);
});
it("retains the existing officer group and explicit source case", () => {
  for (const role of ["candidate", "member"])
    expect(roleAssignmentIncludes("all-officers", role)).toBe(false);
  for (const role of ["aspirant", "scribe", undefined])
    expect(roleAssignmentIncludes("all-officers", role)).toBe(true);
  expect(roleAssignmentIncludes("Hiero", "hierophant")).toBe(false);
  expect(
    roleAssignmentIncludes("all-officers-except-hiero,keryx", "hierophant"),
  ).toBe(false);
});
it("labels exclusions together and handles unfamiliar/prototype-named roles safely", () => {
  const names = {
    hierophant: { name: "Hierophant" },
    keryx: { name: "Keryx" },
  };
  expect(roleAssignmentLabel("all-officers-except-hiero,keryx", names)).toBe(
    "All officers except Hierophant and Keryx",
  );
  expect(roleAssignmentLabel("all", names)).toBe("Everyone");
  expect(roleAssignmentLabel("constructor", names)).toBe("Constructor");
});
