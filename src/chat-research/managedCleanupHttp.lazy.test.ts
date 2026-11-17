/** No runner value import: exercise the actual lazy boundary with a controlled module barrier. */
import { afterEach, expect, it, vi } from "vitest";
import type { ResearchManagedCleanupOptions } from "./managedCleanup";
import {
  createResearchManagedCleanupHttpHandler,
  RESEARCH_MANAGED_CLEANUP_PATH,
} from "./managedCleanupHttp";

vi.mock("server-only", () => ({}));
afterEach(() => {
  vi.doUnmock("./managedCleanup");
  vi.restoreAllMocks();
  vi.resetModules();
});
const origin = "https://synthetic.example",
  token = "a".repeat(64);
it("denied bearer never imports runner code or private options", async () => {
  vi.resetModules();
  const imported = vi.fn(),
    load = vi.fn();
  vi.doMock("./managedCleanup", () => {
    imported();
    return { runResearchManagedCleanup: vi.fn() };
  });
  const handler = createResearchManagedCleanupHttpHandler({
    origin,
    secret: () => token,
    loadOptions: load,
  });
  expect(
    (
      await handler(
        new Request(origin + RESEARCH_MANAGED_CLEANUP_PATH, {
          headers: { host: "synthetic.example" },
        }),
      )
    ).status,
  ).toBe(404);
  expect(imported).not.toHaveBeenCalled();
  expect(load).not.toHaveBeenCalled();
});
it("a late runner import cannot start private loading or receive a renewed config budget", async () => {
  vi.resetModules();
  let release!: () => void;
  const load = vi.fn(async () => ({}) as ResearchManagedCleanupOptions),
    run = vi.fn(),
    clock = vi.spyOn(performance, "now").mockReturnValue(0);
  vi.doMock("./managedCleanup", async () => {
    await new Promise<void>((r) => {
      release = r;
    });
    return { runResearchManagedCleanup: run };
  });
  const handler = createResearchManagedCleanupHttpHandler({
      origin,
      secret: () => token,
      loadOptions: load,
    }),
    pending = handler(
      new Request(origin + RESEARCH_MANAGED_CLEANUP_PATH, {
        headers: {
          host: "synthetic.example",
          authorization: "Bearer " + token,
        },
      }),
    );
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  clock.mockReturnValue(9001);
  release();
  expect((await pending).status).toBe(503);
  expect(load).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
});
it.each([Number.NaN, Infinity, -1])(
  "refuses invalid or exhausted inherited work bound %s before private work",
  async (end) => {
    const load = vi.fn();
    const h = createResearchManagedCleanupHttpHandler({
      origin,
      secret: () => token,
      loadOptions: load,
    });
    expect(
      (
        await h(
          new Request(origin + RESEARCH_MANAGED_CLEANUP_PATH, {
            headers: {
              host: "synthetic.example",
              authorization: "Bearer " + token,
            },
          }),
          end,
        )
      ).status,
    ).toBe(503);
    expect(load).not.toHaveBeenCalled();
  },
);
