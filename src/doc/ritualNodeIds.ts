import { customAlphabet } from "nanoid";
import { isUuidV7 } from "../lib/ids";

const generate = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  16,
);

/** Secure, case-sensitive ritual node identity; database record IDs remain UUIDs. */
export function createRitualNodeId(): string {
  return generate();
}

/** Accept new alphanumeric IDs and existing canonical UUIDv7s without remapping them. */
export function isRitualNodeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ((value.length === 16 && /^[A-Za-z0-9]+$/.test(value)) ||
      (isUuidV7(value) && value === value.toLowerCase()))
  );
}
