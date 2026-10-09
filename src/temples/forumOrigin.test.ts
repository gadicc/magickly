import { describe, expect, it } from "vitest";
import {
  assertPublicForumHost,
  isNonPublicAddress,
  parseForumOrigin,
} from "./forumOrigin";

describe("parseForumOrigin", () => {
  it.each([
    ["https://forum.example.org", "https://forum.example.org"],
    ["https://forum.example.org/", "https://forum.example.org"],
    ["  Forum.Example.ORG ", "https://forum.example.org"],
    ["forum.example.org", "https://forum.example.org"],
    ["https://xn--bcher-kva.example.org", "https://xn--bcher-kva.example.org"],
    ["https://a-b.c.example.co.uk:443", "https://a-b.c.example.co.uk"],
    ["forum.example.org:443", "https://forum.example.org"],
  ])("accepts %s", (input, origin) => {
    expect(parseForumOrigin(input)).toEqual({ ok: true, origin });
  });

  it.each([
    "",
    "   ",
    "http://forum.example.org",
    "ftp://forum.example.org",
    "https://user:pw@forum.example.org",
    "https://forum.example.org/path",
    "https://forum.example.org/?q=1",
    "https://forum.example.org/#x",
    "https://forum.example.org:8443",
    "forum.example.org:8443",
    "https://localhost",
    "https://forum.local",
    "https://db.internal",
    "https://nodots",
    "https://127.0.0.1",
    "https://[::1]",
    "https://10.0.0.1",
    "https://1.2.3.4",
    "https://-bad.example.org",
    "https://bad_.example.org",
    "https://exa mple.org",
    "https://forum.example.org\\@evil.example.net",
    `https://${"a".repeat(250)}.example.org`,
    // Within the host limit, but the origin with its scheme is over 255.
    `${`${"a".repeat(61)}.`.repeat(4)}org`,
    "javascript:alert(1)",
    "https://",
  ])("rejects %j", (input) => {
    expect(parseForumOrigin(input)).toMatchObject({ ok: false });
  });
});

describe("isNonPublicAddress", () => {
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "64:ff9b::7f00:1",
    "2001:db8::1",
    "::127.0.0.1",
    "::ffff:0:7f00:1",
    "64:ff9b:1::1",
    "2002:7f00:1::",
    "2001::1",
    "fec0::1",
    "192.88.99.1",
    "not-an-address",
  ])("treats %s as non-public", (address) => {
    expect(isNonPublicAddress(address)).toBe(true);
  });

  it.each([
    "1.1.1.1",
    "8.8.8.8",
    "93.184.216.34",
    "172.32.0.1",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ])("treats %s as public", (address) => {
    expect(isNonPublicAddress(address)).toBe(false);
  });
});

describe("assertPublicForumHost", () => {
  const origin = "https://forum.example.org";
  const resolves =
    (...addresses: string[]) =>
    async () =>
      addresses.map((address) => ({
        address,
        family: address.includes(":") ? 6 : 4,
      }));

  it("accepts a host whose every address is public", async () => {
    expect(
      await assertPublicForumHost(
        origin,
        resolves("93.184.216.34", "2606:4700::1"),
      ),
    ).toEqual({ ok: true, origin });
  });

  it("refuses a host with any private address, no address, or no such host", async () => {
    for (const lookup of [
      resolves("10.0.0.5"),
      resolves("93.184.216.34", "127.0.0.1"),
      resolves(),
    ])
      expect(await assertPublicForumHost(origin, lookup)).toMatchObject({
        ok: false,
      });
    expect(
      await assertPublicForumHost(origin, async () => {
        throw new Error("ENOTFOUND");
      }),
    ).toEqual({ ok: false, message: "That address could not be found." });
  });

  it("validates the address itself before resolving anything", async () => {
    let called = false;
    const result = await assertPublicForumHost(
      "http://forum.example.org",
      async () => {
        called = true;
        return [];
      },
    );
    expect(result).toMatchObject({ ok: false });
    expect(called).toBe(false);
  });
});
