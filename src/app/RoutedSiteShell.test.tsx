// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import RoutedSiteShell from "./RoutedSiteShell";

const state = vi.hoisted(() => ({
  path: "/" as string | null,
  reload: vi.fn(),
  chrome: vi.fn(),
  script: vi.fn(),
  themes: [] as Record<string, unknown>[],
}));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("./shellNavigation", () => ({
  reloadResearchShellDocument: state.reload,
}));
vi.mock("@/theme", () => ({ default: {} }));
vi.mock("@mui/material/CssBaseline", () => ({ default: () => null }));
vi.mock("@mui/material/InitColorSchemeScript", () => ({
  default: () => {
    state.script();
    return <script>synthetic-public-storage-init</script>;
  },
}));
vi.mock("@mui/material/styles", () => ({
  ThemeProvider: ({ children, ...props }: { children: React.ReactNode }) => {
    state.themes.push(props);
    return <>{children}</>;
  },
}));
vi.mock("@mui/material-nextjs/v16-appRouter", () => ({
  AppRouterCacheProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("./SiteChromeLoader", () => ({
  default: ({ children }: { children: React.ReactNode }) => {
    state.chrome();
    return <div>synthetic-ordinary-chrome{children}</div>;
  },
}));
vi.mock("./StyledJsxRegistry", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./PrintInLight", () => ({ default: () => null }));
vi.mock("./ThemeColorMeta", () => ({ default: () => null }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  state.path = "/";
  state.themes.length = 0;
  state.chrome.mockClear();
  state.script.mockClear();
  state.reload.mockReset();
});
it("preserves ordinary SSR theme/init/chrome on public routes", () => {
  const html = renderToStaticMarkup(
    <RoutedSiteShell>
      <p>synthetic-content</p>
    </RoutedSiteShell>,
  );
  expect(html).toContain("synthetic-ordinary-chrome");
  expect(html).toContain("synthetic-public-storage-init");
  expect(state.themes[0].storageManager).toBeUndefined();
});
it.each([
  "/chat/research",
  "/chat/research/answers/read",
  "/CHAT/research",
  "/chat%2fresearch",
])(
  "omits the complete ordinary shell before rendering research route %s",
  (path) => {
    state.path = path;
    const html = renderToStaticMarkup(
      <RoutedSiteShell>
        <p>synthetic-private-content</p>
      </RoutedSiteShell>,
    );
    expect(html).toContain("synthetic-private-content");
    expect(html).not.toContain("synthetic-ordinary");
    expect(html).not.toContain("synthetic-public-storage");
    expect(html).not.toContain("localStorage");
    expect(state.chrome).not.toHaveBeenCalled();
    expect(state.script).not.toHaveBeenCalled();
    expect(state.themes).toEqual([
      expect.objectContaining({ storageManager: null, defaultMode: "light" }),
    ]);
  },
);
it.each([
  ["/", "/chat/research"],
  ["/chat/research", "/"],
])(
  "removes children and performs one fresh-document reload across %s to %s",
  (from, to) => {
    const child = vi.fn();
    function Child() {
      child();
      return <p>synthetic-child</p>;
    }
    state.path = from;
    const view = render(
      <RoutedSiteShell>
        <Child />
      </RoutedSiteShell>,
    );
    child.mockClear();
    state.chrome.mockClear();
    state.path = to;
    view.rerender(
      <RoutedSiteShell>
        <Child />
      </RoutedSiteShell>,
    );
    expect(screen.queryByText("synthetic-child")).toBeNull();
    expect(child).not.toHaveBeenCalled();
    expect(state.reload).toHaveBeenCalledOnce();
    view.rerender(
      <RoutedSiteShell>
        <Child />
      </RoutedSiteShell>,
    );
    expect(state.reload).toHaveBeenCalledOnce();
  },
);
it("does not mount private children when a reload fails or the pathname is unresolved", () => {
  state.path = null;
  const view = render(
    <RoutedSiteShell>
      <p>private-child</p>
    </RoutedSiteShell>,
  );
  expect(screen.queryByText("private-child")).toBeNull();
  expect(state.chrome).not.toHaveBeenCalled();
  state.path = "/";
  view.rerender(
    <RoutedSiteShell>
      <p>public-child</p>
    </RoutedSiteShell>,
  );
  expect(screen.getByText("public-child")).toBeTruthy();
  state.reload.mockImplementation(() => {
    throw Error("Synthetic blocked reload");
  });
  state.path = "/chat/research";
  view.rerender(
    <RoutedSiteShell>
      <p>private-child</p>
    </RoutedSiteShell>,
  );
  expect(screen.queryByText("private-child")).toBeNull();
  expect(state.reload).toHaveBeenCalledOnce();
});
