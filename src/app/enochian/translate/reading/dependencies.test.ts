import dictionary from "magick-data/enochian/dictionary";
import keys from "magick-data/enochian/keys";
import { describe, expect, it, vi } from "vitest";
import { clientSubject } from "@/limits/client";
import { READING_CLIENT } from "@/limits/policies";
import { GRAMMAR } from "./grammar.generated.ts";
import { gatewayReadingModel } from "./model.ts";
import { admitReading } from "./passage.ts";
import { rowsFromKeys } from "./prompt.ts";
import { buildReadingPrompt } from "./request.ts";

// The real wiring, with fakes for what reaches the network or a database.
const fakes = vi.hoisted(() => ({
  db: { marker: "neonFull" },
  userId: vi.fn(async () => null),
  after: vi.fn(),
  secret: "synthetic-auth-test-secret-over-thirty-two-characters",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/neonFull", () => ({ db: fakes.db }));
vi.mock("@/auth/runtime", () => ({
  sqlAuthOptions: { secret: fakes.secret },
}));
vi.mock("@/auth/session", () => ({ getCurrentSqlUserId: fakes.userId }));
vi.mock("next/server", () => ({ after: fakes.after }));

const { readingDependencies: deps } = await import("./dependencies.ts");

describe("the reading route's real dependencies", () => {
  it("are the transactional database, chat's session reader and the gateway", () => {
    expect(deps.db).toBe(fakes.db);
    expect(deps.userId).toBe(fakes.userId);
    expect(deps.model).toBe(gatewayReadingModel);
  });

  it("build the lookup and the prompt once, from the bundled data", () => {
    const translator = deps.translator();
    expect(deps.translator()).toBe(translator);
    expect(admitReading(translator, "VORSG SONF")).toMatchObject({ ok: true });
    const prompt = deps.prompt();
    expect(deps.prompt()).toBe(prompt);
    expect(prompt.version).toBe(
      buildReadingPrompt({
        dictionary,
        rows: rowsFromKeys(keys),
        grammar: GRAMMAR,
      }).version,
    );
    expect(prompt.instructions[2]).toContain(GRAMMAR.trim().slice(0, 200));
  });

  it("bucket a client by Vercel's x-real-ip under the auth secret's day key", () => {
    const request = (headers: Record<string, string>) =>
      new Request("https://magick.ly/api/enochian/read", { headers });
    expect(
      deps.clientSubject(request({ "x-real-ip": "203.0.113.5" }), "2026-11-17"),
    ).toBe(
      clientSubject(fakes.secret, READING_CLIENT, "203.0.113.5", "2026-11-17"),
    );
    expect(deps.clientSubject(request({}), "2026-11-17")).toBe(
      "reading-client:none",
    );
  });

  it("keep the function alive for the calls with `after`", async () => {
    const work = Promise.resolve("done");
    deps.waitUntil(work);
    expect(fakes.after).toHaveBeenCalledOnce();
    const task = fakes.after.mock.calls[0][0] as () => Promise<unknown>;
    expect(await task()).toBe("done");
  });
});
