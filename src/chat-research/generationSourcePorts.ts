/** Inactive concrete source ports for the actual accounting job. No environment, adoption, publication or route. */
import "server-only";
import { parseResearchAccountingTarget } from "./accountingScope";
import type { ResearchAnswerJobOptions } from "./coordinator";
import {
  prepareResearchMaintenanceTarget,
  type ResearchMaintenanceTargetInput,
} from "./maintenanceTarget";
import { inspectResearchRequestArtifact } from "./requestArtifact";
import { RESEARCH_SOURCE_ERROR } from "./sourceAuthorization";
import type { ResearchAdmissionDatabase } from "./sqlAdmission";
import {
  createSqlResearchMaintenanceSourceReaders,
  createSqlResearchWindowSourceReaders,
  parseResearchSourceStorage,
  type ResearchSourceAuthOptions,
  type ResearchSourceDatabase,
  type ResearchSourceStorage,
} from "./sqlSourceReaders";
/** One trusted actual root shared by accounting and current signed-auth/source SQL. */
export interface ResearchGenerationSourceOptions {
  readonly database: ResearchAdmissionDatabase & ResearchSourceDatabase;
  readonly authOptions: ResearchSourceAuthOptions;
  readonly requestHeaders: Headers;
  readonly sourceStorage: ResearchSourceStorage;
  /** Independently reviewed/adopted exact target; preparing it here does not establish that adoption. */
  readonly maintenance: ResearchMaintenanceTargetInput;
}
/** Every influencing source and exact window is current. Cleanup health gates new provider work; it never blocks settlement or already-authorized answer delivery. */
export function createResearchGenerationSourcePorts(
  options: ResearchGenerationSourceOptions,
): Pick<ResearchAnswerJobOptions, "createSourceReaders"> {
  try {
    const database = options.database,
      maintenance = prepareResearchMaintenanceTarget(options.maintenance),
      sources = parseResearchSourceStorage(options.sourceStorage),
      headers = new Headers(options.requestHeaders),
      auth = options.authOptions,
      input = {
        scope: maintenance.scope,
        storage: maintenance.storage,
        maintenanceSchema: maintenance.maintenanceSchema,
        profileSha256: maintenance.profileSha256,
        artifactTableOid: maintenance.artifactTableOid,
      },
      settings = Object.freeze({
        baseURL: auth.baseURL,
        secret: auth.secret,
        googleClientId: auth.googleClientId,
        googleClientSecret: auth.googleClientSecret,
        localTestLoginEnabled: auth.localTestLoginEnabled,
      }),
      expected = JSON.stringify([maintenance.scope, maintenance.storage]);
    if (sources.corpusVersion !== maintenance.scope.corpusVersion)
      throw Error();
    return Object.freeze({
      createSourceReaders: (stage, binding) => {
        try {
          if (
            !["prepare", "dispatch", "delivery"].includes(stage) ||
            binding.database !== database
          )
            throw Error();
          const actual = parseResearchAccountingTarget(
              binding.scope,
              binding.storage,
            ),
            packet = inspectResearchRequestArtifact(binding.artifact).packet;
          if (
            JSON.stringify([actual.scope, actual.storage]) !== expected ||
            packet.context.corpus_version !== sources.corpusVersion ||
            packet.context.subject.user_id !== actual.scope.actorId
          )
            throw Error();
          const window = { scope: actual.scope, storage: actual.storage };
          if (stage === "delivery")
            return createSqlResearchWindowSourceReaders(
              database,
              settings,
              headers,
              sources,
              window,
            );
          return createSqlResearchMaintenanceSourceReaders(
            database,
            settings,
            headers,
            sources,
            window,
            input,
          );
        } catch {
          throw Error(RESEARCH_SOURCE_ERROR);
        }
      },
    });
  } catch {
    throw Error(RESEARCH_SOURCE_ERROR);
  }
}
