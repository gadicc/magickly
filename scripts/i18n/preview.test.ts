import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("previews SDK inputs with provider imports blocked and no model configuration", () => {
  const dir = mkdtempSync(join(tmpdir(), "i18n-preview-"));
  const hook = join(dir, "block-provider.mjs");
  writeFileSync(
    hook,
    `import {registerHooks} from 'node:module';registerHooks({resolve(s,c,next){if(s==='ai')throw Error('PROVIDER_LOADED');return next(s,c)}});`,
  );
  try {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--import",
        hook,
        "scripts/i18n/translate.mts",
        "--write",
        "--preview",
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, I18N_TRANSLATION_MODEL: "" },
        encoding: "utf8",
        timeout: 30000,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).responseSchema).toBeDefined();
    expect(result.stdout).not.toContain("Saved validated");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 35000);
