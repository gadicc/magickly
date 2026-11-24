// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type PageShare, usePageShare } from "@/app/pageShare";
import LocaleProvider from "@/i18n/LocaleProvider";
import { messages as hebrew } from "@/locales/he/messages.js";
import type { AnyComponentImageLink } from "@/render/componentImageUrl";
import { renderWithShare } from "../../tests/pageShare";
import ExportControls, { type ExportControlsProps } from "./ExportControls";
import { type ExportFormat, PNG_FORMAT, SVG_FORMAT } from "./formats";
import { SvgExportError } from "./svgExport";

const TREE: AnyComponentImageLink = {
  slug: "tree-of-life",
  props: {
    field: "name.roman",
    topText: "index",
    bottomText: "",
    colorScale: "queen",
    letterAttr: "hermetic",
    flip: false,
    showDaat: false,
    fontSize: 10,
  },
};
const CANDLE: AnyComponentImageLink = {
  slug: "seven-branched-candlestick",
  props: {},
};

const runtime = vi.hoisted(() => ({
  rasterizeSvg: vi.fn(),
  downloadBlob: vi.fn(),
  copySvg: vi.fn(),
  copyPng: vi.fn(),
  copyText: vi.fn(),
}));
vi.mock("./exportRuntime", () => runtime);
// LocaleProvider's; nothing here navigates.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));

/** Every action's accessible name contains its visible label (WCAG 2.5.3). */
const expectLabelsInNames = () => {
  const buttons = screen
    .getAllByRole("group")
    .flatMap((row) => within(row).getAllByRole("button"));
  // Three in each format's row, and the share row's Share.
  expect(buttons).toHaveLength(7);
  for (const button of buttons) {
    const label = button.textContent ?? "";
    expect(label).not.toBe("");
    expect(button.getAttribute("aria-label")?.toLowerCase()).toContain(
      label.toLowerCase(),
    );
  }
  return buttons;
};

function Page({
  filename,
  viewBox,
  ...rest
}: { filename: string; viewBox?: string } & Partial<ExportControlsProps>) {
  const ref = React.useRef<SVGSVGElement>(null);
  return (
    <section aria-label={filename}>
      <svg ref={ref} viewBox={viewBox} id="shared">
        <title>{filename}</title>
        <circle r="1" id="shared" />
      </svg>
      <ExportControls target={ref} filename={filename} {...rest} />
    </section>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ExportControls", () => {
  it("exports each instance's own SVG with unique ids and confirms", async () => {
    runtime.copySvg.mockResolvedValue("image/svg+xml");
    render(
      <>
        <Page filename="one" viewBox="0 0 10 10" />
        <Page filename="two" viewBox="0 0 20 10" />
      </>,
    );
    const [first, second] = screen.getAllByLabelText("Copy SVG to clipboard");
    fireEvent.click(second);
    expect(
      await screen.findByText("Copied SVG image to clipboard"),
    ).toBeTruthy();
    expect(runtime.copySvg).toHaveBeenCalledTimes(1);
    const text = runtime.copySvg.mock.calls[0][0] as string;
    expect(text).toContain("<title>two</title>");
    expect(text).not.toContain("one");
    expect(text.match(/id="shared"/g)).toHaveLength(1);
    expect(text).toContain('id="shared-2"');

    runtime.copySvg.mockResolvedValue("text/plain");
    fireEvent.click(first);
    expect(
      await screen.findByText("Copied SVG text to clipboard"),
    ).toBeTruthy();
    expect(runtime.copySvg.mock.calls[1][0]).toContain("<title>one</title>");
  });

  it("downloads SVG synchronously and PNG after rasterising at the computed size", async () => {
    const png = new Blob(["png"], { type: "image/png" });
    runtime.rasterizeSvg.mockResolvedValue(png);
    render(<Page filename="tree" viewBox="-170.5 0 341 598" />);
    fireEvent.click(screen.getByLabelText("Save SVG"));
    expect(runtime.downloadBlob).toHaveBeenCalledTimes(1);
    const [svgBlob, svgName] = runtime.downloadBlob.mock.calls[0] as [
      Blob,
      string,
    ];
    expect(svgName).toBe("tree.svg");
    expect(svgBlob.type).toBe("image/svg+xml");
    expect(await svgBlob.text()).toContain('viewBox="-170.5 0 341 598"');
    expect(await screen.findByText("Downloading SVG")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Save PNG"));
    expect(runtime.rasterizeSvg).toHaveBeenCalledWith(
      expect.stringContaining('width="1168"'),
      { width: 1168, height: 2048 },
    );
    expect(await screen.findByText("Downloading PNG")).toBeTruthy();
    expect(runtime.downloadBlob).toHaveBeenLastCalledWith(png, "tree.png");
  });

  it("credits every exported file when given a credit", async () => {
    // A 1 × 1 PNG: the signature, IHDR, IDAT and IEND.
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      ),
      (char) => char.charCodeAt(0),
    );
    runtime.rasterizeSvg.mockResolvedValue(new Blob([png]));
    runtime.copySvg.mockResolvedValue("text/plain");
    runtime.copyPng.mockImplementation(async (pending: Promise<Blob>) => {
      await pending;
    });
    const credit = { svg: "<metadata>Art: us</metadata>", xmp: "<x>Art</x>" };
    render(<Page filename="hall" viewBox="0 0 10 10" credit={credit} />);
    fireEvent.click(screen.getByLabelText("Save SVG"));
    await screen.findByText("Downloading SVG");
    const [svgBlob] = runtime.downloadBlob.mock.calls[0] as [Blob];
    expect(await svgBlob.text()).toMatch(
      /<svg[^>]*><title>hall<\/title><metadata>Art: us<\/metadata>/,
    );
    fireEvent.click(screen.getByLabelText("Copy SVG to clipboard"));
    await screen.findByText("Copied SVG text to clipboard");
    expect(runtime.copySvg.mock.calls[0][0]).toContain(
      "<metadata>Art: us</metadata>",
    );
    fireEvent.click(screen.getByLabelText("Save PNG"));
    await screen.findByText("Downloading PNG");
    const [pngBlob, name] = runtime.downloadBlob.mock.calls[1] as [
      Blob,
      string,
    ];
    expect(name).toBe("hall.png");
    expect(pngBlob.type).toBe("image/png");
    const bytes = new Uint8Array(await pngBlob.arrayBuffer());
    expect(new TextDecoder().decode(bytes)).toContain(
      "iTXtXML:com.adobe.xmp\0\0\0\0\0<x>Art</x>",
    );
    fireEvent.click(screen.getByLabelText("Copy PNG to clipboard"));
    await screen.findByText("Copied PNG to clipboard");
    const copied = await (runtime.copyPng.mock.calls[0][0] as Promise<Blob>);
    expect(new TextDecoder().decode(await copied.arrayBuffer())).toContain(
      "<x>Art</x>",
    );
  });

  it("hands the pending PNG promise to the clipboard inside the click", async () => {
    let resolve!: (blob: Blob) => void;
    runtime.rasterizeSvg.mockReturnValue(
      new Promise<Blob>((r) => {
        resolve = r;
      }),
    );
    runtime.copyPng.mockImplementation(async (pending: Promise<Blob>) => {
      await pending;
    });
    render(<Page filename="x" viewBox="0 0 10 10" />);
    const copy = screen.getByLabelText("Copy PNG to clipboard");
    fireEvent.click(copy);
    expect(runtime.copyPng).toHaveBeenCalledTimes(1);
    expect(runtime.copyPng.mock.calls[0][0]).toBeInstanceOf(Promise);
    for (const label of [
      "Copy PNG to clipboard",
      "Save PNG",
      "Save SVG",
      "Copy SVG to clipboard",
      // Share too, so its confirmation and the copy's never overlap.
      "Share this page",
    ])
      expect((screen.getByLabelText(label) as HTMLButtonElement).disabled).toBe(
        true,
      );
    resolve(new Blob());
    expect(await screen.findByText("Copied PNG to clipboard")).toBeTruthy();
    expect((copy as HTMLButtonElement).disabled).toBe(false);
    expect(
      (screen.getByLabelText("Share this page") as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("runs prepare on a clone for the PNG paths only, before rasterising", async () => {
    const order: string[] = [];
    let release!: () => void;
    const prepare = vi.fn(async (clone: SVGSVGElement) => {
      order.push("prepare");
      await new Promise<void>((r) => {
        release = r;
      });
      clone.setAttribute("data-prepared", "yes");
    });
    runtime.rasterizeSvg.mockImplementation(async () => {
      order.push("rasterize");
      return new Blob(["png"], { type: "image/png" });
    });
    runtime.copySvg.mockResolvedValue("image/svg+xml");
    runtime.copyPng.mockImplementation(async (pending: Promise<Blob>) => {
      await pending;
    });
    render(<Page filename="hall" viewBox="0 0 10 20" prepare={prepare} />);
    const live = document.querySelector("svg") as SVGSVGElement;

    // SVG download and copy never see it.
    fireEvent.click(screen.getByLabelText("Save SVG"));
    expect(await screen.findByText("Downloading SVG")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Copy SVG to clipboard"));
    expect(
      await screen.findByText("Copied SVG image to clipboard"),
    ).toBeTruthy();
    expect(prepare).not.toHaveBeenCalled();
    const [svgBlob] = runtime.downloadBlob.mock.calls[0] as [Blob];
    expect(await svgBlob.text()).not.toContain("data-prepared");
    expect(runtime.copySvg.mock.calls[0][0]).not.toContain("data-prepared");

    // Copy PNG: the clipboard gets the pending PNG inside the click, while
    // prepare is still running; rasterising waits for it.
    fireEvent.click(screen.getByLabelText("Copy PNG to clipboard"));
    expect(runtime.copyPng).toHaveBeenCalledTimes(1);
    expect(runtime.copyPng.mock.calls[0][0]).toBeInstanceOf(Promise);
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
    const clone = prepare.mock.calls[0][0];
    expect(clone).not.toBe(live);
    expect(clone.isConnected).toBe(false);
    expect(clone.getAttribute("width")).toBe("1024");
    expect(runtime.rasterizeSvg).not.toHaveBeenCalled();
    release();
    expect(await screen.findByText("Copied PNG to clipboard")).toBeTruthy();
    expect(order).toEqual(["prepare", "rasterize"]);
    expect(runtime.rasterizeSvg).toHaveBeenCalledWith(
      expect.stringContaining('data-prepared="yes"'),
      { width: 1024, height: 2048 },
    );
    expect(live.hasAttribute("data-prepared")).toBe(false);

    // Save PNG runs it again, on a fresh clone.
    fireEvent.click(screen.getByLabelText("Save PNG"));
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(2));
    expect(prepare.mock.calls[1][0]).not.toBe(clone);
    release();
    expect(await screen.findByText("Downloading PNG")).toBeTruthy();
    expect(runtime.downloadBlob).toHaveBeenLastCalledWith(
      expect.any(Blob),
      "hall.png",
    );
  });

  it("fails the PNG export when prepare fails", async () => {
    const prepare = vi.fn().mockRejectedValue(new Error("no fonts"));
    render(<Page filename="hall" viewBox="0 0 10 10" prepare={prepare} />);
    fireEvent.click(screen.getByLabelText("Save PNG"));
    expect(await screen.findByText("Export failed.")).toBeTruthy();
    expect(runtime.rasterizeSvg).not.toHaveBeenCalled();
    expect(runtime.downloadBlob).not.toHaveBeenCalled();
  });

  it("fails a PNG copy when prepare fails, not as a refused clipboard", async () => {
    // The real copyPng, with a clipboard that, like a browser's, fails the
    // write when the item's promise rejects.
    const actual =
      await vi.importActual<typeof import("./exportRuntime")>(
        "./exportRuntime",
      );
    runtime.copyPng.mockImplementation(actual.copyPng);
    class Item {
      constructor(readonly items: Record<string, Promise<Blob>>) {}
    }
    vi.stubGlobal("ClipboardItem", Item);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: async ([item]: Item[]) => {
          try {
            await item.items["image/png"];
          } catch {
            throw new DOMException("item failed", "NotAllowedError");
          }
        },
      },
    });
    try {
      const prepare = vi.fn().mockRejectedValue(new Error("no fonts"));
      render(<Page filename="hall" viewBox="0 0 10 10" prepare={prepare} />);
      fireEvent.click(screen.getByLabelText("Copy PNG to clipboard"));
      expect(await screen.findByText("Export failed.")).toBeTruthy();
      expect(
        screen.queryByText("The browser refused clipboard access."),
      ).toBeNull();
      expect(runtime.rasterizeSvg).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
    }
  });

  it("explains failures instead of throwing", async () => {
    runtime.copyPng.mockRejectedValue(
      new SvgExportError("clipboard-unavailable"),
    );
    runtime.rasterizeSvg.mockResolvedValue(new Blob());
    runtime.copySvg.mockRejectedValue(new Error("boom"));
    render(<Page filename="x" viewBox="0 0 10 10" />);
    fireEvent.click(screen.getByLabelText("Copy PNG to clipboard"));
    expect(
      await screen.findByText(
        "Clipboard access is not available here. Use Save instead.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Copy SVG to clipboard"));
    expect(await screen.findByText("Export failed.")).toBeTruthy();
  });

  it("refuses PNG for an image without a viewport and copes with a missing target", async () => {
    render(<Page filename="x" />);
    fireEvent.click(screen.getByLabelText("Save PNG"));
    expect(
      await screen.findByText("This image has no size to export."),
    ).toBeTruthy();
    expect(runtime.rasterizeSvg).not.toHaveBeenCalled();

    function Detached() {
      const ref = React.useRef<SVGSVGElement>(null);
      return <ExportControls target={ref} filename="none" />;
    }
    render(<Detached />);
    fireEvent.click(screen.getAllByLabelText("Save SVG")[1]);
    expect(await screen.findByText("Nothing to export yet.")).toBeTruthy();
    expect(runtime.downloadBlob).not.toHaveBeenCalled();
  });

  it("names each row by its format and each action by what it does", () => {
    render(<Page filename="tree" viewBox="-170.5 0 341 598" link={TREE} />);
    const rows = screen.getAllByRole("group");
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "SVG",
      "PNG",
      "This page",
    ]);
    for (const [index, format] of ["SVG", "PNG"].entries())
      expect(
        within(rows[index])
          .getAllByRole("button")
          .map((button) => [
            button.getAttribute("aria-label"),
            button.textContent,
          ]),
      ).toEqual([
        [`Save ${format}`, "Save"],
        [`Copy ${format} to clipboard`, "Copy"],
        [`Copy ${format} image link`, "Link"],
      ]);
    expect(
      within(rows[2])
        .getAllByRole("button")
        .map((button) => [
          button.getAttribute("aria-label"),
          button.textContent,
        ]),
    ).toEqual([["Share this page", "Share"]]);
    // So a voice command that says what it sees reaches the button.
    expectLabelsInNames();
    expect(within(rows[0]).getByText("Sharp at any size")).toBeTruthy();
    expect(within(rows[1]).getByText("Pastes anywhere")).toBeTruthy();
    expect(within(rows[2]).getByText("With your chosen options")).toBeTruthy();
    // The file icons are decorative; the names are beside them.
    expect(
      [...document.querySelectorAll("[data-file-icon]")].map((icon) => [
        icon.getAttribute("data-file-icon"),
        icon.getAttribute("aria-hidden"),
        icon.textContent,
      ]),
    ).toEqual([
      ["svg", "true", "SVG"],
      ["png", "true", "PNG"],
      ["web", "true", "WEB"],
    ]);
    // Nothing to open until a link is copied, and nothing outside the
    // rows: the page link is Share's (plan 097, decisions 3 and 7).
    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(screen.getAllByRole("button")).toHaveLength(7);
  });

  it("copies each format's absolute image link and offers to open it", async () => {
    runtime.copyText.mockResolvedValue(undefined);
    render(<Page filename="tree" viewBox="-170.5 0 341 598" link={TREE} />);
    const origin = window.location.origin;
    for (const [format, href] of [
      ["SVG", `${origin}/api/render/tree-of-life?field=name.roman&fontSize=10`],
      [
        "PNG",
        `${origin}/api/render/tree-of-life?fmt=png&field=name.roman&fontSize=10`,
      ],
    ]) {
      fireEvent.click(
        screen.getByRole("button", { name: `Copy ${format} image link` }),
      );
      expect(
        await screen.findByText(`Copied ${format} image link`),
      ).toBeTruthy();
      expect(runtime.copyText).toHaveBeenLastCalledWith(href);
      const open = screen.getByRole("link", { name: "Open" });
      expect(open.getAttribute("href")).toBe(href);
      expect(open.getAttribute("target")).toBe("_blank");
      expect(open.getAttribute("rel")).toBe("noopener");
    }
    expect(runtime.copyText).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/what you entered/)).toBeNull();
  });

  it("keeps a confirmation that offers Open for 6 seconds, others for 2.5", async () => {
    vi.useFakeTimers();
    try {
      runtime.copyText.mockResolvedValue(undefined);
      render(<Page filename="candlestick" viewBox="0 0 1 1" link={CANDLE} />);
      const settle = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
      fireEvent.click(
        screen.getByRole("button", { name: "Copy SVG image link" }),
      );
      await settle(0);
      expect(screen.getByText("Copied SVG image link")).toBeTruthy();
      await settle(5900);
      expect(screen.queryByText("Copied SVG image link")).toBeTruthy();
      await settle(200);
      expect(screen.queryByText("Copied SVG image link")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Save SVG" }));
      await settle(0);
      expect(screen.getByText("Downloading SVG")).toBeTruthy();
      await settle(2400);
      expect(screen.queryByText("Downloading SVG")).toBeTruthy();
      await settle(200);
      expect(screen.queryByText("Downloading SVG")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("restarts the timer for each new confirmation", async () => {
    vi.useFakeTimers();
    try {
      runtime.copyText.mockResolvedValue(undefined);
      render(<Page filename="candlestick" viewBox="0 0 1 1" link={CANDLE} />);
      const settle = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
      fireEvent.click(
        screen.getByRole("button", { name: "Copy SVG image link" }),
      );
      await settle(0);
      expect(screen.getByText("Copied SVG image link")).toBeTruthy();
      await settle(5000);
      fireEvent.click(
        screen.getByRole("button", { name: "Copy PNG image link" }),
      );
      await settle(0);
      expect(screen.getByText("Copied PNG image link")).toBeTruthy();
      // Past the first one's 6 seconds, the second still shows.
      await settle(5000);
      expect(screen.queryByText("Copied PNG image link")).toBeTruthy();
      await settle(1100);
      expect(screen.queryByText("Copied PNG image link")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["unavailable", new SvgExportError("clipboard-unavailable")],
    ["refused", new SvgExportError("clipboard-denied")],
  ])(
    "still offers Open when the clipboard is %s for a link",
    async (_case, error) => {
      runtime.copyText.mockRejectedValue(error);
      render(<Page filename="tree" viewBox="0 0 1 1" link={TREE} />);
      fireEvent.click(
        screen.getByRole("button", { name: "Copy PNG image link" }),
      );
      const alert = await screen.findByRole("alert");
      expect(
        within(alert).getByText("Could not copy the link. Open it instead."),
      ).toBeTruthy();
      expect(alert.className).toContain("MuiAlert-colorError");
      const href = `${window.location.origin}/api/render/tree-of-life?fmt=png&field=name.roman&fontSize=10`;
      const open = within(alert).getByRole("link", { name: "Open" });
      expect(open.getAttribute("href")).toBe(href);
      expect(open.getAttribute("target")).toBe("_blank");
    },
  );

  it("puts each visible label in its name in Hebrew too", () => {
    render(
      <LocaleProvider locale="he" messages={hebrew}>
        <Page filename="tree" viewBox="0 0 1 1" link={TREE} />
      </LocaleProvider>,
    );
    expect(
      expectLabelsInNames().map((button) => [
        button.textContent,
        button.getAttribute("aria-label"),
      ]),
    ).toEqual([
      ["שמירה", "שמירה כ־SVG"],
      ["העתקה", "העתקה ללוח כ־SVG"],
      ["קישור", "העתקת קישור לתמונת ה־SVG"],
      ["שמירה", "שמירה כ־PNG"],
      ["העתקה", "העתקה ללוח כ־PNG"],
      ["קישור", "העתקת קישור לתמונת ה־PNG"],
      ["שיתוף", "שיתוף העמוד הזה"],
    ]);
  });

  it("keeps two linked instances independent", async () => {
    runtime.copyText.mockResolvedValue(undefined);
    render(
      <>
        <Page filename="a" viewBox="0 0 1 1" link={CANDLE} />
        <Page
          filename="b"
          viewBox="0 0 1 1"
          link={{
            slug: "enochian-tablet",
            props: { id: "air", font: "latin" },
          }}
        />
      </>,
    );
    const origin = window.location.origin;
    fireEvent.click(
      screen.getAllByRole("button", { name: "Copy PNG image link" })[1],
    );
    expect(await screen.findByText("Copied PNG image link")).toBeTruthy();
    expect(runtime.copyText).toHaveBeenLastCalledWith(
      `${origin}/api/render/enochian-tablet?fmt=png&id=air`,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Copy SVG image link" })[0],
    );
    expect(await screen.findByText("Copied SVG image link")).toBeTruthy();
    expect(runtime.copyText).toHaveBeenLastCalledWith(
      `${origin}/api/render/seven-branched-candlestick`,
    );
    // Each instance confirms its own copy.
    expect(
      screen
        .getAllByRole("link", { name: "Open" })
        .map((open) => open.getAttribute("href")),
    ).toEqual([
      `${origin}/api/render/seven-branched-candlestick`,
      `${origin}/api/render/enochian-tablet?fmt=png&id=air`,
    ]);
    expect(screen.queryByText(/what you entered/)).toBeNull();
  });

  it("explains a missing link when Link is pressed, and copies nothing", async () => {
    render(
      <Page
        filename="tree"
        viewBox="-170.5 0 341 598"
        linkNote="No image link for this combination."
      />,
    );
    // Nothing waits under the box.
    expect(
      screen.queryByText("No image link for this combination."),
    ).toBeNull();
    const links = ["SVG", "PNG"].map((format) =>
      screen.getByRole("button", { name: `Copy ${format} image link` }),
    );
    for (const link of links) {
      // Looks disabled, but stays in the tab order to explain itself.
      expect(link.getAttribute("aria-disabled")).toBe("true");
      expect((link as HTMLButtonElement).disabled).toBe(false);
      expect(link.tabIndex).toBe(0);
    }
    fireEvent.click(links[1]);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("No image link for this combination.");
    expect(alert.className).toContain("MuiAlert-colorInfo");
    expect(runtime.copyText).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Open" })).toBeNull();
  });

  it("says in the confirmation that a personal page's link carries what was entered", async () => {
    runtime.copyText.mockResolvedValue(undefined);
    render(
      <Page
        filename="sigil"
        viewBox="-50 -50 100 100"
        link={{ slug: "rose-sigil", props: { text: "גדי", rose: true } }}
      />,
    );
    // Before the tap, only the share row's hint says so.
    expect(
      screen.getAllByText(/what you entered/).map((node) => node.textContent),
    ).toEqual(["Includes what you entered"]);
    fireEvent.click(
      screen.getByRole("button", { name: "Copy PNG image link" }),
    );
    expect(
      await screen.findByText(
        "Copied PNG image link. It includes what you entered here.",
      ),
    ).toBeTruthy();
    const href = `${window.location.origin}/api/render/rose-sigil?fmt=png&text=%D7%92%D7%93%D7%99`;
    expect(runtime.copyText).toHaveBeenLastCalledWith(href);
    expect(
      screen.getByRole("link", { name: "Open" }).getAttribute("href"),
    ).toBe(href);
  });

  it("offers Save and Copy only on a page with no image route", () => {
    render(<Page filename="hall" viewBox="0 0 1 1" />);
    for (const row of screen.getAllByRole("group").slice(0, 2))
      expect(
        within(row)
          .getAllByRole("button")
          .map((button) => button.textContent),
      ).toEqual(["Save", "Copy"]);
    expect(screen.queryByRole("button", { name: /image link/ })).toBeNull();
    expect(screen.queryByText(/what you entered/)).toBeNull();
  });

  it("takes a third format as one more row, moving nothing else", async () => {
    runtime.copyText.mockResolvedValue(undefined);
    const pdf: ExportFormat = {
      type: "pdf",
      name: "PDF",
      hint: { id: "Prints well" },
      save: vi.fn(async () => {}),
      copy: vi.fn(async () => ({ id: "Copied {format} to clipboard" })),
      link: (link) => `/api/render/${link.slug}?fmt=pdf`,
    };
    const rows = (formats?: ExportFormat[]) => {
      cleanup();
      render(
        <Page
          filename="candlestick"
          viewBox="0 0 1 1"
          link={CANDLE}
          formats={formats}
        />,
      );
      return screen.getAllByRole("group");
    };
    const two = rows().map((row) => row.outerHTML);
    const three = rows([SVG_FORMAT, PNG_FORMAT, pdf]);
    expect(three.map((row) => row.getAttribute("aria-label"))).toEqual([
      "SVG",
      "PNG",
      "PDF",
      "This page",
    ]);
    expect(three.map((row) => row.outerHTML)).toEqual([
      two[0],
      two[1],
      expect.anything(),
      two[2],
    ]);
    expect(
      within(three[2])
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Save PDF", "Copy PDF to clipboard", "Copy PDF image link"]);
    expect(within(three[2]).getByText("Prints well")).toBeTruthy();
    expect(three[2].querySelector('[data-file-icon="pdf"]')?.textContent).toBe(
      "PDF",
    );

    fireEvent.click(screen.getByRole("button", { name: "Save PDF" }));
    expect(await screen.findByText("Downloading PDF")).toBeTruthy();
    expect(pdf.save).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "candlestick" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copy PDF image link" }),
    );
    expect(await screen.findByText("Copied PDF image link")).toBeTruthy();
    expect(runtime.copyText).toHaveBeenLastCalledWith(
      `${window.location.origin}/api/render/seven-branched-candlestick?fmt=pdf`,
    );
  });
});

describe("ExportControls' share row", () => {
  const shareRow = () => screen.queryByRole("group", { name: "This page" });
  /** The row's name and hint, as shown. */
  const rowText = () =>
    [...(shareRow()?.querySelector("[data-share-text]")?.children ?? [])].map(
      (span) => span.textContent,
    );

  /** A page that registers its link for Share, as the personal ones do. */
  function Registered({
    registration,
    ...rest
  }: {
    registration: PageShare | undefined;
  } & Partial<ExportControlsProps>) {
    usePageShare(registration);
    return <Page filename="page" viewBox="0 0 1 1" {...rest} />;
  }
  const PERSONAL: PageShare = {
    url: () => "/gd/sigils?text=x",
    personal: true,
  };
  const BARE: PageShare = { url: () => "/gd/sigils", personal: false };

  it("comes last, after a rule, with the default hint", () => {
    render(<Page filename="tree" viewBox="0 0 1 1" link={TREE} />);
    const rows = screen.getAllByRole("group");
    expect(rows.at(-1)).toBe(shareRow());
    expect(rowText()).toEqual(["This page", "With your chosen options"]);
    expect(
      shareRow()
        ?.querySelector('[data-file-icon="web"]')
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("takes the page's own hint, or none", () => {
    render(
      <Page filename="a" viewBox="0 0 1 1" shareHint="With your colours" />,
    );
    expect(rowText()).toEqual(["This page", "With your colours"]);
    cleanup();
    render(<Page filename="b" viewBox="0 0 1 1" shareHint={null} />);
    // The name alone, centred in the row as the others are.
    expect(rowText()).toEqual(["This page"]);
  });

  it.each([
    ["the default", undefined],
    ["an override", "With your colours"],
    ["no hint", null],
  ])(
    "says a personal registration's link includes what was entered, over %s",
    (_case, shareHint) => {
      renderWithShare(
        <Registered registration={PERSONAL} shareHint={shareHint} />,
      );
      expect(rowText()).toEqual(["This page", "Includes what you entered"]);
    },
  );

  it("follows the registration as it changes", () => {
    const { rerender } = renderWithShare(
      <Registered registration={BARE} shareHint={null} />,
    );
    expect(rowText()).toEqual(["This page"]);
    rerender(<Registered registration={PERSONAL} shareHint={null} />);
    expect(rowText()).toEqual(["This page", "Includes what you entered"]);
    rerender(<Registered registration={BARE} shareHint={null} />);
    expect(rowText()).toEqual(["This page"]);
  });

  it("goes by the registration over the image contract", () => {
    // A sigil page with no sigil registers its bare page, which is not
    // personal, while its last drawing's contract is.
    renderWithShare(
      <Registered
        registration={BARE}
        shareHint={null}
        link={{ slug: "rose-sigil", props: { text: "גדי", rose: true } }}
      />,
    );
    expect(rowText()).toEqual(["This page"]);
  });

  it("goes by the image contract until a page registers, as on the server", () => {
    render(
      <Page
        filename="sigil"
        viewBox="0 0 1 1"
        shareHint={null}
        link={{ slug: "rose-sigil", props: { text: "גדי", rose: true } }}
      />,
    );
    expect(rowText()).toEqual(["This page", "Includes what you entered"]);
  });

  it("is absent where the page shares by its own means", () => {
    render(<Page filename="hall" viewBox="0 0 1 1" share={false} />);
    expect(shareRow()).toBeNull();
    expect(
      screen.getAllByRole("group").map((row) => row.getAttribute("aria-label")),
    ).toEqual(["SVG", "PNG"]);
    expect(screen.queryByRole("button", { name: /Share/ })).toBeNull();
    expect(document.querySelector('[data-file-icon="web"]')).toBeNull();
  });

  it("confirms in the box's own snackbar, and copies the address with nothing registered", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      window.history.replaceState(null, "", "/kabbalah/tree?flip=true#x");
      render(<Page filename="tree" viewBox="0 0 1 1" link={TREE} />);
      fireEvent.click(screen.getByRole("button", { name: "Share this page" }));
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/kabbalah/tree?flip=true#x`,
      );
      expect((await screen.findByRole("alert")).textContent).toBe(
        "Copied link to this page",
      );
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
      window.history.replaceState(null, "", "/");
    }
  });
});
