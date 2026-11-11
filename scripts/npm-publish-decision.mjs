import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Whether CI publishes a package's tarball, decided from the npm registry's
 * packument (plan 080, decision 3). The rule:
 *
 * - 404, the package does not exist: **skip**. Its first publish is by hand,
 *   since npm cannot configure a trusted publisher for a package it does not
 *   have.
 * - 200 and the version is listed: **skip**. It is published, so a re-run
 *   or a push that does not bump the version does nothing.
 * - 200, the version is absent and greater than `dist-tags.latest` (or there
 *   is no `latest`): **publish**.
 * - 200, the version is absent and not greater: **fail**. A bump that goes
 *   backwards or sideways is a mistake, and a human should look.
 * - Any other status, a network error after the retries, or a body that is
 *   not a packument: **fail**.
 *
 * A pre-release (`0.1.0-rc.1`) publishes under the `next` dist-tag, never
 * `latest`, so `npm install magick-data` keeps the last release. A release
 * publishes under `latest`. It is compared with `latest` all the same: the
 * registry may point `latest` at a package's first version even when that
 * was published under `--tag next`, and a pre-release is lower than its
 * release, so `0.1.0` after `0.1.0-rc.0` publishes.
 *
 * `npm view` is not used: it exits 1 with E404 both for a missing package and
 * for a missing version.
 */

const REGISTRY = "https://registry.npmjs.org/";
/** The abbreviated packument: name, dist-tags, versions and modified. */
const ACCEPT =
  "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*";

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

function parse(version) {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`Not a semantic version: ${version}`);
  return {
    release: match.slice(1, 4).map(Number),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

/** Whether a version carries a pre-release tag, such as `0.1.0-rc.0`. */
export function isPrerelease(version) {
  return parse(version).prerelease.length > 0;
}

/**
 * Semantic-versioning precedence: negative if `a` is lower than `b`, zero if
 * equal, positive if higher. Build metadata is ignored, as the spec says.
 */
export function compareVersions(a, b) {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++)
    if (x.release[i] !== y.release[i]) return x.release[i] - y.release[i];
  // A version without a pre-release is higher than one with.
  if (!x.prerelease.length || !y.prerelease.length)
    return y.prerelease.length - x.prerelease.length;
  for (let i = 0; i < Math.max(x.prerelease.length, y.prerelease.length); i++) {
    const p = x.prerelease[i];
    const q = y.prerelease[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) - Number(q);
    // Numeric identifiers are lower than alphanumeric ones.
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

/**
 * @typedef {object} Decision
 * @property {"publish" | "skip" | "fail"} action
 * @property {"latest" | "next"} [tag] The dist-tag the version publishes
 *   under, whatever the action, so that a dry run can name it; absent only
 *   when the version is not semantic.
 * @property {boolean} [published] True when the registry already lists the
 *   version, which npm would refuse to publish again, even in a dry run.
 * @property {string} reason One line for the log.
 */

/**
 * Fetches the packument and applies the rule above to `name` at `version`.
 * Network errors, 429 and 5xx are retried `retries` times, with a pause
 * between; every request times out after `timeoutMs`.
 *
 * @returns {Promise<Decision>}
 */
export async function decide({ name, version }, options = {}) {
  const request = options.fetch ?? fetch;
  const wait =
    options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const label = `${name}@${version}`;
  let tag;
  try {
    tag = isPrerelease(version) ? "next" : "latest";
  } catch (error) {
    return { action: "fail", reason: `${label}: ${error.message}` };
  }
  const fail = (reason) => ({
    action: "fail",
    tag,
    reason: `${label}: ${reason}`,
  });

  // A scoped name keeps its @ and escapes only the slash, as npm does.
  const url = `${REGISTRY}${name.replace("/", "%2f")}`;
  let response;
  for (let attempt = 0; ; attempt++) {
    let problem;
    try {
      response = await request(url, {
        headers: { Accept: ACCEPT },
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status !== 429 && response.status < 500) break;
      problem = `the registry answered ${response.status}`;
    } catch (error) {
      problem = `the registry could not be reached (${error.name})`;
    }
    if (attempt >= retries)
      return fail(`${problem}, ${attempt + 1} times; failing`);
    await wait(2_000 * (attempt + 1));
  }

  if (response.status === 404)
    return {
      action: "skip",
      tag,
      reason: `${label}: ${name} is not on the registry; its first publish is by hand`,
    };
  if (response.status !== 200)
    return fail(`the registry answered ${response.status}`);

  let packument;
  try {
    packument = await response.json();
  } catch {
    return fail("the registry's answer is not JSON");
  }
  if (
    !packument ||
    typeof packument.versions !== "object" ||
    packument.versions === null
  )
    return fail("the registry's answer has no versions");

  if (Object.hasOwn(packument.versions, version))
    return {
      action: "skip",
      tag,
      published: true,
      reason: `${label} is already published`,
    };

  const latest = packument["dist-tags"]?.latest;
  let greater;
  try {
    greater = latest === undefined || compareVersions(version, latest) > 0;
  } catch (error) {
    return fail(error.message);
  }
  if (!greater)
    return fail(
      `not published, and not greater than latest (${latest}); is the bump a mistake?`,
    );
  return {
    action: "publish",
    tag,
    reason: `${label} is new (latest is ${latest ?? "unset"}); publish under ${tag}`,
  };
}

/** The `package.json` inside a tarball `pnpm pack` made. */
export function tarballManifest(tarball) {
  const result = spawnSync("tar", ["-xzOf", tarball, "package/package.json"], {
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Cannot read package/package.json from ${tarball}`);
  return JSON.parse(result.stdout);
}

// node scripts/npm-publish-decision.mjs <tarball>
// Reads the name and version from the tarball that would be published,
// prints the decision and, under GitHub Actions, writes `publish` and
// `published` (true or false) and `tag` to the step's outputs. Exits 1 when
// the rule fails.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const tarball = process.argv[2];
    if (!tarball) throw new Error("Usage: npm-publish-decision.mjs <tarball>");
    const decision = await decide(tarballManifest(tarball));
    console.log(`${decision.action}: ${decision.reason}`);
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        [
          `publish=${decision.action === "publish"}`,
          `published=${decision.published === true}`,
          `tag=${decision.tag ?? ""}`,
          "",
        ].join("\n"),
      );
    if (decision.action === "fail") process.exitCode = 1;
  } catch (error) {
    console.error(`fail: ${error.message}`);
    process.exitCode = 1;
  }
}
