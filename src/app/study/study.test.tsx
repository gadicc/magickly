import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { sets } from "@/study/sets";
import StudyRoute from "./page";

// Next's prerender bails out to the browser at `useSearchParams`, so the
// server renders the Suspense fallback. Throwing here does the same under
// renderToString; nothing past it (session, storage, progress) runs.
vi.mock("@/lib/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: () => {
    throw new Error("Bail out to client-side rendering: useSearchParams()");
  },
  useSetSearchParam: vi.fn(),
}));
vi.mock("@/auth/client", () => ({ useSession: vi.fn() }));
vi.mock("@/study/client", () => ({ useStudyList: vi.fn() }));
vi.mock("../clientProviders", () => ({ useLegacyRecoveryGate: vi.fn() }));

describe("/study server HTML", () => {
  const html = renderToString(<StudyRoute />);

  it("lists every set with a link to it", () => {
    const ids = Object.keys(sets);
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) {
      expect(html).toContain(`href="/study/${id}"`);
      expect(html).toContain(`>${id}</a>`);
    }
  });

  it("says progress is still loading, and claims no scope", () => {
    expect(html).toContain("Initializing study progress…");
    expect(html).not.toContain("Anonymous progress");
    expect(html).not.toContain("Account progress");
  });
});
