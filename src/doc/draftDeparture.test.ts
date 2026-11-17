// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installDraftDepartureGuard } from "./draftDeparture";

let remove = () => {};
beforeEach(() => {
  window.history.replaceState({}, "", "/doc/synthetic/edit");
});
afterEach(() => {
  remove();
  document.body.replaceChildren();
});

function setup({
  flushFields = () => {},
  pendingFields = () => false,
}: {
  flushFields?: () => void;
  pendingFields?: () => boolean;
} = {}) {
  let dirty = true;
  const persisted: Array<() => void> = [];
  const failed = vi.fn();
  const flush = vi.fn(
    () =>
      new Promise<void>((resolve) =>
        persisted.push(() => {
          dirty = false;
          resolve();
        }),
      ),
  );
  remove = installDraftDepartureGuard(
    { pending: () => dirty, flush, failed },
    { document, window, flushFields, pendingFields },
  );
  const anchor = document.createElement("a");
  anchor.href = "/doc/synthetic";
  document.body.append(anchor);
  const navigate = vi.fn((event: Event) => event.preventDefault());
  anchor.addEventListener("click", navigate);
  return {
    anchor,
    navigate,
    flush,
    failed,
    persisted,
    setDirty: (value: boolean) => {
      dirty = value;
    },
  };
}

async function settled() {
  for (let index = 0; index < 10; index++) await Promise.resolve();
}

describe("local draft durability before departure", () => {
  it("holds any link, including app-bar/breadcrumb links, until local persistence finishes", async () => {
    const view = setup();
    view.anchor.click();
    expect(view.flush).toHaveBeenCalledOnce();
    expect(view.navigate).not.toHaveBeenCalled();
    view.persisted.shift()?.();
    await settled();
    expect(view.navigate).toHaveBeenCalledOnce();
    expect(view.failed).not.toHaveBeenCalled();
  });

  it("keeps the page open on storage failure", async () => {
    const view = setup();
    view.flush.mockRejectedValueOnce(Error("synthetic full disk"));
    view.anchor.click();
    await settled();
    expect(view.navigate).not.toHaveBeenCalled();
    expect(view.failed).toHaveBeenCalledOnce();
  });

  it("flushes focused field edits before capturing and awaiting the draft", async () => {
    let fieldDirty = true;
    const fields = vi.fn(() => {
      fieldDirty = false;
    });
    const view = setup({
      flushFields: fields,
      pendingFields: () => fieldDirty,
    });
    view.setDirty(false);
    view.anchor.click();
    expect(fields).toHaveBeenCalledOnce();
    expect(view.flush).toHaveBeenCalledOnce();
    view.persisted.shift()?.();
    await settled();
    expect(view.navigate).toHaveBeenCalledOnce();
  });

  it("warns only while bytes are not durable, and starts a best-effort flush", async () => {
    const view = setup();
    const pending = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(pending);
    expect(pending.defaultPrevented).toBe(true);
    expect(view.flush).toHaveBeenCalledOnce();
    view.persisted.shift()?.();
    await settled();
    const durable = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(durable);
    expect(durable.defaultPrevented).toBe(false);
  });

  it("coalesces pagehide with an in-flight flush", async () => {
    const view = setup();
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pagehide"));
    expect(view.flush).toHaveBeenCalledOnce();
    view.persisted.shift()?.();
    await settled();
  });

  it.each(["_blank", "download", "#section"])(
    "does not intercept %s",
    (kind) => {
      const view = setup();
      if (kind === "_blank") view.anchor.target = kind;
      else if (kind === "download") view.anchor.download = "synthetic.txt";
      else view.anchor.href = kind;
      view.anchor.click();
      expect(view.flush).not.toHaveBeenCalled();
      expect(view.navigate).toHaveBeenCalledOnce();
    },
  );

  it("does not intercept modifier clicks, but guards a same-URL reload", () => {
    const view = setup();
    view.anchor.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      }),
    );
    expect(view.flush).not.toHaveBeenCalled();
    view.anchor.href = "";
    view.anchor.click();
    expect(view.flush).toHaveBeenCalledOnce();
  });

  it("does not navigate from a stale or unmounted editor after persistence", async () => {
    const view = setup();
    view.anchor.click();
    remove();
    view.persisted.shift()?.();
    await settled();
    expect(view.navigate).not.toHaveBeenCalled();
  });
});
