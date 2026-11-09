// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import MyAppBar from "./MyAppBar";

const auth = vi.hoisted(() => ({
  session: {
    data: null as { user: { id: string; image?: string } } | null,
    isPending: true,
  },
}));

const navigation = vi.hoisted(() => ({
  pathname: "/gd/rituals",
  segment: null as string | null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSelectedLayoutSegment: () => navigation.segment,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/auth/client", () => ({ useSession: () => auth.session }));
vi.mock("@/auth/browserLifecycle", () => ({ sqlBrowserLifecycle: {} }));
vi.mock("./clientProviders", () => ({
  useLegacyRecoveryGate: () => ({ state: "ready", retry: () => {} }),
}));

it("hydrates the signed-out server bar even when the client already knows the user", async () => {
  const html = renderToString(<MyAppBar />);
  auth.session = {
    data: { user: { id: "user-1", image: "/avatar.png" } },
    isPending: false,
  };
  // Attribute mismatches are only logged, never reported as recoverable.
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const recoverable = vi.fn();
  await act(async () => {
    hydrateRoot(container, <MyAppBar />, { onRecoverableError: recoverable });
  });
  expect(recoverable).not.toHaveBeenCalled();
  expect(logged).not.toHaveBeenCalled();
  logged.mockRestore();
  // After hydration the signed-in controls replace the sign-in button.
  expect(
    container.querySelector('[aria-label="account of current user"]'),
  ).toBeTruthy();
});

afterEach(() => {
  navigation.pathname = "/gd/rituals";
  navigation.segment = null;
  auth.session = { data: null, isPending: true };
  document.body.innerHTML = "";
});

const roots: { unmount(): void }[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
});

/** Hydrates the server's bar at a path; returns the container. */
async function hydrateAt(
  pathname: string,
  server: string | null,
  browser: string | null,
) {
  navigation.pathname = pathname;
  navigation.segment = server;
  const html = renderToString(<MyAppBar />);
  navigation.segment = browser;
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const recoverable = vi.fn();
  await act(async () => {
    roots.push(
      hydrateRoot(container, <MyAppBar />, { onRecoverableError: recoverable }),
    );
  });
  expect(recoverable, pathname).not.toHaveBeenCalled();
  expect(logged, pathname).not.toHaveBeenCalled();
  logged.mockRestore();
  return container;
}

it("hydrates the kept-mounted menu on titled, untitled and missing pages", async () => {
  const tree = await hydrateAt("/kabbalah/tree", null, null);
  expect(tree.querySelector("h1")?.textContent).toBe("Tree of Life");
  expect(tree.querySelector('#nav-menu a[href="/kabbalah"]')).toBeTruthy();

  const angel = await hydrateAt("/kabbalah/angel/vehuiah", null, null);
  expect(angel.querySelector("h1")).toBeNull();
  expect(angel.querySelector('#nav-menu [aria-current="page"]')).toBeNull();

  // Prerendered at /_not-found, served at an unknown path below a section.
  const missing = await hydrateAt("/gd/nope", "/_not-found", "_not-found");
  expect(missing.querySelector("#nav-menu")).toBeNull();
});

it("opens the menu from the title and closes it on a choice", async () => {
  const bar = await hydrateAt("/kabbalah/tree", null, null);
  const trigger = bar.querySelector<HTMLButtonElement>("h1 button");
  expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  await act(async () => trigger?.click());
  expect(trigger?.getAttribute("aria-expanded")).toBe("true");
  const menu = bar.querySelector("#nav-menu");
  expect(menu?.classList.contains("MuiModal-hidden")).toBe(false);
  const link = menu?.querySelector<HTMLAnchorElement>('a[href="/kabbalah"]');
  // Keep the test's document where it is.
  link?.addEventListener("click", (e) => e.preventDefault());
  await act(async () => link?.click());
  expect(trigger?.getAttribute("aria-expanded")).toBe("false");
});
