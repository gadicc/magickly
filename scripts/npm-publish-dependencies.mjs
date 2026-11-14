import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  compareVersions,
  fetchPackument,
  isPrerelease,
  parseVersion,
  tarballManifest,
} from "./npm-publish-decision.mjs";

/**
 * Before CI publishes a tarball, every dependency it has on another package
 * of this repository must resolve on npm (plan 080, stage G review, H1).
 * magick-components depends on magick-data at the version it was built
 * with (`workspace:^`, packed as `^0.2.0` and so on), and a version npm
 * publishes is permanent: published against a magick-data npm lacks, it
 * could never be installed.
 *
 * For each dependency of the tarball's manifest (`dependencies`,
 * `optionalDependencies` and `peerDependencies`) that names a package of
 * this repository, the registry must list a version satisfying its range:
 *
 * - if it does: **ok**;
 * - if it does not, and that package is being published in the same run
 *   (publish.yml's legs run side by side): **wait** and ask again, every
 *   15 seconds for five minutes, since npm's CDN can lag a couple of
 *   minutes behind a publish it accepted; then **fail**;
 * - otherwise: **fail** at once.
 *
 * It reads the tarball's `package/package.json` with `tar`, as the decision
 * does, and runs nothing from it; it imports only Node's own modules and
 * the decision's registry and version helpers, so publish.yml's publish
 * job can run it with no install.
 *
 * Ranges are the ones pnpm packs from `workspace:` (`^x.y.z`, `~x.y.z` and
 * an exact `x.y.z`); any other range fails, saying so, rather than being
 * guessed at. A pre-release satisfies a range only when the range names a
 * pre-release of the same `x.y.z`, as npm resolves them.
 */

/** How often to ask again while waiting for a package of the same run. */
export const WAIT_MS = 15_000;
/** How many times to ask in all while waiting: five minutes at 15 s. */
export const WAIT_ATTEMPTS = 21;

/** The fields of a manifest whose packages an install resolves. */
const FIELDS = ["dependencies", "optionalDependencies", "peerDependencies"];

const RANGE = /^(\^|~|=)?\s*(\S+)$/;

/**
 * Whether `version` satisfies `range`, for the ranges pnpm packs from a
 * `workspace:` dependency. Throws on any other range, or a version that is
 * not semantic.
 *
 * @param {string} version
 * @param {string} range
 * @returns {boolean}
 */
export function satisfies(version, range) {
  if (range.startsWith("workspace:"))
    throw new Error(
      `${range} was not replaced by a version when the tarball was packed`,
    );
  const match = RANGE.exec(range.trim());
  let base;
  try {
    base = match && parseVersion(match[2]);
  } catch {
    base = undefined;
  }
  if (!match || !base)
    throw new Error(
      `${range} is not a range this check understands (^x.y.z, ~x.y.z or x.y.z)`,
    );
  const operator = match[1] ?? "=";
  const low = match[2];
  const [major, minor, patch] = base.release;
  // A pre-release only where the range names one of the same release.
  if (isPrerelease(version)) {
    const [x, y, z] = parseVersion(version).release;
    if (!isPrerelease(low) || x !== major || y !== minor || z !== patch)
      return false;
  }
  if (operator === "=") return compareVersions(version, low) === 0;
  if (compareVersions(version, low) < 0) return false;
  const high =
    operator === "~"
      ? `${major}.${minor + 1}.0`
      : major > 0
        ? `${major + 1}.0.0`
        : minor > 0
          ? `0.${minor + 1}.0`
          : `0.0.${patch + 1}`;
  // Below the next release itself, not its pre-releases: ^0.2.0 takes
  // neither 0.3.0 nor 0.3.0-rc.0 (the pre-release rule above already
  // refuses the latter).
  return compareVersions(version, high) < 0;
}

/**
 * The names of this repository's packages: each `package.json` one level
 * under `dir`.
 *
 * @param {string} dir
 * @returns {Set<string>}
 */
export function workspacePackages(dir) {
  const names = new Set();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let manifest;
    try {
      manifest = JSON.parse(
        readFileSync(join(dir, entry.name, "package.json"), "utf8"),
      );
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (typeof manifest.name === "string") names.add(manifest.name);
  }
  return names;
}

/**
 * A manifest's dependencies on `packages`, each with its range and field.
 *
 * @param {Record<string, any>} manifest
 * @param {Set<string>} packages
 * @returns {Array<{ name: string, range: string, field: string }>}
 */
export function workspaceDependencies(manifest, packages) {
  return FIELDS.flatMap((field) =>
    Object.entries(manifest[field] ?? {})
      .filter(([name]) => packages.has(name) && name !== manifest.name)
      .map(([name, range]) => ({ name, range: String(range), field })),
  );
}

/**
 * Whether the registry lists a version of `name` satisfying `range`: `{ ok:
 * true, version }` with the highest such version, or `{ ok: false, reason
 * }`.
 *
 * @param {string} name
 * @param {string} range
 * @param {import("./npm-publish-decision.mjs").FetchOptions} options
 */
export async function resolvable(name, range, options) {
  const fetched = await fetchPackument(name, options);
  if ("error" in fetched) return { ok: false, reason: fetched.error };
  if (fetched.status === 404)
    return { ok: false, reason: `${name} is not on the registry` };
  const listed = Object.keys(fetched.packument.versions).filter((version) => {
    try {
      return satisfies(version, range);
    } catch (error) {
      // The range was checked before asking; a listed version that is not
      // semantic satisfies nothing.
      if (/not a range/.test(error.message)) throw error;
      return false;
    }
  });
  if (!listed.length)
    return {
      ok: false,
      reason: `the registry lists no version of ${name} satisfying ${range}`,
    };
  listed.sort(compareVersions);
  return { ok: true, version: listed[listed.length - 1] };
}

/**
 * @typedef {import("./npm-publish-decision.mjs").FetchOptions & {
 *   packages: Set<string>,
 *   sameRun?: Set<string>,
 *   attempts?: number,
 *   intervalMs?: number,
 *   log?: (line: string) => void,
 * }} CheckOptions
 */

/**
 * Checks every dependency of `manifest` on `packages`, waiting for those in
 * `sameRun`. Returns the failures, one line each; none means the tarball
 * may be published.
 *
 * @param {Record<string, any>} manifest
 * @param {CheckOptions} options
 * @returns {Promise<string[]>}
 */
export async function checkDependencies(manifest, options) {
  const log = options.log ?? console.log;
  const wait =
    options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const attempts = options.attempts ?? WAIT_ATTEMPTS;
  const intervalMs = options.intervalMs ?? WAIT_MS;
  const label = `${manifest.name}@${manifest.version}`;
  const dependencies = workspaceDependencies(manifest, options.packages);
  if (!dependencies.length) {
    log(`${label} depends on no other package of this repository`);
    return [];
  }
  const failures = [];
  for (const { name, range, field } of dependencies) {
    const what = `${label} depends on ${name} ${range} (${field})`;
    try {
      // Refuse a range not understood before asking, and before waiting.
      satisfies("0.0.0", range);
    } catch (error) {
      failures.push(`${what}: ${error.message}`);
      continue;
    }
    const waiting = options.sameRun?.has(name) ?? false;
    for (let attempt = 1; ; attempt++) {
      const found = await resolvable(name, range, options);
      if (found.ok) {
        log(`${what}: npm has ${found.version}`);
        break;
      }
      if (!waiting) {
        failures.push(
          `${what}, but ${found.reason}, and ${name} is not being published in this run: publishing would leave a version that cannot be installed`,
        );
        break;
      }
      if (attempt >= attempts) {
        failures.push(
          `${what}, published in this run, but after ${attempts} tries ${found.reason}: has its publish failed?`,
        );
        break;
      }
      log(
        `${what}: ${found.reason}; it is being published in this run, so asking again in ${intervalMs / 1000} s (${attempt} of ${attempts})`,
      );
      await wait(intervalMs);
    }
  }
  return failures;
}

const USAGE = `Usage: npm-publish-dependencies.mjs <tarball>
  [--same-run <publish.yml's list, [{"package": …}, …]>]
  [--packages <dir>] [--registry <url>]`;

/**
 * The command line, for publish.yml's publish job: checks the tarball's
 * dependencies on the packages under `--packages` (the repository's
 * `packages/` by default), waiting for those `--same-run` lists, decide's
 * JSON list of what this run publishes. Exits 1, with an `::error::` per
 * failure under GitHub Actions, unless every one resolves.
 *
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} [env]
 * @param {Partial<CheckOptions>} [overrides] For the tests: the waits.
 * @returns {Promise<number>} The exit code.
 */
export async function main(argv, env = process.env, overrides = {}) {
  const annotate = (message) =>
    env.GITHUB_ACTIONS === "true" ? `::error::${message}` : `fail: ${message}`;
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        "same-run": { type: "string" },
        packages: { type: "string" },
        registry: { type: "string" },
      },
    });
    if (positionals.length !== 1) throw new Error(USAGE);
    const sameRun = new Set();
    if (values["same-run"] !== undefined) {
      const list = JSON.parse(values["same-run"]);
      if (!Array.isArray(list)) throw new Error(USAGE);
      for (const entry of list)
        if (typeof entry?.package === "string") sameRun.add(entry.package);
        else throw new Error(USAGE);
    }
    const manifest = tarballManifest(positionals[0]);
    const failures = await checkDependencies(manifest, {
      packages: workspacePackages(
        values.packages ??
          fileURLToPath(new URL("../packages/", import.meta.url)),
      ),
      sameRun,
      registry: values.registry,
      ...overrides,
    });
    for (const failure of failures) console.log(annotate(failure));
    return failures.length ? 1 : 0;
  } catch (e) {
    console.log(annotate(e.message));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
