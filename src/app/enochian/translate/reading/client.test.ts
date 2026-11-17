import { describe, expect, it } from "vitest";
import { isSameOrigin } from "@/lib/sameOrigin";
import { bucketAddress, clientSubject, NO_ADDRESS_SUBJECT } from "./client.ts";

const secret = "synthetic-auth-test-secret-over-thirty-two-characters";

describe("a signed-out client's bucket (plan 081, S4)", () => {
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
    const one = clientSubject(secret, "203.0.113.5", "2026-11-17");
    expect(one).toMatch(/^reading-client:[0-9a-f]{64}$/);
    expect(one).not.toContain("203");
    // The same /64 is one bucket; another address, another.
    expect(clientSubject(secret, "2001:db8:1:2::1", "2026-11-17")).toBe(
      clientSubject(secret, "2001:db8:1:2:ffff::9", "2026-11-17"),
    );
    expect(clientSubject(secret, "203.0.113.6", "2026-11-17")).not.toBe(one);
    // A new day, or another secret, gives an unrelated bucket.
    expect(clientSubject(secret, "203.0.113.5", "2026-11-18")).not.toBe(one);
    expect(clientSubject(`${secret}!`, "203.0.113.5", "2026-11-17")).not.toBe(
      one,
    );
  });

  it("is one shared bucket for a request with no address", () => {
    expect(clientSubject(secret, undefined, "2026-11-17")).toBe(
      NO_ADDRESS_SUBJECT,
    );
    expect(clientSubject(secret, "not an address", "2026-11-17")).toBe(
      NO_ADDRESS_SUBJECT,
    );
  });
});

describe("the same-origin guard (S5)", () => {
  const request = (headers: Record<string, string>) =>
    new Request("https://magick.ly/api/enochian/read", {
      method: "POST",
      headers,
    });

  it("takes this site's own pages", () => {
    expect(isSameOrigin(request({ "sec-fetch-site": "same-origin" }))).toBe(
      true,
    );
    expect(
      isSameOrigin(request({ origin: "https://magick.ly", host: "magick.ly" })),
    ).toBe(true);
  });

  it("refuses others, and a browser that says it is cross-site", () => {
    const cases: Record<string, string>[] = [
      {},
      { "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "same-site" },
      { "sec-fetch-site": "none" },
      { "sec-fetch-site": "cross-site", origin: "https://magick.ly" },
      { origin: "https://magick.ly.example", host: "magick.ly" },
      { origin: "http://magick.ly:8080", host: "magick.ly" },
      { origin: "null", host: "magick.ly" },
      // The Origin matches the URL, but not the Host the request was made to.
      { origin: "https://magick.ly" },
      { origin: "https://magick.ly", host: "elsewhere.example" },
      // A forwarded host a client sent is never trusted.
      {
        origin: "https://elsewhere.example",
        host: "magick.ly",
        "x-forwarded-host": "elsewhere.example",
      },
    ];
    for (const headers of cases)
      expect(isSameOrigin(request(headers))).toBe(false);
  });
});
