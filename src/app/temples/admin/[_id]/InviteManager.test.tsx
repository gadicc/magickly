// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteManager } from "./InviteManager";

vi.mock("../../actions", () => ({
  regenerateTempleInviteAction: async () => undefined,
  disableTempleInviteAction: async () => undefined,
}));
vi.mock("react-qrcode", () => ({
  QRCode: ({ value }: { value: string }) => <span data-qr={value} />,
}));

const CODE = "7kq2m-dx9vt-a4hr0-nweb3";
const show = (joinPass: string | null) =>
  render(
    <InviteManager
      actorId="actor"
      templeId="temple"
      templeName="Example"
      slug="example"
      joinPass={joinPass}
    />,
  );
const hidden = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value;

afterEach(cleanup);

describe("temple invite panel", () => {
  it("offers to create a code when there is none, with no field to type one", () => {
    const { container } = show(null);
    expect(
      screen.getByText("No one can join with a code at the moment."),
    ).toBeTruthy();
    const create = screen.getByRole("button", { name: "Create join code" });
    expect(create.getAttribute("type")).toBe("submit");
    expect(hidden(container, "expectedActorId")).toBe("actor");
    expect(hidden(container, "templeId")).toBe("temple");
    expect(container.querySelector('input[name="joinPass"]')).toBeNull();
    expect(container.querySelector("[data-qr]")).toBeNull();
  });

  it("masks the code and link until shown, and puts the code in the QR link", () => {
    const { container } = show(CODE);
    expect(container.textContent).not.toContain(CODE);
    expect(container.textContent).toContain("•••••-•••••-•••••-•••••");
    expect(container.querySelector("[data-qr]")?.getAttribute("data-qr")).toBe(
      `${location.origin}/temples/join/example/${CODE}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show join code" }));
    expect(container.textContent).toContain(CODE);
    expect(container.textContent).toContain(
      `${location.origin}/temples/join/example/${CODE}`,
    );
    expect(screen.getByRole("button", { name: "Hide join code" })).toBeTruthy();
    expect(container.querySelector('input[name="joinPass"]')).toBeNull();
  });

  it("asks before replacing the code", () => {
    show(CODE);
    fireEvent.click(screen.getByRole("button", { name: "New join code" }));
    expect(screen.getByText("Make a new join code?")).toBeTruthy();
    expect(
      screen.getByText(/The current join code, link and QR code stop working/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Make new code" })).toBeTruthy();
  });

  it("asks before turning invitations off", () => {
    show(CODE);
    fireEvent.click(
      screen.getByRole("button", { name: "Turn off invitations" }),
    );
    expect(screen.getByText("Turn off invitations?")).toBeTruthy();
    expect(
      screen.getByText(/No one new can join until you create another/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Turn off" })).toBeTruthy();
  });
});
