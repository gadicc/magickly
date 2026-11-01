/**
 * Whether a typed title confirms a ritual's title for Delete permanently.
 * Unicode is compared in NFC and runs of whitespace count as one space, on
 * the client and the server alike; case still matters.
 */
export function confirmsRitualTitle(typed: string, title: string): boolean {
  const normal = (value: string) =>
    value.normalize("NFC").replace(/\s+/gu, " ").trim();
  return normal(typed) === normal(title) && normal(title) !== "";
}
