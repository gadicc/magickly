import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connection: vi.fn(async () => {}),
  gate: vi.fn(),
  session: vi.fn(),
  dbReads: 0,
  authReads: 0,
}));
vi.mock("next/server", () => ({ connection: state.connection }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("Synthetic404");
  },
}));
vi.mock("@/chat-research/localDeployment", () => ({
  readResearchLocalDeployment: state.gate,
}));
vi.mock("@/chat-research/ResearchSavedAnswers", () => ({
  ResearchSavedAnswers: () => null,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/db/neonFull", () => ({
  get db() {
    state.dbReads++;
    return {};
  },
}));
vi.mock("@/auth/runtime", () => ({
  get sqlAuthOptions() {
    state.authReads++;
    return {};
  },
}));
vi.mock("@/chat-research/previewSession", () => ({
  readPrivateResearchPreviewSession: state.session,
}));

import ResearchPage, { metadata, runtime } from "./page";

afterEach(() => {
  state.connection.mockClear();
  state.gate.mockReset();
  state.session.mockReset();
  state.dbReads = state.authReads = 0;
});
it("waits for an incoming request before evaluating the private shell gate", async () => {
  let release!: () => void;
  state.connection.mockReturnValueOnce(
    new Promise<void>((r) => {
      release = r;
    }),
  );
  state.gate.mockReturnValue(null);
  const pending = ResearchPage();
  const failed = expect(pending).rejects.toThrow("Synthetic404");
  expect(state.gate).not.toHaveBeenCalled();
  release();
  await failed;
  expect(state.gate).toHaveBeenCalledOnce();
  expect(state.dbReads + state.authReads).toBe(0);
});
it("renders the unconfigured shell only after the valid local gate, without passing identity/configuration", async () => {
  state.gate.mockReturnValue({ origin: "http://localhost:4179" });
  state.session.mockResolvedValue({
    expiresAt: 2000000000000,
    identity: "synthetic-session-key",
  });
  const element = await ResearchPage();
  expect(element.props).toEqual({ expiresAt: 2000000000000 });
  expect(element.key).toBe("synthetic-session-key");
  expect(metadata.robots).toEqual({ index: false });
  expect(runtime).toBe("nodejs");
});
it("treats malformed local settings as unavailable without leaking diagnostics", async () => {
  state.gate.mockImplementation(() => {
    throw Error("Private path and secret");
  });
  await expect(ResearchPage()).rejects.toThrow(/^Synthetic404$/);
  expect(state.dbReads + state.authReads).toBe(0);
});

it.each([null, "failure"])(
  "renders a sign-in hint without browser session APIs when the server session is unavailable: %s",
  async (kind) => {
    state.gate.mockReturnValue({ origin: "http://localhost:4180" });
    if (kind === null) state.session.mockResolvedValue(null);
    else state.session.mockRejectedValue(Error("Private secret"));
    const element = await ResearchPage();
    expect(element.type).toBe("p");
    expect(JSON.stringify(element)).not.toContain("Private secret");
  },
);
