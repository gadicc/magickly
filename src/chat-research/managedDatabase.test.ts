/** Transport wiring/name checks with synthetic ports, not a live TLS or database acceptance proof. */
import { beforeEach, expect, it, vi } from "vitest";
import {
  createResearchManagedDatabase,
  parseResearchManagedDatabase,
  researchManagedEndpointIdentity,
} from "./managedDatabase";

const m = vi.hoisted(() => ({
  postgres: vi.fn(),
  drizzle: vi.fn(),
  end: vi.fn(),
  root: { transaction: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("postgres", () => ({ default: m.postgres }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: m.drizzle }));
const host = "ep-synthetic.eu-west-2.aws.neon.tech",
  database = "synthetic_db",
  runtime = "magickli_research_runtime_v1" as const;
function inputs(role: typeof runtime | "magickli_corpus_reader_v1" = runtime) {
  return {
    url: `postgresql://${role}:${"a".repeat(64)}@${host}/${database}?sslmode=verify-full&channel_binding=require`,
    pin: {
      database,
      role,
      roleOid: 701,
      endpointSha256: researchManagedEndpointIdentity({ host, database, role }),
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  m.end.mockResolvedValue(undefined);
  m.postgres.mockReturnValue({ end: m.end });
  m.drizzle.mockReturnValue(m.root);
});
it.each([runtime, "magickli_corpus_reader_v1"] as const)(
  "uses only the dedicated %s root and certificate-verified TLS",
  async (role) => {
    const { url, pin } = inputs(role),
      created = createResearchManagedDatabase(url, pin),
      options = m.postgres.mock.calls[0][0];
    expect(created.database).toBe(m.root);
    expect(options).toMatchObject({
      host,
      database,
      username: role,
      prepare: false,
      debug: false,
      max: role === runtime ? 2 : 1,
      ssl: {
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
        servername: host,
      },
      connection: { default_transaction_read_only: role !== runtime },
    });
    expect(
      options.ssl.checkServerIdentity(host, { subjectaltname: `DNS:${host}` }),
    ).toBeUndefined();
    expect(options.ssl.checkServerIdentity("other.example", {})).toBeInstanceOf(
      Error,
    );
    expect(
      options.ssl.checkServerIdentity(host, {
        subjectaltname: "DNS:other.example",
      }),
    ).toBeInstanceOf(Error);
    options.onnotice({ message: "Synthetic private notice" });
    expect(m.root.transaction).not.toHaveBeenCalled();
    await created.close();
    expect(m.end).toHaveBeenCalledWith({ timeout: 1 });
  },
);
it.each([
  ["bad URL", "bad"],
  ["wrong protocol", "https://"],
  ["pooler", "-pooler"],
  ["port", ":5433"],
  ["fragment", "#x"],
  ["owner", "owner"],
  ["database", "other_db"],
  ["short secret", "short"],
  ["encoded newline secret", "%0a"],
  ["unsafe SSL", "require"],
  ["unknown option", "&options=anything"],
  ["duplicate SSL", "&sslmode=verify-full"],
  ["duplicate binding", "&channel_binding=require"],
  ["no binding", "none"],
])("rejects %s without constructing a client", (kind, value) => {
  let { url, pin } = inputs();
  if (kind === "bad URL") url = value;
  if (kind === "wrong protocol") url = url.replace("postgresql://", value);
  if (kind === "pooler")
    url = url.replace("ep-synthetic.", "ep-synthetic-pooler.");
  if (kind === "port") url = url.replace(host, host + value);
  if (
    kind === "fragment" ||
    kind.startsWith("duplicate") ||
    kind === "unknown option"
  )
    url += value;
  if (kind === "owner") url = url.replace(runtime, value);
  if (kind === "database") url = url.replace(database, value);
  if (kind === "short secret") url = url.replace("a".repeat(64), value);
  if (kind === "encoded newline secret")
    url = url.replace("a".repeat(64), "a".repeat(64) + value);
  if (kind === "unsafe SSL") url = url.replace("verify-full", value);
  if (kind === "no binding") url = url.replace("&channel_binding=require", "");
  expect(() => createResearchManagedDatabase(url, pin)).toThrow(
    /^Private managed database unavailable$/,
  );
  expect(m.postgres).not.toHaveBeenCalled();
});
it.each([undefined, " ", "x".repeat(16385), "postgresql://a\nb@bad/db"])(
  "bounds malformed/control input before any transport",
  (url) => {
    expect(() =>
      parseResearchManagedDatabase(url as string, inputs().pin),
    ).toThrow();
  },
);
it.each([
  { roleOid: 0 },
  { roleOid: NaN },
  { roleOid: 4294967296 },
  { endpointSha256: "bad" },
  { endpointSha256: "f".repeat(64) },
  { role: "owner" },
])("refuses wrong independent pins %j", (delta) => {
  const { url, pin } = inputs();
  expect(() =>
    parseResearchManagedDatabase(url, { ...pin, ...delta } as typeof pin),
  ).toThrow();
});
it("accepts the explicit standard port and rejects invalid database names even with matching input", () => {
  const { url, pin } = inputs();
  expect(
    parseResearchManagedDatabase(url.replace(host, host + ":5432"), pin)
      .database,
  ).toBe(database);
  expect(() =>
    parseResearchManagedDatabase(url.replace(database, "bad-name"), {
      ...pin,
      database: "bad-name",
    }),
  ).toThrow();
  expect(() => parseResearchManagedDatabase(" " + url, pin)).toThrow();
});
