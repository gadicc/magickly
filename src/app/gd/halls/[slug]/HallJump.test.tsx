// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import HallJump from "./HallJump";

afterEach(cleanup);

const groups = [
  {
    name: "Neophyte 0=0",
    halls: [{ href: "/gd/halls/neophyte", label: "Neophyte · The hall" }],
  },
  {
    name: "Zelator 1=10",
    halls: [
      { href: "/gd/halls/zelator-1", label: "Zelator · Part 1" },
      { href: "/gd/halls/zelator-2", label: "Zelator · Part 2" },
    ],
  },
];

it("is named by its label alone, and opens the hall chosen", () => {
  const view = render(
    <HallJump groups={groups} current="/gd/halls/zelator-1" />,
  );
  const select = screen.getByRole("combobox", { name: "Jump to hall" });
  expect((select as HTMLSelectElement).value).toBe("/gd/halls/zelator-1");
  fireEvent.change(select, { target: { value: "/gd/halls/neophyte" } });
  expect(push).toHaveBeenCalledWith("/gd/halls/neophyte");
  // The choice stays while the page loads ...
  expect((select as HTMLSelectElement).value).toBe("/gd/halls/neophyte");
  // ... and follows the page once it has changed.
  view.rerender(<HallJump groups={groups} current="/gd/halls/zelator-2" />);
  expect((select as HTMLSelectElement).value).toBe("/gd/halls/zelator-2");
});
