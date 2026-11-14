/** Owner-local outer listener only. Never imported by ordinary Next routes or started automatically. */
import "server-only";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readResearchOperatorDeployment } from "./operatorDeployment";
import { privateResearchOperatorRefusal } from "./operatorIngress";
/** Actual independently reviewed immutable Next handler. Its own source/session/native/price/cleanup guards remain mandatory. */
export interface ResearchOperatorNodeOptions {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly handle: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<void>;
}
/** Start only after outer adoption/code/account/endpoint checks. Exact canonical loopback listener, no proxy/upgrade or other application routes. No allowance, grants or cleanup is created. */
export async function startResearchOperatorNodeServer(
  options: ResearchOperatorNodeOptions,
) {
  const deployment = readResearchOperatorDeployment(options.env);
  if (!deployment) throw Error("Private operator service unavailable");
  const expected = new URL(deployment.origin),
    port = Number(expected.port),
    handle = options.handle;
  if (
    !["localhost", "127.0.0.1"].includes(expected.hostname) ||
    port < 1 ||
    typeof handle !== "function"
  )
    throw Error("Private operator service unavailable");
  const refuse = (response: ServerResponse, status: number) => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "private, no-store, max-age=0",
      vary: "Cookie",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
      connection: "close",
    });
    response.end('{"error":"Private research unavailable"}');
  };
  const server = createServer(
    {
      maxHeaderSize: 16384,
      headersTimeout: 8000,
      requestTimeout: 20000,
      keepAliveTimeout: 1000,
    },
    (request, response) => {
      try {
        const raw = request.url ?? "";
        // Require origin-form before URL normalization; aliases never reach Next.
        if (
          !raw.startsWith("/") ||
          raw.startsWith("//") ||
          raw.includes("\\") ||
          raw
            .split("?")[0]
            .split("/")
            .some((part) => part === "." || part === "..") ||
          /%(?:2f|5c|2e)/i.test(raw.split("?")[0])
        ) {
          refuse(response, 404);
          return;
        }
        if (
          request.socket.localAddress !== "127.0.0.1" ||
          request.socket.localPort !== port ||
          !["127.0.0.1", "::ffff:127.0.0.1"].includes(
            request.socket.remoteAddress ?? "",
          )
        ) {
          refuse(response, 403);
          return;
        }
        const headers = new Headers();
        for (let i = 0; i < request.rawHeaders.length; i += 2)
          headers.append(request.rawHeaders[i], request.rawHeaders[i + 1]);
        const status = privateResearchOperatorRefusal(
          {
            method: request.method ?? "",
            url: deployment.origin + raw,
            headers,
          },
          deployment,
        );
        if (status !== null) {
          refuse(response, status);
          return;
        }
        for (const [key, value] of [
          ["cache-control", "private, no-store, max-age=0"],
          ["vary", "Cookie"],
          ["x-content-type-options", "nosniff"],
          ["x-robots-tag", "noindex, nofollow"],
        ])
          response.setHeader(key, value);
        // Capture the handler and selected deployment once. Failed requests are never retried or sent to another entry.
        void Promise.resolve(handle(request, response)).catch(() =>
          refuse(response, 503),
        );
      } catch {
        refuse(response, 503);
      }
    },
  );
  // Reject Expect before Node can send 100 Continue or pull a body before auth.
  server.on("checkContinue", (_request, response) => refuse(response, 417));
  server.on("checkExpectation", (_request, response) => refuse(response, 417));
  server.maxConnections = 16;
  server.on("upgrade", (_request, socket) => {
    // Upgraded sockets leave Node HTTP ownership. A peer may keep its writable
    // half open after FIN; close our side explicitly so it cannot retain slots.
    socket.on("error", () => socket.destroy());
    socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n", () =>
      socket.destroy(),
    );
  });
  server.on("clientError", (_error, socket) => {
    socket.destroy();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  return server;
}
