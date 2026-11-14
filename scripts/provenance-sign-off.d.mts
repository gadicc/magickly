/** Declarations for `provenance-sign-off.mjs`, which a strict package test imports. */

export interface SignOffRow {
  /** The row's first cell, backticks removed: what the row is about. */
  item: string;
  /** Where it comes from. */
  source: string;
  /** `YYYY-MM-DD`, or empty while the row is not signed off. */
  signedOff: string;
}

export function signOffRows(
  readme: string,
  table: { section: string; firstColumn: string },
): SignOffRow[];

export function unsignedRows<T extends { signedOff: string }>(rows: T[]): T[];
