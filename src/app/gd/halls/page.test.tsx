import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { GD_HALLS } from "@/render/contracts/gdHall";
import HallsPage from "./page";

it("links every hall's page and the editor from the halls' index", () => {
  const html = renderToString(<HallsPage />);
  for (const hall of GD_HALLS)
    expect(html).toContain(`href="/gd/halls/${hall.slug}"`);
  expect(html).toContain('href="/gd/halls/editor"');
  expect(html).toContain("Golden Dawn temple halls");
});
