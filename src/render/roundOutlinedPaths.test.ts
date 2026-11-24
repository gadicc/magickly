import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { roundOutlinedPaths } from "./outlineTreeImage";

const SQUARE = [-50, -50, 100, 100] as const;

describe("roundOutlinedPaths", () => {
  it("keeps a hundred-thousandth of the drawing's larger side", () => {
    // 100 units across: 0.001, three decimals.
    expect(
      roundOutlinedPaths(
        '<path d="M 42.17292 -40.7718 Q 41.84524 -40.7718 41.648123 -40.840923 Z"/>',
        SQUARE,
      ),
    ).toBe('<path d="M 42.173 -40.772 Q 41.845 -40.772 41.648 -40.841 Z"/>');
    // 2,531 units: 0.025, two decimals.
    expect(
      roundOutlinedPaths('<path d="M 1.23456 7.891"/>', [0, 0, 1904, 2531]),
    ).toBe('<path d="M 1.23 7.89"/>');
  });

  it("keeps more inside a group a transform scales up", () => {
    // A hall's art, drawn small and scaled by 100: four decimals there,
    // and the same everywhere in the image.
    expect(
      roundOutlinedPaths(
        '<g transform="matrix(100 0 0 100 5 5)"><path d="M 0.123456 0"/></g><path d="M 1.23456 0"/>',
        [0, 0, 1904, 2531],
      ),
    ).toBe(
      '<g transform="matrix(100 0 0 100 5 5)"><path d="M 0.1235 0"/></g><path d="M 1.2346 0"/>',
    );
    // Nested scales multiply; a closed group's scale ends with it.
    expect(
      roundOutlinedPaths(
        '<g transform="matrix(10 0 0 10 0 0)"><g transform="matrix(0 10 -10 0 0 0)"><path d="M 0.1234567 0"/></g></g>',
        SQUARE,
      ),
    ).toBe(
      '<g transform="matrix(10 0 0 10 0 0)"><g transform="matrix(0 10 -10 0 0 0)"><path d="M 0.12346 0"/></g></g>',
    );
  });

  it("takes a rotation's scale of 1, in single precision, as 1", () => {
    // A turn of the candlestick's branches as resvg writes it: scale
    // 1.00000005, which must not cost a decimal; a real 1.04 does.
    const turn =
      "0.62348396 0.78183615 -0.78183615 0.62348396 -5.599631 -24.534357";
    expect(
      roundOutlinedPaths(
        `<g transform="matrix(${turn})"><path d="M 0.123456 0"/></g>`,
        SQUARE,
      ),
    ).toContain('d="M 0.123 0"');
    expect(
      roundOutlinedPaths(
        '<g transform="matrix(1.04 0 0 1.04 0 0)"><path d="M 0.123456 0"/></g>',
        SQUARE,
      ),
    ).toContain('d="M 0.1235 0"');
  });

  it("writes no negative zero, no trailing zeros, and leaves integers", () => {
    expect(
      roundOutlinedPaths('<path d="M -0.0001 2.5000004 L 48 -48 Z"/>', SQUARE),
    ).toBe('<path d="M 0 2.5 L 48 -48 Z"/>');
  });

  it("rounds a point shared by two paths the same in both", () => {
    const out = roundOutlinedPaths(
      '<path d="M 1.23456 2.34567 L 3 3"/><path d="M 3 3 L 1.23456 2.34567"/>',
      SQUARE,
    );
    expect(out).toBe(
      '<path d="M 1.235 2.346 L 3 3"/><path d="M 3 3 L 1.235 2.346"/>',
    );
  });

  it("touches no other attribute", () => {
    const other =
      '<path fill="#ff0000" stroke-width="0.6123456" transform="matrix(1 0 0 1 -100.123456 0)" d="M 0 0"/>';
    expect(roundOutlinedPaths(other, SQUARE)).toBe(other);
  });

  it("refuses a transform that collapses or isn't a number", () => {
    for (const matrix of ["0 0 0 0 0 0", "a b c d e f"])
      expect(() =>
        roundOutlinedPaths(
          `<g transform="matrix(${matrix})"><path d="M 0.5 0"/></g>`,
          SQUARE,
        ),
      ).toThrow("Unexpected component image transform");
  });

  it("keeps numbers apart that were written together", () => {
    // "1.0004.5" is 1.0004 then .5; once the first is 1, ".5" must not join it.
    expect(roundOutlinedPaths('<path d="M1.0004.5 L2.0001.25"/>', SQUARE)).toBe(
      '<path d="M1 0.5 L2 0.25"/>',
    );
  });

  it("bounds a skew or uneven scale by its largest stretch", () => {
    // matrix(1 0 3 1): a shear that stretches some direction by about 3.3.
    expect(
      roundOutlinedPaths(
        '<g transform="matrix(1 0 3 1 0 0)"><path d="M 0.123456 0"/></g>',
        SQUARE,
      ),
    ).toContain('d="M 0.1235 0"');
    // A self-closing element's own transform counts too.
    expect(
      roundOutlinedPaths(
        '<path transform="matrix(20 0 0 20 0 0)" d="M 0.123456 0"/>',
        SQUARE,
      ),
    ).toContain('d="M 0.12346 0"');
  });

  it("takes a clip's own scale times that of the groups using it", () => {
    // Drawn in the space of whatever uses it: up to 10 × 10.
    expect(
      roundOutlinedPaths(
        '<defs><clipPath id="c" transform="matrix(10 0 0 10 0 0)"><path d="M 0.1234567 0"/></clipPath></defs><g transform="matrix(10 0 0 10 0 0)"><path d="M 0.5 0"/></g>',
        SQUARE,
      ),
    ).toContain('d="M 0.12346 0"');
  });

  it("refuses what it cannot bound", () => {
    for (const body of [
      '<g transform="translate(5 5) scale(100)"><path d="M 0.5 0"/></g>',
      '<defs><clipPath id="c" clipPathUnits="objectBoundingBox"><path d="M 0.1 0.1"/></clipPath></defs>',
      '<defs><pattern id="p" patternContentUnits="objectBoundingBox"><path d="M 0.1 0.1"/></pattern></defs>',
    ])
      expect(() => roundOutlinedPaths(body, SQUARE)).toThrow(
        /Unexpected component image/,
      );
  });
});
