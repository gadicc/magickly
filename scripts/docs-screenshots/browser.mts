import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The few reply fields this client reads, across the methods it calls. */
interface CdpResult {
  data?: string;
  result?: { value?: unknown };
  exceptionDetails?: { text: string; exception?: { description?: string } };
}

/**
 * A tiny Chrome DevTools Protocol client: headless Chromium plus Node's global
 * WebSocket, so the screenshot task adds no dependency.
 */
export class Browser {
  private socket!: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private process!: ChildProcess;
  private profile = mkdtempSync(join(tmpdir(), "docs-screenshots-"));
  private sessionId = "";

  static async launch(chromium = process.env.CHROMIUM ?? "chromium") {
    const browser = new Browser();
    const port = 9400 + Math.floor(Math.random() * 400);
    browser.process = spawn(
      chromium,
      [
        "--headless=new",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${browser.profile}`,
        "--hide-scrollbars",
        "--force-color-profile=srgb",
        "--no-first-run",
        "about:blank",
      ],
      { stdio: "ignore" },
    );
    let wsUrl = "";
    for (let attempt = 0; attempt < 100 && !wsUrl; attempt++) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        const targets = (await (
          await fetch(`http://127.0.0.1:${port}/json`)
        ).json()) as { type: string; webSocketDebuggerUrl: string }[];
        wsUrl =
          targets.find((t) => t.type === "page")?.webSocketDebuggerUrl ?? "";
      } catch {}
    }
    if (!wsUrl) throw new Error("Chromium did not start");
    browser.socket = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      browser.socket.onopen = resolve;
      browser.socket.onerror = reject;
    });
    browser.socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      const waiter = browser.pending.get(message.id);
      if (!waiter) return;
      browser.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    };
    await browser.send("Page.enable");
    await browser.send("Runtime.enable");
    return browser;
  }

  send<T = CdpResult>(method: string, params: object = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    this.socket?.close();
    const exited = new Promise((resolve) => this.process.once("exit", resolve));
    this.process.kill();
    await exited;
    rmSync(this.profile, { recursive: true, force: true, maxRetries: 10 });
  }

  async viewport(width: number, height: number, mobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 2,
      mobile,
    });
  }

  async evaluate<T = unknown>(expression: string): Promise<T> {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text,
      );
    return result.result?.value as T;
  }

  /** Wait until `expression` is truthy, polling; the page may still be hydrating. */
  async waitFor(expression: string, timeout = 30_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        if (await this.evaluate(expression)) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }

  async goto(url: string) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'");
    // Let hydration and webfont swaps settle before anything is measured.
    await new Promise((r) => setTimeout(r, 800));
  }

  /** Click the first element matching `selector` whose text contains `text`. */
  async click(selector: string, text = "") {
    const point = await this.evaluate<{ x: number; y: number } | null>(`(() => {
      const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find((e) => e.textContent.includes(${JSON.stringify(text)}) || e.getAttribute("aria-label")?.includes(${JSON.stringify(text)}));
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    if (!point) throw new Error(`No ${selector} containing "${text}"`);
    for (const type of ["mousePressed", "mouseReleased"])
      await this.send("Input.dispatchMouseEvent", {
        type,
        ...point,
        button: "left",
        clickCount: 1,
      });
    await new Promise((r) => setTimeout(r, 400));
  }

  async type(selector: string, text: string) {
    await this.click(selector);
    await this.send("Input.insertText", { text });
  }

  async clearSiteData() {
    await this.send("Network.enable");
    await this.send("Network.clearBrowserCookies");
  }

  /**
   * An image of the viewport, or of the union of the boxes of the elements
   * `clip` evaluates to (a JS expression returning an array of Elements).
   */
  async screenshot(clip?: string, padding = 16) {
    let region: object | undefined;
    if (clip) {
      const box = await this.evaluate<{
        x: number;
        y: number;
        width: number;
        height: number;
      } | null>(`(() => {
        const els = (${clip}).filter(Boolean);
        if (!els.length) return null;
        const rects = els.map((e) => e.getBoundingClientRect());
        const x = Math.max(0, Math.min(...rects.map((r) => r.left)) - ${padding});
        const y = Math.max(0, Math.min(...rects.map((r) => r.top) ) - ${padding} + scrollY);
        const right = Math.min(innerWidth, Math.max(...rects.map((r) => r.right)) + ${padding});
        const bottom = Math.max(...rects.map((r) => r.bottom)) + ${padding} + scrollY;
        return { x, y, width: right - x, height: bottom - y };
      })()`);
      if (!box) throw new Error(`Nothing matches ${clip}`);
      region = { ...box, scale: 1 };
    }
    const { data } = await this.send<{ data: string }>(
      "Page.captureScreenshot",
      {
        format: "webp",
        quality: 88,
        captureBeyondViewport: !!region,
        ...(region ? { clip: region } : {}),
      },
    );
    return Buffer.from(data, "base64");
  }
}
