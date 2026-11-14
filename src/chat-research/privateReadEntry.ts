/** Shared actual signed-cookie private read ingress; constructor callbacks come only from trusted server composition. */
import "server-only";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import {
  failure,
  fault,
  HttpFault,
  jsonContentType,
  origin,
  RESEARCH_HTTP_ERROR,
  readBody,
} from "./httpIngress";
import {
  RESEARCH_ARCHIVE_API_PATH,
  RESEARCH_CATALOG_API_PATH,
  RESEARCH_READ_API_PATH,
} from "./paths";
import { parseResearchSourcePrincipal } from "./sourceAuthorization";
import {
  copyResearchSourceAuthOptions,
  createSqlResearchSourceReaders,
  type ResearchSourceAuthOptions,
  type ResearchSourceDatabase,
  type ResearchSourceStorage,
} from "./sqlSourceReaders";
/** Closed local read endpoints only. A parser or callback never creates source/adoption authority. */
export interface ResearchPrivateReadEntryOptions<T> {
  readonly database: ResearchSourceDatabase;
  readonly authOptions: ResearchSourceAuthOptions;
  readonly sourceStorage: ResearchSourceStorage;
  readonly actorId: string;
  readonly origin: string;
  readonly path:
    | typeof RESEARCH_ARCHIVE_API_PATH
    | typeof RESEARCH_READ_API_PATH
    | typeof RESEARCH_CATALOG_API_PATH;
  readonly bodyByteLimit: number;
  readonly parseBody: (value: unknown) => T;
  readonly requireServiceReadActive: (
    signal: AbortSignal,
    deadlineAt: number,
  ) => Promise<void>;
  /** Called only after actual current canonical-owner auth and bounded body validation; final source authorization remains the responder's duty. */
  readonly respond: (
    body: T,
    headers: Headers,
    principal: ReturnType<typeof parseResearchSourcePrincipal>,
    signal: AbortSignal,
    deadlineAt: number,
  ) => Promise<Response>;
}
/** Own a separate one-operation slot and original eight-second/session bound without queues, retries, storage or generation. */
export function createResearchPrivateReadEntry<T>(
  options: ResearchPrivateReadEntryOptions<T>,
) {
  const expectedOrigin = origin(options.origin),
    expectedPath = options.path,
    database = options.database,
    settings = copyResearchSourceAuthOptions(options.authOptions),
    sourceStorage = Object.freeze({ ...options.sourceStorage }),
    actor = options.actorId,
    requireActive = options.requireServiceReadActive,
    respond = options.respond,
    parseBody = options.parseBody,
    bodyByteLimit = options.bodyByteLimit;
  if (
    ![
      RESEARCH_READ_API_PATH,
      RESEARCH_CATALOG_API_PATH,
      RESEARCH_ARCHIVE_API_PATH,
    ].includes(expectedPath) ||
    !Number.isSafeInteger(bodyByteLimit) ||
    bodyByteLimit < 1 ||
    bodyByteLimit > 128 ||
    [requireActive, respond, parseBody].some((f) => typeof f !== "function")
  )
    throw Error(RESEARCH_HTTP_ERROR);
  createSqlResearchSourceReaders(
    database,
    settings,
    new Headers(),
    sourceStorage,
  );
  let inFlight = false;
  return async (
    request: Request,
    inheritedDeadlineAt?: number,
  ): Promise<Response> => {
    const entered = performance.now();
    let owned = false,
      body: Request["body"] = null,
      response: Response | undefined;
    try {
      const signal = request.signal,
        headers = new Headers(request.headers);
      body = request.body;
      if (
        inheritedDeadlineAt !== undefined &&
        !Number.isFinite(inheritedDeadlineAt)
      )
        throw Error(RESEARCH_HTTP_ERROR);
      let end = Math.min(
        entered + RESEARCH_OPERATION_TIMEOUT_MS,
        inheritedDeadlineAt ?? Infinity,
      );
      signal.throwIfAborted();
      if (request.method !== "POST") fault(405);
      const url = new URL(request.url);
      if (
        url.origin !== expectedOrigin ||
        url.pathname !== expectedPath ||
        url.search ||
        url.hash ||
        headers.get("origin") !== expectedOrigin ||
        headers.get("sec-fetch-site") === "cross-site"
      )
        fault(403);
      if (!jsonContentType(headers.get("content-type"))) fault(415);
      if (request.bodyUsed || body?.locked) fault(400);
      const length = headers.get("content-length");
      if (
        length !== null &&
        (!/^(0|[1-9][0-9]{0,8})$/.test(length) ||
          Number(length) > bodyByteLimit)
      )
        fault(413);
      if (inFlight) fault(429);
      inFlight = true;
      owned = true;
      response = await withinResearchDeadline(
        signal,
        async (bounded) => {
          const assert = () => {
            bounded.throwIfAborted();
            if (performance.now() >= end) throw Error(RESEARCH_HTTP_ERROR);
          };
          assert();
          const ready: unknown = await requireActive(bounded, end);
          assert();
          if (ready !== undefined) throw Error(RESEARCH_HTTP_ERROR);
          const started = performance.now(),
            bootstrap = new AbortController();
          let principal: ReturnType<typeof parseResearchSourcePrincipal>;
          try {
            const readers = createSqlResearchSourceReaders(
              database,
              settings,
              headers,
              sourceStorage,
            );
            principal = parseResearchSourcePrincipal(
              await readers.readPrincipal(
                AbortSignal.any([bounded, bootstrap.signal]),
              ),
            );
            const nativeNow = readers.now();
            bounded.throwIfAborted();
            if (
              principal.expires_at_ms <=
              nativeNow + Math.ceil(performance.now() - started)
            )
              throw Error(RESEARCH_HTTP_ERROR);
            end = Math.min(end, started + principal.expires_at_ms - nativeNow);
            assert();
            if (principal.subject.user_id !== actor) fault(403);
          } finally {
            bootstrap.abort();
          }
          const parsed = await readBody(
            request,
            body,
            headers,
            bounded,
            end,
            parseBody,
            bodyByteLimit,
            16,
          );
          assert();
          response = await withinResearchDeadline(
            bounded,
            async (workSignal) => {
              const value = await respond(
                parsed,
                headers,
                principal,
                workSignal,
                end,
              );
              response = value;
              if (workSignal.aborted || performance.now() >= end) {
                response = undefined;
                try {
                  if (value.body && !value.body.locked)
                    void value.body.cancel().catch(() => {});
                } catch {}
                throw Error(RESEARCH_HTTP_ERROR);
              }
              return value;
            },
            end,
          );
          assert();
          return response;
        },
        end,
      );
      return response;
    } catch (error) {
      if (response?.body && !response.body.locked) {
        try {
          void response.body.cancel().catch(() => {});
        } catch {}
      }
      return failure(error instanceof HttpFault ? error.status : 503, body);
    } finally {
      if (owned) inFlight = false;
    }
  };
}
