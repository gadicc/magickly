/** Private completed-answer HTTP entry. No price, credential, provider or generation path. */
import "server-only";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";
import { RESEARCH_READ_API_PATH, RESEARCH_READ_BODY_BYTE_LIMIT } from "./paths";
import { createResearchPrivateReadEntry } from "./privateReadEntry";
import {
  createSqlResearchRetainedDelivery,
  type ResearchRetainedDeliveryOptions,
} from "./retainedDelivery";

export { RESEARCH_READ_BODY_BYTE_LIMIT } from "./paths";

const shape = v.strictObject({
  permit_id: v.pipe(
    v.string(),
    v.check((s) => isUuidV7(s) && s === s.toLowerCase()),
  ),
});
/** Trusted actual service configuration only; the common configured constructor supplies genuine native read-purpose guards. */
export interface ResearchReadHttpOptions
  extends ResearchRetainedDeliveryOptions {
  readonly origin: string;
  /** Service-wide read adoption/native target/clock check before auth or body. Does not invent a completed permit. */
  readonly requireServiceReadActive: (
    signal: AbortSignal,
    deadlineAt: number,
  ) => Promise<void>;
}
/** Keep completed delivery real while sharing only actual authenticated read ingress. */
export function createSqlResearchReadHttpHandler(
  options: ResearchReadHttpOptions,
) {
  const delivery = createSqlResearchRetainedDelivery(options);
  return createResearchPrivateReadEntry({
    database: options.database,
    authOptions: options.authOptions,
    sourceStorage: options.sourceStorage,
    actorId: options.scope.actorId,
    origin: options.origin,
    path: RESEARCH_READ_API_PATH,
    bodyByteLimit: RESEARCH_READ_BODY_BYTE_LIMIT,
    parseBody: (value) => v.parse(shape, value),
    requireServiceReadActive: options.requireServiceReadActive,
    respond: (body, headers, _principal, signal, end) =>
      delivery.createResponse(body.permit_id, headers, signal, end),
  });
}
