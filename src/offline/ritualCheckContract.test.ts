import { describe, expect, it } from "vitest";
import { createUuidV7 } from "../lib/ids";
import { OFFLINE_AUTHORIZATION_WINDOW_MS } from "./lease";
import {
  parseRitualPermissionCheckRequest,
  parseRitualPermissionCheckResponse,
} from "./ritualCheckContract";

const request = () => ({
  version: 1 as const,
  requestId: createUuidV7(),
  expectedActorId: createUuidV7(),
  ritualId: createUuidV7(),
});
const checkRequest = (r = request()) => ({ ...r, version: 2 as const });
const granted = (r: ReturnType<typeof request>) => ({
  version: 1 as const,
  requestId: r.requestId,
  ownerId: r.expectedActorId,
  ritualId: r.ritualId,
  kind: "granted" as const,
  grant: {
    version: 1 as const,
    leaseId: createUuidV7(),
    ownerId: r.expectedActorId,
    ritualId: r.ritualId,
    checkedAtMs: 100,
    respondedAtMs: 200,
    expiresAtMs: 100 + OFFLINE_AUTHORIZATION_WINDOW_MS,
    sourceEdit: false,
  },
  editor: null,
  rendered: {
    kind: "available" as const,
    descriptor: {
      descriptorSha256: "a".repeat(64),
      contentSha256: "b".repeat(64),
      outputFormat: "json-rich-text" as const,
      outputFormatVersion: "1" as const,
    },
  },
});
const valid = (r = request()) => ({
  version: 2 as const,
  requestId: r.requestId,
  ownerId: r.expectedActorId,
  ritualId: r.ritualId,
  routeAlias: null as string | null,
  permission: granted(r) as object,
  bundle: { bundleId: createUuidV7(), manifestSha256: "c".repeat(64) } as
    | object
    | null,
});
const transport = { status: 200, sameOrigin: true, uncached: true };
const temporary = (r: ReturnType<typeof request>) => ({
  routeAlias: null,
  permission: {
    version: 1,
    requestId: r.requestId,
    ownerId: r.expectedActorId,
    ritualId: r.ritualId,
    kind: "temporarily-unavailable",
  },
  bundle: null,
});
const inner = (r: ReturnType<typeof request>, kind: string) => ({
  version: 1,
  requestId: r.requestId,
  ownerId: r.expectedActorId,
  ritualId: r.ritualId,
  kind,
});

describe("strict check request", () => {
  it("returns the v1 request a check implies, as a copy", () => {
    const r = request();
    const body = checkRequest(r);
    const parsed = parseRitualPermissionCheckRequest(body);
    expect(parsed).toEqual(r);
    body.ritualId = createUuidV7();
    expect(parsed?.ritualId).toBe(r.ritualId);
    expect(
      parseRitualPermissionCheckRequest(
        Object.assign(Object.create(null), checkRequest(r)),
      ),
    ).toEqual(r);
  });
  it.each([
    null,
    [],
    false,
    "",
    2,
    {},
    new Date(),
    { version: 2 },
    Object.create(checkRequest()),
  ])("rejects invalid request shape %j", (input) =>
    expect(parseRitualPermissionCheckRequest(input)).toBeNull(),
  );
  it.each([1, 3, "2", 2.5, null])("rejects version %j", (version) =>
    expect(
      parseRitualPermissionCheckRequest({ ...checkRequest(), version }),
    ).toBeNull(),
  );
  it.each(["version", "requestId", "expectedActorId", "ritualId"])(
    "requires own canonical request %s",
    (key) => {
      const r = checkRequest();
      expect(
        parseRitualPermissionCheckRequest({ ...r, [key]: "bad" }),
      ).toBeNull();
      expect(
        parseRitualPermissionCheckRequest({ ...r, [key]: undefined }),
      ).toBeNull();
      if (key !== "version")
        expect(
          parseRitualPermissionCheckRequest({
            ...r,
            [key]: createUuidV7().toUpperCase(),
          }),
        ).toBeNull();
      const missing: Partial<typeof r> = { ...r };
      delete missing[key as keyof typeof r];
      expect(parseRitualPermissionCheckRequest(missing)).toBeNull();
    },
  );
  it("rejects extras, symbols, accessors and hostile proxies without invoking getters", () => {
    const r = checkRequest(),
      getter = Object.defineProperty({ ...r }, "ritualId", {
        get() {
          throw Error("private");
        },
        enumerable: true,
      });
    expect(parseRitualPermissionCheckRequest(getter)).toBeNull();
    expect(parseRitualPermissionCheckRequest({ ...r, extra: 1 })).toBeNull();
    expect(
      parseRitualPermissionCheckRequest({ ...r, [Symbol()]: 1 }),
    ).toBeNull();
    expect(
      parseRitualPermissionCheckRequest(
        Object.defineProperty({ ...r }, "extra", { value: 1 }),
      ),
    ).toBeNull();
    expect(
      parseRitualPermissionCheckRequest(
        new Proxy(r, {
          getPrototypeOf() {
            throw Error();
          },
        }),
      ),
    ).toBeNull();
  });
});

describe("strict check reply", () => {
  it("accepts a grant with a bundle identity and copies it", () => {
    const r = request(),
      body = valid(r);
    const result = parseRitualPermissionCheckResponse(r, body, transport);
    expect(result).toEqual({
      routeAlias: null,
      permission: body.permission,
      bundle: body.bundle,
    });
    (body.bundle as { bundleId: string }).bundleId = createUuidV7();
    expect(result?.bundle).not.toEqual(body.bundle);
  });
  it.each([
    ["granted", (r: ReturnType<typeof request>) => granted(r)],
    [
      "unavailable rendering",
      (r: ReturnType<typeof request>) => ({
        ...granted(r),
        rendered: { kind: "temporarily-unavailable" },
      }),
    ],
    ["denied", (r: ReturnType<typeof request>) => inner(r, "denied")],
    [
      "authentication-required",
      (r: ReturnType<typeof request>) => inner(r, "authentication-required"),
    ],
  ])("accepts a bound %s reply with no bundle", (_name, permission) => {
    const r = request(),
      value = permission(r);
    expect(
      parseRitualPermissionCheckResponse(
        r,
        { ...valid(r), permission: value, bundle: null },
        transport,
      ),
    ).toEqual({ routeAlias: null, permission: value, bundle: null });
  });
  it.each(["denied", "authentication-required"])(
    "binds a %s reply to the request",
    (kind) => {
      const r = request(),
        other = request();
      for (const permission of [
        inner(other, kind),
        { ...inner(r, kind), requestId: other.requestId },
        { ...inner(r, kind), ownerId: other.expectedActorId },
        { ...inner(r, kind), ritualId: other.ritualId },
        { ...inner(r, kind), extra: 1 },
      ])
        expect(
          parseRitualPermissionCheckResponse(
            r,
            { ...valid(r), permission, bundle: null },
            transport,
          ),
        ).toEqual(temporary(r));
      expect(
        parseRitualPermissionCheckResponse(
          r,
          { ...valid(other), permission: inner(r, kind), bundle: null },
          transport,
        ),
      ).toEqual(temporary(r));
    },
  );
  it("never accepts an inner temporary permission", () => {
    const r = request();
    expect(
      parseRitualPermissionCheckResponse(
        r,
        {
          ...valid(r),
          permission: inner(r, "temporarily-unavailable"),
          bundle: null,
        },
        transport,
      ),
    ).toEqual(temporary(r));
  });
  it.each([
    ["denied", (r: ReturnType<typeof request>) => inner(r, "denied")],
    [
      "authentication-required",
      (r: ReturnType<typeof request>) => inner(r, "authentication-required"),
    ],
    [
      "unavailable rendering",
      (r: ReturnType<typeof request>) => ({
        ...granted(r),
        rendered: { kind: "temporarily-unavailable" },
      }),
    ],
  ])("rejects a bundle on %s", (_name, permission) => {
    const r = request();
    expect(
      parseRitualPermissionCheckResponse(
        r,
        { ...valid(r), permission: permission(r) },
        transport,
      ),
    ).toEqual(temporary(r));
  });
  it.each([
    {},
    [],
    "bundle",
    { bundleId: createUuidV7() },
    { manifestSha256: "c".repeat(64) },
    {
      bundleId: createUuidV7(),
      manifestSha256: "c".repeat(64),
      manifestJson: "{}",
    },
    { bundleId: createUuidV7(), manifestSha256: "C".repeat(64) },
    { bundleId: createUuidV7(), manifestSha256: "c".repeat(63) },
    { bundleId: createUuidV7().toUpperCase(), manifestSha256: "c".repeat(64) },
    { bundleId: "bad", manifestSha256: "c".repeat(64) },
    Object.assign(Object.create({ extra: 1 }), {
      bundleId: createUuidV7(),
      manifestSha256: "c".repeat(64),
    }),
  ])("rejects bundle %j", (bundle) => {
    const r = request();
    expect(
      parseRitualPermissionCheckResponse(r, { ...valid(r), bundle }, transport),
    ).toEqual(temporary(r));
  });
  it("rejects a manifest anywhere in the envelope", () => {
    const r = request(),
      body = valid(r);
    expect(
      parseRitualPermissionCheckResponse(
        r,
        { ...body, manifestJson: "{}" },
        transport,
      ),
    ).toEqual(temporary(r));
  });
  it("rejects a v1 delivery envelope", () => {
    const r = request(),
      body = valid(r);
    expect(
      parseRitualPermissionCheckResponse(
        r,
        {
          ...body,
          version: 1,
          bundle: { ...body.bundle, manifestJson: "{}" },
        },
        transport,
      ),
    ).toEqual(temporary(r));
    expect(
      parseRitualPermissionCheckResponse(
        r,
        { ...body, version: 1, bundle: null },
        transport,
      ),
    ).toEqual(temporary(r));
  });
  it.each(["version", "requestId", "ownerId", "ritualId"])(
    "rejects a wrong envelope %s",
    (key) => {
      const r = request();
      expect(
        parseRitualPermissionCheckResponse(
          r,
          { ...valid(r), [key]: key === "version" ? 3 : createUuidV7() },
          transport,
        ),
      ).toEqual(temporary(r));
    },
  );
  it.each([
    "version",
    "requestId",
    "ownerId",
    "ritualId",
    "routeAlias",
    "permission",
    "bundle",
  ])("requires envelope %s", (key) => {
    const r = request();
    const body: Partial<ReturnType<typeof valid>> = valid(r);
    delete body[key as keyof typeof body];
    expect(parseRitualPermissionCheckResponse(r, body, transport)).toEqual(
      temporary(r),
    );
  });
  it("accepts only the requested route alias, or none", () => {
    const r = request(),
      alias = "0123456789abcdef01234567";
    const body = { ...valid(r), routeAlias: alias };
    expect(
      parseRitualPermissionCheckResponse(r, body, transport, alias)?.routeAlias,
    ).toBe(alias);
    expect(
      parseRitualPermissionCheckResponse(r, valid(r), transport, alias)
        ?.routeAlias,
    ).toBeNull();
    expect(parseRitualPermissionCheckResponse(r, body, transport)).toEqual(
      temporary(r),
    );
    expect(
      parseRitualPermissionCheckResponse(
        r,
        body,
        transport,
        "fedcba9876543210fedcba98",
      ),
    ).toEqual(temporary(r));
  });
  it.each([0, 201, 204, 304, 400, 401, 403, 404, 500])(
    "HTTP %s is temporary",
    (status) => {
      const r = request();
      expect(
        parseRitualPermissionCheckResponse(r, valid(r), {
          ...transport,
          status,
        }),
      ).toEqual(temporary(r));
    },
  );
  it.each(["sameOrigin", "uncached"])(
    "requires explicit %s transport acceptance",
    (key) => {
      const r = request();
      expect(
        parseRitualPermissionCheckResponse(r, valid(r), {
          ...transport,
          [key]: false,
        }),
      ).toEqual(temporary(r));
    },
  );
  it.each([
    null,
    undefined,
    42,
    "granted",
    [],
    {},
    new Error("secret"),
    Object.create(valid()),
  ])("arbitrary body %j is temporary", (body) => {
    const r = request();
    expect(parseRitualPermissionCheckResponse(r, body, transport)).toEqual(
      temporary(r),
    );
  });
  it("never propagates hostile getters, proxies or errors", () => {
    const r = request();
    expect(
      parseRitualPermissionCheckResponse(
        r,
        new Proxy(valid(r), {
          getOwnPropertyDescriptor() {
            throw Error("secret");
          },
        }),
        transport,
      ),
    ).toEqual(temporary(r));
    expect(
      parseRitualPermissionCheckResponse(
        r,
        Object.defineProperty(valid(r), "bundle", {
          get() {
            throw Error("secret");
          },
          enumerable: true,
        }),
        transport,
      ),
    ).toEqual(temporary(r));
    expect(
      parseRitualPermissionCheckResponse(r, valid(r), null as never),
    ).toEqual(temporary(r));
  });
  it("cannot bind to an invalid caller request", () => {
    const r = request();
    expect(
      parseRitualPermissionCheckResponse(
        checkRequest(r) as never,
        valid(r),
        transport,
      ),
    ).toBeNull();
    expect(
      parseRitualPermissionCheckResponse(
        { ...r, ritualId: "bad" },
        valid(r),
        transport,
      ),
    ).toBeNull();
  });
});
