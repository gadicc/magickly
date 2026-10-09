import { BlockList, isIP } from "node:net";

/**
 * A temple's forum address is typed by a temple administrator, and the server
 * then sends requests to it carrying that administrator's API key. Anyone may
 * create a temple, so the address is untrusted input: it must be a plain public
 * https origin, never a way to reach this server's own network.
 */
export const FORUM_ORIGIN_MAX_LENGTH = 255;

export type ForumOriginResult =
  | { ok: true; origin: string }
  | { ok: false; message: string };

const BAD = "Enter the forum's web address, such as https://forum.example.org.";

/** Accepts `forum.example.org` or `https://forum.example.org/`; returns `https://forum.example.org`. */
export function parseForumOrigin(input: string): ForumOriginResult {
  const text = input.trim();
  if (!text || text.length > FORUM_ORIGIN_MAX_LENGTH || /[\s\\]/.test(text))
    return { ok: false, message: BAD };
  // Only `scheme://` is a scheme; `forum.example.org:443` is a host and port.
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  let url: URL;
  try {
    url = new URL(hasScheme ? text : `https://${text}`);
  } catch {
    return { ok: false, message: BAD };
  }
  if (url.protocol !== "https:")
    return { ok: false, message: "The forum address must use https." };
  if (url.username || url.password)
    return {
      ok: false,
      message: "Remove the username and password from the address.",
    };
  if (url.search || url.hash || (url.pathname !== "/" && url.pathname !== ""))
    return {
      ok: false,
      message: "Use only the forum's address, without a path.",
    };
  if (url.port)
    return { ok: false, message: "Use the forum's standard https port." };
  const host = url.hostname.toLowerCase();
  if (
    !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(
      host,
    ) ||
    host.length > 253 ||
    isIP(host) !== 0 ||
    /(^|\.)(localhost|local|internal|localdomain|lan|home|corp|test|invalid|example)$/.test(
      host,
    ) ||
    /^[0-9.]+$/.test(host)
  )
    return { ok: false, message: "Use the forum's public web address." };
  const origin = `https://${host}`;
  if (origin.length > FORUM_ORIGIN_MAX_LENGTH)
    return { ok: false, message: BAD };
  return { ok: true, origin };
}

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 96], // unspecified, loopback and IPv4-compatible
  ["::ffff:0:0:0", 96], // IPv4-translated
  ["64:ff9b::", 96], // NAT64
  ["64:ff9b:1::", 48], // local-use NAT64
  ["100::", 64],
  ["2001::", 32], // Teredo
  ["2001:db8::", 32],
  ["2002::", 16], // 6to4
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10], // deprecated site-local
  ["ff00::", 8],
] as const)
  blocked.addSubnet(address, prefix, "ipv6");

/** True for loopback, private, link-local, reserved and other non-public addresses. */
export function isNonPublicAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return isNonPublicAddress(mapped[1]);
  const family = isIP(address);
  if (family === 0) return true;
  return blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

export type HostLookup = (
  hostname: string,
) => Promise<{ address: string; family: number }[]>;

/**
 * Resolves the host and refuses it unless every address is public. This runs
 * when a forum is saved and again before each sync, so a later change of DNS
 * is noticed. It cannot close the gap between this lookup and the connection
 * (DNS rebinding). What limits that gap: only https on the standard port, so
 * the forum's certificate must be valid for the typed name (an internal
 * service will not present one), redirects refused, and short timeouts.
 */
export async function assertPublicForumHost(
  origin: string,
  lookup: HostLookup,
): Promise<ForumOriginResult> {
  const parsed = parseForumOrigin(origin);
  if (!parsed.ok) return parsed;
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(new URL(parsed.origin).hostname);
  } catch {
    return { ok: false, message: "That address could not be found." };
  }
  if (
    addresses.length === 0 ||
    addresses.some((item) => isNonPublicAddress(item.address))
  )
    return { ok: false, message: "Use the forum's public web address." };
  return parsed;
}
