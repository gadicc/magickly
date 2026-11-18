// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocaleProvider, { useUiLanguage } from "@/i18n/LocaleProvider";
import { messages as hebrew } from "@/locales/he/messages.js";
import { loadSearchEngine } from "./client";
import { createSearchEngine } from "./engine";
import SearchDialog from "./SearchDialog";

vi.mock("./client", () => ({ loadSearchEngine: vi.fn() }));
const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
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
  it("keeps English query suggestions functional in the Hebrew interface", async () => {
    const search = vi.fn().mockReturnValue([]);
    vi.mocked(loadSearchEngine).mockResolvedValue({ ...engine, search });
    render(
      <LocaleProvider locale="he" messages={hebrew}>
        <SearchDialog open onClose={() => {}} />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "שעות פלנטריות" }));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("Planetary hours");
    await waitFor(() => expect(search).toHaveBeenCalledWith("Planetary hours"));
    expect(screen.getByRole("status").textContent).toContain(
      "לא נמצאו דפים תואמים",
    );
  });
  it("does not display unrecognized API or network exception messages", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { message: "unexpected-provider-detail" },
          { status: 500 },
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    render(
      <LocaleProvider locale="he" messages={hebrew}>
        <SearchDialog open onClose={() => {}} />
      </LocaleProvider>,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Tree" },
    });
    await screen.findByRole("link", { name: /Tree of Life/ });
    const meaning = screen.getByRole("button", { name: "חיפוש לפי משמעות" });
    fireEvent.click(meaning);
    await screen.findByText(
      "לא ניתן היה להשלים את החיפוש לפי משמעות. תוצאות חיפוש הטקסט עדיין מוצגות.",
    );
    expect(screen.queryByText("unexpected-provider-detail")).toBeNull();
    fetcher.mockRejectedValueOnce(new Error("private-network-detail"));
    fireEvent.click(meaning);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("private-network-detail")).toBeNull();
  });
  it("retains query, result links and feedback during an in-place locale change", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        {
          message:
            "Search by meaning is unavailable. Text results are still shown.",
        },
        { status: 503 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    function ChooseEnglish() {
      const { choose } = useUiLanguage();
      return (
        <button type="button" onClick={() => void choose("en")}>
          English
        </button>
      );
    }
    render(
      <LocaleProvider locale="he" messages={hebrew} policy="private">
        <SearchDialog open onClose={() => {}} />
        <ChooseEnglish />
      </LocaleProvider>,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Tree" } });
    const result = await screen.findByRole("link", { name: /Tree of Life/ });
    expect(result.querySelector('[lang="en"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "חיפוש לפי משמעות" }));
    await screen.findByText(
      "החיפוש לפי משמעות אינו זמין. תוצאות חיפוש הטקסט עדיין מוצגות.",
    );
    // The dialog intentionally traps focus and hides its siblings from accessibility.
    fireEvent.click(screen.getByText("English"));
    await screen.findByText(
      "Search by meaning is unavailable. Text results are still shown.",
    );
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input.value).toBe("Tree");
    expect(screen.getByRole("link", { name: /Tree of Life/ })).toBe(result);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(screen.getByRole("status").textContent).toBe("1 matching page");
  });
});
