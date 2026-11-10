import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_PLACE } from "@/geo/fixture";
import { GET } from "./route";

const TOKYO = {
  name: "Tokyo",
  country: "JP",
  latitude: 35.6895,
  longitude: 139.6917,
  timezone: "Asia/Tokyo",
};

const VERCEL_HEADERS = {
  "x-vercel-ip-latitude": "48.8534",
  "x-vercel-ip-longitude": "2.3488",
  "x-vercel-ip-city": "Paris",
  "x-vercel-ip-country": "FR",
  "x-vercel-ip-timezone": "Europe/Paris",
};

const fetchMock = vi.fn<typeof fetch>();

function request(headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3000/api/geo", {
    headers: { cookie: "session=secret", ...headers },
  });
}

async function place(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const body = await response.json();
  expect(Object.keys(body)).toEqual(["place"]);
  return body.place;
}

function development() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL_ENV", "");
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEO_FIXTURE", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/geo", () => {
  it("answers the place from Vercel's headers", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await place(await GET(request(VERCEL_HEADERS)))).toEqual({
      name: "Paris",
      country: "FR",
      latitude: 48.8534,
      longitude: 2.3488,
      timezone: "Europe/Paris",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefers the headers to the proxy in development", async () => {
    development();
    expect((await place(await GET(request(VERCEL_HEADERS)))).name).toBe(
      "Paris",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is null for out-of-range coordinates in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    const headers = { ...VERCEL_HEADERS, "x-vercel-ip-latitude": "91" };
    expect(await place(await GET(request(headers)))).toBeNull();
  });

  it("keeps the coordinates when the city is malformed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    const headers = { ...VERCEL_HEADERS, "x-vercel-ip-city": "%E0%A4%A" };
    expect(await place(await GET(request(headers)))).toMatchObject({
      name: "France",
      latitude: 48.8534,
    });
  });

  describe("GEO_FIXTURE=1", () => {
    beforeEach(() => vi.stubEnv("GEO_FIXTURE", "1"));

    it("answers the synthetic place in development, asking no one", async () => {
      development();
      expect(await place(await GET(request(VERCEL_HEADERS)))).toEqual(
        FIXTURE_PLACE,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ["NODE_ENV=production", "production", ""],
      ["VERCEL_ENV set", "development", "preview"],
    ])("is ignored with %s", async (_label, nodeEnv, vercelEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      expect(await place(await GET(request(VERCEL_HEADERS)))).toMatchObject({
        name: "Paris",
      });
      expect(await place(await GET(request()))).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("without headers", () => {
    it.each([
      ["NODE_ENV=production", "production", ""],
      ["NODE_ENV=test", "test", ""],
      ["VERCEL_ENV set", "development", "preview"],
    ])("never asks production with %s", async (_label, nodeEnv, vercelEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      expect(await place(await GET(request()))).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("asks production in development and passes its place on", async () => {
      development();
      fetchMock.mockResolvedValue(Response.json({ place: TOKYO }));
      expect(await place(await GET(request()))).toEqual(TOKYO);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://magick.ly/api/geo");
      expect(init).toMatchObject({ cache: "no-store", redirect: "error" });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      // Nothing from the incoming request (its cookie) is forwarded.
      expect(init).not.toHaveProperty("headers");
    });

    it.each([
      ["a 404", () => new Response("Not found", { status: 404 })],
      ["non-JSON", () => new Response("<html></html>", { status: 200 })],
      ["a bad shape", () => Response.json({ place: { name: "Nowhere" } })],
      ["a bare place", () => Response.json(TOKYO)],
      ["JSON null", () => Response.json(null)],
      ["a null place", () => Response.json({ place: null })],
    ])("is null when production answers %s", async (_label, answer) => {
      development();
      fetchMock.mockResolvedValue(answer());
      expect(await place(await GET(request()))).toBeNull();
    });

    it.each([
      ["times out", new DOMException("timed out", "TimeoutError")],
      ["redirects", new TypeError("fetch failed: redirect")],
      ["is unreachable", new TypeError("fetch failed")],
    ])("is null when production %s", async (_label, error) => {
      development();
      fetchMock.mockRejectedValue(error);
      expect(await place(await GET(request()))).toBeNull();
    });
  });
});
