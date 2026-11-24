import { createHmac, hkdfSync } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";
import type { ClientPolicy } from "./policies.ts";

/**
 * A signed-out client's bucket for a per-client daily cap (first built for
 * plan 081, S4): an HMAC of its IP address, under a key derived for the
 * UTC day and the policy from a server secret, so the counters never hold
 * an address and a day's or a purpose's buckets can't be matched with
 * another's. The key itself is never stored.
 */

/**
 * The address as bucketed: IPv4 whole; IPv6 cut to its /64, the block one
 * subscriber is usually given; an IPv4-mapped IPv6 address as its IPv4.
 * Undefined when it isn't an address.
 */
export function bucketAddress(address: string | null | undefined) {
  const text = address?.trim() ?? "";
  if (isIPv4(text)) return text;
  if (!isIPv6(text)) return undefined;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(text);
  if (mapped && isIPv4(mapped[1])) return mapped[1];
  // Expand "::" and any embedded IPv4 tail to eight groups, then keep four.
  let groups = text.toLowerCase();
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(groups);
  if (tail) {
    const [a, b, c, d] = tail[1].split(".").map(Number);
    groups = groups.replace(
      tail[1],
      `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`,
    );
  }
  const [head, rest] = groups.split("::");
  const left = head ? head.split(":") : [];
  const right = rest !== undefined && rest ? rest.split(":") : [];
  const full =
    rest === undefined
      ? left
      : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  return `${full
    .slice(0, 4)
    .map((one) => Number.parseInt(one, 16).toString(16))
    .join(":")}::/64`;
}

/** The day's key: HKDF-SHA-256 of the secret, for this policy and day. */
export function clientKey(
  secret: string,
  policy: ClientPolicy,
  day: string,
): Buffer {
  return Buffer.from(
    hkdfSync("sha256", secret, policy.label, `day:${day}`, 32),
  );
}

/** The bucket every request with no usable address shares. */
export const noAddressSubject = (policy: ClientPolicy) =>
  `${policy.prefix}:none`;

/**
 * The counter subject for a signed-out client on `day` ("2026-11-17"): an
 * HMAC of its bucketed address under the day's key for `policy`, or the
 * policy's shared bucket when there is no usable address.
 */
export function clientSubject(
  secret: string,
  policy: ClientPolicy,
  address: string | null | undefined,
  day: string,
): string {
  const bucket = bucketAddress(address);
  if (!bucket) return noAddressSubject(policy);
  const mac = createHmac("sha256", clientKey(secret, policy, day))
    .update(bucket)
    .digest("hex");
  return `${policy.prefix}:${mac}`;
}
