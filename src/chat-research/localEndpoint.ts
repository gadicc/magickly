/** Pure endpoint compatibility only; no app/bootstrap/environment acquisition. */
import "server-only";
import { createHash } from "node:crypto";
import { RESEARCH_LOCAL_DEPLOYMENT_ERROR } from "./localDeployment";

const fail = (): never => {
  throw Error(RESEARCH_LOCAL_DEPLOYMENT_ERROR);
};
/** Nonsecret compatibility observation of the actual existing postgres.js root, not branch/clone or endpoint provenance attestation. */
export function researchLocalEndpointIdentity(connection: {
  readonly host: readonly string[];
  readonly port: readonly number[];
  readonly database: string;
  readonly user: string;
  readonly path?: unknown;
}) {
  try {
    if (
      connection.host.length !== 1 ||
      connection.host[0] !== "db.localtest.me" ||
      connection.port.length !== 1 ||
      connection.port[0] !== 5432 ||
      connection.database !== "magickli_dev" ||
      connection.user !== "magickli_dev" ||
      (connection.path !== undefined && connection.path !== false)
    )
      fail();
    return createHash("sha256")
      .update(
        JSON.stringify({
          kind: "local-postgresjs-tcp-v1",
          host: "db.localtest.me",
          port: 5432,
          database: "magickli_dev",
          role: "magickli_dev",
        }),
      )
      .digest("hex");
  } catch {
    return fail();
  }
}
