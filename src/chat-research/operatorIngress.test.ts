import { expect, it } from "vitest";
import { privateResearchOperatorRefusal } from "./operatorIngress";

const deployment = {
  origin: "http://localhost:4182",
  startupSha256: "a".repeat(64),
  runtimeRevision: "b".repeat(64),
  authorityEndpointIdentity: "c".repeat(64),
};
const req = (
  path: string,
  method = "GET",
  extra: Record<string, string> = {},
) => ({
  url: deployment.origin + path,
  method,
  headers: new Headers({
    host: "localhost:4182",
    origin: deployment.origin,
    ...extra,
  }),
});
it.each([
  "/chat/research",
  "/chat/research?_rsc=hint",
  "/_next/static/chunks/a.js",
  "/_next/static/css/a.css",
  "/_next/static/media/font.woff2",
])("allows only private shell/static GET and HEAD: %s", (path) => {
  for (const method of ["GET", "HEAD"])
    expect(
      privateResearchOperatorRefusal(req(path, method), deployment),
    ).toBeNull();
});
it.each([
  "/chat/research/api",
  "/chat/research/catalog",
  "/chat/research/answers/list",
  "/chat/research/answers/read",
])("allows only exact same-origin POST: %s", (path) => {
  expect(
    privateResearchOperatorRefusal(req(path, "POST"), deployment),
  ).toBeNull();
  expect(privateResearchOperatorRefusal(req(path), deployment)).toBe(404);
  expect(
    privateResearchOperatorRefusal(req(path + "?extra=1", "POST"), deployment),
  ).toBe(404);
});
it.each([
  "/",
  "/api/chat",
  "/api/auth/get-session",
  "/api/files",
  "/chat/research/",
  "/chat/research/api/",
  "/CHAT/research",
  "/chat%2fresearch",
  "/_next/image?url=https://example.test/private",
  "/_next/data/build/chat/research.json",
  "/_next/static/a.json",
  "/sw.js",
  "/chat/research?extra=1",
  "/chat/research?_rsc=1&_rsc=2",
  "/chat/research#private",
])("refuses unrelated or aliased path: %s", (path) => {
  for (const method of ["GET", "POST", "PUT"])
    expect(
      privateResearchOperatorRefusal(req(path, method), deployment),
    ).not.toBeNull();
});
it.each<Record<string, string>>([
  { host: "127.0.0.1:4182" },
  { origin: "https://example.test" },
  { "sec-fetch-site": "cross-site" },
  { authorization: "Bearer synthetic" },
  { "next-action": "synthetic" },
  { forwarded: "host=localhost:4182" },
  { "x-forwarded-host": "external.example" },
  { "x-forwarded-port": "3004" },
  { "x-forwarded-proto": "https" },
  { "x-middleware-rewrite": "/api/chat" },
  { "x-invoke-path": "/api/chat" },
  { "x-nextjs-data": "1" },
  { "x-now-route-matches": "private" },
  { "x-matched-path": "/api/chat" },
  { "next-url": "/api/chat" },
  { "next-router-state-tree": "synthetic" },
  { expect: "100-continue" },
])("refuses spoof/action/routing headers %j", (extra) => {
  expect(
    privateResearchOperatorRefusal(
      req("/chat/research", "GET", extra),
      deployment,
    ),
  ).toBe(403);
});
it("refuses missing POST origin and unsupported listener origins", () => {
  const request = req("/chat/research/api", "POST");
  request.headers.delete("origin");
  expect(privateResearchOperatorRefusal(request, deployment)).toBe(404);
  for (const origin of [
    "http://[::1]:4182",
    "https://example.test",
    "http://localhost",
  ])
    expect(
      privateResearchOperatorRefusal(req("/chat/research"), {
        ...deployment,
        origin,
      }),
    ).toBe(503);
  expect(
    privateResearchOperatorRefusal({ ...request, url: "invalid" }, deployment),
  ).toBe(503);
});
