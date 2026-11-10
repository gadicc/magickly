// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHOSEN_PLACE_KEY,
  DETECTED_PLACE_KEY,
  earlyPlaceLookupScript,
  PLACE_PAGES,
  takeEarlyPlaceLookup,
} from "./earlyPlaceLookup";

const london = { name: "London", latitude: 51.5085, longitude: -0.1257 };

const answer = (body: unknown, status = 200) =>
  ({
    ok: status === 200,
    status,
    json: async () => body,
  }) as Response;

/** Runs the `<head>` script as the browser would, on `path`. */
function runOn(path: string) {
  window.history.replaceState(null, "", path);
  new Function(earlyPlaceLookupScript)();
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete window.__magickliPlaceLookup;
  fetchMock = vi.fn(async () => answer({ place: london }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("earlyPlaceLookupScript", () => {
  it.each(PLACE_PAGES)("looks up the place on %s", async (path) => {
    runOn(path);
    expect(fetchMock).toHaveBeenCalledWith("/api/geo", { cache: "no-store" });
    await expect(takeEarlyPlaceLookup()).resolves.toEqual({ place: london });
  });

  it("accepts a trailing slash", () => {
    runOn("/astrology/planets/");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["/", "/astrology", "/astrology/planets/sol", "/geomancy"])(
    "does nothing on %s",
    (path) => {
      runOn(path);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(takeEarlyPlaceLookup()).toBeUndefined();
    },
  );

  it("does nothing when the reader chose a place", () => {
    localStorage.setItem(CHOSEN_PLACE_KEY, "{}");
    runOn("/geomancy/reading");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when this session already looked up", () => {
    sessionStorage.setItem(DETECTED_PLACE_KEY, "{}");
    runOn("/geomancy/reading");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives undefined for an error status", async () => {
    fetchMock.mockResolvedValue(answer({ error: "no" }, 503));
    runOn("/geomancy/reading");
    await expect(takeEarlyPlaceLookup()).resolves.toBeUndefined();
  });

  it("gives undefined when the request fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    runOn("/geomancy/reading");
    await expect(takeEarlyPlaceLookup()).resolves.toBeUndefined();
  });

  it("leaves it to the store when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => runOn("/geomancy/reading")).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("takeEarlyPlaceLookup", () => {
  it("gives the lookup once", () => {
    runOn("/astrology/planetary-hours");
    expect(takeEarlyPlaceLookup()).toBeInstanceOf(Promise);
    expect(takeEarlyPlaceLookup()).toBeUndefined();
  });
});

describe("PLACE_PAGES", () => {
  it("lists every page whose components use the place store", () => {
    const app = join(__dirname, "..", "app");
    const pages = (readdirSync(app, { recursive: true }) as string[])
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) =>
        readFileSync(join(app, file), "utf8").includes('from "@/geo/usePlace"'),
      )
      .map(
        (file) =>
          `/${relative(app, join(app, dirname(file)))
            .split(sep)
            .filter((segment) => !/^\(.*\)$/.test(segment))
            .join("/")}`,
      );
    expect(new Set(pages)).toEqual(new Set(PLACE_PAGES));
  });
});
