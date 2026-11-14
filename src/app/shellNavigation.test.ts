import { expect, it, vi } from "vitest";
import { reloadResearchShellDocument } from "./shellNavigation";

it("replaces the current document exactly, preserving no mounted application state", () => {
  const replace = vi.fn();
  vi.stubGlobal("window", {
    location: {
      href: "https://synthetic.example/chat/research#bibliography-ref1",
      replace,
    },
  });
  try {
    reloadResearchShellDocument();
    expect(replace).toHaveBeenCalledExactlyOnceWith(
      "https://synthetic.example/chat/research#bibliography-ref1",
    );
  } finally {
    vi.unstubAllGlobals();
  }
});
