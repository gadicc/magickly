import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Browser } from "../docs-screenshots/browser.mts";

const origin = process.env.SEARCH_ORIGIN ?? "http://127.0.0.1:4187";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname))
  throw new Error("Use an isolated local preview");
const output = resolve(
  process.env.SEARCH_SCREENSHOTS ?? "/tmp/magickli-site-search",
);
mkdirSync(output, { recursive: true });
const browser = await Browser.launch();
try {
  await browser.viewport(1100, 850);
  await browser.goto(origin + "/kabbalah/tree");
  await browser.waitFor(
    "!!document.querySelector('button[aria-label=\"Search the site\"]')",
  );
  assert.equal(
    await browser.evaluate(
      "performance.getEntriesByType('resource').some(r => r.name.endsWith('/search/index'))",
    ),
    false,
  );
  await browser.click("button[aria-label='Search the site']");
  await browser.waitFor("!!document.querySelector('[role=dialog] input')");
  await browser.type("[role=dialog] input", "Planetary hours");
  await browser.waitFor(
    '!!document.querySelector(\'[aria-label="Search results"] a[href="/astrology/planetary-hours"]\')',
    90_000,
  );
  assert.equal(
    await browser.evaluate(
      "document.querySelector('[aria-label=\"Search results\"] a').getAttribute('href')",
    ),
    "/astrology/planetary-hours",
  );
  await browser.evaluate("document.querySelector('nextjs-portal')?.remove()");
  writeFileSync(resolve(output, "desktop.webp"), await browser.screenshot());
  await browser.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowDown",
    code: "ArrowDown",
    windowsVirtualKeyCode: 40,
  });
  assert.equal(
    await browser.evaluate("document.activeElement.getAttribute('href')"),
    "/astrology/planetary-hours",
  );
  await browser.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowDown",
    code: "ArrowDown",
    windowsVirtualKeyCode: 40,
  });
  await browser.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await browser.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });

  await browser.waitFor(
    "![...document.querySelectorAll('[role=dialog]')].some(el => el.textContent.includes('Search Magick.ly'))",
  );
  assert.equal(
    await browser.evaluate("document.activeElement.getAttribute('aria-label')"),
    "Search the site",
  );

  await browser.viewport(390, 844, true);
  await browser.click("button[aria-label='Search the site']");
  await browser.waitFor("!!document.querySelector('[role=dialog] input')");
  await browser.evaluate(
    "document.querySelector('[role=dialog] input').select()",
  );
  await browser.send("Input.insertText", { text: "מיכאל" });
  await browser.waitFor(
    "!!document.querySelector('[aria-label=\"Search results\"] a')",
  );
  assert.equal(
    await browser.evaluate(
      "document.documentElement.scrollWidth <= innerWidth",
    ),
    true,
  );
  await browser.evaluate("document.querySelector('nextjs-portal')?.remove()");
  writeFileSync(resolve(output, "phone.webp"), await browser.screenshot());
  console.log(
    JSON.stringify({
      outcome: "passed",
      checks: [
        "lazy loading",
        "destination ranking",
        "keyboard navigation",
        "Escape/focus restoration",
        "Hebrew search",
        "phone layout",
      ],
      screenshots: output,
    }),
  );
} finally {
  await browser.close();
}
