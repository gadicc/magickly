/**
 * Regenerates the images used by the help pages, from synthetic data only.
 * See scripts/docs-screenshots/README.md.
 *
 *   pnpm docs-screenshots:seed      # once, idempotent
 *   pnpm docs-screenshots:capture   # with `./dev` running on :3004
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Browser } from "./browser.mts";

const base = process.env.DOCS_SCREENSHOTS_ORIGIN ?? "http://localhost:3004";
const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/app/help/temples/images",
);
const only = process.argv.slice(2);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DESKTOP = [1100, 800] as const;
const PHONE = [390, 844] as const;
const text = (t: string) => JSON.stringify(t);

type Persona = "creator" | "reader";

interface Shot {
  /** File name under src/app/help/temples/images, without extension. */
  name: string;
  persona: Persona;
  viewport?: readonly [number, number];
  /** Page to open; may be computed from links on an earlier page. */
  open: (b: Browser) => Promise<void>;
  /** Clip expression; omitted means the whole viewport. */
  clip?: string;
  /** CSS pixels kept around the clipped elements. */
  padding?: number;
}

async function hrefOf(
  b: Browser,
  path: string,
  selector: string,
  label: string,
) {
  await b.goto(base + path);
  await b.waitFor(
    `[...document.querySelectorAll(${text(selector)})].some((e) => e.textContent.trim() === ${text(label)} || e.getAttribute('aria-label') === ${text(label)})`,
  );
  return b.evaluate<string>(
    `[...document.querySelectorAll(${text(selector)})].find((e) => e.textContent.trim() === ${text(label)} || e.getAttribute('aria-label') === ${text(label)}).getAttribute('href')`,
  );
}

const templeAdminPath = (b: Browser) =>
  hrefOf(b, "/temples/admin", "a", "Example");
const ritualPath = (b: Browser, title: string) =>
  hrefOf(b, "/gd/rituals", "a", title);

const editorReady = `!!document.querySelector('.cm-content, [contenteditable="true"]')`;

async function editor(b: Browser, mode: "visual" | "source" | "split") {
  const path = await ritualPath(b, "Neophyte 0=0");
  await b.goto(`${base}${path}/edit/semantic`);
  await b.waitFor(editorReady);
  await sleep(1500);
  await b.click("button", mode);
  await sleep(800);
}

/**
 * Readers only receive a ritual once its saved version is published, which
 * seeding does not do; press Publish in the editor like an administrator would.
 */
async function publish(b: Browser, title: string) {
  const path = await ritualPath(b, title);
  await b.goto(`${base}${path}/edit/semantic`);
  await b.waitFor(editorReady);
  await sleep(1500);
  await b.click("button", "Publish");
  await b.waitFor(
    `document.body.textContent.includes('ublished for download')`,
    60_000,
  );
}

const shots: Shot[] = [
  {
    name: "(publish)",
    persona: "creator",
    open: (b) => publish(b, "Neophyte 0=0"),
  },
  {
    name: "my-temples",
    persona: "reader",
    viewport: [1000, 460],
    open: (b) => b.goto(`${base}/temples`),
  },
  {
    name: "create-temple",
    persona: "creator",
    open: (b) => b.goto(`${base}/temples/admin`),
    clip: `[...byTextAll('h5', 'Create a new temple'), document.querySelector('form')]`,
  },
  {
    name: "members",
    persona: "creator",
    open: async (b) => b.goto(base + (await templeAdminPath(b))),
    clip: `[...byTextAll('h5', 'Example Temple'), document.querySelector('table').closest('.MuiTableContainer-root')]`,
  },
  {
    name: "join-code",
    persona: "creator",
    open: async (b) => b.goto(base + (await templeAdminPath(b))),
    clip: `[...byTextAll('h6', 'Join information'), document.querySelector('canvas, svg[aria-label^="Join"], img[aria-label^="Join"]')]`,
  },
  {
    name: "edit-member",
    persona: "creator",
    open: async (b) => {
      const path = await templeAdminPath(b);
      const edit = await hrefOf(b, path, "a", "Edit Synthetic Member B");
      await b.goto(base + edit);
    },
    clip: `[document.querySelector('h5'), ...document.querySelectorAll('form')]`,
  },
  {
    name: "remove-member",
    persona: "creator",
    open: async (b) => {
      const path = await templeAdminPath(b);
      const edit = await hrefOf(b, path, "a", "Edit Synthetic Member B");
      await b.goto(base + edit);
      await b.click("button", "Remove from temple");
      await b.waitFor(
        `[...document.querySelectorAll('.MuiDialog-paper')].some((e) => e.textContent.includes('Remove member'))`,
      );
      await sleep(500);
    },
    clip: `[...document.querySelectorAll('.MuiDialog-paper')].filter((e) => e.textContent.includes('Remove member'))`,
    padding: 0,
  },
  {
    name: "create-ritual",
    persona: "creator",
    open: async (b) => {
      await b.goto(`${base}/gd/rituals`);
      await b.waitFor(`document.body.textContent.includes('Create ritual')`);
      await b.click(".MuiTextField-root", "Visibility");
      await b.click(`[role="option"]`, "Example");
      await b.waitFor(`document.body.textContent.includes('Min Grade')`);
    },
    clip: `[...byTextAll('h6', 'Create ritual'), ...document.querySelectorAll('form > .MuiTextField-root, form > .MuiFormControl-root')]`,
    padding: 6,
  },
  {
    name: "ritual-access",
    persona: "creator",
    viewport: [1100, 800],
    open: async (b) => {
      const path = await ritualPath(b, "Zelator 1=10 (sample)");
      await b.goto(`${base}${path}/edit/semantic`);
      await b.waitFor(editorReady);
      await sleep(1500);
      await b.click("button", "More editor actions");
      await sleep(400);
      await b.click("li", "Who can read this ritual");
      await b.waitFor(
        `document.body.textContent.includes('can currently be read by')`,
      );
      await sleep(500);
    },
    clip: `[...document.querySelectorAll('.MuiDialog-paper')].filter((e) => e.textContent.includes('Who can read this ritual'))`,
    padding: 0,
  },
  {
    name: "ritual-list-grade-1",
    persona: "reader",
    viewport: [1000, 800],
    open: (b) => b.goto(`${base}/gd/rituals`),
    clip: `[document.querySelector('table').closest('.MuiTableContainer-root')]`,
  },
  {
    name: "editor-split",
    persona: "creator",
    viewport: [1280, 800],
    open: (b) => editor(b, "split"),
  },
  {
    name: "editor-source",
    persona: "creator",
    viewport: [1280, 800],
    open: (b) => editor(b, "source"),
  },
  {
    name: "editor-visual",
    persona: "creator",
    viewport: [1280, 800],
    open: (b) => editor(b, "visual"),
  },
  {
    name: "editor-phone",
    persona: "creator",
    viewport: PHONE,
    open: (b) => editor(b, "visual"),
  },
  {
    name: "reader-phone",
    persona: "reader",
    viewport: PHONE,
    open: async (b) => {
      const path = await ritualPath(b, "Neophyte 0=0");
      await b.goto(base + path);
      await b.waitFor(
        `document.body.textContent.includes('Opening of the Hall of the Neophytes')`,
      );
    },
  },
];

const helpers = `
  const byTextAll = (sel, t) => [...document.querySelectorAll(sel)].filter((e) => e.textContent.trim() === t);
`;

async function signIn(b: Browser, persona: Persona) {
  await b.clearSiteData();
  await b.goto(`${base}/signin`);
  await b.click("button", persona === "creator" ? "Creator" : "Reader");
  await b.waitFor(`location.pathname !== '/signin'`);
  await sleep(1500);
}

mkdirSync(outDir, { recursive: true });
const browser = await Browser.launch();
try {
  let current: Persona | null = null;
  let failed = 0;
  for (const shot of shots) {
    if (only.length && !only.includes(shot.name) && !shot.name.startsWith("("))
      continue;
    try {
      if (shot.persona !== current) {
        await signIn(browser, shot.persona);
        current = shot.persona;
      }
      const [w, h] = shot.viewport ?? DESKTOP;
      await browser.viewport(w, h, w < 500);
      await shot.open(browser);
      await sleep(600);
      await browser.evaluate(
        `document.querySelectorAll('nextjs-portal').forEach((e) => e.remove()); ${helpers} window.byTextAll = byTextAll;`,
      );
      if (shot.name.startsWith("(")) {
        console.log(`ok    ${shot.name}`);
        continue;
      }
      const image = await browser.screenshot(shot.clip, shot.padding);
      writeFileSync(join(outDir, `${shot.name}.webp`), image);
      console.log(`ok    ${shot.name} (${Math.round(image.length / 1024)} kB)`);
    } catch (error) {
      failed++;
      console.error(`FAIL  ${shot.name}: ${(error as Error).message}`);
    }
  }
  if (failed) process.exitCode = 1;
} finally {
  await browser.close();
}
