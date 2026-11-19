import { HALL_ROLES } from "magick-components/gd/hall/editor";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { contrast, oklabDistance } from "../../colourContrast";
import theme from "../../theme";
import { TaskFrame } from "./Frames";
import { roles } from "./roles";

describe("ritual role symbols", () => {
  it("draws the Past Hierophant as its own lamen, without brackets", () => {
    // The white ring tells it from the Hierophant (plan 061, decision 9).
    const past = renderToStaticMarkup(roles.pastHierophant.symbol);
    expect(past.startsWith("<svg")).toBe(true);
    expect(past).not.toMatch(/^\(|\)$|<span/);
    expect(past).not.toBe(renderToStaticMarkup(roles.hierophant.symbol));
  });

  it("knows every officer a temple hall knows, so the two stay one set", () => {
    // Plan 061, decision 5: hall roles use the ritual role keys.
    for (const [role, name] of HALL_ROLES) {
      expect(Object.hasOwn(roles, role), role).toBe(true);
      expect(roles[role].name, role).toBe(name);
      expect(roles[role].symbol, role).toBeTruthy();
    }
  });

  it("hides every role's symbol from assistive technology, beside its name", () => {
    for (const role of Object.keys(roles)) {
      const markup = renderToStaticMarkup(
        <TaskFrame role={role} roles={roles} kind="say">
          text
        </TaskFrame>,
      );
      const symbol = /<div class="[^"]*roleSymbol[^"]*"([^>]*)>/.exec(markup);
      expect(symbol?.[1], role).toContain('aria-hidden="true"');
      expect(markup, role).toContain(`>${roles[role].name}</span>`);
    }
  });

  it("draws the adepts' own lamens, each its own", () => {
    const symbols = ["chiefAdept", "secondAdept", "thirdAdept"].map((role) =>
      renderToStaticMarkup(roles[role].symbol),
    );
    expect(new Set(symbols).size).toBe(3);
    for (const symbol of symbols)
      expect(symbol).toContain('viewBox="-50 -50 100 100"');
  });
});

// Plan 089, "Officer colours".
describe("ritual role colours", () => {
  const coloured = Object.entries(roles).filter(([, role]) => role.color);

  it.each(["light", "dark"] as const)(
    "reads at 4.5:1 or more on every %s background a name sits on",
    (scheme) => {
      const ritual = theme.colorSchemes[scheme]?.palette.ritual;
      expect(ritual).toBeDefined();
      const { bubble, self, surface, selfAction } = ritual!;
      for (const [key, role] of coloured) {
        const colour =
          scheme === "light" ? role.color! : (role.darkColor ?? role.color!);
        for (const background of [bubble, self, surface, selfAction])
          expect(
            contrast(colour, background),
            `${key} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  // The officers who share a hall, by distinct office: the Imperator and
  // Past Hierophant wear the Hierophant's red, and the Psaltis the
  // Keryx's teal, on purpose. Officers of different halls may be close
  // (the Dadouchos and Second Adept); the plan records it.
  const halls = {
    outer: [
      "hierophant",
      "praemonstrator",
      "cancellarius",
      "hiereus",
      "hegemon",
      "keryx",
      "stolistes",
      "dadouchos",
      "sentinel",
      "candidate",
    ],
    portal: [
      "chiefAdept",
      "secondAdept",
      "thirdAdept",
      "hiereus",
      "hegemon",
      "aspirant",
    ],
  };

  it.each(Object.entries(halls))(
    "keeps the %s hall's officers apart in both schemes",
    (_hall, officers) => {
      for (const scheme of ["light", "dark"] as const)
        officers.forEach((a, i) => {
          for (const b of officers.slice(i + 1)) {
            const colour = (key: string) =>
              scheme === "light"
                ? roles[key].color!
                : (roles[key].darkColor ?? roles[key].color!);
            expect(
              oklabDistance(colour(a), colour(b)),
              `${a} and ${b}, ${scheme}`,
            ).toBeGreaterThanOrEqual(0.07);
          }
        });
    },
  );

  it("keeps the Hierophant's red, which the lamen and collar wear", () => {
    expect(roles.hierophant.color).toBe("#c80000");
    expect(roles.imperator.color).toBe(roles.hierophant.color);
    expect(roles.pastHierophant.color).toBe(roles.hierophant.color);
  });

  it("leaves the members uncoloured: the hall, not an office", () => {
    expect(roles.member.color).toBeUndefined();
    expect(roles.member.darkColor).toBeUndefined();
  });
});
