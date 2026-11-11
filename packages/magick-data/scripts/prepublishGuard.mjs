/**
 * The package's `prepublishOnly` guard (plan 080, decision 3).
 *
 * The source manifest's `exports` point into `./src/`, at TypeScript the
 * tarball does not carry; only `pnpm pack` swaps them for
 * `publishConfig.exports`. So `npm publish` or `pnpm publish` run in this
 * directory would ship either a broken package or whatever `lib/` and
 * `dist/` happen to hold. What may be published is the tarball the smoke
 * test verified:
 *
 *   pnpm --filter magick-data smoke --keep-tarball <path>
 *   npm publish <path> …
 *
 * Neither package manager runs lifecycle scripts when publishing a tarball,
 * and `pnpm pack` drops `prepublishOnly` from the packed manifest, so this
 * guard stops a directory publish and never a tarball. `--ignore-scripts`
 * would skip it; don't.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Every file path an `exports` value names, conditions included. */
function targets(exports) {
  if (typeof exports === "string") return [exports];
  if (Array.isArray(exports)) return exports.flatMap(targets);
  if (exports && typeof exports === "object")
    return Object.values(exports).flatMap(targets);
  return [];
}

/**
 * Why a manifest must not be published, or `undefined` if it may be: it may
 * not when any of its `exports` points into `./src/`.
 */
export function refusal(manifest) {
  const intoSrc = targets(manifest.exports).filter((target) =>
    target.startsWith("./src/"),
  );
  if (intoSrc.length === 0) return undefined;
  return [
    `Refusing to publish ${manifest.name} from its source manifest:`,
    `${intoSrc.length} of its exports point into ./src/ (${intoSrc[0]}, …).`,
    "Publish the tarball the smoke test verified instead:",
    "  pnpm --filter magick-data smoke --keep-tarball <path>",
    "  npm publish <path> --access public",
    "(plan 080, decision 3).",
  ].join("\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  // npm and pnpm name the manifest they are publishing; a lifecycle script
  // runs in the package's directory either way.
  const path =
    process.env.npm_package_json || join(process.cwd(), "package.json");
  const message = refusal(JSON.parse(readFileSync(path, "utf8")));
  if (message) {
    console.error(message);
    process.exitCode = 1;
  }
}
