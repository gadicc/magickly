// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSearchEngine } from "./client";
import { createSearchEngine } from "./engine";
import SearchDialog from "./SearchDialog";

vi.mock("./client", () => ({ loadSearchEngine: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

const engine = {
  ...createSearchEngine({
    version: 1,
    documents: [
      {
        path: "/tree",
        title: "Tree of Life",
        description: "The sephirot.",
        aliases: [],
        sections: [],
      },
    ],
  }),
  semanticAvailable: true,
};

beforeEach(() => vi.mocked(loadSearchEngine).mockResolvedValue(engine));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("search dialog interactions", () => {
  it("loads on opening, searches locally and supports arrow-key navigation", async () => {
    const close = vi.fn();
    render(<SearchDialog open onClose={close} />);
    const input = screen.getByRole("textbox", {
      name: "Search pages and content",
    });
    fireEvent.change(input, { target: { value: "Tree" } });
    const link = await screen.findByRole("link", { name: /Tree of Life/ });
    expect(link.getAttribute("href")).toBe("/tree");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(document.activeElement).toBe(link);
    fireEvent.keyDown(link, { key: "ArrowUp" });
    expect(document.activeElement).toBe(input);
    fireEvent.click(link);
    expect(close).toHaveBeenCalled();
  });
  it("does not send typed queries to a provider until meaning search is requested", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ query: "Tree", results: [] }));
    vi.stubGlobal("fetch", fetcher);
    render(<SearchDialog open onClose={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Tree" },
    });
    await screen.findByRole("link", { name: /Tree of Life/ });
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      isComposing: true,
      keyCode: 229,
    });
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Search by meaning" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      query: "Tree",
    });
  });
  it("retains text results when hosted search fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            message:
              "Search by meaning is unavailable. Text results are still shown.",
          },
          { status: 503 },
        ),
      ),
    );
    render(<SearchDialog open onClose={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Tree" },
    });
    await screen.findByRole("link", { name: /Tree of Life/ });
    fireEvent.click(screen.getByRole("button", { name: "Search by meaning" }));
    await screen.findByText(/Search by meaning is unavailable/);
    expect(screen.getByRole("link", { name: /Tree of Life/ })).toBeTruthy();
  });
  it("retries a failed index load", async () => {
    vi.mocked(loadSearchEngine).mockRejectedValueOnce(new Error("offline"));
    render(<SearchDialog open onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Tree" },
    });
    await screen.findByRole("link", { name: /Tree of Life/ });
  });
});
