import { expect, it, vi } from "vitest";
import { privateResearchPreviewRefusal } from "./previewIngress";

vi.mock("server-only", () => ({}));
const env = () => ({
  MAGICKLI_PRIVATE_RESEARCH_LOCAL: "1",
  NODE_ENV: "production",
  BETTER_AUTH_URL: "http://localhost:4180",
  MAGICKLI_RESEARCH_STARTUP_SHA256: "a".repeat(64),
  MAGICKLI_RESEARCH_RUNTIME_SHA256: "b".repeat(64),
  MAGICKLI_RESEARCH_ENDPOINT_SHA256: "c".repeat(64),
});
function req(
  path: string,
  method = "GET",
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost:4180" + path, {
    method,
    headers: { host: "localhost:4180", ...headers },
  });
}
it("preserves ordinary site methods/paths without inspecting unrelated env", () => {
  expect(
    privateResearchPreviewRefusal(
      req("/api/anything", "POST"),
      new Proxy(
        {},
        {
          get: (_, k) => {
            if (k === "MAGICKLI_PRIVATE_RESEARCH_LOCAL") return undefined;
            throw Error();
          },
        },
      ),
    ),
  ).toBeNull();
});
it.each([
  "/chat/research",
  "/chat/research?_rsc=hint",
  "/_next/static/chunks/foo.js",
  "/_next/static/css/a.css",
  "/_next/static/media/font.woff2",
])("allows the read shell and immutable assets %s", (path) => {
  for (const method of ["GET", "HEAD"])
    expect(privateResearchPreviewRefusal(req(path, method), env())).toBeNull();
});
it.each([
  "/chat/research/catalog",
  "/chat/research/answers/list",
  "/chat/research/answers/read",
])("allows only explicit source-authorized read API POST %s", (path) => {
  expect(
    privateResearchPreviewRefusal(
      req(path, "POST", { origin: "http://localhost:4180" }),
      env(),
    ),
  ).toBeNull();
  expect(privateResearchPreviewRefusal(req(path), env())).toBe(404);
  expect(
    privateResearchPreviewRefusal(req(path + "?extra=1", "POST"), env()),
  ).toBe(404);
});
it.each([
  "/",
  "/api/auth/get-session",
  "/api/auth/sign-in/social",
  "/api/files",
  "/chat/research/api",
  "/_next/image?url=https://example.test/private",
  "/_next/data/build/index.json",
  "/chat/research/answers/list/",
  "/CHAT/research",
  "/chat%2fresearch",
  "/_next/static/a%2fb.js",
  "/_next/static/a.json",
  "/sw.js",
])("refuses unrelated and aliased paths %s", (path) => {
  for (const method of ["GET", "POST", "PUT"])
    expect(privateResearchPreviewRefusal(req(path, method), env())).toBe(404);
});
it.each<Record<string, string>>([
  { host: "127.0.0.1:4180" },
  { host: "localhost:3004" },
  { origin: "https://evil.example" },
  { "sec-fetch-site": "cross-site" },
  { "next-action": "synthetic" },
  { authorization: "Bearer synthetic" },
  { forwarded: "host=localhost:4180" },
  { "x-forwarded-host": "evil.example" },
  { "x-forwarded-proto": "https" },
  { "x-forwarded-port": "443" },
])(
  "refuses alternate destination, cross-origin and action headers %j",
  (headers) => {
    expect(
      privateResearchPreviewRefusal(
        req("/chat/research", "GET", headers),
        env(),
      ),
    ).toBe(403);
  },
);
it("accepts only Next's canonical forwarded values", () => {
  expect(
    privateResearchPreviewRefusal(
      req("/chat/research", "GET", {
        "x-forwarded-host": "localhost:4180",
        "x-forwarded-proto": "http",
        "x-forwarded-port": "4180",
      }),
      env(),
    ),
  ).toBeNull();
});
it("refuses malformed/alternate enabled deployments before rendering", () => {
  for (const patch of [
    { BETTER_AUTH_URL: "http://localhost:4179" },
    { NODE_ENV: "development" },
    { MAGICKLI_RESEARCH_STARTUP_SHA256: "invalid" },
  ])
    expect(
      privateResearchPreviewRefusal(req("/chat/research"), {
        ...env(),
        ...patch,
      }),
    ).toBe(503);
});
