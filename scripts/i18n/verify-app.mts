import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  createWriteStream,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { Browser } from "../docs-screenshots/browser.mts";

const root = fileURLToPath(new URL("../../", import.meta.url));
assert(
  !readdirSync(root).some(
    (name) => name === ".env" || name.startsWith(".env."),
  ),
  "Use an isolated worktree without .env files; Next loads them itself",
);
mkdirSync(`${root}/output/i18n`, { recursive: true });
const tag = process.argv[2] || "webpack";
assert(["webpack", "turbopack"].includes(tag), "Choose webpack or turbopack");
const port = await new Promise<number>((resolve, reject) => {
  const socket = createServer();
  socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const address = socket.address();
    if (!address || typeof address === "string") throw new Error("No port");
    socket.close(() => resolve(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const env: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  ROOT_URL: origin,
  NEXTAUTH_URL: origin,
  AUTH_SECRET: "ci-build-only-not-a-production-secret",
  BETTER_AUTH_SECRET: "ci-build-only-better-auth-secret-0123456789",
  BETTER_AUTH_URL: origin,
  GOOGLE_CLIENT_ID: "ci-build-only-google-client",
  GOOGLE_CLIENT_SECRET: "ci-build-only-google-secret",
  MONGO_URL: "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100",
  DATABASE_URL: "postgresql://build:build@127.0.0.1:1/build?sslmode=disable",
  DATABASE_URL_UNPOOLED:
    "postgresql://build:build@127.0.0.1:1/build?sslmode=disable",
};
const log = createWriteStream(`${root}/output/i18n/app-${tag}-server.log`);
const server = spawn(
  process.execPath,
  [
    `${root}/node_modules/next/dist/bin/next`,
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { cwd: root, env },
);
server.stdout.pipe(log);
server.stderr.pipe(log);
let browser: Browser | undefined;
const results: Record<string, unknown>[] = [];
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + "/about")).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (server.exitCode !== null)
      throw new Error("Server exited before readiness");
    await new Promise((r) => setTimeout(r, 200));
  }
  assert(ready, "Server readiness");
  for (const [path, cookie, status, locale] of [
    ["/about", "he", 200, "en"],
    ["/he/about", "en", 200, "he"],
    ["/he", "en", 200, "he"],
    ["/he/books", "en", 200, "he"],
    ["/temples", "he", 200, "he"],
    ["/offline/ritual", "he", 200, "en"],
    ["/doc/neophyte", "he", 200, "en"],
    ["/doc/019a0000-0000-7000-8000-000000000101", "he", 200, "he"],
    ...[
      "/he/temples",
      "/he/signin",
      "/he/api/ui-locale",
      "/he/chat/research",
      "/he/doc/019a0000-0000-7000-8000-000000000101",
      "/en/about",
      "/fr/about",
      "/he/he/about",
    ].map((p) => [p, "he", 404, null]),
  ]) {
    const response = await fetch(origin + path, {
      headers: { Cookie: `magickly-ui-locale=${cookie}` },
      redirect: "manual",
    });
    const html = await response.text();
    assert.equal(response.status, status, String(path));
    if (locale) {
      assert(
        new RegExp(`<html[^>]*lang="${locale}"`).test(html),
        `language ${path}`,
      );
      assert(
        new RegExp(`<html[^>]*dir="${locale === "he" ? "rtl" : "ltr"}"`).test(
          html,
        ),
        `direction ${path}`,
      );
    }
    if (status === 404) assert(/noindex/.test(html), `noindex ${path}`);
    if (path === "/offline/ritual" || path === "/about" || path === "/he/about")
      assert(
        !/private|no-store/i.test(response.headers.get("cache-control") || ""),
        `cacheable ${path}`,
      );
    if (path === "/temples")
      assert(
        /private|no-store/i.test(response.headers.get("cache-control") || ""),
        "Private SSR cache",
      );
    if (path === "/he/about") {
      assert(html.includes("https://magick.ly/he/about"), "canonical");
      assert(
        /<meta name="robots" content="noindex, follow"/.test(html),
        "Hebrew SEO remains gated",
      );
      assert(
        !/<link[^>]+hreflang=/i.test(html),
        "No language alternates before SEO launch",
      );
      assert(/[א-ת]/.test(html), "Hebrew content");
    }
    results.push({
      path,
      status: response.status,
      locale,
      cache: response.headers.get("cache-control"),
    });
  }
  const sitemapXml = await (await fetch(origin + "/sitemap.xml")).text();
  assert(
    !/<loc>https:\/\/magick\.ly\/he(?:<|\/)/.test(sitemapXml),
    "Hebrew sitemap remains gated",
  );
  const cross = await fetch(origin + "/api/ui-locale", {
    method: "POST",
    headers: {
      Origin: "https://other.example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: "synthetic", locale: "he" }),
  });
  assert.equal(cross.status, 403);
  browser = await Browser.launch();
  await browser.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__i18nErrors=[]; const before=console.error; console.error=(...args)=>{window.__i18nErrors.push(args.map(String).join(' '));before(...args)};`,
  });
  await browser.viewport(390, 844, true);
  await browser.goto(origin + "/temples");
  await browser.evaluate(`window.__i18nDocumentToken='same-private-document'`);
  assert.equal(
    await browser.evaluate(
      `!!document.querySelector('header [role="combobox"]')`,
    ),
    false,
    "No language control in mobile app bar",
  );
  await browser.click('button[aria-label="menu"]');
  await browser.click('[role="combobox"]', "English");
  await browser.click('[role="option"]', "עברית");
  await browser.waitFor(
    `document.documentElement.lang==='he' && document.documentElement.dir==='rtl'`,
  );
  await browser.waitFor(`document.body.innerText.includes('המקדשים שלי')`);
  assert.equal(
    await browser.evaluate(`window.__i18nDocumentToken`),
    "same-private-document",
  );
  assert(
    await browser.evaluate(
      `document.documentElement.scrollWidth <= innerWidth`,
    ),
    "Drawer mobile overflow",
  );
  writeFileSync(
    `${root}/output/i18n/drawer-hebrew-mobile.webp`,
    await browser.screenshot(),
  );
  await browser.goto(origin + "/he/books");
  await browser.waitFor(`document.body.innerText.includes('על המהדורות האלה')`);
  assert(
    await browser.evaluate(
      `!!document.querySelector('a[lang="fr"][dir="ltr"]')`,
    ),
    "French source title boundary",
  );
  await browser.goto(origin + "/he/about");
  await browser.waitFor(
    `document.body.innerText.includes('אפליקציית מאגיה בקוד פתוח')`,
  );
  assert.equal(await browser.evaluate(`document.documentElement.dir`), "rtl");
  await browser.viewport(1280, 900);
  writeFileSync(
    `${root}/output/i18n/hebrew-about-desktop.webp`,
    await browser.screenshot(),
  );
  await browser.viewport(390, 844, true);
  assert(
    await browser.evaluate(
      `document.documentElement.scrollWidth <= innerWidth`,
    ),
    "Hebrew mobile overflow",
  );
  writeFileSync(
    `${root}/output/i18n/hebrew-about-mobile.webp`,
    await browser.screenshot(),
  );
  await browser.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "dark" }],
  });
  await browser.waitFor(`document.documentElement.classList.contains('dark')`);
  writeFileSync(
    `${root}/output/i18n/hebrew-about-mobile-dark.webp`,
    await browser.screenshot(),
  );
  await browser.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  await browser.viewport(390, 844, true);
  await browser.evaluate(
    `window.__i18nDocumentToken='localized-public-document'`,
  );
  await browser.click('button[aria-label="תפריט"]');
  await browser.click('[role="combobox"]', "עברית");
  writeFileSync(
    `${root}/output/i18n/drawer-language-options-mobile.webp`,
    await browser.screenshot(),
  );
  await browser.click('[role="option"]', "English");
  await browser.waitFor(
    `location.pathname==='/about' && document.documentElement.lang==='en'`,
  );
  assert.equal(await browser.evaluate(`window.__i18nDocumentToken`), undefined);
  await browser.evaluate(`document.cookie='magickly-ui-locale=he; Path=/'`);
  await browser.goto(origin + "/offline/ritual");
  await browser.waitFor(
    `document.documentElement.lang==='he' && document.documentElement.dir==='rtl'`,
  );
  if (tag === "webpack") {
    await browser.waitFor(
      `navigator.serviceWorker.getRegistrations().then(r=>r.some(v=>v.active))`,
      60000,
    );
    results.push({ worker: "active" });
    await browser.waitFor(`!!navigator.serviceWorker.controller`, 30000);
    await browser.send("Network.enable");
    await browser.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await browser.goto(origin + "/doc/019a0000-0000-7000-8000-000000000102");
    await browser.waitFor(
      `document.documentElement.lang==='he' && !!document.querySelector('[role=alert]')`,
      30000,
    );
    assert(
      (await browser.evaluate<string>(`document.body.innerText`)).includes(
        "הטקס אינו זמין במכשיר הזה",
      ),
      "Real worker UUID fallback",
    );
    results.push({
      workerFallback:
        "anonymous offline shell at synthetic UUID; Hebrew controls",
    });
    await browser.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }
  const errors = await browser.evaluate<string[]>(`window.__i18nErrors`);
  assert(
    !errors.some((v) => /hydrat|Minified React error/i.test(v)),
    JSON.stringify(errors),
  );
  writeFileSync(
    `${root}/output/i18n/app-${tag}-http-report.json`,
    JSON.stringify(
      {
        results,
        browser: {
          privateSwitchNoReload: true,
          publicSwitchReload: true,
          offlineRestoration: true,
          hydrationErrors: errors,
        },
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS ${tag}: ${results.length} HTTP/worker checks and real-browser locale navigation`,
  );
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  log.end();
}
