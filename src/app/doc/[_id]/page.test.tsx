import { beforeEach, describe, expect, it, vi } from "vitest";

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
