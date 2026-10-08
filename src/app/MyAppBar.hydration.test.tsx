// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import MyAppBar from "./MyAppBar";

const auth = vi.hoisted(() => ({
  session: { data: null as { user: { id: string } } | null, isPending: true },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/gd/rituals",
  useSelectedLayoutSegment: () => null,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/auth/client", () => ({ useSession: () => auth.session }));
vi.mock("@/auth/browserLifecycle", () => ({ sqlBrowserLifecycle: {} }));
vi.mock("./clientProviders", () => ({
  useLegacyRecoveryGate: () => ({ state: "ready", retry: () => {} }),
}));

it("hydrates the signed-out server bar even when the client already knows the user", async () => {
  const html = renderToString(<MyAppBar />);
  auth.session = { data: { user: { id: "user-1" } }, isPending: false };
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const recoverable = vi.fn();
  await act(async () => {
    hydrateRoot(container, <MyAppBar />, { onRecoverableError: recoverable });
  });
  expect(recoverable).not.toHaveBeenCalled();
  // After hydration the signed-in controls replace the sign-in button.
  expect(
    container.querySelector('[aria-label="account of current user"]'),
  ).toBeTruthy();
});
