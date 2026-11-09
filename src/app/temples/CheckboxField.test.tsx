import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CheckboxField from "./CheckboxField";

const srcDir = path.join(import.meta.dirname, "../..");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(file);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)
      ? [file]
      : [];
  });
}

describe("CheckboxField", () => {
  it("renders a named, labelled checkbox", () => {
    const html = renderToString(
      <CheckboxField
        name="admin"
        defaultChecked
        label="Temple administrator"
      />,
    );
    expect(html).toMatch(/<input[^>]*name="admin"[^>]*value="true"/);
    expect(html).toMatch(/<input[^>]*checked/);
    expect(html).toContain("Temple administrator");
  });

  // A server component that passes a <Checkbox> to FormControlLabel fails
  // its server render: the control can arrive as a lazy reference without
  // props (the membership page's 500 on 9 November 2026).
  it("keeps FormControlLabel out of server components", () => {
    const servers = sources(srcDir).filter((file) => {
      const source = readFileSync(file, "utf8");
      return (
        source.includes("FormControlLabel") &&
        !/^\s*["']use client["']/.test(source)
      );
    });
    expect(servers.map((file) => path.relative(srcDir, file))).toEqual([]);
  });
});
