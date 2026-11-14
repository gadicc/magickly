import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
/** Legacy and app callers share the identical implementation and limits. */
import { expect, it } from "vitest";
import * as shared from "./privateFiles";

it("reads larger public runtime metadata without relaxing the existing startup manifest limit", () => {
  const dir = mkdtempSync("/tmp/magickli-runtime-metadata-");
  chmodSync(dir, 0o700);
  const file = join(dir, "manifest.json");
  try {
    const text = " ".repeat(1024 * 1024 + 1);
    writeFileSync(file, text, { mode: 0o400 });
    expect(shared.readPrivateResearchRuntimeManifest(file).text).toBe(text);
    expect(() => shared.readPrivateRetentionManifest(file)).toThrow();
    chmodSync(file, 0o600);
    writeFileSync(file, Buffer.alloc(4 * 1024 * 1024 + 1));
    chmodSync(file, 0o400);
    expect(() => shared.readPrivateResearchRuntimeManifest(file)).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("imports the private-file helper in plain pinned Node with empty env, native type stripping and blocked private-file/network ports", () => {
  const dir = mkdtempSync("/tmp/magickli-native-reader-test-"),
    legacyUrl = pathToFileURL(
      join(process.cwd(), "src/chat-research/privateFiles.ts"),
    ).href;
  // Source-module resolution/read I/O is necessary. Only the listed public code
  // files may be opened; private paths and all network work remain blocked.
  const code = [
    "import fs from 'node:fs';",
    "import net from 'node:net';",
    "import {syncBuiltinESMExports} from 'node:module';",
    "const codePaths=new Set(" +
      JSON.stringify([
        fileURLToPath(legacyUrl),
        legacyUrl,
        join(process.cwd(), "src/chat-research/privateFiles.ts"),
        pathToFileURL(join(process.cwd(), "src/chat-research/privateFiles.ts"))
          .href,
      ]) +
      "), codeFds=new Set();",
    "const open=fs.openSync;fs.openSync=(path,...args)=>{if(!codePaths.has(String(path)))throw Error('Unexpected runtime file open');const fd=open(path,...args);codeFds.add(fd);return fd;};",
    "for(const key of ['fstatSync','readSync']){const original=fs[key];fs[key]=(fd,...args)=>{if(!codeFds.has(fd))throw Error('Unexpected runtime descriptor');return original(fd,...args);};}",
    "const close=fs.closeSync;fs.closeSync=(fd)=>{codeFds.delete(fd);return close(fd);};",
    "const lstat=fs.lstatSync;fs.lstatSync=(path,...args)=>{if(!codePaths.has(String(path)))throw Error('Unexpected private-file inspection');return lstat(path,...args);};",
    "net.Socket.prototype.connect=()=>{throw Error('No network allowed');};",
    "globalThis.fetch=()=>{throw Error('No fetch allowed');};",
    "syncBuiltinESMExports();",
    "const value=await import(" + JSON.stringify(legacyUrl) + ");",
    "console.log(JSON.stringify({exports:Object.keys(value).sort(),env:Object.keys(process.env)}));",
  ].join(String.fromCharCode(10));
  try {
    const result = JSON.parse(
      execFileSync(process.execPath, ["--input-type=module", "--eval", code], {
        cwd: dir,
        env: {} as NodeJS.ProcessEnv,
        encoding: "utf8",
        timeout: 5000,
      }),
    );
    expect(result.exports).toEqual(Object.keys(shared).sort());
    expect(result.env).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
