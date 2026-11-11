/**
 * The package's `prepublishOnly` and `prepack` guards (plan 080,
 * decision 3).
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
 * guard stops a directory publish and never a tarball.
 *
 * That left a way round it: `npm pack` packs the source manifest as it is,
 * `exports` into `./src/` and all, and `npm publish` of that tarball runs
 * no script. So the same file, run with `--pack` as the `prepack` script,
 * refuses to pack under anything but pnpm.
 *
 * It asks `npm_execpath`, which every run of a script sets afresh to the
 * package manager running it: npm to its own `npm-cli.js`, pnpm to its
 * `pnpm` binary (or `pnpm.cjs`). `npm_config_user_agent` is not enough on
 * its own: npm passes on one it inherits, so npm run under pnpm (`pnpm exec
 * npm pack`, or any shell a pnpm script started) looked like pnpm (plan
 * 080, second stage A review). The guard wants both to say pnpm, and
 * refuses when either is missing. `pnpm install` never runs `prepack`.
 *
 * `--ignore-scripts` skips both guards; don't.
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

/** The basename of pnpm's own executable, as `npm_execpath` names it. */
const PNPM = /^pnpm(\.[cm]?js|\.exe)?$/i;

/**
 * Why the package must not be packed by the package manager running this
 * script, or `undefined` if it may be: only pnpm applies
 * `publishConfig.exports`. `env` is the script's environment; only
 * `npm_execpath` and `npm_config_user_agent` are read.
 *
 * @param {Record<string, string | undefined>} env
 */
export function packRefusal(env) {
  const execpath = env.npm_execpath ?? "";
  const userAgent = env.npm_config_user_agent ?? "";
  const runner = execpath.split(/[\\/]/).pop() ?? "";
  if (PNPM.test(runner) && userAgent.startsWith("pnpm/")) return undefined;
  const tool = !execpath
    ? "an unknown tool (npm_execpath is not set)"
    : runner === "npm-cli.js"
      ? `npm (${execpath})`
      : execpath;
  return [
    `Refusing to pack magick-data with ${tool}: only pnpm pack swaps its`,
    "exports for publishConfig.exports, and this tarball's would point into",
    "./src/. Pack and verify it with",
    "  pnpm --filter magick-data smoke --keep-tarball <path>",
    "(plan 080, decision 3).",
  ].join("\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  // npm and pnpm name the manifest they are publishing; a lifecycle script
  // runs in the package's directory either way.
  const message = process.argv.includes("--pack")
    ? packRefusal(process.env)
    : refusal(
        JSON.parse(
          readFileSync(
            process.env.npm_package_json || join(process.cwd(), "package.json"),
            "utf8",
          ),
        ),
      );
  if (message) {
    console.error(message);
    process.exitCode = 1;
  }
}
