/** Enabled-only new-purpose assembly. No source/window/cleanup installation, renewal or provider call occurs here. */
import "server-only";
import { lookup } from "node:dns/promises";
import { existsSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import type { ResearchLocalDeployment } from "./localDeployment";
import { researchLocalEndpointIdentity } from "./localEndpoint";
import { RESEARCH_OPERATOR_DEPLOYMENT_ERROR } from "./operatorDeployment";
import { loadResearchOperatorStartup } from "./operatorStartup";
import { requirePrivateRetentionDirectory } from "./privateFiles";
/** Separate OS-owned root: adding a new service must not change the frozen reader's pinned chat-corpus root. Never creates or repairs it. */
export function researchOperatorServiceRoot() {
  try {
    const root = join(
      userInfo().homedir,
      ".local/share/magickli/operator-research",
    );
    if (
      ["/tmp", "/var/tmp"].some(
        (path) => root === path || root.startsWith(path + "/"),
      ) ||
      requirePrivateRetentionDirectory(root).mode !== BigInt(0o700)
    )
      throw Error();
    for (let path = root; ; path = dirname(path)) {
      if (existsSync(join(path, ".git"))) throw Error();
      if (dirname(path) === path) break;
    }
    return root;
  } catch {
    throw Error(RESEARCH_OPERATOR_DEPLOYMENT_ERROR);
  }
}
/** Actual code/endpoint/account custody and a loopback-bound immutable launcher remain outer requirements. */
export async function bootstrapOperatorResearch(
  deployment: ResearchLocalDeployment,
  signal: AbortSignal,
  deadlineAt: number,
) {
  const fail = (): never => {
      throw Error(RESEARCH_OPERATOR_DEPLOYMENT_ERROR);
    },
    active = () => {
      signal.throwIfAborted();
      if (!Number.isFinite(deadlineAt) || performance.now() >= deadlineAt)
        fail();
    };
  try {
    active();
    const root = researchOperatorServiceRoot();
    active();
    const original = requirePrivateRetentionDirectory(root);
    active();
    const recheck = () => {
      active();
      if (researchOperatorServiceRoot() !== root) fail();
      active();
      const current = requirePrivateRetentionDirectory(root);
      if (
        (["device", "inode", "mode", "mtime_ns", "ctime_ns"] as const).some(
          (key) => original[key] !== current[key],
        )
      )
        fail();
      active();
    };
    const addresses = await lookup("db.localtest.me", { all: true });
    active();
    if (
      !addresses.length ||
      addresses.some(
        ({ address }) => address !== "127.0.0.1" && address !== "::1",
      )
    )
      fail();
    const [{ db }, { sqlAuthOptions }] = await Promise.all([
      import("../db/neonFull"),
      import("../auth/runtime"),
    ]);
    active();
    const endpoint = researchLocalEndpointIdentity(db.$client.options);
    if (
      endpoint !== deployment.authorityEndpointIdentity ||
      sqlAuthOptions.baseURL !== deployment.origin
    )
      fail();
    recheck();
    const handler = loadResearchOperatorStartup({
      root,
      independentlyAdoptedStartupSha256: deployment.startupSha256,
      runtimeRevision: deployment.runtimeRevision,
      authorityEndpointIdentity: endpoint,
      database: db,
      authOptions: sqlAuthOptions,
      apiKey: () => process.env.AI_GATEWAY_API_KEY ?? fail(),
    });
    recheck();
    return handler;
  } catch {
    return fail();
  }
}
