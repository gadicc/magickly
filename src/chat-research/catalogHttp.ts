/** Actual metadata-only delivery over the intrinsic catalog and current SQL source rights. No query, model or fake completion. */
import "server-only";
import * as v from "valibot";
import {
  inspectPreparedResearchCatalogView,
  type PreparedResearchCatalogView,
  prepareResearchCatalogView,
  type ResearchCatalog,
} from "./answerProvenance";
import { RESEARCH_CATALOG_API_PATH } from "./paths";
import {
  createResearchPrivateReadEntry,
  type ResearchPrivateReadEntryOptions,
} from "./privateReadEntry";
import { withResearchSourceDelivery } from "./sourceAuthorization";
import {
  copyResearchSourceAuthOptions,
  createSqlResearchSourceReaders,
  parseResearchSourceStorage,
} from "./sqlSourceReaders";
/** Trusted fixed service metadata scope; final live source policy and genuine native readiness remain mandatory. */
export interface ResearchCatalogHttpOptions
  extends Pick<
    ResearchPrivateReadEntryOptions<unknown>,
    | "database"
    | "authOptions"
    | "sourceStorage"
    | "actorId"
    | "origin"
    | "requireServiceReadActive"
  > {
  readonly catalog: ResearchCatalog;
  /** Original fixed generation-scope expiry, never a rolling or borrowed retained-answer lease. */
  readonly expiresAtMs: number;
  readonly requireCatalogActive: (
    view: PreparedResearchCatalogView,
    signal: AbortSignal,
    deadlineAt: number,
  ) => Promise<void>;
  readonly assertCatalogReady: (
    view: PreparedResearchCatalogView,
    signal: AbortSignal,
  ) => undefined;
}
/** Construct a bounded explicit metadata read with fresh all-source delivery permissions and no maintenance/window-state fallback. */
export function createSqlResearchCatalogHttpHandler(
  options: ResearchCatalogHttpOptions,
) {
  const catalog = options.catalog,
    expiresAt = options.expiresAtMs,
    database = options.database,
    settings = copyResearchSourceAuthOptions(options.authOptions),
    storage = parseResearchSourceStorage(options.sourceStorage),
    requireActive = options.requireCatalogActive,
    assertReady = options.assertCatalogReady;
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < 1 ||
    typeof requireActive !== "function" ||
    typeof assertReady !== "function"
  )
    throw Error("Private book catalog unavailable");
  return createResearchPrivateReadEntry({
    ...options,
    path: RESEARCH_CATALOG_API_PATH,
    bodyByteLimit: 16,
    parseBody: (value) => v.parse(v.strictObject({}), value),
    respond: async (_body, headers, principal, signal, end) => {
      const view = prepareResearchCatalogView(
          catalog,
          principal.subject,
          Math.min(expiresAt, principal.expires_at_ms),
        ),
        prepared = inspectPreparedResearchCatalogView(view);
      const active: unknown = await requireActive(view, signal, end);
      signal.throwIfAborted();
      if (active !== undefined || performance.now() >= end)
        throw Error("Private book catalog unavailable");
      let response: Response | undefined;
      try {
        return await withResearchSourceDelivery(
          prepared.context,
          createSqlResearchSourceReaders(database, settings, headers, storage),
          signal,
          () => {
            signal.throwIfAborted();
            if (performance.now() >= end)
              throw Error("Private book catalog unavailable");
            response = Response.json(prepared.value, {
              headers: {
                "cache-control": "private, no-store, max-age=0",
                vary: "Cookie",
                "x-content-type-options": "nosniff",
              },
            });
            const ready: unknown = assertReady(view, signal);
            if (ready !== undefined) {
              void Promise.resolve(ready).catch(() => {});
              throw Error("Private book catalog unavailable");
            }
            signal.throwIfAborted();
            if (performance.now() >= end)
              throw Error("Private book catalog unavailable");
            return response;
          },
          end,
        );
      } catch {
        try {
          if (response?.body && !response.body.locked)
            void response.body.cancel().catch(() => {});
        } catch {}
        throw Error("Private book catalog unavailable");
      }
    },
  });
}
