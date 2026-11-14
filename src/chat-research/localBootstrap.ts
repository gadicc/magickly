/** Enabled-only actual local assembly. No schema, grant, window, timer or provider request is created. */
import "server-only";
import { researchLocalEndpointIdentity } from "./localEndpoint";

export { researchLocalEndpointIdentity };

import { lookup } from "node:dns/promises";
import { existsSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import {
  RESEARCH_LOCAL_DEPLOYMENT_ERROR,
  type ResearchLocalDeployment,
} from "./localDeployment";
import { loadResearchLocalStartup } from "./localStartup";
import { requirePrivateRetentionDirectory } from "./privateFiles";

const fail = (): never => {
  throw Error(RESEARCH_LOCAL_DEPLOYMENT_ERROR);
};
/** Fixed OS identity, independent of mutable HOME and request data. Never creates directories. */
export function researchLocalOperatorRoot() {
  try {
    const root = join(userInfo().homedir, ".local/share/magickli/chat-corpus");
    if (
      ["/tmp", "/var/tmp"].some(
        (p) => root === p || root.startsWith(p + "/"),
      ) ||
      requirePrivateRetentionDirectory(root).mode !== BigInt(0o700)
    )
      fail();
    for (let path = root; ; path = dirname(path)) {
      if (existsSync(join(path, ".git"))) fail();
      if (dirname(path) === path) break;
    }
    return root;
  } catch {
    return fail();
  }
}
/** Called by the independently bounded shared startup, never directly by a request. Original cancellation is checked after every await before follow-up work. */
export async function bootstrapLocalResearch(
  deployment: ResearchLocalDeployment,
  signal: AbortSignal,
  deadlineAt: number,
) {
  const assert = () => {
    signal.throwIfAborted();
    if (!Number.isFinite(deadlineAt) || performance.now() >= deadlineAt) fail();
  };
  try {
    assert();
    const root = researchLocalOperatorRoot();
    assert();
    const originalRoot = requirePrivateRetentionDirectory(root);
    const recheckRoot = () => {
      assert();
      if (researchLocalOperatorRoot() !== root) fail();
      assert();
      const current = requirePrivateRetentionDirectory(root);
      if (
        (["device", "inode", "mode", "mtime_ns", "ctime_ns"] as const).some(
          (key) => originalRoot[key] !== current[key],
        )
      )
        fail();
      assert();
    };
    assert();
    const addresses = await lookup("db.localtest.me", { all: true });
    assert();
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
    assert();
    const endpoint = researchLocalEndpointIdentity(db.$client.options);
    if (
      endpoint !== deployment.authorityEndpointIdentity ||
      sqlAuthOptions.baseURL !== deployment.origin
    )
      fail();
    recheckRoot();
    assert();
    const handler = loadResearchLocalStartup({
      root,
      independentlyAdoptedStartupSha256: deployment.startupSha256,
      runtimeRevision: deployment.runtimeRevision,
      authorityEndpointIdentity: endpoint,
      generation: "read-only",
      database: db,
      authOptions: sqlAuthOptions,
      apiKey: () => process.env.AI_GATEWAY_API_KEY ?? fail(),
    });
    recheckRoot();
    return handler;
  } catch {
    return fail();
  }
}
