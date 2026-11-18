import { describe, expect, it } from "vitest";
import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "../../gd/roseSigilLayout.ts";
import { referencePlan, referenceWords } from "./referencePlan.ts";
import { PLAN_TEMPLATES } from "./templates.ts";

describe("plan templates", () => {
  it("have distinct ids and cover every letter doubled and tripled in each position", () => {
    const ids = PLAN_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.startsWith("repeat-"))).toHaveLength(
      22 * 2 * 3,
    );
  });

  it.each(PLAN_TEMPLATES.map((template) => [template.id, template] as const))(
    "%s: the reference plans it as written",
    (_, template) => {
      expect(
        referencePlan(
          referenceWords(template.text),
          roseSigilLayout(template.version),
          ROSE_SIGIL_PROFILE,
        ),
      ).toEqual(template.plan);
    },
  );
});
