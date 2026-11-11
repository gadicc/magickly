import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import {
  COLOR_SCHEME_ATTRIBUTE,
  DARK_SELECTOR,
  DEFAULT_COLOR_MODE,
} from "@/colorScheme";
import theme from "@/theme";
import RootLayout from "./layout";

/**
 * `<InitColorSchemeScript>` and `ThemeProvider` each default `attribute`
 * and `defaultMode` on their own, so the layout must hand both the same
 * values, and the script's attribute must be the one the theme's CSS
 * selects on; otherwise the first paint and the hydrated page disagree
 * (plan 076, decision 3). This renders the real layout and records what
 * each received.
 */
const received = vi.hoisted(() => ({
  script: [] as Record<string, unknown>[],
  provider: [] as Record<string, unknown>[],
}));

vi.mock("@mui/material/InitColorSchemeScript", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@mui/material/InitColorSchemeScript")
    >();
  return {
    ...original,
    default: (props: Parameters<typeof original.default>[0]) => {
      received.script.push({ ...props });
      return original.default(props);
    },
  };
});
vi.mock("@mui/material/styles", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@mui/material/styles")>();
  return {
    ...original,
    ThemeProvider: (props: Parameters<typeof original.ThemeProvider>[0]) => {
      received.provider.push({ ...props });
      return original.ThemeProvider(props);
    },
  };
});
vi.mock("next/navigation", () => ({
  useServerInsertedHTML: () => {},
  usePathname: () => "/",
}));
vi.mock("@/db", () => ({}));
vi.mock("@/analytics/VercelInsights", () => ({ default: () => null }));
vi.mock("./clientProviders", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("./MyAppBar", () => ({ default: () => null }));
vi.mock("./SiteFooter", () => ({ default: () => null }));
vi.mock("./StyledJsxRegistry", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

it("gives the colour-scheme script and the provider the same scheme", () => {
  const html = renderToStaticMarkup(
    <RootLayout>
      <main>page</main>
    </RootLayout>,
  );
  expect(received.script).toHaveLength(1);
  expect(received.provider).toHaveLength(1);
  const [scriptProps] = received.script;
  const [provider] = received.provider;

  expect(scriptProps.attribute).toBe(COLOR_SCHEME_ATTRIBUTE);
  expect(scriptProps.defaultMode).toBe(DEFAULT_COLOR_MODE);
  expect(provider.defaultMode).toBe(DEFAULT_COLOR_MODE);
  expect(provider.disableTransitionOnChange).toBe(true);
  expect(provider.theme).toBe(theme);

  // The theme's CSS keys the dark scheme on the class the script sets.
  expect(theme.getColorSchemeSelector("dark")).toBe(".dark &");
  // Server components' `sx` uses the same selector.
  expect(DARK_SELECTOR).toBe(theme.getColorSchemeSelector("dark"));
  // The script is the first thing in <body>, before anything paints, and
  // sets the class from the stored mode or the default.
  const script = html.match(/<body><script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toContain(
    `localStorage.getItem("mui-mode") || ${JSON.stringify(DEFAULT_COLOR_MODE)}`,
  );
  expect(script).toContain("document.documentElement.classList.add(");
});
