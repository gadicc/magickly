/** Explicit actual retained archive over the shared authenticated tiny-body entry. No query or provider API. */
import "server-only";
import * as v from "valibot";
import { RESEARCH_ARCHIVE_API_PATH } from "./paths";
import { createResearchPrivateReadEntry } from "./privateReadEntry";
import {
  createSqlResearchRetainedArchive,
  type ResearchRetainedArchiveOptions,
} from "./retainedArchive";
export interface ResearchArchiveHttpOptions
  extends ResearchRetainedArchiveOptions {
  readonly origin: string;
  readonly requireServiceReadActive: (
    signal: AbortSignal,
    deadlineAt: number,
  ) => Promise<void>;
}
/** Compose actual store/source/native-owned archive; current SQL auth precedes body and private packet loading. */
export function createSqlResearchArchiveHttpHandler(
  options: ResearchArchiveHttpOptions,
) {
  const archive = createSqlResearchRetainedArchive(options);
  return createResearchPrivateReadEntry({
    database: options.database,
    authOptions: options.authOptions,
    sourceStorage: options.sourceStorage,
    actorId: options.scope.actorId,
    origin: options.origin,
    path: RESEARCH_ARCHIVE_API_PATH,
    bodyByteLimit: 16,
    parseBody: (value) => v.parse(v.strictObject({}), value),
    requireServiceReadActive: options.requireServiceReadActive,
    respond: (_body, headers, principal, signal, end) =>
      archive.createResponse(principal, headers, signal, end),
  });
}
