/**
 * Isolated plan-086 feasibility gate. Only synthetic pages/catalogs are served;
 * the app's routes, credentials and production services are never used.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Browser } from "../docs-screenshots/browser.mts";
import { routeInventory } from "./inventory";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.join(root, "output/i18n");
const fixture = path.join(output, "proof");
const templates = fileURLToPath(new URL("./fixture/", import.meta.url));
const runtime = process.versions.node.split(".")[0];
assert.equal(runtime, "24", "Use the project's Node 24 runtime for this gate.");

// Do not pass application credentials into the fixture or its Next subprocesses.
const environment: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NEXT_TELEMETRY_DISABLED: "1",
  NODE_ENV: "production",
};

async function run(args: string[], logName: string, cwd = fixture, extra = {}) {
  const log = createWriteStream(path.join(output, logName));
  const child = spawn("pnpm", args, { cwd, env: { ...environment, ...extra } });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  const status = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  await new Promise<void>((resolve) => log.end(resolve));
  if (status !== 0)
    throw new Error(
      `${args.join(" ")} exited ${status}; see output/i18n/${logName}`,
    );
}

const files = {
  "next.config.mjs": "next.config.mjs",
  "messages.ts": "src/messages.ts",
  "ClientShell.tsx": "src/ClientShell.tsx",
  "Document.tsx": "src/Document.tsx",
  "preference.ts": "src/preference.ts",
  "reader.ts": "src/reader.ts",
  "global-not-found.tsx": "src/app/global-not-found.tsx",
  "global-error.tsx": "src/app/global-error.tsx",
  "public-layout.tsx": "src/app/(public)/layout.tsx",
  "about-page.tsx": "src/app/(public)/about/page.tsx",
  "localized-layout.tsx": "src/app/(localized)/[locale]/layout.tsx",
  "localized-about.tsx": "src/app/(localized)/[locale]/about/page.tsx",
  "localized-reader.tsx": "src/app/(localized)/[locale]/doc/[id]/page.tsx",
  "private-layout.tsx": "src/app/(private)/layout.tsx",
  "private-page.tsx": "src/app/(private)/temples/page.tsx",
  "offline-page.tsx": "src/app/(offline)/offline/ritual/page.tsx",
  "reader-layout.tsx": "src/app/(reader)/doc/[id]/layout.tsx",
  "reader-page.tsx": "src/app/(reader)/doc/[id]/page.tsx",
  "research-layout.tsx": "src/app/(research)/layout.tsx",
  "research-page.tsx": "src/app/(research)/chat/research/page.tsx",
};

async function prepare() {
  await mkdir(fixture, { recursive: true });
  assert(
    !(await readdir(fixture)).some((name) => name.startsWith(".env")),
    "Fixture must not load env files.",
  );
  await rm(path.join(fixture, "src"), { recursive: true, force: true });
  const dependencies = [
    "next",
    "react",
    "react-dom",
    "@mui/material",
    "@mui/material-nextjs",
    "@emotion/cache",
    "@emotion/react",
    "@emotion/styled",
    "@gadicc/loom",
  ];
  const devDependencies = [
    "typescript",
    "@types/react",
    "@types/react-dom",
    "@types/node",
  ];
  async function versions(names: string[]) {
    return Object.fromEntries(
      await Promise.all(
        names.map(async (name) => [
          name,
          JSON.parse(
            await readFile(
              path.join(root, "node_modules", name, "package.json"),
              "utf8",
            ),
          ).version,
        ]),
      ),
    );
  }
  const appPackage = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  await writeFile(
    path.join(fixture, "package.json"),
    `${JSON.stringify(
      {
        name: "magickli-i18n-proof",
        private: true,
        version: "0.0.0",
        packageManager: appPackage.packageManager,
        scripts: { build: "next build" },
        dependencies: {
          ...(await versions(dependencies)),
          "@mui/stylis-plugin-rtl": "9.5.0",
          stylis: "4.4.0",
        },
        devDependencies: await versions(devDependencies),
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(fixture, "pnpm-workspace.yaml"),
    "packages: []\nminimumReleaseAge: 10080\nstrictDepBuilds: true\nallowBuilds:\n  sharp: true\n  esbuild: true\n",
  );
  await writeFile(
    path.join(fixture, "loom.json"),
    `${JSON.stringify(
      {
        version: 1,
        project: {
          name: "magickli-i18n-proof",
          framework: { kind: "nextjs", router: "app", srcDir: true },
          tooling: {
            dependencies: { config: "package.json", manager: "pnpm" },
            tasks: { config: "package.json", runner: "pnpm" },
          },
        },
        features: {},
      },
      null,
      2,
    )}\n`,
  );
  await mkdir(path.join(fixture, "src/app"), { recursive: true });
  await run(
    ["exec", "loom", "add", "lingui", "--cwd", fixture],
    "proof-loom.log",
    root,
  );
  // Pin the exact Lingui combination first verified in this proof; no app pins change.
  const pkgPath = path.join(fixture, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  for (const section of [pkg.dependencies, pkg.devDependencies])
    for (const name of Object.keys(section))
      if (name.startsWith("@lingui/"))
        section[name] = name === "@lingui/swc-plugin" ? "6.7.1" : "6.12.0";
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  await run(["install", "--prod=false"], "proof-install.log");
  for (const [source, target] of Object.entries(files)) {
    const destination = path.join(fixture, target);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(templates, `${source}.txt`), destination);
  }
  await copyFile(
    path.join(templates, "public-layout.tsx.txt"),
    path.join(fixture, "src/app/(offline)/layout.tsx"),
  );
  for (const group of [
    "(public)",
    "(private)",
    "(offline)",
    "(reader)/doc/[id]",
    "(localized)/[locale]",
    "(research)",
  ])
    await copyFile(
      path.join(templates, "not-found.tsx.txt"),
      path.join(fixture, "src/app", group, "not-found.tsx"),
    );
  for (const bundler of [
    "webpack",
    "turbopack",
    "webpack-local",
    "webpack-operator",
    "turbopack-local",
    "turbopack-operator",
  ]) {
    await writeFile(
      path.join(fixture, `tsconfig.${bundler}.json`),
      `${JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            lib: ["dom", "esnext"],
            jsx: "react-jsx",
            module: "esnext",
            moduleResolution: "bundler",
            skipLibCheck: true,
            esModuleInterop: true,
            strict: false,
            noEmit: true,
            plugins: [{ name: "next" }],
          },
          include: [
            "next-env.d.ts",
            "src/**/*",
            `.next-${bundler}/types/**/*.ts`,
          ],
          exclude: ["node_modules", ".next"],
        },
        null,
        2,
      )}\n`,
    );
  }
  const configPath = path.join(fixture, "lingui.config.ts");
  await writeFile(
    configPath,
    (await readFile(configPath, "utf8")).replace(
      'locales: ["en"]',
      'locales: ["en", "he"]',
    ),
  );
  await run(["i18n:extract"], "proof-extract.log");
  const poPath = path.join(fixture, "src/locales/he/messages.po");
  let po = await readFile(poPath, "utf8");
  for (const [english, hebrew] of [
    ["Compiler compatibility proof", "בדיקת תאימות המהדר"],
    ["Unsaved draft", "טיוטה שלא נשמרה"],
  ])
    po = po.replace(
      `msgid "${english}"\nmsgstr ""`,
      `msgid "${english}"\nmsgstr "${hebrew}"`,
    );
  await writeFile(poPath, po);
  await run(["i18n:compile"], "proof-compile.log");
}

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

async function verify(bundler: string, extra = {}, outputName = bundler) {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const log = createWriteStream(
    path.join(
      output,
      `proof-${bundler}-server-${Object.keys(extra).join("") || "normal"}.log`,
    ),
  );
  const server = spawn(
    process.execPath,
    [
      path.join(fixture, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: fixture,
      env: {
        ...environment,
        I18N_PROOF_OUTPUT: `.next-${outputName}`,
        ...extra,
      },
    },
  );
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  let browser: Browser | undefined;
  try {
    const deadline = Date.now() + 30_000;
    while (true) {
      try {
        await fetch(`${origin}/about`);
        break;
      } catch {
        assert(
          Date.now() < deadline && server.exitCode === null,
          "Fixture server did not start",
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (Object.keys(extra).length) {
      // Check static and dynamic documents built with each isolation flag.
      for (const route of [
        "/about",
        "/he/about",
        "/offline/ritual",
        "/temples",
        "/doc/public",
        "/doc/private",
      ]) {
        const html = await (await fetch(origin + route)).text();
        assert(
          html.includes('data-research="true"'),
          `${route}: missing isolated root`,
        );
        assert(
          !html.includes("data-emotion="),
          `${route}: ordinary MUI shell mounted`,
        );
      }
      return { isolation: extra };
    }
    const rows: {
      route: string;
      status: number;
      locale: string;
      cacheControl: string | null;
      serverErrorShell: boolean;
    }[] = [];
    const cases: [string, number, string, string, string?][] = [
      ["/about", 200, "en", "Compiler compatibility proof"],
      ["/he/about", 200, "he", "בדיקת תאימות המהדר"],
      [
        "/temples",
        200,
        "he",
        "Private working screen",
        "magickli-ui-locale=he",
      ],
      [
        "/doc/public",
        200,
        "en",
        "Published synthetic ritual",
        "magickli-ui-locale=he",
      ],
      [
        "/doc/private",
        200,
        "he",
        "Private downloaded-reader fallback",
        "magickli-ui-locale=he",
      ],
      ["/doc/unavailable", 200, "en", "Private downloaded-reader fallback"],
      ["/doc/deleted", 404, "en", "Not found"],
      ["/he/doc/public", 200, "he", "טקס לדוגמה"],
      ["/he/doc/private", 404, "he", "Not found"],
      ["/he/doc/unavailable", 500, "he", ""],
      [
        "/offline/ritual",
        200,
        "en",
        "Anonymous offline shell",
        "magickli-ui-locale=he",
      ],
      [
        "/doc/00000000-0000-7000-8000-000000000001",
        200,
        "en",
        "Anonymous offline shell",
      ],
      ["/chat/research", 200, "en", "Isolated synthetic research page"],
      ["/fr/about", 404, "en", "Not found"],
      ["/fr/doc/public", 404, "en", "Not found"],
      ["/en/doc/public", 404, "en", "Not found"],
      ["/he/temples", 404, "en", "Not found"],
      ["/he/he/about", 404, "en", "Not found"],
      ["/unknown", 404, "en", "Not found"],
    ];
    for (const [route, status, locale, text, cookie] of cases) {
      const response = await fetch(origin + route, {
        headers: cookie ? { cookie } : {},
        redirect: "manual",
      });
      const html = await response.text();
      assert.equal(response.status, status, `${route}: status`);
      const serverErrorShell = html.includes('id="__next_error__"');
      if (status === 200 || (status === 404 && !serverErrorShell)) {
        assert.match(
          html,
          new RegExp(`<html[^>]*lang="${locale}"`),
          `${route}: document locale`,
        );
        assert(html.includes(text), `${route}: content`);
      }
      if (status === 404)
        assert.match(
          html,
          /name="robots" content="noindex"/,
          `${route}: missing noindex`,
        );
      rows.push({
        route,
        status,
        locale,
        cacheControl: response.headers.get("cache-control"),
        serverErrorShell,
      });
    }
    const offline = rows.find((row) => row.route === "/offline/ritual");
    assert(
      offline && !/private|no-store/.test(offline.cacheControl ?? ""),
      "Offline shell must be anonymously cacheable",
    );
    assert.match(
      rows.find((row) => row.route === "/temples")?.cacheControl ?? "",
      /private|no-store/,
    );
    browser = await Browser.launch();
    await browser.send("Page.addScriptToEvaluateOnNewDocument", {
      source:
        "window.__proofErrors=[];window.addEventListener('error',e=>window.__proofErrors.push(String(e.message)));const old=console.error;console.error=(...args)=>{window.__proofErrors.push(args.map(String).join(' '));old(...args)};",
    });
    await browser.goto(`${origin}/temples`);
    await browser.waitFor("!!document.querySelector('#draft')");
    await browser.type("#draft", " Additional work");
    await browser.waitFor(
      "document.querySelector('#draft').value.includes('Additional work')",
    );
    await browser.evaluate(
      "window.__draftNode=document.querySelector('#draft');window.__draftNode.focus();window.__draftNode.setSelectionRange(2,7);window.__documentToken=Math.random();",
    );
    const before = (await browser.evaluate(
      "({value:document.querySelector('#draft').value,token:window.__documentToken})",
    )) as { value: string; token: number };
    await browser.click("#switch-locale");
    await browser.waitFor("document.documentElement.lang==='he'");
    assert.deepEqual(
      await browser.evaluate(
        "({value:document.querySelector('#draft').value,token:window.__documentToken})",
      ),
      before,
    );
    assert.equal(
      await browser.evaluate(
        "document.querySelector('#draft')===window.__draftNode",
      ),
      true,
      "RTL switch remounted the editor field",
    );
    assert.equal(
      await browser.evaluate(
        "getComputedStyle(document.querySelector('#direction-probe')).marginRight",
      ),
      "17px",
      "RTL styles did not switch",
    );
    await browser.click("#switch-locale");
    await browser.waitFor("document.documentElement.lang==='en'");
    assert.equal(
      await browser.evaluate(
        "getComputedStyle(document.querySelector('#direction-probe')).marginLeft",
      ),
      "17px",
    );
    const errors = await browser.evaluate("window.__proofErrors");
    assert.deepEqual(
      errors,
      [],
      "Browser errors during hydration/direction switching",
    );
    await browser.click("#view");
    await browser.waitFor("location.pathname==='/doc/public'");
    assert.equal(
      await browser.evaluate("window.__documentToken"),
      undefined,
      "Cross-root navigation did not replace the document",
    );
    await browser.goto(`${origin}/doc/deleted`);
    await browser.waitFor("document.body.innerText.includes('Not found')");
    await browser.goto(`${origin}/he/doc/private`);
    await browser.waitFor("document.body.innerText.includes('Not found')");
    return {
      rows,
      browser: {
        directionSwitchPreservedNodeAndDraft: true,
        hydrationErrors: errors,
        crossRootDocumentReload: true,
      },
    };
  } finally {
    await browser?.close();
    const stopped = new Promise<void>((resolve) =>
      server.once("close", () => resolve()),
    );
    server.kill("SIGTERM");
    await stopped;
    await new Promise<void>((resolve) => log.end(resolve));
  }
}

await mkdir(output, { recursive: true });
await prepare();
const inventory = await routeInventory(path.join(root, "src/app"));
await writeFile(
  path.join(output, "route-placement.json"),
  `${JSON.stringify(inventory, null, 2)}\n`,
);
const report = {
  node: process.versions.node,
  inventoryPages: inventory.length,
  bundlers: {},
};
for (const bundler of ["webpack", "turbopack"]) {
  console.log(`i18n proof: ${bundler}`);
  await run(
    ["exec", "next", "build", `--${bundler}`],
    `proof-${bundler}-build.log`,
    fixture,
    { I18N_PROOF_OUTPUT: `.next-${bundler}` },
  );
  report.bundlers[bundler] = await verify(bundler);
  for (const [mode, variable] of [
    ["local", "MAGICKLI_PRIVATE_RESEARCH_LOCAL"],
    ["operator", "MAGICKLI_PRIVATE_RESEARCH_OPERATOR"],
  ]) {
    const extra = { [variable]: "1" };
    const outputName = `${bundler}-${mode}`;
    await run(
      ["exec", "next", "build", `--${bundler}`],
      `proof-${outputName}-build.log`,
      fixture,
      { I18N_PROOF_OUTPUT: `.next-${outputName}`, ...extra },
    );
    await verify(bundler, extra, outputName);
  }
  await writeFile(
    path.join(output, "proof-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
console.log("i18n proof passed; output/i18n/proof-report.json");
