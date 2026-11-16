import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connection: vi.fn(async () => {}),
  gate: vi.fn(),
  session: vi.fn(),
  managedSession: vi.fn(),
  dbReads: 0,
  authReads: 0,
}));
vi.mock("next/server", () => ({ connection: state.connection }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("Synthetic404");
  },
}));
vi.mock("@/chat-research/webDeployment", () => ({
  readResearchWebDeployment: state.gate,
}));
vi.mock("@/chat-research/managedBootstrap", () => ({
  readManagedResearchPageSession: state.managedSession,
}));
vi.mock("@/chat-research/ResearchHostedChat", () => ({
  ResearchHostedChat: () => null,
}));
vi.mock("@/chat-research/ResearchOperatorChat", () => ({
  ResearchOperatorChat: () => null,
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

import { ResearchHostedChat } from "@/chat-research/ResearchHostedChat";
import { ResearchOperatorChat } from "@/chat-research/ResearchOperatorChat";
import { ResearchSavedAnswers } from "@/chat-research/ResearchSavedAnswers";
import ResearchPage, { metadata, runtime } from "./page";

afterEach(() => {
  state.connection.mockClear();
  state.gate.mockReset();
  state.session.mockReset();
  state.managedSession.mockReset();
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
it.each(["reader", "operator"])(
  "renders only the %s shell after its valid gate, without passing identity/configuration",
  async (mode) => {
    state.gate.mockReturnValue({ mode, origin: "http://localhost:4179" });
    state.session.mockResolvedValue({
      expiresAt: 2000000000000,
      identity: "synthetic-session-key",
    });
    const element = await ResearchPage();
    expect(element.type).toBe(
      mode === "operator" ? ResearchOperatorChat : ResearchSavedAnswers,
    );
    expect(element.props).toEqual({ expiresAt: 2000000000000 });
    expect(element.key).toBe("synthetic-session-key");
    expect(metadata.robots).toEqual({ index: false });
    expect(runtime).toBe("nodejs");
  },
);
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

it.each(["read-only", "native-window"])(
  "renders the hosted privacy guard for managed %s without serializing server pins",
  async (generation) => {
    state.gate.mockReturnValue({
      mode: "managed",
      generation,
      operatorId: "synthetic-private-operator",
    });
    state.managedSession.mockResolvedValue({
      identity: "synthetic-key",
      expiresAt: 2000000000000,
    });
    const element = await ResearchPage();
    expect(element.type).toBe(ResearchHostedChat);
    expect(element.key).toBe("synthetic-key");
    expect(element.props).toEqual({
      expiresAt: 2000000000000,
      readOnly: generation === "read-only",
    });
    expect(state.dbReads + state.authReads).toBe(0);
  },
);
it.each([null, "reject"])(
  "does not reveal a managed shell to an unavailable/nonoperator session: %s",
  async (failure) => {
    state.gate.mockReturnValue({ mode: "managed" });
    if (failure === null) state.managedSession.mockResolvedValue(null);
    else state.managedSession.mockRejectedValue(Error("synthetic-private"));
    await expect(ResearchPage()).rejects.toThrow(/^Synthetic404$/);
    expect(state.dbReads + state.authReads).toBe(0);
  },
);
