// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignInButton from "./SignInButton";

const mocks = vi.hoisted(() => ({
  recoveryState: "checking" as "checking" | "ready" | "failed",
  signIn: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/auth/client", () => ({
  authClient: { signIn: { social: mocks.signIn } },
}));
vi.mock("../clientProviders", () => ({
  useLegacyRecoveryGate: () => ({
    state: mocks.recoveryState,
    retry: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  mocks.recoveryState = "checking";
  vi.clearAllMocks();
});

describe("SQL sign-in gate", () => {
  it("cannot invoke Better Auth until legacy recovery is verified", async () => {
    const view = render(<SignInButton callbackURL="/study" />);
    const blocked = screen.getByRole("button", {
      name: "Continue with Google",
    });
    expect((blocked as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(blocked);
    expect(mocks.signIn).not.toHaveBeenCalled();

    mocks.recoveryState = "ready";
    view.rerender(<SignInButton callbackURL="/study" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/study",
      }),
    );
  });

  it("keeps fixed local identities behind the same recovery gate", () => {
    const view = render(
      <SignInButton
        callbackURL="/study"
        localTestLoginEnabled
        showLocalTestAdmin
        localTestSeedCommand="local-acceptance:seed"
      />,
    );
    const creator = screen.getByRole("button", { name: "Creator" });
    const reader = screen.getByRole("button", { name: "Reader" });
    const admin = screen.getByRole("button", { name: "Test admin" });
    expect((creator as HTMLButtonElement).disabled).toBe(true);
    expect((reader as HTMLButtonElement).disabled).toBe(true);
    expect((admin as HTMLButtonElement).disabled).toBe(true);

    mocks.recoveryState = "ready";
    view.rerender(
      <SignInButton
        callbackURL="/study"
        localTestLoginEnabled
        showLocalTestAdmin
        localTestSeedCommand="local-acceptance:seed"
      />,
    );
    expect((creator as HTMLButtonElement).form?.action).toBe(
      "http://localhost:3000/api/dev/test-login",
    );
    expect((creator as HTMLButtonElement).value).toBe("creator");
    expect((reader as HTMLButtonElement).value).toBe("reader");
    expect((admin as HTMLButtonElement).value).toBe("admin");
    expect(screen.getByText(/pnpm local-acceptance:seed/)).toBeTruthy();
    expect(
      (creator as HTMLButtonElement).form?.elements.namedItem("callbackURL"),
    ).toMatchObject({ value: "/study" });
    expect((creator as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows only Creator and Reader for ordinary development", () => {
    mocks.recoveryState = "ready";
    render(<SignInButton callbackURL="/study" localTestLoginEnabled />);
    expect(screen.getByRole("button", { name: "Creator" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reader" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Test admin" })).toBeNull();
  });
});
