/**
 * After `next build`: that the build registered `src/proxy.ts` and the
 * angels' `.rsc` rewrite as src/proxyRegistration.test.ts expects, read
 * from the manifests Next writes and Vercel deploys from (plan 096,
 * decision 3), and that the angel page's prerendered segments are the ones
 * the proxy lets through. A build without them works, and keeps a 404 for
 * every made-up sigil file name asked for, so this fails the build instead.
 *
 *   node --import tsx scripts/checkProxyBuild.mts [.next]
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ANGEL_PAGE_SEGMENTS } from "../src/seo/angelSigilFileGuard";
import { angelSigilRoutingProblems } from "../src/seo/angelSigilRouting";

const dist = process.argv[2] ?? ".next";
const read = (file: string) =>
  JSON.parse(readFileSync(path.join(dist, file), "utf8"));

const functions = read("server/functions-config-manifest.json").functions;
const routes = read("routes-manifest.json");
const beforeFiles = Array.isArray(routes.rewrites)
  ? []
  : (routes.rewrites?.beforeFiles ?? []);

// The angel page's segments as the build wrote them, by path.
const angels = path.join(dist, "server/app/kabbalah/angel");
const segmentPaths: string[] = [];
const twoDeep = new Set<string>();
for (const entry of readdirSync(angels, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.endsWith(".segments")) continue;
  const files = readdirSync(path.join(angels, entry.name), {
    recursive: true,
  }) as string[];
  for (const file of files) {
    if (!file.endsWith(".segment.rsc")) continue;
    const posix = file.split(path.sep).join("/");
    segmentPaths.push(`/kabbalah/angel/${entry.name}/${posix}`);
    if (!posix.includes("/")) twoDeep.add(posix.replace(/\.segment\.rsc$/, ""));
  }
}

const problems = angelSigilRoutingProblems({
  matchers: functions["/_middleware"]?.matchers ?? [],
  rewrites: beforeFiles,
  segmentPaths,
});
if (segmentPaths.length === 0)
  problems.push(`no prerendered segments of the angel page under ${angels}`);
const expected = [...ANGEL_PAGE_SEGMENTS].sort();
if (JSON.stringify([...twoDeep].sort()) !== JSON.stringify(expected))
  problems.push(
    `the angel page's segments are ${[...twoDeep].sort().join(", ")}, not ANGEL_PAGE_SEGMENTS's ${expected.join(", ")}`,
  );

if (problems.length > 0) {
  console.error(
    `checkProxyBuild: the angels' sigil files are not guarded (plan 096, decision 3):\n${problems
      .slice(0, 20)
      .map((line) => `- ${line}`)
      .join(
        "\n",
      )}${problems.length > 20 ? `\n… ${problems.length - 20} more` : ""}`,
  );
  process.exit(1);
}
console.log(
  `checkProxyBuild: the proxy and the .rsc rewrite are registered; ${segmentPaths.length} segments of the angel page pass.`,
);
