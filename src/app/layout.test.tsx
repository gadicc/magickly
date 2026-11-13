import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

const themes = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@mui/material/CssBaseline", () => ({ default: () => null }));
vi.mock("@mui/material/styles", () => ({
  ThemeProvider: ({ children, ...props }: { children: React.ReactNode }) => {
    themes.push(props);
    return <>{children}</>;
  },
}));
vi.mock("@mui/material-nextjs/v16-appRouter", () => ({
  AppRouterCacheProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/theme", () => ({ default: {} }));
vi.mock("./PrintInLight", () => ({
  default: () => <div>synthetic-print-theme</div>,
}));
vi.mock("./ThemeColorMeta", () => ({
  default: () => <div>synthetic-toolbar-theme</div>,
}));
vi.mock("@/db", () => ({}));
vi.mock("@/geo/earlyPlaceLookup", () => ({
  earlyPlaceLookupScript: "synthetic-place-lookup",
}));
vi.mock("@/analytics/VercelInsights", () => ({
  default: () => <div>synthetic-analytics</div>,
}));
vi.mock("./clientProviders", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>synthetic-client-providers{children}</div>
  ),
}));
vi.mock("./MyAppBar", () => ({ default: () => <div>synthetic-app-bar</div> }));
vi.mock("./SiteFooter", () => ({
  default: () => <div>synthetic-site-footer</div>,
}));
vi.mock("./StyledJsxRegistry", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./SiteChromeLoader", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>
      synthetic-client-providers synthetic-app-bar synthetic-site-footer
      synthetic-analytics{children}
    </div>
  ),
}));

import RootLayout from "./layout";

afterEach(() => {
  vi.unstubAllEnvs();
  themes.length = 0;
});
it("renders the ordinary app shell while the private flag is absent", () => {
  vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_LOCAL", undefined);
  const html = renderToStaticMarkup(
    <RootLayout>
      <p>synthetic-content</p>
    </RootLayout>,
  );
  for (const text of [
    "synthetic-content",
    "synthetic-place-lookup",
    "synthetic-analytics",
    "synthetic-client-providers",
    "synthetic-app-bar",
    "synthetic-site-footer",
    "synthetic-print-theme",
    "synthetic-toolbar-theme",
  ])
    expect(html).toContain(text);
});
it("mounts only the reader theme and content in private mode", () => {
  vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_LOCAL", "1");
  const html = renderToStaticMarkup(
    <RootLayout>
      <p>synthetic-content</p>
    </RootLayout>,
  );
  expect(html).toContain("synthetic-content");
  expect(html).toContain('class="light"');
  expect(themes).toEqual([
    expect.objectContaining({ defaultMode: "light", storageManager: null }),
  ]);
  for (const text of [
    "synthetic-place-lookup",
    "synthetic-analytics",
    "synthetic-client-providers",
    "synthetic-app-bar",
    "synthetic-site-footer",
    "synthetic-print-theme",
    "synthetic-toolbar-theme",
  ])
    expect(html).not.toContain(text);
});
