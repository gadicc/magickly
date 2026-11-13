import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import About from "./page";

describe("/about's credits", () => {
  it("credit moon-phase's BSD licence for the Moon's drawing", () => {
    const html = renderToString(<About />);
    const credits = html.slice(html.indexOf('id="credits"'));
    expect(credits).toContain(
      'href="https://github.com/tingletech/moon-phase"',
    );
    expect(credits).toContain("Regents of the University of California");
    expect(credits).toContain(
      'href="https://github.com/gadicc/magickly/blob/main/packages/magick-components/LICENSE.txt"',
    );
  });
});
