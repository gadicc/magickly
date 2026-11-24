import { describe, expect, it, vi } from "vitest";
import StudySetPage from "./[_id]/page";
import StudyInfoPage from "./info/[_id]/page";

vi.mock("@/app/study/[_id]/studySet", () => ({ default: () => null }));
vi.mock("@/app/study/info/[_id]/info", () => ({ default: () => null }));
vi.mock("@/i18n/server", () => ({ privateUiMetadata: vi.fn() }));

const params = (_id: string) => ({ params: Promise.resolve({ _id }) });

describe("study set pages", () => {
  it("answer 404 for an id that is no set, Object.prototype's keys included", async () => {
    for (const page of [StudySetPage, StudyInfoPage])
      for (const id of ["constructor", "__proto__", "missing"])
        await expect(page(params(id) as never)).rejects.toThrow(
          /NEXT_HTTP_ERROR_FALLBACK;404/,
        );
  });

  it("render a known set", async () => {
    for (const page of [StudySetPage, StudyInfoPage]) {
      const element = await page(params("hebrew-latin") as never);
      expect(element.props._id).toBe("hebrew-latin");
    }
  });
});
