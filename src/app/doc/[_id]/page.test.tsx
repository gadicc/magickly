import { createHash } from "node:crypto";
import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { compileRitualSource } from "@/doc/compileContract";
import { semanticFromJrt } from "@/doc/semantic";
import { compileSemanticSource } from "@/doc/semanticCompile";

const runtime = vi.hoisted(() => ({
  resolve: vi.fn(),
  rendered: vi.fn(),
  deletedPublic: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/doc/sqlRuntime", () => ({
  resolveSqlRitualRouteId: runtime.resolve,
  publicSqlRitualReader: { getRendered: runtime.rendered },
  isDeletedPublicSqlRitual: runtime.deletedPublic,
}));
vi.mock("./PrivateRitualReader", () => ({
  default: (props: { resolvedRitualId: string | null }) => props,
}));
vi.mock("./DocRender", () => ({ default: () => null }));

const { default: DocPage, generateMetadata } = await import("./page");
const { default: DocRender } = await import("./DocRender");
const { default: PrivateRitualReader } = await import("./PrivateRitualReader");

const id = "019a0000-0000-7000-8000-000000000999";
const params = { params: Promise.resolve({ _id: id }) } as never;

beforeEach(() => {
  runtime.resolve.mockReset().mockResolvedValue(id);
  runtime.rendered.mockReset().mockResolvedValue(null);
  runtime.deletedPublic.mockReset().mockResolvedValue(false);
});

describe("the ritual page of a deleted ritual", () => {
  it("gives a deleted public ritual a 404 and noindex metadata", async () => {
    runtime.deletedPublic.mockResolvedValue(true);
    await expect(DocPage(params)).rejects.toThrow("NOT_FOUND");
    expect(await generateMetadata(params)).toEqual({
      title: "Ritual",
      robots: { index: false },
    });
    expect(runtime.deletedPublic).toHaveBeenCalledWith(id);
  });

  it("renders the private shell for a deleted private or purged ritual", async () => {
    const page = await DocPage(params);
    expect(JSON.stringify(page)).toContain(id);
    // A lookup failure counts as not deleted: the shell, never an error.
    runtime.deletedPublic.mockRejectedValue(new Error("down"));
    expect(JSON.stringify(await DocPage(params))).toContain(id);
  });

  it("never asks about deletion when a public ritual renders", async () => {
    runtime.rendered.mockResolvedValue({
      ritual: { id, title: "Public" },
      contentJson: JSON.stringify({ type: "root", children: [] }),
    });
    await DocPage(params);
    expect(runtime.deletedPublic).not.toHaveBeenCalled();
  });
});

function serve(contentJson: string) {
  runtime.rendered.mockResolvedValue({
    ritual: {
      id,
      title: "Synthetic Opening",
      createdAt: null,
      updatedAt: null,
      canEdit: false,
    },
    contentJson,
    contentSha256: createHash("sha256").update(contentJson).digest("hex"),
  });
}

/** Props of the first element of `type` in a server component's tree. */
function find(node: ReactNode, type: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, type);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<Record<string, unknown>>(node)) return null;
  if (node.type === type) return node.props;
  return find(node.props.children as ReactNode, type);
}

const body = [
  { type: "h1", children: [{ type: "text", value: "Opening" }] },
  { type: "p", children: [{ type: "text", value: "Synthetic words." }] },
];
// What each ritual compiler stores: a root with children and no type.
const compiled = {
  legacy: compileRitualSource("h1 Opening\np Synthetic words.\n")!.contentJson,
  semantic: compileSemanticSource(
    JSON.stringify(semanticFromJrt({ children: body })),
  )!.contentJson,
};

describe("the ritual page of a public SQL ritual", () => {
  it.each(Object.entries(compiled))(
    "server-renders and indexes %s compiler output",
    async (_compiler, contentJson) => {
      expect(JSON.parse(contentJson)).toEqual({ children: body });
      serve(contentJson);

      const page = await DocPage(params);
      expect(find(page, PrivateRitualReader)).toBeNull();
      expect(find(page, DocRender)?.doc).toEqual({ children: body });

      const metadata = await generateMetadata(params);
      expect(metadata.robots).toBeUndefined();
      expect(metadata.title).toBe("Synthetic Opening");
      expect(metadata.alternates?.canonical).toBe(`/doc/${id}`);
    },
  );

  it.each([
    ["malformed JSON", "{"],
    ["an array root", JSON.stringify(body)],
    ["a root without children", JSON.stringify({ type: "p" })],
    ["non-array children", JSON.stringify({ children: {} })],
  ])("falls back to the private reader for %s", async (_case, contentJson) => {
    serve(contentJson);

    const page = await DocPage(params);
    expect(find(page, DocRender)).toBeNull();
    expect(find(page, PrivateRitualReader)?.resolvedRitualId).toBe(id);

    const metadata = await generateMetadata(params);
    expect(metadata.robots).toEqual({ index: false });
  });
});
