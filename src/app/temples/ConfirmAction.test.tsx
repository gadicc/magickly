// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConfirmAction } from "./ConfirmAction";

afterEach(cleanup);

function setup(action = vi.fn()) {
  render(
    <ConfirmAction
      action={action}
      fields={{ templeId: "temple-1", expectedActorId: "me" }}
      label="Leave"
      title="Leave Example?"
      confirmLabel="Leave temple"
    >
      You will lose access.
    </ConfirmAction>,
  );
  return action;
}

it("keeps the action out of reach until the dialog is confirmed", () => {
  const action = setup();
  expect(screen.queryByText("Leave Example?")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Leave" }));
  expect(screen.getByText("Leave Example?")).toBeTruthy();
  expect(screen.getByText("You will lose access.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(action).not.toHaveBeenCalled();
});

it("submits the hidden fields only from the confirm button", async () => {
  const action = setup();
  fireEvent.click(screen.getByRole("button", { name: "Leave" }));
  fireEvent.click(screen.getByRole("button", { name: "Leave temple" }));
  await vi.waitFor(() => expect(action).toHaveBeenCalledOnce());
  const formData = action.mock.calls[0][0] as FormData;
  expect(Object.fromEntries(formData)).toEqual({
    templeId: "temple-1",
    expectedActorId: "me",
  });
});

it("closes the dialog on submit, so a refusal shown on the page is not hidden behind it", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Leave" }));
  fireEvent.click(screen.getByRole("button", { name: "Leave temple" }));
  await vi.waitFor(() =>
    expect(screen.queryByText("Leave Example?")).toBeNull(),
  );
});
