import exceptions from "magick-data/astrology/planetaryNameExceptions";
import names, {
  PLANETARY_NAME_WITNESSES,
  readingOf,
} from "magick-data/astrology/planetaryNames";
import { describe, expect, it } from "vitest";
import { AGRIPPA_SQUARE_LEAVES } from "./kameaPlanets";
import {
  AGRIPPA_LEAF_PAGES,
  EEBO_1651,
  leafNumbers,
  leafRef,
  mirroredLeaf,
  readingLeaves,
  WITNESS_ITEMS,
  WITNESS_LABELS,
} from "./witnesses";

describe("the witnesses' leaves", () => {
  it("read a leaf or a run of two", () => {
    expect(leafNumbers("n163")).toEqual([163]);
    expect(leafNumbers("n181–n182")).toEqual([181, 182]);
    for (const bad of ["163", "n", "n181-n182", "n182–n181", "p. 243"])
      expect(() => leafNumbers(bad), bad).toThrow();
  });

  it("parse every leaf the names and their exceptions give", () => {
    for (const name of Object.values(names))
      for (const witness of PLANETARY_NAME_WITNESSES) {
        const leaf = readingOf(name, witness)?.leaf;
        if (leaf) expect(leafNumbers(leaf).length, name.id).toBeGreaterThan(0);
      }
    for (const row of Object.values(exceptions))
      expect(leafNumbers(row.leaf).length, row.id).toBeGreaterThan(0);
  });

  it("label and locate every witness", () => {
    expect(Object.keys(WITNESS_LABELS)).toEqual([...PLANETARY_NAME_WITNESSES]);
    expect(Object.keys(WITNESS_ITEMS)).toEqual([...PLANETARY_NAME_WITNESSES]);
  });

  it("open Agrippa's names leaves in the lightbox, outlining the planet's", () => {
    expect(mirroredLeaf("DeOccultaPhilosophiaLoc1533", 163)).toBe("agrippa148");
    expect(mirroredLeaf("DeOccultaPhilosophiaLoc1533", 165)).toBeUndefined();
    const [agiel] = readingLeaves(
      "agrippa1533",
      readingOf(names.agiel, "agrippa1533")!,
      "saturn",
    );
    expect(agiel).toEqual({
      item: "DeOccultaPhilosophiaLoc1533",
      leaf: 163,
      href: "https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n163/mode/1up",
      mirror: { page: "agrippa148", region: "saturn" },
    });
    // The Moon's names are on the next leaf, under its own region.
    expect(
      readingLeaves(
        "agrippa1533",
        readingOf(names.chasmodai, "agrippa1533")!,
        "luna",
      )[0].mirror,
    ).toEqual({ page: "agrippa149", region: "luna" });
    // A region the page does not have leaves the page's own outline.
    expect(leafRef("DeOccultaPhilosophiaLoc1533", 164, "mars").mirror).toEqual({
      page: "agrippa149",
    });
  });

  it("link another copy where a reading was made in it", () => {
    const [malcha] = readingLeaves(
      "agrippa1651",
      readingOf(names["malcha-betharsisim"], "agrippa1651")!,
    );
    expect(malcha.item).toBe(EEBO_1651);
    expect(malcha.href).toBe(
      `https://archive.org/details/${EEBO_1651}/page/n271/mode/1up`,
    );
    expect(malcha.mirror).toBeUndefined();
    // Barrett's Mars names run over two leaves, each linked.
    expect(
      readingLeaves(
        "barrett1801",
        readingOf(names.graphiel, "barrett1801")!,
      ).map((leaf) => leaf.href),
    ).toEqual([
      "https://archive.org/details/b22006795/page/n181/mode/1up",
      "https://archive.org/details/b22006795/page/n182/mode/1up",
    ]);
    expect(readingLeaves("crowley777", {})).toEqual([]);
  });

  it("number Agrippa's leaves as the squares' pages do", () => {
    for (const [planet, { leaf, page }] of Object.entries(
      AGRIPPA_SQUARE_LEAVES,
    ))
      expect(AGRIPPA_LEAF_PAGES[leaf], planet).toBe(page);
    // The chapter's pages run on, a leaf a page, from n160's CXLV.
    expect(Object.keys(AGRIPPA_LEAF_PAGES).map(Number)).toEqual([
      160, 161, 162, 163, 164, 165, 166, 167, 168,
    ]);
  });
});
