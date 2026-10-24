import { HALL_ROLES } from "@magick-components/gd/hall/vocabulary";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
        <TaskFrame role={role} roles={roles}>
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
