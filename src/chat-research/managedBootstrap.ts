/** Hosted-only assembly. Every private load remains behind the existing fresh canonical operator gate. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { parseBoundedResearchJson } from "./boundedJson";
import { withinResearchDeadline } from "./boundedWork";
import { failure } from "./httpIngress";
import { createResearchManagedDatabase } from "./managedDatabase";
import {
  prepareResearchManagedDeployment,
  RESEARCH_MANAGED_DEPLOYMENT_ERROR,
  type ResearchManagedDeployment,
} from "./managedDeployment";
import { parseResearchManagedRuntime } from "./managedRetentionProfile";
import {
  createResearchManagedSqlService,
  type ResearchManagedSqlPrivateOptions,
} from "./managedSqlService";
import { RESEARCH_API_PATH } from "./paths";
import { readPrivateResearchManagedOperatorPrincipal } from "./previewSession";
import { copyResearchSourceAuthOptions } from "./sqlSourceReaders";

const fail: () => never = () => {
  throw Error(RESEARCH_MANAGED_DEPLOYMENT_ERROR);
};
const oid = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(1),
  v.maxValue(4294967295),
);
const shape = v.strictObject({
  schema_version: v.literal(1),
  startupJson: v.string(),
  generation: v.picklist(["read-only", "native-window"]),
  corpusTarget: v.strictObject({ datasetsOid: oid, unitsOid: oid }),
  cleanupRuntime: v.unknown(),
});
let prepared: { key: string; promise: ReturnType<typeof prepare> } | undefined;
/** Shared connection resources/settings only, never a source, corpus, session or answer cache. */
function shared(deployment: ResearchManagedDeployment) {
  const captured = prepareResearchManagedDeployment(deployment),
    key = JSON.stringify(captured);
  if (prepared) {
    if (prepared.key !== key) fail();
    return prepared.promise;
  }
  const end = performance.now() + 8000;
  const promise = withinResearchDeadline(
    new AbortController().signal,
    (signal) => prepare(captured, signal, end),
    end,
  );
  prepared = { key, promise };
  return promise;
}
async function prepare(
  deployment: ResearchManagedDeployment,
  signal: AbortSignal,
  end: number,
) {
  const active = () => {
    signal.throwIfAborted();
    if (performance.now() >= end) fail();
  };
  let authority: ReturnType<typeof createResearchManagedDatabase> | undefined;
  try {
    active();
    if (Number(process.versions.node.split(".")[0]) !== 24) fail();
    const url = process.env.MAGICKLI_MANAGED_RUNTIME_DATABASE_URL;
    if (!url) fail();
    authority = createResearchManagedDatabase(url, {
      database: deployment.database,
      role: "magickli_research_runtime_v1",
      roleOid: deployment.runtimeRoleOid,
      endpointSha256: deployment.authorityEndpointIdentity,
    });
    // Canonical site signing/provider configuration only. The copy deliberately
    // discards its ordinary app DB; every research SQL call uses the restricted root.
    const { sqlAuthOptions } = await import("../auth/runtime");
    active();
    const authOptions = copyResearchSourceAuthOptions(sqlAuthOptions);
    if (authOptions.baseURL !== deployment.origin) fail();
    const database = authority.database;
    let reader: ReturnType<typeof createResearchManagedDatabase> | undefined;
    const handler = createResearchManagedSqlService({
      origin: deployment.origin,
      operatorId: deployment.operatorId,
      startupSha256: deployment.startupSha256,
      database,
      authOptions,
      authNativeTarget: {
        database: deployment.database,
        role: "magickli_research_runtime_v1",
        roleOid: deployment.runtimeRoleOid,
      },
      loadPrivateOptions: async (
        signal,
        end,
      ): Promise<ResearchManagedSqlPrivateOptions> => {
        const active = () => {
          signal.throwIfAborted();
          if (performance.now() >= end) fail();
        };
        active();
        const raw = process.env.MAGICKLI_MANAGED_PRIVATE_JSON;
        if (
          typeof raw !== "string" ||
          Buffer.byteLength(raw) > 1024 * 1024 + 32768 ||
          createHash("sha256").update(raw).digest("hex") !==
            deployment.privateConfigSha256
        )
          fail();
        const config = v.parse(
          shape,
          parseBoundedResearchJson(raw, 1024 * 1024 + 32768),
        );
        const cleanup = parseResearchManagedRuntime(config.cleanupRuntime);
        if (
          config.generation !== deployment.generation ||
          config.corpusTarget.datasetsOid === config.corpusTarget.unitsOid
        )
          fail();
        active();
        if (!reader) {
          const value = process.env.MAGICKLI_MANAGED_CORPUS_DATABASE_URL;
          if (!value) fail();
          reader = createResearchManagedDatabase(value, {
            database: deployment.database,
            role: "magickli_corpus_reader_v1",
            roleOid: deployment.readerRoleOid,
            endpointSha256: deployment.corpusEndpointIdentity,
          });
        }
        active();
        return {
          startupJson: config.startupJson,
          corpusDatabase: reader.database,
          corpusNativeTarget: {
            database: deployment.database,
            role: "magickli_corpus_reader_v1",
            roleOid: deployment.readerRoleOid,
            ...config.corpusTarget,
          },
          runtime: {
            kind: "immutable-deployment",
            revision: deployment.runtimeRevision,
            authorityEndpointIdentity: authority!.endpointIdentity,
          },
          managedCleanupRuntime: cleanup,
          generation:
            deployment.generation === "read-only" ? "read-only" : undefined,
          apiKey: () => process.env.AI_GATEWAY_API_KEY ?? fail(),
        };
      },
    });
    return Object.freeze({
      handler: (request: Request, deadlineAt?: number) =>
        deployment.generation === "read-only" &&
        new URL(request.url).pathname === RESEARCH_API_PATH
          ? Promise.resolve(failure(503, request.body))
          : handler(request, deadlineAt),
      database,
      authOptions,
    });
  } catch {
    if (authority) await authority.close();
    return fail();
  }
}
/** Existing outer ingress supplies its original deadline; neither startup nor auth gets a renewed request budget. */
export async function bootstrapManagedResearch(
  deployment: ResearchManagedDeployment,
  signal: AbortSignal,
  deadlineAt: number,
) {
  signal.throwIfAborted();
  if (!Number.isFinite(deadlineAt) || performance.now() >= deadlineAt) fail();
  const value = await withinResearchDeadline(
    signal,
    () => shared(deployment),
    deadlineAt,
  );
  signal.throwIfAborted();
  if (!Number.isFinite(deadlineAt) || performance.now() >= deadlineAt) fail();
  return value.handler;
}
/** Fresh operator-only shell hint. No startup, corpus credential, bibliography, packets or model key is loaded. */
export async function readManagedResearchPageSession(
  deployment: ResearchManagedDeployment,
  headers: Headers,
  signal: AbortSignal,
) {
  const captured = prepareResearchManagedDeployment(deployment),
    end = performance.now() + 8000;
  signal.throwIfAborted();
  const value = await withinResearchDeadline(
    signal,
    () => shared(deployment),
    end,
  );
  signal.throwIfAborted();
  if (performance.now() >= end) fail();
  const principal = await readPrivateResearchManagedOperatorPrincipal(
    value.database,
    value.authOptions,
    headers,
    signal,
    captured.operatorId,
    end,
    {
      database: captured.database,
      role: "magickli_research_runtime_v1",
      roleOid: captured.runtimeRoleOid,
    },
  );
  return principal
    ? {
        identity: createHash("sha256")
          .update(
            JSON.stringify([
              principal.identity,
              captured.startupSha256,
              captured.privateConfigSha256,
              captured.generation,
            ]),
          )
          .digest("hex"),
        expiresAt: principal.expiresAt,
      }
    : null;
}
