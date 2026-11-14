/** Real isolated loopback socket controls, with a synthetic handler and no Next/database/provider. */
import { createServer, request as httpRequest, type Server } from "node:http";
import { connect } from "node:net";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startResearchOperatorNodeServer } from "./operatorNodeServer";

vi.mock("server-only", () => ({}));
let server: Server | undefined,
  port: number,
  env: Record<string, string>,
  calls: string[];
beforeEach(async () => {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  port = (probe.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  env = {
    NODE_ENV: "production",
    MAGICKLI_PRIVATE_RESEARCH_OPERATOR: "1",
    BETTER_AUTH_URL: "http://localhost:" + port,
    MAGICKLI_OPERATOR_STARTUP_SHA256: "a".repeat(64),
    MAGICKLI_OPERATOR_RUNTIME_SHA256: "b".repeat(64),
    MAGICKLI_OPERATOR_ENDPOINT_SHA256: "c".repeat(64),
  };
  calls = [];
});
afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
    server = undefined;
  }
});
const start = async () =>
  (server = await startResearchOperatorNodeServer({
    env,
    async handle(request, response) {
      calls.push(request.url!);
      response.end("synthetic-handler");
    },
  }));
const send = (
  path: string,
  method = "GET",
  headers: Record<string, string> = {},
) =>
  new Promise<{ status: number; body: string; continued: boolean }>(
    (resolve, reject) => {
      let continued = false;
      const request = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path,
          method,
          headers: {
            host: "localhost:" + port,
            origin: env.BETTER_AUTH_URL,
            ...headers,
          },
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => (body += chunk));
          response.on("error", reject);
          response.on("end", () =>
            resolve({ status: response.statusCode!, body, continued }),
          );
        },
      );
      request.on("continue", () => (continued = true));
      request.on("error", reject);
      request.end();
    },
  );
it("binds exactly IPv4 loopback and delegates only canonical private routes", async () => {
  await start();
  expect((server!.address() as { address: string }).address).toBe("127.0.0.1");
  expect((await send("/chat/research")).body).toBe("synthetic-handler");
  expect((await send("/chat/research/api", "POST")).status).toBe(200);
  expect((await send("/_next/static/chunks/a.js")).status).toBe(200);
  expect(calls).toEqual([
    "/chat/research",
    "/chat/research/api",
    "/_next/static/chunks/a.js",
  ]);
});
it.each([
  "/",
  "/api/chat",
  "/api/files",
  "/api/auth/get-session",
  "/chat/extra/../research",
  "/chat/%2e%2e/chat/research",
  "/chat%2fresearch",
  "//localhost/chat/research",
  "http://localhost/chat/research",
  "/chat/research/api/",
  "/_next/data/build/chat/research.json",
])("refuses before Next normalization/dispatch: %s", async (path) => {
  await start();
  expect((await send(path)).status).not.toBe(200);
  expect(calls).toEqual([]);
});
it.each<Record<string, string>>([
  { "next-action": "synthetic" },
  { "x-middleware-rewrite": "/api/chat" },
  { "x-invoke-path": "/api/chat" },
  { "x-forwarded-host": "external.example" },
  { host: "external.example" },
])("rejects spoof/action headers before delegation: %j", async (headers) => {
  await start();
  expect((await send("/chat/research", "POST", headers)).status).toBe(403);
  expect(calls).toEqual([]);
});
it("rejects Expect without an automatic100Continue or calling the body/Next handler", async () => {
  await start();
  const result = await send("/chat/research/api", "POST", {
    expect: "100-continue",
    "content-length": "100",
  });
  expect(result).toMatchObject({ status: 417, continued: false });
  expect(calls).toEqual([]);
});
it("rejects WebSocket upgrades and duplicate Host values without delegation", async () => {
  await start();
  const raw = (headers: string) =>
    new Promise<string>((resolve, reject) => {
      const socket = connect(port, "127.0.0.1", () =>
        socket.write("GET /chat/research HTTP/1.1\r\n" + headers + "\r\n\r\n"),
      );
      let bytes = "";
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => (bytes += chunk));
      socket.on("end", () => resolve(bytes));
      socket.on("error", reject);
    });
  expect(
    await raw(
      "Host: localhost:" +
        port +
        "\r\nConnection: Upgrade\r\nUpgrade: websocket",
    ),
  ).toContain("404");
  expect(
    await raw("Host: localhost:" + port + "\r\nHost: localhost:" + port),
  ).toContain("403");
  expect(calls).toEqual([]);
});
it("returns generic failure without retrying a failed handler", async () => {
  const handle = vi.fn(async () => {
    throw Error("synthetic-private-stack");
  });
  server = await startResearchOperatorNodeServer({ env, handle });
  const result = await send("/chat/research");
  expect(result.status).toBe(503);
  expect(result.body).not.toContain("synthetic-private");
  expect(handle).toHaveBeenCalledOnce();
});
it.each(["disabled", "ambiguous", "bad-pin", "hosted", "ipv6", "default-port"])(
  "refuses invalid startup before opening a listener: %s",
  async (kind) => {
    if (kind === "disabled") delete env.MAGICKLI_PRIVATE_RESEARCH_OPERATOR;
    if (kind === "ambiguous") env.MAGICKLI_PRIVATE_RESEARCH_LOCAL = "1";
    if (kind === "bad-pin") env.MAGICKLI_OPERATOR_STARTUP_SHA256 = "invalid";
    if (kind === "hosted") env.VERCEL = "1";
    if (kind === "ipv6") env.BETTER_AUTH_URL = "http://[::1]:" + port;
    if (kind === "default-port") env.BETTER_AUTH_URL = "http://localhost";
    await expect(start()).rejects.toThrow(
      "Private operator service unavailable",
    );
    expect(server).toBeUndefined();
  },
);

it.each(["localAddress", "localPort", "remoteAddress"])(
  "refuses a changed actual socket fact: %s",
  async (field) => {
    await start();
    server!.prependListener("connection", (socket) =>
      Object.defineProperty(socket, field, {
        value: field === "localPort" ? port + 1 : "192.0.2.1",
      }),
    );
    expect((await send("/chat/research")).status).toBe(403);
    expect(calls).toEqual([]);
  },
);
it("handles a synchronous handler throw without exposing private failure details", async () => {
  server = await startResearchOperatorNodeServer({
    env,
    handle() {
      throw Error("synthetic private failure");
    },
  });
  const result = await send("/chat/research");
  expect(result.status).toBe(503);
  expect(result.body).not.toContain("synthetic private failure");
});
it("destroys an already-started response on late failure instead of appending an error to it", async () => {
  server = await startResearchOperatorNodeServer({
    env,
    async handle(_request, response) {
      response.writeHead(200);
      response.write("synthetic partial");
      response.flushHeaders();
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw Error("synthetic private late failure");
    },
  });
  await expect(send("/chat/research")).rejects.toThrow();
});
it("rejects an unsupported expectation before dispatch and destroys a native HTTP parser error", async () => {
  await start();
  expect(
    (await send("/chat/research", "GET", { expect: "synthetic-unsupported" }))
      .status,
  ).toBe(417);
  await new Promise<void>((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () =>
      socket.write("synthetic invalid HTTP\r\n\r\n"),
    );
    socket.on("close", () => resolve());
    socket.on("error", reject);
  });
  expect(calls).toEqual([]);
});
it("refuses an occupied listener without retrying or changing ports", async () => {
  await start();
  await expect(
    startResearchOperatorNodeServer({ env, async handle() {} }),
  ).rejects.toMatchObject({ code: "EADDRINUSE" });
  expect(calls).toEqual([]);
});
it("refuses a nonfunction handler before opening a listener", async () => {
  await expect(
    startResearchOperatorNodeServer({ env, handle: null as never }),
  ).rejects.toThrow("Private operator service unavailable");
});

it("closes a refused upgraded socket even while its client deliberately keeps its write half open", async () => {
  await start();
  const socket = connect({ port, host: "127.0.0.1", allowHalfOpen: true });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    let bytes = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => (bytes += chunk));
    const ended = new Promise<void>((resolve, reject) => {
      socket.once("end", resolve);
      socket.once("error", reject);
    });
    socket.write(
      "GET /chat/research HTTP/1.1\r\nHost: localhost:" +
        port +
        "\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n",
    );
    await ended;
    expect(bytes).toContain("404");
    expect(socket.writableEnded).toBe(false);
    const original = server!;
    await new Promise<void>((resolve, reject) =>
      original.close((error) => (error ? reject(error) : resolve())),
    );
    server = undefined;
    expect(calls).toEqual([]);
  } finally {
    socket.destroy();
  }
});
it("owns an upgraded socket error even after Node hands the socket to the application", async () => {
  await start();
  // Inject a transport error at the real ownership handoff. Without the
  // listener's error owner this would become an uncaught EventEmitter error.
  server!.on("upgrade", (_request, socket) =>
    socket.emit("error", Error("synthetic upgrade transport failure")),
  );
  await new Promise<void>((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () =>
      socket.write(
        "GET /chat/research HTTP/1.1\r\nHost: localhost:" +
          port +
          "\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n",
      ),
    );
    socket.resume();
    socket.on("close", () => resolve());
    socket.on("error", (error) =>
      (error as NodeJS.ErrnoException).code === "ECONNRESET"
        ? resolve()
        : reject(error),
    );
  });
  expect(calls).toEqual([]);
});
