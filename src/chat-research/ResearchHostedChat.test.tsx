// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResearchHostedChat } from "./ResearchHostedChat";

const state = vi.hoisted(() => ({
  ready: vi.fn(),
  child: vi.fn(),
  mount: vi.fn(),
  unmount: vi.fn(),
}));
vi.mock("./browserWorker", () => ({ createResearchBrowserFetch: state.ready }));
vi.mock("./ResearchSessionChat", () => ({
  SessionResearchChat: (props: unknown) => {
    useEffect(() => {
      state.mount();
      return () => {
        state.unmount();
      };
    }, []);
    state.child(props);
    return <p>synthetic-private-ui</p>;
  },
}));
let original: PropertyDescriptor | undefined,
  workers: {
    controller: null;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
beforeEach(() => {
  state.ready.mockReset();
  state.child.mockReset();
  state.mount.mockReset();
  state.unmount.mockReset();
  original = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  workers = {
    controller: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: workers,
  });
});
afterEach(() => {
  cleanup();
  if (original) Object.defineProperty(navigator, "serviceWorker", original);
  else Reflect.deleteProperty(navigator, "serviceWorker");
  vi.restoreAllMocks();
});
const gate = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { resolve, promise };
};
it("mounts no private child until compatibility passes and gives it only the guarded transport", async () => {
  const pending = gate<typeof fetch>(),
    requestFetch = vi.fn();
  state.ready.mockReturnValue(pending.promise);
  render(<ResearchHostedChat expiresAt={2000000000000} />);
  expect(state.child).not.toHaveBeenCalled();
  await act(async () => pending.resolve(requestFetch));
  expect(screen.getByText("synthetic-private-ui")).toBeTruthy();
  expect(state.child.mock.calls.at(-1)?.[0]).toEqual({
    expiresAt: 2000000000000,
    requestFetch,
  });
});
it("blocks an old worker without changing app state, registering, unregistering or mounting private UI", async () => {
  state.ready.mockRejectedValue(Error("synthetic old worker"));
  render(<ResearchHostedChat expiresAt={2000000000000} />);
  await screen.findByText(/Update the site/);
  expect(state.child).not.toHaveBeenCalled();
});
it("immediately aborts the old transport on controllerchange and ignores a late old probe", async () => {
  const old = gate<typeof fetch>(),
    next = gate<typeof fetch>();
  state.ready
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(next.promise);
  const view = render(<ResearchHostedChat expiresAt={2000000000000} />),
    first = state.ready.mock.calls[0][1] as AbortSignal,
    changed = workers.addEventListener.mock.calls[0][1];
  act(() => changed());
  expect(first.aborted).toBe(true);
  await act(async () => old.resolve(vi.fn()));
  expect(state.child).not.toHaveBeenCalled();
  await act(async () => next.resolve(vi.fn()));
  expect(screen.getByText("synthetic-private-ui")).toBeTruthy();
  const second = state.ready.mock.calls[1][1] as AbortSignal;
  view.unmount();
  expect(second.aborted).toBe(true);
  expect(workers.removeEventListener).toHaveBeenCalled();
});
it("blocks a throwing controller API instead of allowing private loading", async () => {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    get() {
      throw Error("synthetic blocked API");
    },
  });
  render(<ResearchHostedChat expiresAt={2000000000000} />);
  await screen.findByText(/Update the site/);
  expect(state.ready).not.toHaveBeenCalled();
  expect(state.child).not.toHaveBeenCalled();
});

it("supports browsers without service workers and ignores a probe rejection after unmount", async () => {
  Reflect.deleteProperty(navigator, "serviceWorker");
  let reject!: (reason: Error) => void;
  state.ready.mockReturnValue(
    new Promise((_resolve, r) => {
      reject = r;
    }),
  );
  const view = render(<ResearchHostedChat expiresAt={2000000000000} />);
  expect(state.ready.mock.calls[0][0]).toBe(null);
  view.unmount();
  await act(async () => reject(Error("synthetic late failed probe")));
  expect(state.child).not.toHaveBeenCalled();
});

it("remounts the private child after a same-batch successful controller check", async () => {
  state.ready.mockResolvedValue(vi.fn());
  render(<ResearchHostedChat expiresAt={2000000000000} />);
  await screen.findByText("synthetic-private-ui");
  expect(state.mount).toHaveBeenCalledTimes(1);
  const changed = workers.addEventListener.mock.calls[0][1];
  await act(async () => changed());
  expect(screen.getByText("synthetic-private-ui")).toBeTruthy();
  expect(state.mount).toHaveBeenCalledTimes(2);
  expect(state.unmount).toHaveBeenCalledTimes(1);
});
