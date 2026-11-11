import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

/**
 * Whether CI publishes a package's tarball, decided from the npm registry's
 * packument (plan 080, decision 3). The rule:
 *
 * - 404, the package does not exist: **skip**. Its first publish is by hand,
 *   since npm cannot configure a trusted publisher for a package it does not
 *   have. Once it exists, `expectExists` turns a 404 into a **fail**, so a
 *   registry that loses the package, or a misspelt name, cannot skip quietly
 *   forever.
 * - 200 and the version is listed: **skip**. It is published, so a re-run
 *   or a push that does not bump the version does nothing. When the caller
 *   gives the tarball's integrity and it differs from the registry's for
 *   that version, the decision carries a warning: the content changed
 *   without a bump.
 * - 200, the version is absent and greater than `dist-tags.latest` (or there
 *   is no `latest`), and for a pre-release greater than `dist-tags.next` as
 *   well (or there is no `next`): **publish**.
 * - 200, the version is absent and not greater: **fail**. A bump that goes
 *   backwards or sideways, or that would move `next` backwards, is a
 *   mistake, and a human should look.
 * - Any other status, a network error or timeout after the retries, or a
 *   body that is not a packument: **fail**.
 *
 * A failure carries its cause: `rule` when the manifest is at fault (the
 * bump, or a version that is not semantic), `registry` when the registry's
 * state or answer is. CI on a pull request can then warn on what the
 * repository does not control (plan 080, stage A review, M2).
 *
 * CI publishes a pre-release (`0.1.0-rc.0`) under the `next` dist-tag and a
 * release under `latest`. A release is compared with `latest` only: the
 * registry may point `latest` at a package's first version even when that
 * was published under `--tag next`, and a pre-release is lower than its
 * release, so `0.1.0` after `0.1.0-rc.0` publishes.
 *
 * The registry's CDN caches a packument for up to five minutes, so a re-run
 * soon after a publish can decide "publish" for a version npm then refuses
 * ("cannot publish over the previously published versions"). That fails
 * safe; publish.yml treats that refusal as a skip.
 *
 * `npm view` is not used: it exits 1 with E404 both for a missing package and
 * for a missing version.
 */

/** The public registry, unless the caller names another. */
export const REGISTRY = "https://registry.npmjs.org/";
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
 * @property {"rule" | "registry"} [cause] Why it failed, on a failure: the
 *   manifest's version, or the registry's state or answer.
 * @property {string} [warning] Something to look at that does not change
 *   the action, such as published content that differs from the tarball.
 * @property {string} reason One line for the log.
 */

/**
 * @typedef {object} DecideOptions
 * @property {typeof fetch} [fetch]
 * @property {(ms: number) => Promise<void>} [wait]
 * @property {number} [retries] Retries after a network error, a timeout,
 *   429 or 5xx; 2 by default.
 * @property {number} [timeoutMs] Per request, body included; 15 s.
 * @property {string} [registry] The registry's base URL; the public one by
 *   default.
 * @property {boolean} [expectExists] A 404 fails instead of skipping.
 */

/**
 * Fetches the packument and applies the rule above to `name` at `version`.
 * `integrity`, the tarball's `sha512-…` integrity, is compared with the
 * registry's when the version is already published.
 *
 * @param {{ name: string, version: string, integrity?: string }} manifest
 * @param {DecideOptions} [options]
 * @returns {Promise<Decision>}
 */
export async function decide({ name, version, integrity }, options = {}) {
  const request = options.fetch ?? fetch;
  const wait =
    options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const registry = (options.registry ?? REGISTRY).replace(/\/*$/, "/");
  const label = `${name}@${version}`;
  let tag;
  try {
    tag = isPrerelease(version) ? "next" : "latest";
  } catch (error) {
    return {
      action: "fail",
      cause: "rule",
      reason: `${label}: ${error.message}`,
    };
  }
  const fail = (cause, reason) => ({
    action: "fail",
    tag,
    cause,
    reason: `${label}: ${reason}`,
  });

  // A scoped name keeps its @ and escapes only the slash, as npm does.
  const url = `${registry}${name.replace("/", "%2f")}`;
  let status;
  let body;
  for (let attempt = 0; ; attempt++) {
    let problem;
    try {
      // The timeout covers the body as well as the headers.
      const response = await request(url, {
        headers: { Accept: ACCEPT },
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      status = response.status;
      if (status === 429 || status >= 500)
        problem = `the registry answered ${status}`;
      else if (status !== 200) break;
      else
        try {
          body = await response.text();
          break;
        } catch (error) {
          problem =
            error.name === "TimeoutError"
              ? "the registry timed out while sending its answer"
              : `the registry's answer could not be read (${error.name})`;
        }
    } catch (error) {
      problem =
        error.name === "TimeoutError"
          ? "the registry timed out"
          : `the registry could not be reached (${error.name})`;
    }
    if (attempt >= retries)
      return fail("registry", `${problem}, ${attempt + 1} times; failing`);
    await wait(2_000 * (attempt + 1));
  }

  if (status === 404)
    return options.expectExists
      ? fail(
          "registry",
          `${name} is not on the registry, which should have it; failing`,
        )
      : {
          action: "skip",
          tag,
          reason: `${label}: ${name} is not on the registry; its first publish is by hand`,
        };
  if (status !== 200)
    return fail("registry", `the registry answered ${status}`);

  let packument;
  try {
    packument = JSON.parse(body);
  } catch {
    return fail("registry", "the registry's answer is not JSON");
  }
  if (
    !packument ||
    typeof packument.versions !== "object" ||
    packument.versions === null
  )
    return fail("registry", "the registry's answer has no versions");

  if (Object.hasOwn(packument.versions, version)) {
    const listed = packument.versions[version]?.dist?.integrity;
    const decision = {
      action: "skip",
      tag,
      published: true,
      reason: `${label} is already published`,
    };
    if (integrity && listed && listed !== integrity)
      decision.warning = `${label} is published with integrity ${listed}, but this tarball's is ${integrity}: its content changed without a version bump`;
    return decision;
  }

  const distTags = packument["dist-tags"] ?? {};
  // A release is compared with latest; a pre-release with next as well, so
  // that next never moves backwards.
  const against = tag === "next" ? ["latest", "next"] : ["latest"];
  for (const distTag of against) {
    const current = distTags[distTag];
    if (current === undefined) continue;
    let greater;
    try {
      greater = compareVersions(version, current) > 0;
    } catch (error) {
      return fail("registry", `${distTag}: ${error.message}`);
    }
    if (!greater)
      return fail(
        "rule",
        `not published, and not greater than ${distTag} (${current}); is the bump a mistake?`,
      );
  }
  return {
    action: "publish",
    tag,
    reason: `${label} is new (latest is ${distTags.latest ?? "unset"}${
      tag === "next" ? `, next ${distTags.next ?? "unset"}` : ""
    }); publish under ${tag}`,
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

/**
 * A file's integrity as npm records it (`dist.integrity`): `sha512-` and
 * the base64 SHA-512 of its bytes.
 */
export function integrityOf(path) {
  return `sha512-${createHash("sha512").update(readFileSync(path)).digest("base64")}`;
}

const USAGE = `Usage: npm-publish-decision.mjs (<tarball> | --manifest <package.json>)
  [--expect-exists] [--advisory registry|all] [--registry <url>]`;

/**
 * The command line, for CI. Reads the name and version from the tarball
 * that would be published (and its integrity, for the published-content
 * check) or from a `package.json`, prints the decision and, under GitHub
 * Actions, writes `action`, `publish` and `published` (true or false),
 * `tag`, `name` and `version` to the step's outputs; ci.yml and
 * publish.yml read them. Exits 1 when the rule fails, unless `--advisory`
 * covers the failure's cause: `registry` for what the registry says, `all`
 * for any failure. Then it warns instead.
 *
 * Its tests run it as CI does, against a local registry (`--registry`).
 *
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<number>} The exit code.
 */
export async function main(argv, env = process.env) {
  const log = console.log;
  const annotate = (level, message) =>
    env.GITHUB_ACTIONS === "true"
      ? `::${level}::${message}`
      : `${level}: ${message}`;
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        manifest: { type: "string" },
        "expect-exists": { type: "boolean", default: false },
        advisory: { type: "string" },
        registry: { type: "string" },
      },
    });
    const tarball = positionals[0];
    if (
      positionals.length > 1 ||
      (tarball === undefined) === (values.manifest === undefined) ||
      (values.advisory !== undefined &&
        !["registry", "all"].includes(values.advisory))
    )
      throw new Error(USAGE);
    const { name, version } = tarball
      ? tarballManifest(tarball)
      : JSON.parse(readFileSync(values.manifest, "utf8"));
    const integrity = tarball ? integrityOf(tarball) : undefined;
    if (integrity) log(`tarball: ${name}@${version} ${integrity}`);
    const decision = await decide(
      { name, version, integrity },
      { registry: values.registry, expectExists: values["expect-exists"] },
    );
    log(`${decision.action}: ${decision.reason}`);
    if (decision.warning) log(annotate("warning", decision.warning));
    if (env.GITHUB_OUTPUT)
      appendFileSync(
        env.GITHUB_OUTPUT,
        [
          `action=${decision.action}`,
          `publish=${decision.action === "publish"}`,
          `published=${decision.published === true}`,
          `tag=${decision.tag ?? ""}`,
          `name=${name}`,
          `version=${version}`,
          "",
        ].join("\n"),
      );
    if (decision.action !== "fail") return 0;
    if (
      values.advisory === "all" ||
      (values.advisory === "registry" && decision.cause === "registry")
    ) {
      log(annotate("warning", `${decision.reason} (advisory here)`));
      return 0;
    }
    return 1;
  } catch (e) {
    console.error(`fail: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
