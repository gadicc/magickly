import { describe, expect, it } from "vitest";
import {
  LAZY_JS_CEILING,
  precacheUrls,
  type ThreeBuild,
  threeBuildProblems,
} from "./checkThreeBuild.mts";

const THREE = "static/chunks/c23c07e0.85c2.js";
const VIEW = "static/chunks/tablet3d.5544.js";
const SHARED = "static/chunks/3441-f3e7.js";
const PAGE = "static/chunks/app/enochian/tablets/page-1a2b.js";
const MAIN = "static/chunks/main-app-9f8e.js";

/** A worker whose precache lists these files, as Serwist writes it. */
const worker = (...files: string[]) =>
  `self.__SW_MANIFEST=[${files.map((file) => `{'revision':null,'url':'/_next/${file}'}`).join(",")}];`;

/** A build that keeps the 3D view off the flat page. */
const good = (): ThreeBuild => ({
  threeChunks: {
    chunks: [
      { id: 1506, files: [VIEW] },
      { id: 9654, files: [THREE] },
    ],
    lazyFiles: [THREE, SHARED, VIEW],
  },
  buildManifest: { rootMainFiles: [MAIN], polyfillFiles: [] },
  clientManifests: {
    "/enochian/tablets/page": {
      clientModules: {
        // Ids and files in turn, as Next writes them.
        tablets: { chunks: ["8123", PAGE] },
        loader: { chunks: ["8123", PAGE] },
      },
    },
    "/_not-found/page": {
      clientModules: { theme: { chunks: ["3441", SHARED] } },
    },
  },
  serviceWorker: worker(MAIN, PAGE, SHARED, "static/css/a.css"),
  gzipBytes: () => 10 * 1024,
});

describe("checkThreeBuild (plan 101, invariant 3)", () => {
  it("passes a build that keeps the 3D view off the flat page", () => {
    expect(threeBuildProblems(good())).toEqual({
      problems: [],
      lazyBytes: 30 * 1024,
    });
  });

  it("reads Serwist's precache list, quoted either way", () => {
    expect(
      precacheUrls(`[{"revision":"1","url":"/a.js"},{url:'/b.js'}]`),
    ).toEqual(["/a.js", "/b.js"]);
  });

  it("fails when the list is empty, so a lost import cannot pass", () => {
    for (const threeChunks of [null, { chunks: [], lazyFiles: [] }])
      expect(
        threeBuildProblems({ ...good(), threeChunks }).problems,
      ).toContainEqual(expect.stringMatching(/lists no chunk/));
  });

  it("fails when a 3D chunk is on any page's first load", () => {
    const shared = good();
    shared.buildManifest.rootMainFiles = [MAIN, `/${THREE}`];
    expect(threeBuildProblems(shared).problems).toContain(
      `${THREE} is on the first load of every page (rootMainFiles)`,
    );
    const polyfill = good();
    polyfill.buildManifest.polyfillFiles = [VIEW];
    expect(threeBuildProblems(polyfill).problems).toContain(
      `${VIEW} is on the first load of every page (polyfillFiles)`,
    );
    const page = good();
    page.clientManifests["/enochian/tablets/page"].clientModules = {
      loader: { chunks: ["1506", VIEW] },
    };
    expect(threeBuildProblems(page).problems).toContain(
      `${VIEW} is on the first load of /enochian/tablets/page`,
    );
  });

  it("reads chunks Next writes with a deployment's query, or encoded", () => {
    // Vercel sets NEXT_DEPLOYMENT_ID, and Next then writes every client
    // manifest chunk as `encodeURIPath(file)?dpl=<id>`.
    const dpl = (file: string) => `/_next/${encodeURI(file)}?dpl=dpl_abc`;
    const build = good();
    delete build.clientManifests["/_not-found/page"];
    build.clientManifests["/enochian/tablets/page"].clientModules = {
      loader: { chunks: ["1506", dpl(VIEW)] },
      theme: { chunks: ["3441", dpl(SHARED)] },
      app: { chunks: ["77", dpl("static/chunks/app/[tablet]/page-1.js")] },
    };
    build.serviceWorker = worker(
      MAIN,
      PAGE,
      "static/chunks/app/%5Btablet%5D/page-1.js",
    );
    expect(threeBuildProblems(build).problems).toEqual([
      `${VIEW} is on the first load of /enochian/tablets/page`,
      `${SHARED} is on a first load but not precached`,
    ]);
  });

  it("fails when a 3D chunk is precached", () => {
    const build = good();
    build.serviceWorker = worker(MAIN, PAGE, SHARED, THREE);
    expect(threeBuildProblems(build).problems).toEqual([
      `${THREE} is in the service worker's precache`,
    ]);
  });

  it("fails when leaving the 3D chunks out leaves out another page's chunk", () => {
    const build = good();
    build.serviceWorker = worker(MAIN, PAGE);
    expect(threeBuildProblems(build).problems).toEqual([
      `${SHARED} is on a first load but not precached`,
    ]);
  });

  it("fails without a service worker or a precache list to read", () => {
    expect(
      threeBuildProblems({ ...good(), serviceWorker: null }).problems,
    ).toEqual(["no service worker to read"]);
    expect(
      threeBuildProblems({ ...good(), serviceWorker: "self.x=[]" }).problems,
    ).toEqual(["the service worker has no precache list to read"]);
  });

  it("fails without client manifests, except on Vercel", () => {
    const build = { ...good(), clientManifests: {} };
    expect(threeBuildProblems(build).problems).toEqual([
      "no client reference manifests to read",
    ]);
    expect(threeBuildProblems({ ...build, vercel: true }).problems).toEqual([]);
  });

  it("fails when the lazy JS is over its ceiling", () => {
    const build = { ...good(), gzipBytes: () => LAZY_JS_CEILING / 2 };
    expect(threeBuildProblems(build).problems).toEqual([
      "the lazy JS is 300.0 KB gzipped, over its 200 KB",
    ]);
  });
});
