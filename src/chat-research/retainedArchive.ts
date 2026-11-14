/** Actual completed-answer summaries only. No provider, request-body projection, generation, history or adoption writer. */
import "server-only";
import { createHash } from "node:crypto";
import { parseResearchAccountingTarget } from "./accountingScope";
import {
  inspectPreparedResearchCatalogView,
  type PreparedResearchCatalogView,
  prepareResearchCatalogView,
  type ResearchCatalog,
} from "./answerProvenance";
import { parseResearchAnswerArchive, RESEARCH_ARCHIVE_ERROR } from "./archive";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import type { ResearchReadServiceBinding } from "./readAdoption";
import type {
  ResearchRetainedDeliveryOptions,
  ResearchRetainedReadBinding,
} from "./retainedDelivery";
import {
  parseResearchSourcePrincipal,
  requireResearchSourceAccess,
  withResearchSourceDelivery,
} from "./sourceAuthorization";
import { createSqlResearchAdmission } from "./sqlAdmission";
import {
  copyResearchSourceAuthOptions,
  createSqlResearchSourceReaders,
  parseResearchSourceStorage,
} from "./sqlSourceReaders";

const fail = (): never => {
  throw Error(RESEARCH_ARCHIVE_ERROR);
};
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
/** Owned list/completion facts, never browser authority. Empty delivery is [], never a fabricated permit. */
export interface ResearchRetainedArchiveBinding
  extends ResearchReadServiceBinding {
  readonly kind: "retained_answer_archive";
  readonly view: PreparedResearchCatalogView;
  readonly completed:
    | readonly {
        readonly permit_id: string;
        readonly completed: NonNullable<
          ResearchRetainedReadBinding["completed"]
        >;
      }[]
    | null;
  readonly archive_json: string | null;
  readonly archive_sha256: string | null;
}
/** Trusted real configuration only. The common configured application supplies actual exact-scope/native guards. */
export interface ResearchRetainedArchiveOptions
  extends Pick<
    ResearchRetainedDeliveryOptions,
    | "database"
    | "scope"
    | "storage"
    | "sourceStorage"
    | "authOptions"
    | "readUntilMs"
  > {
  readonly catalog: ResearchCatalog;
  readonly requireArchiveActive: (
    stage: "prepare" | "delivery",
    binding: ResearchRetainedArchiveBinding,
    signal: AbortSignal,
    deadlineAt: number,
  ) => Promise<void>;
  readonly assertArchiveReady: (
    binding: ResearchRetainedArchiveBinding,
    signal: AbortSignal,
  ) => undefined;
}
/** Own actual SQL readers and validated packet store. Principal input is data only: actual signed-cookie/source gates independently prove it before list SQL. */
export function createSqlResearchRetainedArchive(
  options: ResearchRetainedArchiveOptions,
) {
  try {
    const database = options.database,
      target = parseResearchAccountingTarget(options.scope, options.storage),
      sources = parseResearchSourceStorage(options.sourceStorage),
      auth = copyResearchSourceAuthOptions(options.authOptions),
      catalog = options.catalog,
      readUntil = options.readUntilMs,
      requireActive = options.requireArchiveActive,
      assertReady = options.assertArchiveReady,
      store = createSqlResearchAdmission(
        database,
        target.scope,
        target.storage,
      );
    if (
      !Number.isSafeInteger(readUntil) ||
      readUntil < 1 ||
      sources.corpusVersion !== target.scope.corpusVersion ||
      catalog.revision !== target.scope.corpusVersion ||
      typeof requireActive !== "function" ||
      typeof assertReady !== "function"
    )
      fail();
    createSqlResearchSourceReaders(database, auth, new Headers(), sources);
    return Object.freeze({
      async createResponse(
        principalData: unknown,
        incomingHeaders: Headers,
        signal: AbortSignal,
        inheritedDeadlineAt?: number,
      ): Promise<Response> {
        let response: Response | undefined;
        const started = performance.now(),
          cancel = new AbortController();
        try {
          signal.throwIfAborted();
          if (
            inheritedDeadlineAt !== undefined &&
            !Number.isFinite(inheritedDeadlineAt)
          )
            fail();
          let end = Math.min(
            started + RESEARCH_OPERATION_TIMEOUT_MS,
            inheritedDeadlineAt ?? Infinity,
          );
          const headers = new Headers(incomingHeaders),
            principal = parseResearchSourcePrincipal(principalData);
          if (principal.subject.user_id !== target.scope.actorId) fail();
          return await withinResearchDeadline(
            signal,
            async (bounded) => {
              const combined = AbortSignal.any([bounded, cancel.signal]),
                active = () => {
                  if (combined.aborted || performance.now() >= end) {
                    cancel.abort();
                    fail();
                  }
                };
              active();
              const view = prepareResearchCatalogView(
                  catalog,
                  principal.subject,
                  Math.min(readUntil, principal.expires_at_ms),
                ),
                context = inspectPreparedResearchCatalogView(view).context,
                base = {
                  kind: "retained_answer_archive" as const,
                  database,
                  scope: target.scope,
                  storage: target.storage,
                  source_storage: sources,
                  read_until_ms: readUntil,
                  current_subject: Object.freeze({ ...principal.subject }),
                  view,
                };
              await withinResearchDeadline(
                combined,
                (s) =>
                  requireActive(
                    "prepare",
                    Object.freeze({
                      ...base,
                      completed: null,
                      archive_json: null,
                      archive_sha256: null,
                    }),
                    s,
                    end,
                  ),
                end,
              );
              active();
              const preflight = new AbortController();
              try {
                await requireResearchSourceAccess(
                  context,
                  { kind: "delivery" },
                  createSqlResearchSourceReaders(
                    database,
                    auth,
                    headers,
                    sources,
                  ),
                  AbortSignal.any([combined, preflight.signal]),
                  end,
                );
                active();
              } finally {
                preflight.abort();
              }
              const saved = await store.readOwnedCompletedAnswerSummaries(
                principal.subject.user_id,
                combined,
                end,
              );
              active();
              end = Math.min(end, saved.retention_deadline);
              active();
              const value = parseResearchAnswerArchive({
                  contract: "magickli-private-research-archive",
                  schema_version: 1,
                  scope: "original_private_research_window",
                  semantic_review: "unreviewed",
                  entries: saved.entries.map((e) => e.summary),
                }),
                archiveJson = JSON.stringify(value),
                binding: ResearchRetainedArchiveBinding = Object.freeze({
                  ...base,
                  archive_json: archiveJson,
                  archive_sha256: sha(archiveJson),
                  completed: Object.freeze(
                    saved.entries.map((e) => {
                      const original = JSON.stringify(e.context);
                      return Object.freeze({
                        permit_id: e.summary.permit_id,
                        completed: Object.freeze({
                          answer_id: e.summary.answer_id,
                          answer_sha256: e.answer_sha256!,
                          response_artifact_sha256: e.response_artifact_sha256,
                          request_revision: e.request_revision,
                          query_revision: e.query_revision,
                          original_source_context_json: original,
                          original_source_context_sha256: sha(original),
                          retain_until_ms: e.retain_until_ms,
                        }),
                      });
                    }),
                  ),
                });
              await withinResearchDeadline(
                combined,
                (s) => requireActive("delivery", binding, s, end),
                end,
              );
              active();
              const delivered = await withResearchSourceDelivery(
                context,
                createSqlResearchSourceReaders(
                  database,
                  auth,
                  headers,
                  sources,
                ),
                combined,
                () => {
                  active();
                  response = Response.json(value, {
                    headers: {
                      "cache-control": "private, no-store, max-age=0",
                      vary: "Cookie",
                      "x-content-type-options": "nosniff",
                    },
                  });
                  const ready: unknown = assertReady(binding, combined);
                  if (ready !== undefined) {
                    void Promise.resolve(ready).catch(() => {});
                    fail();
                  }
                  active();
                  return response;
                },
                end,
              );
              active();
              return delivered;
            },
            end,
          );
        } catch {
          try {
            if (response?.body && !response.body.locked)
              void response.body.cancel().catch(() => {});
          } catch {}
          return fail();
        } finally {
          cancel.abort();
        }
      },
    });
  } catch {
    return fail();
  }
}
