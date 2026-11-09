import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_PAGES } from "../../src/seo/pages";
import { pageProse } from "./prose";

const root = fileURLToPath(new URL("../../", import.meta.url));
const prose = Object.fromEntries(
  Object.keys(PUBLIC_PAGES).map((path) => [path, pageProse(root, path)]),
);
mkdirSync(resolve(root, "src/search/generated"), { recursive: true });
const output = resolve(root, "src/search/generated/prose.json");
const next = JSON.stringify(prose);
if (!existsSync(output) || readFileSync(output, "utf8") !== next)
  writeFileSync(output, next);
console.log(
  `search: extracted public JSX prose for ${Object.keys(prose).length} pages`,
);
