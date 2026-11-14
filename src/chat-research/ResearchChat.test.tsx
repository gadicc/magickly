// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { researchQueryOutcomeAnswer } from "./answer";
import { answerFixture } from "./answer.fixture";
import { archiveFixture } from "./archive.fixture";
import { requestResearchAnswerArchive } from "./browserArchive";
import { requestResearchBookCatalog } from "./browserCatalog";
import {
  requestResearchAnswer,
  requestRetainedResearchAnswer,
} from "./browserRequest";
import { catalogFixture } from "./catalog.fixture";
import { ResearchChat } from "./ResearchChat";
import { ResearchOperatorChat } from "./ResearchOperatorChat";
import { ResearchSavedAnswers } from "./ResearchSavedAnswers";

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/auth/client", () => ({ useSession: () => auth.value }));
vi.mock("./browserRequest", () => ({
  requestResearchAnswer: vi.fn(),
  requestRetainedResearchAnswer: vi.fn(),
}));
vi.mock("./browserArchive", () => ({ requestResearchAnswerArchive: vi.fn() }));
const archiveRequest = vi.mocked(requestResearchAnswerArchive),
  retainedRequest = vi.mocked(requestRetainedResearchAnswer);
vi.mock("./browserCatalog", () => ({ requestResearchBookCatalog: vi.fn() }));
const catalogRequest = vi.mocked(requestResearchBookCatalog);
const request = vi.mocked(requestResearchAnswer);
const session = (user = "operator", id = "session1") => ({
  data: {
    user: { id: user },
    session: { id, expiresAt: new Date(Date.now() + 60000) },
  },
  isPending: false,
});
const deferred = <T,>() => {
  let resolve!: (v: T) => void, reject!: (e: Error) => void;
  const promise = new Promise<T>((r, j) => {
    resolve = r;
    reject = j;
  });
  return { resolve, reject, promise };
};
beforeEach(() => {
  auth.value = session();
  request.mockReset();
  archiveRequest.mockReset();
  retainedRequest.mockReset();
  catalogRequest.mockReset();
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function ask(value = "Synthetic question") {
  fireEvent.change(screen.getByLabelText("Question"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}
it("does no work on mount and sends only the submitted single-turn question", async () => {
  request.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  expect(request).not.toHaveBeenCalled();
  ask();
  await screen.findByRole("article", { name: "Research answer" });
  expect(request).toHaveBeenCalledOnce();
  expect(request.mock.calls[0][0]).toEqual({
    question: "Synthetic question",
    mode: "passage",
    source_book_handles: [],
  });
  expect(screen.getByText(/Previous answers are not sent/)).toBeTruthy();
});
it("latches single flight synchronously and clears old content on the next question", async () => {
  const gate = deferred<ReturnType<typeof answerFixture>>();
  request.mockReturnValue(gate.promise);
  const { container } = render(<ResearchChat />);
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "Q" },
  });
  const form = container.querySelector("form")!;
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(request).toHaveBeenCalledOnce();
  await act(async () => gate.resolve(answerFixture()));
  expect(screen.getByRole("article")).toBeTruthy();
  request.mockReturnValue(new Promise(() => {}));
  ask("Next independent question");
  expect(screen.queryByRole("article")).toBeNull();
  expect(request.mock.calls[1][0]).not.toHaveProperty("history");
});
it.each(["success", "failure"])(
  "does not commit late %s after clear and a replacement request",
  async (kind) => {
    const first = deferred<ReturnType<typeof answerFixture>>(),
      second = deferred<ReturnType<typeof answerFixture>>();
    request
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<ResearchChat />);
    ask("First");
    fireEvent.click(screen.getByRole("button", { name: "Cancel and clear" }));
    expect(request.mock.calls[0][1].aborted).toBe(true);
    ask("Second");
    await act(async () => {
      if (kind === "success") first.resolve(answerFixture());
      else first.reject(Error("private"));
    });
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
    await act(async () => second.resolve(answerFixture()));
    expect(screen.getByRole("article")).toBeTruthy();
  },
);
it.each(["hidden", "pagehide", "pageshow"])(
  "scrubs private content and drafts on %s without automatic resend",
  async (event) => {
    request.mockResolvedValue(answerFixture());
    render(<ResearchChat />);
    ask();
    await screen.findByRole("article");
    act(() => {
      if (event === "hidden") {
        Object.defineProperty(document, "hidden", { value: true });
        document.dispatchEvent(new Event("visibilitychange"));
      } else window.dispatchEvent(new Event(event));
    });
    expect(screen.queryByRole("article")).toBeNull();
    expect(
      (screen.getByLabelText("Question") as HTMLTextAreaElement).value,
    ).toBe("");
    act(() => {
      Object.defineProperty(document, "hidden", { value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.queryByRole("article")).toBeNull();
    expect(request).toHaveBeenCalledOnce();
  },
);
it.each(["user", "session", "signedout", "pending", "error"])(
  "removes private answers on observed %s transition",
  async (kind) => {
    request.mockResolvedValue(answerFixture());
    const { rerender } = render(<ResearchChat />);
    ask();
    await screen.findByRole("article");
    auth.value =
      kind === "user"
        ? session("other")
        : kind === "session"
          ? session("operator", "session2")
          : kind === "pending"
            ? { isPending: true }
            : kind === "error"
              ? { ...session(), error: Error("private") }
              : { data: null, isPending: false };
    rerender(<ResearchChat />);
    expect(screen.queryByRole("article")).toBeNull();
    expect(request).toHaveBeenCalledOnce();
  },
);
it("aborts on unmount and ignores a deferred completion", async () => {
  const gate = deferred<ReturnType<typeof answerFixture>>();
  request.mockReturnValue(gate.promise);
  const { unmount } = render(<ResearchChat />);
  ask();
  unmount();
  expect(request.mock.calls[0][1].aborted).toBe(true);
  await act(async () => gate.resolve(answerFixture()));
  expect(screen.queryByRole("article")).toBeNull();
});
it("shows a sanitized failure with no retry and requires explicit next submission", async () => {
  request.mockRejectedValue(Error("private passage and key"));
  render(<ResearchChat />);
  ask();
  await screen.findByRole("alert");
  expect(document.body.textContent).not.toContain("private passage");
  expect(request).toHaveBeenCalledOnce();
  expect(
    screen.getByRole("button", { name: "Ask" }).hasAttribute("disabled"),
  ).toBe(false);
});
it("does not submit whitespace or a hidden form and rejects malformed UTF16", async () => {
  const { container } = render(<ResearchChat />);
  fireEvent.submit(container.querySelector("form")!);
  expect(request).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "\ud800" },
  });
  fireEvent.submit(container.querySelector("form")!);
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeTruthy();
  Object.defineProperty(document, "hidden", { value: true });
  ask("Hidden");
  expect(request).not.toHaveBeenCalled();
});

it("expires an observed session, scrubs the draft, and cancels its pending request", async () => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "Date", "performance"],
  });
  auth.value = {
    data: {
      user: { id: "operator" },
      session: { id: "session", expiresAt: new Date(Date.now() + 1000) },
    },
    isPending: false,
  };
  request.mockReturnValue(new Promise(() => {}));
  render(<ResearchChat />);
  ask();
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(screen.queryByLabelText("Question")).toBeNull();
  expect(screen.queryByRole("article")).toBeNull();
  expect(request.mock.calls[0][1].aborted).toBe(true);
});
it("refuses a missing or already expired session without any request", () => {
  auth.value = {
    data: {
      user: { id: "operator" },
      session: { id: "session", expiresAt: new Date(0) },
    },
    isPending: false,
  };
  const { rerender } = render(<ResearchChat />);
  expect(screen.queryByLabelText("Question")).toBeNull();
  auth.value = {
    data: { user: { id: "operator" }, session: { id: "session" } },
    isPending: false,
  };
  rerender(<ResearchChat />);
  expect(screen.queryByLabelText("Question")).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

it("keeps the completed question snapshot when a new draft is edited", async () => {
  request.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  ask("Original submitted question");
  await screen.findByRole("article");
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "New draft" },
  });
  const completed = screen.getByRole("region", { name: "Completed research" });
  expect(completed.textContent).toContain("Original submitted question");
  expect(completed.textContent).not.toContain("New draft");
});
it.each(["success", "failure"])(
  "does not let an old-session deferred %s appear in a new session",
  async (kind) => {
    const gate = deferred<ReturnType<typeof answerFixture>>();
    request.mockReturnValue(gate.promise);
    const { rerender } = render(<ResearchChat />);
    ask();
    auth.value = session("operator", "new-session");
    rerender(<ResearchChat />);
    expect(request.mock.calls[0][1].aborted).toBe(true);
    await act(async () => {
      if (kind === "success") gate.resolve(answerFixture());
      else gate.reject(Error("private"));
    });
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(request).toHaveBeenCalledOnce();
  },
);

it("offers inventory independently of source-scoped comparison choices", async () => {
  request.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Research mode" }));
  expect(
    screen.getByRole("option", { name: "Compare two books" }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("option", { name: "Prepared book inventory" }),
  );
  ask("Which prepared books are available?");
  await screen.findByRole("article");
  expect(request.mock.calls[0][0]).toMatchObject({
    mode: "inventory",
    source_book_handles: [],
  });
});

it.each(["not-a-date", "2026-12-01T00:00:00Z", new Date(NaN)])(
  "scrubs an already displayed answer for malformed expiry %s",
  async (expiresAt) => {
    request.mockResolvedValue(answerFixture());
    const { rerender } = render(<ResearchChat />);
    ask();
    await screen.findByRole("article");
    auth.value = {
      data: {
        user: { id: "operator" },
        session: { id: "session1", expiresAt },
      },
      isPending: false,
    };
    rerender(<ResearchChat />);
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByLabelText("Question")).toBeNull();
    expect(request).toHaveBeenCalledOnce();
  },
);

async function choices() {
  catalogRequest.mockResolvedValue(catalogFixture());
  fireEvent.click(screen.getByRole("button", { name: "Choose books" }));
  await screen.findByLabelText("First book");
}
function chooseBook(label = "First book", value = "book1") {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
async function mode(name: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Research mode" }));
  fireEvent.click(await screen.findByRole("option", { name }));
}
it("only loads book choices on explicit action and sends the exact current ordinal revision", async () => {
  request.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  expect(catalogRequest).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
  await choices();
  expect(request).not.toHaveBeenCalled();
  expect(catalogRequest).toHaveBeenCalledOnce();
  chooseBook();
  ask();
  await screen.findByRole("article");
  expect(request.mock.calls[0][0]).toEqual({
    question: "Synthetic question",
    mode: "passage",
    source_book_handles: ["book1"],
    expected_catalog_revision: "a".repeat(64),
  });
  expect(
    screen.getByRole("region", { name: "Completed research" }).textContent,
  ).toContain("Requested books: Synthetic Author · Synthetic choice 1");
});
it("requires two different explicit comparison choices and pins both", async () => {
  request.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  await mode("Compare two books");
  expect(
    screen.getByRole("button", { name: "Ask" }).hasAttribute("disabled"),
  ).toBe(true);
  await choices();
  chooseBook();
  chooseBook("Second book", "book1");
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "Compare" },
  });
  expect(
    screen.getByRole("button", { name: "Ask" }).hasAttribute("disabled"),
  ).toBe(true);
  chooseBook("Second book", "book2");
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  await screen.findByRole("article");
  expect(request.mock.calls[0][0]).toMatchObject({
    mode: "comparison",
    source_book_handles: ["book1", "book2"],
    expected_catalog_revision: "a".repeat(64),
  });
  expect(
    screen.getByRole("region", { name: "Completed research" }).textContent,
  ).toContain("Comparison");
});
it("a failed refresh leaves selected intent unresolved until explicit All prepared books", async () => {
  request.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  await choices();
  chooseBook();
  catalogRequest.mockRejectedValue(Error("private metadata failure"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh book choices" }));
  await screen.findByRole("alert");
  ask();
  expect(request).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("First book")).toBeNull();
  expect(
    (screen.getByLabelText("Search scope") as HTMLSelectElement).value,
  ).toBe("selected");
  expect(document.body.textContent).not.toContain("private metadata failure");
  fireEvent.change(screen.getByLabelText("Search scope"), {
    target: { value: "all" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  await screen.findByRole("article");
  expect(request.mock.calls[0][0]).toEqual({
    question: "Synthetic question",
    mode: "passage",
    source_book_handles: [],
  });
});
it("a failed selected submission drops usable ordinal mappings without becoming global", async () => {
  request.mockRejectedValue(Error("private stale scope"));
  render(<ResearchChat />);
  await choices();
  chooseBook();
  ask();
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("First book")).toBeNull();
  expect(
    (screen.getByLabelText("Search scope") as HTMLSelectElement).value,
  ).toBe("selected");
  expect(
    screen.getByRole("button", { name: "Ask" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(request).toHaveBeenCalledOnce();
});
it("completed answer scope stays frozen when the same ordinal gets new bibliographic labels", async () => {
  request.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  await choices();
  chooseBook();
  ask("Original");
  await screen.findByRole("article");
  const next = JSON.parse(JSON.stringify(catalogFixture("b".repeat(64))));
  next.books[0].book.title = "New unrelated ordinal title";
  catalogRequest.mockResolvedValue(next);
  fireEvent.click(screen.getByRole("button", { name: "Refresh book choices" }));
  await screen.findByLabelText("First book");
  chooseBook();
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "Next draft" },
  });
  const completed = screen.getByRole("region", { name: "Completed research" });
  expect(completed.textContent).toContain("Synthetic choice 1");
  expect(completed.textContent).not.toContain("New unrelated ordinal title");
  expect(completed.textContent).not.toContain("Next draft");
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  await screen.findByRole("article");
  expect(request.mock.calls[1][0]).toMatchObject({
    expected_catalog_revision: "b".repeat(64),
  });
});
it.each(["success", "failure"])(
  "late catalog %s cannot replace a cleared scope or a later answer",
  async (kind) => {
    const gate = deferred<ReturnType<typeof catalogFixture>>();
    catalogRequest.mockReturnValue(gate.promise);
    request.mockResolvedValue(answerFixture());
    render(<ResearchChat />);
    fireEvent.click(screen.getByRole("button", { name: "Choose books" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel and clear" }));
    expect(catalogRequest.mock.calls[0][0].aborted).toBe(true);
    ask();
    await screen.findByRole("article");
    await act(async () => {
      if (kind === "success") gate.resolve(catalogFixture());
      else gate.reject(Error("private"));
    });
    expect(screen.queryByLabelText("First book")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("article")).toBeTruthy();
    expect(
      (screen.getByLabelText("Search scope") as HTMLSelectElement).value,
    ).toBe("all");
  },
);
it.each(["hidden", "pagehide", "pageshow", "session"])(
  "scrubs a loaded private catalog on %s without reloading",
  async (kind) => {
    const { rerender } = render(<ResearchChat />);
    await choices();
    chooseBook();
    act(() => {
      if (kind === "hidden") {
        Object.defineProperty(document, "hidden", { value: true });
        document.dispatchEvent(new Event("visibilitychange"));
      } else if (kind !== "session") window.dispatchEvent(new Event(kind));
    });
    if (kind === "session") {
      auth.value = session("operator", "new-session");
      rerender(<ResearchChat />);
    }
    expect(screen.queryByLabelText("First book")).toBeNull();
    expect(screen.queryByText("Prepared book details")).toBeNull();
    expect(catalogRequest).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
  },
);
it("inventory explicitly resets selected scope and sends no catalog hint", async () => {
  request.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  await choices();
  chooseBook();
  await mode("Prepared book inventory");
  ask();
  await screen.findByRole("article");
  expect(request.mock.calls[0][0]).toEqual({
    question: "Synthetic question",
    mode: "inventory",
    source_book_handles: [],
  });
  expect(screen.queryByLabelText("Search scope")).toBeNull();
});
it("a hidden or synchronously busy catalog action cannot dispatch duplicate metadata calls", async () => {
  const gate = deferred<ReturnType<typeof catalogFixture>>();
  catalogRequest.mockReturnValue(gate.promise);
  const { container } = render(<ResearchChat />);
  Object.defineProperty(document, "hidden", { value: true });
  fireEvent.click(screen.getByRole("button", { name: "Choose books" }));
  expect(catalogRequest).not.toHaveBeenCalled();
  Object.defineProperty(document, "hidden", { value: false });
  const button = screen.getByRole("button", { name: "Choose books" });
  act(() => {
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.submit(container.querySelector("form")!);
  });
  expect(catalogRequest).toHaveBeenCalledOnce();
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel and clear" }));
  await act(async () => gate.resolve(catalogFixture()));
});

it("keeps fallback/candidate and edition qualifications attached to submitted scope after a no-evidence answer and refresh", async () => {
  const original = JSON.parse(JSON.stringify(catalogFixture()));
  original.books[0].book.title_status = "catalog_fallback";
  original.books[0].book.candidate_fields = 3;
  original.books[0].book.notes = ["Edition attribution remains uncertain."];
  catalogRequest.mockResolvedValue(original);
  request.mockResolvedValue(
    researchQueryOutcomeAnswer(answerFixture().answer_id, "no_evidence"),
  );
  render(<ResearchChat />);
  fireEvent.click(screen.getByRole("button", { name: "Choose books" }));
  await screen.findByLabelText("First book");
  chooseBook();
  ask();
  await screen.findByRole("article");
  catalogRequest.mockResolvedValue(catalogFixture("b".repeat(64)));
  fireEvent.click(screen.getByRole("button", { name: "Refresh book choices" }));
  await screen.findByLabelText("First book");
  const completed = screen.getByRole("region", { name: "Completed research" });
  expect(completed.textContent).toContain("bibliographic review pending");
  expect(completed.textContent).toContain(
    "Title uses catalog metadata; bibliographic review pending.",
  );
  expect(completed.textContent).toContain(
    "3 extracted field observations await review.",
  );
  expect(completed.textContent).toContain(
    "Edition attribution remains uncertain.",
  );
});
it("expires catalog actions before dispatch when the monotonic login lifetime has elapsed", () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  render(<ResearchChat />);
  now = 60001;
  fireEvent.click(screen.getByRole("button", { name: "Choose books" }));
  expect(catalogRequest).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Question")).toBeNull();
});

it("keeps identical bibliographies associated with each of two distinct submitted choices", async () => {
  const value = JSON.parse(JSON.stringify(catalogFixture()));
  value.books[1].book = structuredClone(value.books[0].book);
  catalogRequest.mockResolvedValue(value);
  request.mockResolvedValue(
    researchQueryOutcomeAnswer(answerFixture().answer_id, "no_evidence"),
  );
  const errors = vi.spyOn(console, "error");
  render(<ResearchChat />);
  await mode("Compare two books");
  fireEvent.click(screen.getByRole("button", { name: "Choose books" }));
  await screen.findByLabelText("First book");
  chooseBook();
  chooseBook("Second book", "book2");
  ask();
  await screen.findByRole("article");
  expect(
    screen.getByRole("heading", {
      name: /First requested book · Synthetic Author/,
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", {
      name: /Second requested book · Synthetic Author/,
    }),
  ).toBeTruthy();
  expect(errors.mock.calls.flat().join(" ")).not.toMatch(
    /same key|unique.*key/,
  );
});

async function savedAnswers() {
  archiveRequest.mockResolvedValue(archiveFixture());
  fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
  await screen.findByRole("region", { name: "Saved completed answers" });
}
it("loads and reopens saved questions explicitly without Ask, using their own original citations and mode", async () => {
  retainedRequest.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  expect(archiveRequest).not.toHaveBeenCalled();
  expect(retainedRequest).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "A current independent draft" },
  });
  await savedAnswers();
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByText("Saved synthetic question 1")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Open saved answer" }));
  await screen.findByRole("article");
  expect(retainedRequest.mock.calls[0][0]).toEqual(archiveFixture().entries[0]);
  expect(retainedRequest).toHaveBeenCalledOnce();
  expect(request).not.toHaveBeenCalled();
  const completed = screen.getByRole("region", { name: "Completed research" });
  expect(completed.textContent).toContain("Saved answer to your question");
  expect(completed.textContent).toContain("Saved synthetic question 1");
  expect(completed.textContent).not.toContain("A current independent draft");
  expect(completed.textContent).toContain("Synthetic book");
  expect(completed.textContent).not.toContain("All prepared books");
  expect(completed.textContent).toContain(
    "Sources shown are from the saved answer.",
  );
});
it("does not relabel a saved answer from the current book picker", async () => {
  retainedRequest.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  await choices();
  chooseBook();
  await savedAnswers();
  fireEvent.click(screen.getByRole("button", { name: "Open saved answer" }));
  await screen.findByRole("article");
  const completed = screen.getByRole("region", { name: "Completed research" });
  expect(completed.textContent).toContain("Synthetic book");
  expect(completed.textContent).not.toContain("Synthetic choice 1");
  expect(completed.textContent).not.toContain("Requested books:");
});
it("an empty original-window archive never fabricates a saved answer or calls Ask", async () => {
  archiveRequest.mockResolvedValue(archiveFixture(0));
  render(<ResearchChat />);
  fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
  await screen.findByText(
    "No saved completed model answers are available in this research window.",
  );
  expect(
    screen.queryByRole("button", { name: "Open saved answer" }),
  ).toBeNull();
  expect(request).not.toHaveBeenCalled();
  expect(retainedRequest).not.toHaveBeenCalled();
});
it("renders saved question text literally without creating HTML resources", async () => {
  const saved = archiveFixture();
  saved.entries[0].question = "<img src=x onerror=alert(1)>";
  archiveRequest.mockResolvedValue(saved);
  const { container } = render(<ResearchChat />);
  fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
  await screen.findByText(saved.entries[0].question);
  expect(container.querySelector("img")).toBeNull();
  expect(request).not.toHaveBeenCalled();
});
it.each(["failure", "answer-id", "status", "origin"])(
  "saved reopen %s clears stale list and answer without generation",
  async (kind) => {
    render(<ResearchChat />);
    await savedAnswers();
    if (kind === "failure")
      retainedRequest.mockRejectedValue(Error("private read refusal"));
    else
      retainedRequest.mockResolvedValue({
        ...answerFixture(),
        ...(kind === "answer-id"
          ? { answer_id: "019aa111-0000-7000-8000-000000000099" }
          : kind === "status"
            ? { status: "supported" as const }
            : { origin: "server_query_outcome" as const }),
      });
    fireEvent.click(screen.getByRole("button", { name: "Open saved answer" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("article")).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Saved completed answers" }),
    ).toBeNull();
    expect(document.body.textContent).not.toContain("private read refusal");
    expect(retainedRequest).toHaveBeenCalledOnce();
    expect(archiveRequest).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
  },
);
it("an explicit failed archive refresh removes the previously displayed saved answer", async () => {
  retainedRequest.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  await savedAnswers();
  fireEvent.click(screen.getByRole("button", { name: "Open saved answer" }));
  await screen.findByRole("article");
  archiveRequest.mockRejectedValue(Error("private revoked read scope"));
  fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
  expect(screen.queryByRole("article")).toBeNull();
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("region", { name: "Saved completed answers" }),
  ).toBeNull();
  expect(document.body.textContent).not.toContain("private revoked");
  expect(request).not.toHaveBeenCalled();
  expect(archiveRequest).toHaveBeenCalledTimes(2);
});
it.each(["list", "reopen"])(
  "one synchronous flight blocks Ask and duplicate %s requests",
  async (kind) => {
    const pending = deferred<ReturnType<typeof archiveFixture>>(),
      opened = deferred<ReturnType<typeof answerFixture>>();
    const { container } = render(<ResearchChat />);
    let button: HTMLElement;
    if (kind === "list") {
      archiveRequest.mockReturnValue(pending.promise);
      button = screen.getByRole("button", { name: "Previous answers" });
    } else {
      await savedAnswers();
      retainedRequest.mockReturnValue(opened.promise);
      button = screen.getByRole("button", { name: "Open saved answer" });
    }
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(request).not.toHaveBeenCalled();
    expect(
      kind === "list" ? archiveRequest : retainedRequest,
    ).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancel and clear" }));
    await act(async () => {
      if (kind === "list") pending.resolve(archiveFixture());
      else opened.resolve(answerFixture());
    });
    expect(screen.queryByRole("article")).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Saved completed answers" }),
    ).toBeNull();
  },
);
it.each(["list-success", "list-failure", "reopen-success", "reopen-failure"])(
  "late %s cannot overwrite a newer question or its flight",
  async (kind) => {
    const listed = deferred<ReturnType<typeof archiveFixture>>(),
      opened = deferred<ReturnType<typeof answerFixture>>(),
      next = deferred<ReturnType<typeof answerFixture>>();
    render(<ResearchChat />);
    if (kind.startsWith("list")) {
      archiveRequest.mockReturnValue(listed.promise);
      fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
    } else {
      await savedAnswers();
      retainedRequest.mockReturnValue(opened.promise);
      fireEvent.click(
        screen.getByRole("button", { name: "Open saved answer" }),
      );
    }
    fireEvent.click(screen.getByRole("button", { name: "Cancel and clear" }));
    request.mockReturnValue(next.promise);
    ask("New explicit question");
    await act(async () => {
      if (kind === "list-success") listed.resolve(archiveFixture());
      else if (kind === "list-failure") listed.reject(Error("private"));
      else if (kind === "reopen-success") opened.resolve(answerFixture());
      else opened.reject(Error("private"));
    });
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Preparing");
    expect(
      screen.queryByRole("region", { name: "Saved completed answers" }),
    ).toBeNull();
    await act(async () => next.resolve(answerFixture()));
    expect(
      screen.getByRole("region", { name: "Completed research" }).textContent,
    ).toContain("New explicit question");
  },
);
it.each(["hidden", "pagehide", "pageshow", "session", "signedout"])(
  "scrubs loaded archive and saved answers on %s",
  async (kind) => {
    retainedRequest.mockResolvedValue(answerFixture());
    const { rerender } = render(<ResearchChat />);
    await savedAnswers();
    fireEvent.click(screen.getByRole("button", { name: "Open saved answer" }));
    await screen.findByRole("article");
    if (kind === "session" || kind === "signedout") {
      auth.value =
        kind === "session"
          ? session("operator", "new-session")
          : { data: null, isPending: false };
      rerender(<ResearchChat />);
    } else
      act(() => {
        if (kind === "hidden") {
          Object.defineProperty(document, "hidden", { value: true });
          document.dispatchEvent(new Event("visibilitychange"));
        } else window.dispatchEvent(new Event(kind));
      });
    expect(screen.queryByRole("article")).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Saved completed answers" }),
    ).toBeNull();
    expect(archiveRequest).toHaveBeenCalledOnce();
    expect(retainedRequest).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
  },
);
it.each(["list", "reopen"])(
  "does not dispatch %s after the observed login deadline",
  async (kind) => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    render(<ResearchChat />);
    if (kind === "reopen") await savedAnswers();
    now = 60001;
    fireEvent.click(
      screen.getByRole("button", {
        name: kind === "list" ? "Previous answers" : "Open saved answer",
      }),
    );
    expect(screen.queryByLabelText("Question")).toBeNull();
    expect(retainedRequest).not.toHaveBeenCalled();
    expect(archiveRequest).toHaveBeenCalledTimes(kind === "list" ? 0 : 1);
  },
);
it("a new explicit Ask invalidates an old saved list instead of automatically refreshing it", async () => {
  request.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  await savedAnswers();
  ask();
  await screen.findByRole("article");
  expect(
    screen.queryByRole("region", { name: "Saved completed answers" }),
  ).toBeNull();
  expect(archiveRequest).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledOnce();
});

function originalArchive(count = 1) {
  const a = archiveFixture(count);
  for (const entry of a.entries) entry.input_kind = "original_question";
  return a;
}
async function chooseContext(value = originalArchive()) {
  archiveRequest.mockResolvedValue(value);
  fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
  await screen.findByRole("region", { name: "Saved completed answers" });
  fireEvent.click(
    screen.getAllByRole("button", { name: "Use as question context" })[0],
  );
  expect(
    screen.getByRole("region", { name: "Selected question context" })
      .textContent,
  ).toContain(value.entries[0].question);
  return value.entries[0];
}
it("selects context explicitly without reading/generating, and sends only its ID hints on Ask", async () => {
  request.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  const entry = await chooseContext();
  expect(request).not.toHaveBeenCalled();
  expect(retainedRequest).not.toHaveBeenCalled();
  ask("What about that?");
  await screen.findByRole("article");
  expect(request.mock.calls[0][0]).toEqual({
    question: "What about that?",
    mode: "passage",
    source_book_handles: [],
    previous_answer: {
      permit_id: entry.permit_id,
      expected_answer_id: entry.answer_id,
    },
  });
  expect(JSON.stringify(request.mock.calls[0][0])).not.toContain(
    entry.question,
  );
  const submitted = screen.getByRole("region", {
    name: "Submitted question context",
  });
  expect(submitted.textContent).toContain(entry.question);
  fireEvent.click(
    screen.getByRole("button", { name: "Clear question context" }),
  );
  expect(
    screen.queryByRole("region", { name: "Selected question context" }),
  ).toBeNull();
  expect(submitted.textContent).toContain(entry.question);
  ask("An explicit independent question");
  await screen.findByRole("article");
  expect(request.mock.calls[1][0]).not.toHaveProperty("previous_answer");
});
it("keeps the selected original, never automatically advances context to a returned follow-up", async () => {
  request.mockResolvedValue(answerFixture());
  render(<ResearchChat />);
  const entry = await chooseContext();
  ask("First follow-up");
  await screen.findByRole("article");
  ask("Another question using the same original");
  await screen.findByRole("article");
  expect(request).toHaveBeenCalledTimes(2);
  for (const [input] of request.mock.calls)
    expect(input).toMatchObject({
      previous_answer: {
        permit_id: entry.permit_id,
        expected_answer_id: entry.answer_id,
      },
    });
  expect(archiveRequest).toHaveBeenCalledOnce();
  expect(retainedRequest).not.toHaveBeenCalled();
});
it.each(["follow_up", undefined] as const)(
  "never offers unsupported/unknown context kind %s, while still allowing reopen",
  async (kind) => {
    const value = archiveFixture();
    value.entries[0].input_kind = kind;
    archiveRequest.mockResolvedValue(value);
    retainedRequest.mockResolvedValue(answerFixture());
    render(<ResearchChat />);
    fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
    await screen.findByRole("region", { name: "Saved completed answers" });
    expect(
      screen.queryByRole("button", { name: "Use as question context" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open saved answer" }));
    await screen.findByRole("article");
    if (kind === "follow_up")
      expect(
        screen.getByText(/original question context is not shown/),
      ).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
  },
);
it("renders selected/submitted context literally without HTML, resource requests or supplied history prose", async () => {
  const value = originalArchive();
  value.entries[0].question = "<img src=x onerror=alert(1)>";
  request.mockResolvedValue(answerFixture());
  const { container } = render(<ResearchChat />);
  await chooseContext(value);
  ask("Follow-up");
  await screen.findByRole("article");
  expect(
    screen.getByRole("region", { name: "Submitted question context" })
      .textContent,
  ).toContain(value.entries[0].question);
  expect(container.querySelector("img,iframe,script")).toBeNull();
  expect(request.mock.calls[0][0]).not.toHaveProperty("history");
});
it("failed context stays unresolved and blocks Ask until explicit clear or reselection", async () => {
  request.mockRejectedValueOnce(Error("Private stale context detail"));
  const { container } = render(<ResearchChat />);
  const entry = await chooseContext();
  ask("Follow-up");
  await screen.findByRole("alert");
  const selected = screen.getByRole("region", {
    name: "Selected question context",
  });
  expect(selected.textContent).toContain(entry.question);
  expect(selected.textContent).toContain("Choose the original answer again");
  expect(
    (screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.submit(container.querySelector("form")!);
  expect(request).toHaveBeenCalledOnce();
  request.mockResolvedValueOnce(answerFixture());
  fireEvent.click(
    screen.getByRole("button", { name: "Clear question context" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  await screen.findByRole("article");
  expect(request.mock.calls[1][0]).not.toHaveProperty("previous_answer");
  expect(screen.queryByText("Private stale context detail")).toBeNull();
});
it.each(["success", "failure"])(
  "archive refresh %s invalidates the selected mapping until explicit reselection",
  async (kind) => {
    request.mockResolvedValue(answerFixture());
    render(<ResearchChat />);
    await chooseContext();
    if (kind === "failure")
      archiveRequest.mockRejectedValueOnce(Error("private refresh refusal"));
    fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
    if (kind === "failure") await screen.findByRole("alert");
    else await screen.findByRole("region", { name: "Saved completed answers" });
    expect(
      screen.getByRole("region", { name: "Selected question context" })
        .textContent,
    ).toContain("Choose the original answer again");
    ask("Follow-up after refresh");
    expect(request).not.toHaveBeenCalled();
    if (kind === "failure") {
      archiveRequest.mockResolvedValueOnce(originalArchive());
      fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
      await screen.findByRole("region", { name: "Saved completed answers" });
    }
    fireEvent.click(
      screen.getByRole("button", { name: "Use as question context" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByRole("article");
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]).toHaveProperty("previous_answer");
  },
);
it("a failed saved-answer reopen also invalidates selected context rather than silently retaining usable hints", async () => {
  retainedRequest.mockRejectedValueOnce(Error("private lost read"));
  render(<ResearchChat />);
  await chooseContext();
  fireEvent.click(screen.getByRole("button", { name: "Open saved answer" }));
  await screen.findByRole("alert");
  expect(
    screen.getByRole("region", { name: "Selected question context" })
      .textContent,
  ).toContain("Choose the original answer again");
  ask("Still a contextual question");
  expect(request).not.toHaveBeenCalled();
});
it.each(["clear", "hidden", "pagehide", "pageshow", "session", "signedout"])(
  "scrubs selected context on %s without automatic traffic",
  async (kind) => {
    const view = render(<ResearchChat />);
    await chooseContext();
    if (kind === "session" || kind === "signedout") {
      auth.value =
        kind === "session"
          ? session("operator", "new-session")
          : { data: null, isPending: false };
      view.rerender(<ResearchChat />);
    } else if (kind === "clear")
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    else
      act(() => {
        if (kind === "hidden") {
          Object.defineProperty(document, "hidden", { value: true });
          document.dispatchEvent(new Event("visibilitychange"));
        } else window.dispatchEvent(new Event(kind));
      });
    expect(
      screen.queryByRole("region", { name: "Selected question context" }),
    ).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expect(archiveRequest).toHaveBeenCalledOnce();
    expect(retainedRequest).not.toHaveBeenCalled();
  },
);
it("cancellation scrubs contextual intent and ignores a late reply after an independent replacement", async () => {
  const gate = deferred<ReturnType<typeof answerFixture>>();
  request
    .mockReturnValueOnce(gate.promise)
    .mockResolvedValueOnce(answerFixture());
  render(<ResearchChat />);
  await chooseContext();
  ask("Contextual request");
  fireEvent.click(screen.getByRole("button", { name: "Cancel and clear" }));
  expect(request.mock.calls[0][1].aborted).toBe(true);
  expect(
    screen.queryByRole("region", { name: "Selected question context" }),
  ).toBeNull();
  ask("Independent replacement");
  await screen.findByRole("article");
  await act(async () => gate.resolve(answerFixture()));
  expect(request.mock.calls[1][0]).not.toHaveProperty("previous_answer");
  expect(
    screen.queryByRole("region", { name: "Submitted question context" }),
  ).toBeNull();
});
it("selection is ignored when hidden or expired before the click without loading private context", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  render(<ResearchChat />);
  await chooseContext();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear question context" }),
  );
  const choose = screen.getByRole("button", {
    name: "Use as question context",
  });
  Object.defineProperty(document, "hidden", { value: true });
  fireEvent.click(choose);
  expect(
    screen.queryByRole("region", { name: "Selected question context" }),
  ).toBeNull();
  Object.defineProperty(document, "hidden", { value: false });
  now = 60001;
  fireEvent.click(choose);
  expect(screen.getByText("Sign in to use private research.")).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  expect(retainedRequest).not.toHaveBeenCalled();
});
it("context buttons share the existing one-flight latch and cannot replace an in-flight selection", async () => {
  const gate = deferred<ReturnType<typeof answerFixture>>();
  request.mockReturnValue(gate.promise);
  const { container } = render(<ResearchChat />);
  const entry = await chooseContext();
  ask("In-flight context");
  const clear = screen.getByRole("button", { name: "Clear question context" });
  expect((clear as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(clear);
  fireEvent.submit(container.querySelector("form")!);
  expect(request).toHaveBeenCalledOnce();
  expect(request.mock.calls[0][0]).toMatchObject({
    previous_answer: {
      permit_id: entry.permit_id,
      expected_answer_id: entry.answer_id,
    },
  });
  await act(async () => gate.resolve(answerFixture()));
  expect(
    within(
      screen.getByRole("region", { name: "Selected question context" }),
    ).getByText(entry.question),
  ).toBeTruthy();
});

it("explicit selection cannot become an independent same-batch submit", async () => {
  request.mockResolvedValue(answerFixture());
  const { container } = render(<ResearchChat />);
  archiveRequest.mockResolvedValue(originalArchive());
  fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
  await screen.findByRole("region", { name: "Saved completed answers" });
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "What does it mean?" },
  });
  act(() => {
    fireEvent.click(
      screen.getByRole("button", { name: "Use as question context" }),
    );
    fireEvent.submit(container.querySelector("form")!);
  });
  expect(request.mock.calls[0]?.[0]).toHaveProperty("previous_answer");
});
it("failed context is invalid before another same-batch submit", async () => {
  const gate = deferred<ReturnType<typeof answerFixture>>();
  request
    .mockReturnValueOnce(gate.promise)
    .mockResolvedValueOnce(answerFixture());
  const { container } = render(<ResearchChat />);
  await chooseContext();
  ask("A contextual question");
  await act(async () => {
    gate.reject(Error("Synthetic unavailable"));
    await gate.promise.catch(() => {});
    fireEvent.submit(container.querySelector("form")!);
  });
  expect(request).toHaveBeenCalledTimes(1);
});

it("explicit context clearing takes effect before a same-batch submit", async () => {
  request.mockResolvedValue(answerFixture());
  const { container } = render(<ResearchChat />);
  await chooseContext();
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "Independent after clearing" },
  });
  act(() => {
    fireEvent.click(
      screen.getByRole("button", { name: "Clear question context" }),
    );
    fireEvent.submit(container.querySelector("form")!);
  });
  expect(request).toHaveBeenCalledOnce();
  expect(request.mock.calls[0][0]).not.toHaveProperty("previous_answer");
  await screen.findByRole("article");
  expect(
    screen.queryByRole("region", { name: "Submitted question context" }),
  ).toBeNull();
});

it("selected scope cannot silently submit globally in the same batch", async () => {
  request.mockResolvedValue(answerFixture());
  const { container } = render(<ResearchChat />);
  await chooseContext();
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "A book-specific follow-up" },
  });
  act(() => {
    fireEvent.change(screen.getByLabelText("Search scope"), {
      target: { value: "selected" },
    });
    fireEvent.submit(container.querySelector("form")!);
  });
  expect(request).not.toHaveBeenCalled();
});

it("comparison intent cannot silently submit globally in the same batch", async () => {
  request.mockResolvedValue(answerFixture());
  const { container } = render(<ResearchChat />);
  await chooseContext();
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "A two-book follow-up" },
  });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Research mode" }));
  act(() => {
    fireEvent.click(screen.getByRole("option", { name: "Compare two books" }));
    fireEvent.submit(container.querySelector("form")!);
  });
  expect(request).not.toHaveBeenCalled();
});

it.each(["Clear", "Cancel and clear"])(
  "global %s empties authoritative question/context before same-batch submit",
  async (label) => {
    const gate = deferred<ReturnType<typeof answerFixture>>();
    request.mockReturnValue(gate.promise);
    const { container } = render(<ResearchChat />);
    await chooseContext();
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "Must not be resubmitted after clear" },
    });
    if (label === "Cancel and clear")
      fireEvent.submit(container.querySelector("form")!);
    const previous = request.mock.calls.length;
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: label }));
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(request).toHaveBeenCalledTimes(previous);
    expect(
      (screen.getByLabelText("Question") as HTMLTextAreaElement).value,
    ).toBe("");
    expect(
      screen.queryByRole("region", { name: "Selected question context" }),
    ).toBeNull();
    if (label === "Cancel and clear") {
      expect(request.mock.calls[0][1].aborted).toBe(true);
      await act(async () => gate.resolve(answerFixture()));
    }
  },
);

it("reopens saved answers in the server-authenticated reader without question controls, session-hook auth fetch or context selection", async () => {
  auth.value = {
    get data() {
      throw Error("Reader must not invoke browser session hook");
    },
  };
  archiveRequest.mockResolvedValue(archiveFixture());
  retainedRequest.mockResolvedValue(answerFixture());
  render(<ResearchSavedAnswers expiresAt={Date.now() + 60000} />);
  expect(screen.queryByRole("button", { name: "Ask" })).toBeNull();
  expect(screen.queryByLabelText("Question")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
  await screen.findByRole("button", { name: "Open saved answer" });
  expect(
    screen.queryByRole("button", { name: "Use as question context" }),
  ).toBeNull();
  expect(request).not.toHaveBeenCalled();
  expect(catalogRequest).not.toHaveBeenCalled();
});

it("replaces saved reader state and ignores a late old-session archive when its server identity key changes", async () => {
  const old = deferred<ReturnType<typeof archiveFixture>>();
  archiveRequest.mockReturnValueOnce(old.promise);
  const expiry = Date.now() + 60000,
    view = render(
      <ResearchSavedAnswers key="old-session" expiresAt={expiry} />,
    );
  fireEvent.click(screen.getByRole("button", { name: "Previous answers" }));
  view.rerender(<ResearchSavedAnswers key="new-session" expiresAt={expiry} />);
  await act(async () => old.resolve(archiveFixture()));
  expect(
    screen.queryByRole("button", { name: "Open saved answer" }),
  ).toBeNull();
  expect(
    screen.queryByRole("region", { name: "Saved completed answers" }),
  ).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

it("uses the server-authenticated operator shell without browser session fields and sends no work before asking", async () => {
  auth.value = new Proxy(
    {},
    {
      get() {
        throw Error("Unexpected browser auth state access");
      },
    },
  );
  request.mockResolvedValue(answerFixture());
  render(<ResearchOperatorChat expiresAt={Date.now() + 60000} />);
  expect(request).not.toHaveBeenCalled();
  ask("Synthetic operator question");
  await screen.findByRole("article", { name: "Research answer" });
  expect(request).toHaveBeenCalledOnce();
});
