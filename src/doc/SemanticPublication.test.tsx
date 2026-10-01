// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createUuidV7 } from "@/lib/ids";
import type { RitualPublicationRequestV1 } from "@/offline/ritualPublicationContract";
import SemanticPublication from "./SemanticPublication";

const mock = vi.hoisted(() => ({
  send: vi.fn(),
  stored: null as RitualPublicationRequestV1 | null,
  save: vi.fn(),
  clear: vi.fn(),
}));
vi.mock("./sqlEditorClient", () => ({ sendRitualPublication: mock.send }));
vi.mock("./semanticDraft", () => ({
  loadSemanticPublication: async () => mock.stored,
  saveSemanticPublication: async (request: RitualPublicationRequestV1) => {
    await mock.save(request);
    mock.stored = request;
  },
  clearSemanticPublication: async (request: RitualPublicationRequestV1) => {
    await mock.clear(request);
    if (JSON.stringify(mock.stored) === JSON.stringify(request))
      mock.stored = null;
  },
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.resetAllMocks();
  mock.stored = null;
});
const setup = () => {
  const actorId = createUuidV7(),
    ritualId = createUuidV7(),
    revisionId = createUuidV7();
  const request: RitualPublicationRequestV1 = {
    version: 1,
    operationId: createUuidV7(),
    expectedActorId: actorId,
    ritualId,
    expectedRevisionId: revisionId,
    expectedVersion: 2,
  };
  return {
    props: { actorId, ritualId, revisionId, version: 2, enabled: true },
    request,
  };
};
it("requires current revision recovery when the server rejects a stale target", async () => {
  const { props, request } = setup();
  mock.stored = request;
  mock.send.mockResolvedValue({
    ok: false,
    code: "STALE",
    message: "Stale revision",
  });
  const rendered = render(<SemanticPublication {...props} />);
  await screen.findByText(/A newer revision exists/);
  expect(screen.queryByRole("button", { name: /Publish|Retry/ })).toBeNull();
  rendered.rerender(<SemanticPublication {...props} enabled={false} />);
  rendered.rerender(<SemanticPublication {...props} />);
  await waitFor(() => expect(mock.send).toHaveBeenCalledOnce());
  expect(mock.stored).toEqual(request);
});
it("starts only one immutable request while browser storage is pending", async () => {
  const { props } = setup();
  let stored!: () => void;
  mock.save.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        stored = resolve;
      }),
  );
  mock.send.mockImplementation(() => new Promise(() => {}));
  render(<SemanticPublication {...props} />);
  const button = screen.getByRole("button", {
    name: "Publish saved version for download",
  });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(button);
  fireEvent.click(button);
  expect(mock.save).toHaveBeenCalledOnce();
  await act(async () => {
    stored();
  });
  await waitFor(() => expect(mock.send).toHaveBeenCalledOnce());
});
it("reenables publication after verification interrupts a durable acknowledgement", async () => {
  const { props, request } = setup();
  mock.stored = request;
  let acknowledged!: () => void;
  mock.send.mockResolvedValue({ ok: true });
  mock.clear.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        acknowledged = resolve;
      }),
  );
  const view = render(<SemanticPublication {...props} />);
  await waitFor(() => expect(mock.clear).toHaveBeenCalledOnce());
  view.rerender(<SemanticPublication {...props} enabled={false} />);
  await act(async () => {
    acknowledged();
  });
  view.rerender(<SemanticPublication {...props} />);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Publish saved version for download",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
});
it("retains unknown publication outcomes and retries the exact request after reload", async () => {
  const { props, request } = setup();
  mock.stored = request;
  mock.send.mockResolvedValueOnce(null).mockResolvedValueOnce({ ok: true });
  render(<SemanticPublication {...props} />);
  await screen.findByText(
    "Publication could not be confirmed. Retry the same request.",
  );
  expect(mock.clear).not.toHaveBeenCalled();
  cleanup();
  render(<SemanticPublication {...props} />);
  await screen.findByText("Published for download.");
  expect(mock.send.mock.calls.map((call) => call[0])).toEqual([
    request,
    request,
  ]);
  expect(mock.clear).toHaveBeenCalledWith(request);
});
it("does not publish without a verified editor grant", async () => {
  const { props, request } = setup();
  mock.stored = request;
  render(<SemanticPublication {...props} enabled={false} />);
  expect(mock.send).not.toHaveBeenCalled();
  expect(
    (
      screen.getByRole("button", {
        name: "Publish saved version for download",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
it("requires a new attempt for an expired publication without changing the saved version", async () => {
  const { props, request } = setup();
  mock.stored = request;
  mock.send
    .mockResolvedValueOnce({
      ok: false,
      code: "EXPIRED",
      message: "Expired",
      retryable: false,
    })
    .mockResolvedValueOnce({ ok: true });
  render(<SemanticPublication {...props} />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Publish current saved version",
    }),
  );
  await screen.findByText("Published for download.");
  const next = mock.send.mock.calls[1][0];
  expect(next.operationId).not.toBe(request.operationId);
  expect(next).toMatchObject({
    expectedActorId: props.actorId,
    ritualId: props.ritualId,
    expectedRevisionId: props.revisionId,
    expectedVersion: props.version,
  });
  expect(mock.save).toHaveBeenCalledWith(next);
});
it("does not send a recovered publication for an older saved version", async () => {
  const { props, request } = setup();
  mock.stored = { ...request, expectedVersion: 1 };
  render(<SemanticPublication {...props} />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Publish current saved version" }),
    ).toBeDefined(),
  );
  expect(mock.send).not.toHaveBeenCalled();
});
