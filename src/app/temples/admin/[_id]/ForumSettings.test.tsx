import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ForumSettings } from "./ForumSettings";

vi.mock("./actions", () => ({ saveTempleForumAction: async () => ({}) }));

const saved = {
  origin: "https://discourse.example.net",
  apiUsername: "bot.user",
  apiKeyHint: "cdef",
  keyReadable: true as const,
};
const render = (
  props: Partial<Parameters<typeof ForumSettings>[0]> = {},
): string =>
  renderToString(
    <ForumSettings
      actorId="actor"
      templeId="temple"
      saved={null}
      canStoreKeys
      {...props}
    />,
  );
const field = (html: string, name: string) =>
  html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? "";

describe("temple forum settings form", () => {
  it("asks for everything when no forum is connected", () => {
    const html = render();
    expect(html).toContain("Connect forum");
    expect(field(html, "origin")).toContain('value=""');
    expect(field(html, "apiUsername")).toContain('value="system"');
    expect(field(html, "apiKey")).toContain("required");
    expect(html).not.toContain("can no longer be read");
  });

  it("offers a readable connection back, without its key", () => {
    const html = render({ saved });
    expect(field(html, "origin")).toContain(
      'value="https://discourse.example.net"',
    );
    expect(field(html, "apiUsername")).toContain('value="bot.user"');
    expect(field(html, "apiKey")).not.toContain("required");
    expect(html).toContain("A key ending cdef is saved.");
    expect(html).toContain("Update forum");
    expect(html).toContain("Disconnect");
  });

  it("asks for everything again when the saved key no longer opens", () => {
    // The server sends nothing of the connection in this state: the address
    // or username may have been changed underneath the key.
    const html = render({ saved: { keyReadable: false } });
    expect(html).toContain("can no longer be read");
    expect(html).not.toContain("is saved");
    expect(field(html, "origin")).toContain('value=""');
    expect(field(html, "apiUsername")).toContain('value="system"');
    expect(field(html, "apiKey")).toContain("required");
    // It can still be replaced or removed.
    expect(html).toContain("Update forum");
    expect(html).toContain("Disconnect");
  });

  it("says so when the server cannot protect keys", () => {
    const html = render({ saved, canStoreKeys: false });
    expect(html).toContain("switched off");
    expect(html).not.toContain("<form");
  });
});
