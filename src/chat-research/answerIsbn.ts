/** Pure browser/server ISBN check; no source records or Node imports. */
/** Check ISBN-10/13 syntax and checksum; this does not establish book or format identity. */
export function validIsbn(value: string): boolean {
  if (!/^[0-9Xx -]+$(?![\s\S])/.test(value)) return false;
  const n = value.replace(/[ -]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$(?![\s\S])/.test(n))
    return (
      [...n].reduce(
        (s, c, i) => s + (c === "X" ? 10 : Number(c)) * (10 - i),
        0,
      ) %
        11 ===
      0
    );
  return (
    /^97[89]\d{10}$(?![\s\S])/.test(n) &&
    [...n].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0) % 10 === 0
  );
}
