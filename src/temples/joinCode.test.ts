import { describe, expect, it } from "vitest";
import {
  generateJoinCode,
  isJoinCode,
  JOIN_CODE_ALPHABET,
  normalizeJoinCode,
} from "./joinCode";

describe("join codes", () => {
  it("draws 20 characters in four groups from 20 random bytes", () => {
    const sizes: number[] = [];
    const code = generateJoinCode((size) => {
      sizes.push(size);
      return Uint8Array.from({ length: size }, (_, i) => i * 13 + 32);
    });
    expect(sizes).toEqual([20]);
    expect(code).toBe("0dt7m-1ev8n-2fw9p-3gxaq");
    expect(isJoinCode(code)).toBe(true);
  });

  it("ignores each byte's top three bits", () => {
    const code = generateJoinCode(() =>
      Uint8Array.from({ length: 20 }, (_, i) => 0xe0 | (i + 12)),
    );
    expect(code.replaceAll("-", "")).toBe(JOIN_CODE_ALPHABET.slice(12));
  });

  it("makes different codes from the system's random source", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateJoinCode()));
    expect(codes.size).toBe(50);
    for (const code of codes) expect(isJoinCode(code)).toBe(true);
  });

  it("refuses a random source that returns the wrong length", () => {
    expect(() => generateJoinCode(() => new Uint8Array(19))).toThrow();
  });

  it("forgives case, spacing, hyphens and look-alike letters", () => {
    const code = "7kq2m-dx9vt-a4hr0-nweb1";
    for (const typed of [
      code,
      "7KQ2M-DX9VT-A4HR0-NWEB1",
      "7kq2mdx9vta4hr0nweb1",
      " 7kq2m dx9vt a4hr0 nweb1 ",
      "7kq2-mdx9v-ta4hr-0nweb1",
      "7kq2m-dx9vt-a4hrO-nwebl",
      "7kq2m-dx9vt-a4hro-nwebI",
    ])
      expect(normalizeJoinCode(typed)).toBe(code);
  });

  it("refuses anything that cannot be a code", () => {
    for (const typed of [
      "1234",
      "example-join-code",
      "7kq2m-dx9vt-a4hr0-nweb",
      "7kq2m-dx9vt-a4hr0-nweb11",
      "7kq2m-dx9vt-a4hr0-nwebu",
      "7kq2m/dx9vt/a4hr0/nweb1",
      "",
      "x".repeat(101),
      null,
      42,
    ])
      expect(normalizeJoinCode(typed)).toBeNull();
    expect(isJoinCode("7KQ2M-DX9VT-A4HR0-NWEB1")).toBe(false);
    expect(isJoinCode("7kq2mdx9vta4hr0nweb1")).toBe(false);
  });
});
