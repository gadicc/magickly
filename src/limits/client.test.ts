import { describe, expect, it } from "vitest";
import { bucketAddress, clientSubject, noAddressSubject } from "./client.ts";
import { CHAT_CLIENT, READING_CLIENT } from "./policies.ts";

const secret = "synthetic-auth-test-secret-over-thirty-two-characters";

describe("a signed-out client's bucket", () => {
  it("is an IPv4 address whole, and an IPv6 address's /64", () => {
    expect(bucketAddress("203.0.113.5")).toBe("203.0.113.5");
    expect(bucketAddress("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
    expect(bucketAddress("2001:DB8:1:2::9")).toBe("2001:db8:1:2::/64");
    expect(bucketAddress("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(bucketAddress("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(bucketAddress("::1")).toBe("0:0:0:0::/64");
    for (const none of [undefined, null, "", "localhost", "1.2.3"])
      expect(bucketAddress(none)).toBeUndefined();
  });

  it("is an HMAC under the day's key, never the address", () => {
    const one = clientSubject(
      secret,
      READING_CLIENT,
      "203.0.113.5",
      "2026-11-17",
    );
    expect(one).toMatch(/^reading-client:[0-9a-f]{64}$/);
    expect(one).not.toContain("203");
    // The same /64 is one bucket; another address, another.
    expect(
      clientSubject(secret, READING_CLIENT, "2001:db8:1:2::1", "2026-11-17"),
    ).toBe(
      clientSubject(
        secret,
        READING_CLIENT,
        "2001:db8:1:2:ffff::9",
        "2026-11-17",
      ),
    );
    expect(
      clientSubject(secret, READING_CLIENT, "203.0.113.6", "2026-11-17"),
    ).not.toBe(one);
    // A new day, another secret or another policy gives an unrelated bucket.
    expect(
      clientSubject(secret, READING_CLIENT, "203.0.113.5", "2026-11-18"),
    ).not.toBe(one);
    expect(
      clientSubject(`${secret}!`, READING_CLIENT, "203.0.113.5", "2026-11-17"),
    ).not.toBe(one);
    const chat = clientSubject(
      secret,
      CHAT_CLIENT,
      "203.0.113.5",
      "2026-11-17",
    );
    expect(chat).toMatch(/^chat-client:[0-9a-f]{64}$/);
    expect(chat.slice(12)).not.toBe(one.slice(15));
  });

  it("is one shared bucket for a request with no address", () => {
    expect(clientSubject(secret, READING_CLIENT, undefined, "2026-11-17")).toBe(
      "reading-client:none",
    );
    expect(
      clientSubject(secret, CHAT_CLIENT, "not an address", "2026-11-17"),
    ).toBe(noAddressSubject(CHAT_CLIENT));
  });
});
