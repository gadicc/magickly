import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Cite from "./Cite";
import {
  MIRRORED_PAGES,
  type MirroredPageKey,
  type Scan,
} from "./mirroredPages";
import {
  citeUrl,
  mirrorOf,
  WORKS,
  type Work,
  type WorkId,
  workUrl,
} from "./works";

const ids = Object.keys(WORKS) as WorkId[];

describe("the works the site cites", () => {
  it("are each scanned once", () => {
    const scans = ids.map((id) => {
      const scan = WORKS[id].scan;
      return scan.site === "archive.org"
        ? `${scan.item}/${"file" in scan ? scan.file : ""}`
        : scan.id;
    });
    expect(new Set(scans).size).toBe(scans.length);
  });

  it("link a leaf, a printed page and the whole book", () => {
    expect(citeUrl("agrippa1533", { leaf: 164 })).toBe(
      "https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n164/mode/1up",
    );
    expect(citeUrl("equinoxI2", { leaf: 266 })).toBe(
      "https://archive.org/details/crowley-equinox_202110/The%20Equinox%20Vol.%201%2C%20No.%202/page/n266/mode/1up",
    );
    expect(citeUrl("lenainReissue", { page: 46 })).toBe(
      "https://books.google.com/books?id=ZqgpxTZ43HkC&pg=PA46",
    );
    expect(citeUrl("lenainReissue", { page: "vj", front: true })).toBe(
      "https://books.google.com/books?id=ZqgpxTZ43HkC&pg=PRvj",
    );
    // An unnumbered preliminary page, by Google's count: the 1823
    // printing's title page (plan 096, Y0).
    expect(citeUrl("lenain1823", { page: 11, preliminary: true })).toBe(
      "https://books.google.com/books?id=qt9SAAAAcAAJ&pg=PP11",
    );
    expect(workUrl("lenain1823")).toBe(
      "https://books.google.com/books?id=qt9SAAAAcAAJ",
    );
  });

  it("are never mirrored where they are not public domain", () => {
    // Regardie, James and anything unsettled are linked, never shown
    // (AGENTS.md "Outside sources"; plan 091).
    for (const key of Object.keys(MIRRORED_PAGES) as MirroredPageKey[]) {
      const scan: Scan = MIRRORED_PAGES[key].scan;
      for (const id of ids) {
        const work: Work = WORKS[id];
        if (work.rights === "public-domain") continue;
        const same =
          work.scan.site === scan.site &&
          (scan.site === "archive.org"
            ? "item" in work.scan && work.scan.item === scan.item
            : scan.site === "Google Books" &&
              "id" in work.scan &&
              work.scan.id === scan.id);
        expect(same, `${key} mirrors ${id}`).toBe(false);
      }
    }
  });

  it("find every mirrored page of theirs", () => {
    // A mirror added for a registered work is picked up by every <Cite>.
    for (const key of Object.keys(MIRRORED_PAGES) as MirroredPageKey[]) {
      const scan: Scan = MIRRORED_PAGES[key].scan;
      const id = ids.find((each) => {
        const work: Work["scan"] = WORKS[each].scan;
        return scan.site === "archive.org"
          ? work.site === "archive.org" &&
              work.item === scan.item &&
              !("file" in work)
          : scan.site === "Google Books" &&
              work.site === "Google Books" &&
              work.id === scan.id;
      });
      if (!id || scan.site === "Wikimedia Commons") continue;
      const at =
        scan.site === "archive.org" ? { leaf: scan.leaf } : { page: scan.page };
      expect(mirrorOf(id, at as never), key).toBe(key);
    }
  });
});

describe("a citation", () => {
  it("opens the site's mirror where it has the page", () => {
    const html = renderToString(
      <Cite work="agrippa1533" leaf={164} region="kameaSigils" plain>
        leaf 164
      </Cite>,
    );
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain(
      'href="https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n164/mode/1up"',
    );
    expect(html).toContain(">leaf 164</a>");
  });

  it("links the scan's page where it has not", () => {
    const html = renderToString(
      <Cite work="regardie1938" leaf={54} plain rel="noreferrer">
        60
      </Cite>,
    );
    expect(html).toBe(
      '<a href="https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol2-1938/page/n54/mode/1up" rel="noreferrer">60</a>',
    );
  });

  it("links an unnumbered preliminary page, never to the mirror", () => {
    const html = renderToString(
      <Cite work="lenain1823" page={11} preliminary plain rel="noreferrer">
        title page
      </Cite>,
    );
    expect(html).toBe(
      '<a href="https://books.google.com/books?id=qt9SAAAAcAAJ&amp;pg=PP11" rel="noreferrer">title page</a>',
    );
    // The same number in the body is another page.
    expect(citeUrl("lenain1823", { page: 11 })).toBe(
      "https://books.google.com/books?id=qt9SAAAAcAAJ&pg=PA11",
    );
    expect(mirrorOf("lenain1823", { page: 11, preliminary: true })).toBe(
      undefined,
    );
  });
});
