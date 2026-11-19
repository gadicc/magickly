import { pathToFileURL } from "node:url";

const idPattern = /^dpl_[A-Za-z0-9]{1,100}$/;
const terminal = new Set(["succeeded", "failed", "skipped"]);

/**
 * Guard a configuration-only promotion inside the serialized release workflow.
 * Provider source metadata is a declaration, not artifact byte attestation.
 * The private deployment owner must separately bind its payload and adoption.
 */
export async function checkExistingPromotion(env, options = {}) {
  const now = options.now ?? Date.now;
  const request = options.fetch ?? fetch;
  const required = (name) => {
    if (typeof env[name] !== "string" || !env[name])
      throw new Error("Missing existing-promotion setting");
    return env[name];
  };
  const targetId = required("EXPECTED_DEPLOYMENT_ID");
  const baselineId = required("EXPECTED_PRODUCTION_DEPLOYMENT_ID");
  const sha = required("EXPECTED_SOURCE_SHA");
  const expiry = Number(required("PROMOTION_EXPIRES_AT_MS"));
  const alive = () => {
    const remaining = expiry - now();
    if (
      !Number.isSafeInteger(expiry) ||
      remaining <= 0 ||
      remaining > 3_600_000
    )
      throw new Error("Existing-promotion window is invalid or expired");
  };
  alive();
  const url = new URL(required("DEPLOYMENT_URL"));
  if (
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_SHA !== sha ||
    env.GITHUB_REPOSITORY !== "gadicc/magickly" ||
    !/^[a-f0-9]{40}$/.test(sha) ||
    !idPattern.test(targetId) ||
    !idPattern.test(baselineId) ||
    targetId === baselineId ||
    url.protocol !== "https:" ||
    !/^[a-z0-9][a-z0-9-]*\.vercel\.app$/.test(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid existing-promotion identity");
  const projectId = required("VERCEL_PROJECT_ID");
  const teamId = required("VERCEL_ORG_ID");
  const token = required("VERCEL_TOKEN");
  const api = async (path) => {
    alive();
    const endpoint = new URL(path, "https://api.vercel.com");
    endpoint.searchParams.set("teamId", teamId);
    const response = await request(endpoint.href, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(Math.min(30_000, expiry - now())),
    });
    if (!response.ok)
      throw new Error("Existing-promotion provider check failed");
    const value = await response.json();
    alive();
    return value;
  };
  const project = async () => {
    const value = await api(
      `/v9/projects/${encodeURIComponent(projectId)}?rollbackInfo=true`,
    );
    const job = value.lastAliasRequest;
    if (
      value.id !== projectId ||
      value.accountId !== teamId ||
      value.rollingRelease ||
      value.targets?.production?.id !== baselineId ||
      (job != null &&
        (!idPattern.test(job.toDeploymentId) ||
          !Number.isSafeInteger(job.requestedAt) ||
          job.requestedAt <= 0 ||
          !["promote", "rollback"].includes(job.type) ||
          !terminal.has(job.jobStatus)))
    )
      throw new Error("Production baseline changed or is unsettled");
    return job == null
      ? null
      : {
          toDeploymentId: job.toDeploymentId,
          requestedAt: job.requestedAt,
          type: job.type,
          jobStatus: job.jobStatus,
        };
  };
  const alias = async () => {
    const value = await api("/v4/aliases/magick.ly");
    if (
      value.alias !== "magick.ly" ||
      value.projectId !== projectId ||
      value.deploymentId !== baselineId
    )
      throw new Error("Canonical production alias changed");
  };
  const deployment = async (id) => {
    const value = await api(`/v13/deployments/${encodeURIComponent(id)}`);
    if (
      value.id !== id ||
      value.projectId !== projectId ||
      value.target !== "production" ||
      value.readyState !== "READY" ||
      value.meta?.githubCommitSha !== sha
    )
      throw new Error("Existing-promotion source or deployment mismatch");
    return value;
  };
  const currentMain = async () => {
    alive();
    const response = await request(
      "https://api.github.com/repos/gadicc/magickly/git/ref/heads/main",
      {
        headers: {
          Authorization: `Bearer ${required("GITHUB_TOKEN")}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        redirect: "error",
        signal: AbortSignal.timeout(Math.min(30_000, expiry - now())),
      },
    );
    if (!response.ok) throw new Error("Current main source check failed");
    const value = await response.json();
    alive();
    if (
      value.ref !== "refs/heads/main" ||
      value.object?.type !== "commit" ||
      value.object.sha !== sha
    )
      throw new Error("Main changed since this workflow was dispatched");
  };
  await currentMain();
  const before = await project();
  await alias();
  const target = await deployment(targetId);
  if (target.url !== url.hostname)
    throw new Error("Existing-promotion URL mismatch");
  // Equal already-live source means this path cannot skip a new code migration.
  await deployment(baselineId);
  await alias();
  const after = await project();
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error("Production promotion changed during verification");
  await currentMain();
  alive();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await checkExistingPromotion(process.env);
    console.log("Existing-promotion identity and baseline checks passed.");
  } catch {
    console.error(
      "Existing-promotion check refused; inspect the release before proceeding.",
    );
    process.exitCode = 1;
  }
}
