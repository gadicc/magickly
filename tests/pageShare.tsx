/**
 * Renders a page under the app's page-share provider, beside the app
 * bar's Share, and reads what Share would send for it (plan 097,
 * decision 3).
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import {
  type PageShare,
  PageShareProvider,
  useSharedPage,
} from "@/app/pageShare";
import ShareButton from "@/app/ShareButton";

export function renderWithShare(ui: React.ReactElement) {
  let read: () => PageShare | null = () => null;
  function Probe() {
    read = useSharedPage();
    return null;
  }
  const result = render(ui, {
    wrapper: ({ children }) => (
      <PageShareProvider>
        <Probe />
        <ShareButton title="Test page" />
        {children}
      </PageShareProvider>
    ),
  });
  return { ...result, shared: () => read() };
}

/**
 * Taps Share in a browser without a share sheet, with a stand-in
 * clipboard, and returns what it copied and what it said.
 */
export async function tapShare(): Promise<{ copied: string[]; said: string }> {
  const copied: string[] = [];
  const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const share = Object.getOwnPropertyDescriptor(navigator, "share");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        copied.push(text);
      },
    },
  });
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: undefined,
  });
  try {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "share" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  } finally {
    for (const [name, previous] of [
      ["clipboard", clipboard],
      ["share", share],
    ] as const)
      if (previous) Object.defineProperty(navigator, name, previous);
      else delete (navigator as unknown as Record<string, unknown>)[name];
  }
  const alerts = screen.getAllByRole("alert");
  return { copied, said: alerts[alerts.length - 1].textContent ?? "" };
}
