import { createHash } from "node:crypto";
import kameas, { KAMEA_PLANETS } from "magick-data/astrology/kameas";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROSE_SIGIL_PROFILE, roseSigilLayout } from "../gd/roseSigilLayout.ts";
import {
  KAMEA_SIGIL_PITCH,
  kameaLayout,
  kameaSigilMinSize,
} from "../sigil/kameaLayout.ts";
import { kameaNameCases } from "../sigil/oracle/kameaCorpus.ts";
import KameaSigil, { KameaSigilImage, kameaSigil } from "./KameaSigil.tsx";

/** The `<svg>`s drawn, each as its opening tag. */
const svgs = (markup: string) => markup.match(/<svg [^>]*>/g) ?? [];

/** The sigil's ink: the path data in its red group, in drawing order. */
const ink = (markup: string) =>
  [
    ...markup.matchAll(
      /<g stroke="([^"]+)" stroke-width="[^"]+" fill="none">(.*?)<\/g>/g,
    ),
  ].map(([, , paths]) => [...paths.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]));

/**
 * Path data moved `dx` along x, token by token: every coordinate pair,
 * not an arc's radii or flags.
 */
const moved = (d: string, dx: number): string[] => {
  let command = "";
  let index = 0;
  return d.split(" ").map((token) => {
    if (/^[A-Z]$/.test(token)) {
      command = token;
      index = 0;
      return token;
    }
    index++;
    // An arc's radii, rotation and flags come before its end point.
    if (command === "A" && index < 4) return token;
    const [x, y] = token.split(",").map(Number);
    return `${Math.round((x + dx) * 1000) / 1000},${y}`;
  });
};

/** One traced name per planet, the first the pages trace on its square. */
const names = KAMEA_PLANETS.map(
  (planet) =>
    kameaNameCases().find((c) => c.planet === planet && !c.finals) as {
      planet: typeof planet;
      text: string;
    },
);

describe("KameaSigil", () => {
  it("draws a traced name on every planet's square, under the sigil", () => {
    for (const { planet, text } of names) {
      const markup = renderToStaticMarkup(
        <KameaSigil planet={planet} text={text} />,
      );
      const order = kameas[planet].length;
      // The square's numbers, then the sigil's ink at the rule's width.
      const numbers = [...markup.matchAll(/<text [^>]*>(\d+)<\/text>/g)];
      expect(numbers, planet).toHaveLength(order * order);
      expect(markup, planet).toContain('stroke="red" stroke-width="0.6"');
      expect(ink(markup).flat().length, planet).toBeGreaterThan(0);
      expect(markup, planet).not.toContain("data-placement");
      expect(kameaSigil(planet, text).failed, planet).toBe(false);
    }
  });

  it("draws each word of a name as its own figure, right to left, wrapping", () => {
    // The spirit of spirits, as its romanisation divides it (decision 10).
    const text = "שדברשהמעת שרתתן";
    const markup = renderToStaticMarkup(
      <KameaSigil planet="luna" text={text} />,
    );
    expect(markup).toMatch(
      /^<div dir="rtl" style="display:flex;flex-wrap:wrap" role="img" aria-label="Sigil of שדברשהמעת שרתתן on the Kamea of Luna">/,
    );
    const words = svgs(markup);
    expect(words).toHaveLength(2);
    for (const svg of words) {
      expect(svg).toContain('viewBox="-50 -50 100 100"');
      expect(svg).toContain('width="329" height="329"');
      expect(svg).toContain('aria-hidden="true"');
    }
    // The same figures as the one-row image, placed once for the text.
    const row = renderToStaticMarkup(
      <KameaSigilImage planet="luna" text={text} />,
    );
    expect(svgs(row)).toHaveLength(1);
    expect(row).toContain('viewBox="-150 -50 200 100"');
    expect(row).toContain('width="658" height="329"');
    const sigil = kameaSigil("luna", text);
    expect(sigil.words).toHaveLength(2);
    sigil.words.forEach((word, i) => {
      expect(word.placed[0]).toBe(sigil.figure.placed[i]);
      expect(word.viewBox).toEqual([-50, -50, 100, 100]);
    });
    // Each word's ink, moved into its region of the row, is the row's,
    // token by token.
    const rowPaths = sigil.figure.paths;
    let at = 0;
    sigil.words.forEach((word, i) => {
      for (const d of word.paths) {
        expect(moved(d, -i * KAMEA_SIGIL_PITCH)).toEqual(
          rowPaths[at].split(" ").map((t) => {
            if (!t.includes(",")) return t;
            const [x, y] = t.split(",");
            return `${Number(x)},${y}`;
          }),
        );
        at++;
      }
    });
    expect(at).toBe(rowPaths.length);
    expect(ink(row)[0]).toEqual(rowPaths);
  });

  it("sets a long name in rows when asked, the last row centred", () => {
    const text = "מלכא בתרשיתים עד ברוח שחקים";
    const sigil = kameaSigil("luna", text);
    const markup = renderToStaticMarkup(
      <KameaSigilImage planet="luna" text={text} sigil={sigil} columns={2} />,
    );
    expect(svgs(markup)).toHaveLength(1);
    // Two a row, three rows: a full row wide, a square a row high.
    expect(markup).toContain('viewBox="-150 -50 200 300"');
    expect(markup).toContain('width="658" height="987"');
    expect(markup).toContain(
      'aria-label="Sigil of מלכא בתרשיתים עד ברוח שחקים on the Kamea of Luna"',
    );
    // Right to left, top to bottom; the fifth word alone, centred.
    const places = ["0 0", "-100 0", "0 100", "-100 100", "-50 200"];
    const squares = [
      ...markup.matchAll(/<g transform="translate\(([^)]+)\)"><rect/g),
    ].map((m) => m[1]);
    // The first square sits at the origin, untranslated, as in a row.
    expect(squares).toEqual(places.slice(1));
    const words = [
      ...markup.matchAll(
        /<g transform="translate\(([^)]+)\)">((?:<path [^>]*><\/path>)+)<\/g>/g,
      ),
    ];
    expect(words.map((m) => m[1])).toEqual(places);
    // Each word's own figure, moved whole: the generator's figures.
    words.forEach(([, , paths], i) =>
      expect([...paths.matchAll(/ d="([^"]+)"/g)].map((m) => m[1])).toEqual(
        sigil.words[i].paths,
      ),
    );
    // Without rows, or with as many a row as there are words, one row.
    const row = renderToStaticMarkup(
      <KameaSigilImage planet="luna" text={text} sigil={sigil} />,
    );
    for (const columns of [5, 6, 0, 1.5])
      expect(
        renderToStaticMarkup(
          <KameaSigilImage
            planet="luna"
            text={text}
            sigil={sigil}
            columns={columns}
          />,
        ),
      ).toBe(row);
  });

  it("counts finals at 500 to 900 only when asked", () => {
    // Mem final: 40 as Mem, 600 (60) with finals, on the Moon's square.
    const plain = kameaSigil("luna", "אם");
    const finals = kameaSigil("luna", "אם", { finals: true });
    const luna = kameaLayout("luna");
    expect(plain.figure.plan[0].map((v) => v.place)).toEqual([
      luna.place("א"),
      luna.place("מ"),
    ]);
    expect(finals.figure.plan[0].map((v) => v.place)).toEqual([
      luna.place("א"),
      luna.place("ס"),
    ]);
    expect(
      ink(renderToStaticMarkup(<KameaSigil planet="luna" text="אם" finals />)),
    ).not.toEqual(
      ink(renderToStaticMarkup(<KameaSigil planet="luna" text="אם" />)),
    );
  });

  it("never draws a figure under its square's minimum", () => {
    const width = (size?: number) =>
      svgs(
        renderToStaticMarkup(
          <KameaSigil planet="luna" text="אגיאל" size={size} />,
        ),
      )[0]?.match(/width="([\d.]+)"/)?.[1];
    expect(width()).toBe("329");
    expect(width(100)).toBe("329");
    expect(width(Number.NaN)).toBe("329");
    expect(width(400)).toBe("400");
    expect(
      svgs(
        renderToStaticMarkup(
          <KameaSigil planet="saturn" text="זאזל" size={200} />,
        ),
      )[0],
    ).toContain('width="240" height="240"');
    for (const planet of KAMEA_PLANETS)
      expect(
        svgs(renderToStaticMarkup(<KameaSigil planet={planet} text="א" />))[0],
      ).toContain(`width="${kameaSigilMinSize(planet)}"`);
  });

  it("draws a figure placement could not clear best effort, and says so", () => {
    // A-B-A across the Moon's column: a known failure of the engine.
    const failing = kameaSigil("luna", "גוג");
    expect(failing.failed).toBe(true);
    expect(failing.figure.failures[0].length).toBeGreaterThan(0);
    const markup = renderToStaticMarkup(
      <KameaSigil planet="luna" text="אגיאל גוג" />,
    );
    // The image is flagged, and of its words only the one that failed.
    expect(markup).toMatch(/^<div [^>]*data-placement="failed"/);
    expect(
      svgs(markup).map((svg) => svg.includes('data-placement="failed"')),
    ).toEqual([false, true]);
    expect(ink(markup)[1].length).toBeGreaterThan(0);
    expect(
      renderToStaticMarkup(<KameaSigilImage planet="luna" text="גוג" />),
    ).toContain('data-placement="failed"');
  });

  it("draws what its props say, ignoring a sigil worked out for others", () => {
    const zazel = kameaSigil("saturn", "זאזל");
    const plain = renderToStaticMarkup(
      <KameaSigil planet="saturn" text="זאזל" />,
    );
    expect(
      renderToStaticMarkup(
        <KameaSigil planet="saturn" text="זאזל" sigil={zazel} />,
      ),
    ).toBe(plain);
    for (const other of [
      kameaSigil("saturn", "אגיאל"),
      kameaSigil("saturn", "זאזל", { finals: true }),
      kameaSigil("jupiter", "זאזל"),
    ]) {
      expect(
        renderToStaticMarkup(
          <KameaSigil planet="saturn" text="זאזל" sigil={other} />,
        ),
      ).toBe(plain);
      expect(
        renderToStaticMarkup(
          <KameaSigilImage planet="saturn" text="זאזל" sigil={other} />,
        ),
      ).toBe(
        renderToStaticMarkup(<KameaSigilImage planet="saturn" text="זאזל" />),
      );
    }
  });

  it("leaves the rose's rules alone: no lines, no run limit, no fallback", () => {
    expect(ROSE_SIGIL_PROFILE.placement?.lineRun).toBeUndefined();
    expect(ROSE_SIGIL_PROFILE.placement?.fallback).toBeUndefined();
    expect(ROSE_SIGIL_PROFILE.strokeWidth).toBeUndefined();
    for (const version of ["gd", "regardie1939"] as const)
      expect(roseSigilLayout(version).lines).toBeUndefined();
  });

  it("names itself, or is decorative, as Kamea is", () => {
    expect(
      renderToStaticMarkup(
        <KameaSigil planet="saturn" text="זאזל" label="Zazel" />,
      ),
    ).toContain('role="img" aria-label="Zazel"');
    const hidden = renderToStaticMarkup(
      <KameaSigilImage planet="saturn" text="זאזל" label={false} />,
    );
    expect(hidden).toContain('aria-hidden="true"');
    expect(hidden).not.toContain("role=");
  });

  it("takes the square's and the sigil's colours", () => {
    const markup = renderToStaticMarkup(
      <KameaSigil
        planet="saturn"
        text="זאזל"
        ink="#ff4d4d"
        squareInk="currentColor"
        paper="#121212"
      />,
    );
    expect(markup).toContain('fill="#121212" stroke="currentColor"');
    expect(markup).toContain('stroke="#ff4d4d" stroke-width="0.6"');
  });

  it("draws the bare square for an empty text, and refuses a planet without one", () => {
    const empty = renderToStaticMarkup(<KameaSigil planet="mars" text="" />);
    expect(svgs(empty)).toHaveLength(1);
    expect(ink(empty)).toEqual([[]]);
    expect(empty).toContain('aria-label="Kamea of Mars"');
    expect(() =>
      renderToStaticMarkup(<KameaSigil planet={"earth" as "mars"} text="א" />),
    ).toThrow(RangeError);
  });

  it("draws the same markup on every render, pinned", () => {
    const render = () =>
      renderToStaticMarkup(
        <KameaSigilImage planet="luna" text="מלכא בתרשיסים ועד ברוח שחקים" />,
      );
    const first = render();
    expect(render()).toBe(first);
    expect(first).not.toContain("data-placement");
    const digest = (markup: string) =>
      createHash("sha256").update(markup).digest("hex");
    expect({
      luna: digest(first),
      saturn: digest(
        renderToStaticMarkup(<KameaSigil planet="saturn" text="זאזל" />),
      ),
    }).toEqual({
      luna: "b6f1cc6935d79b73944a0e62029469b7d079c4ae2b89ce77eba6d8e537909fcf",
      saturn:
        "662759337422ac25bd414265112c1db7873e85e45319c6d34cf08061a055ec61",
    });
  });
});
