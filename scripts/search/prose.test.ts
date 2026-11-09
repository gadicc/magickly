import { describe, expect, it } from "vitest";
import { jsxProse } from "./prose";

describe("public JSX prose extraction", () => {
  it("reads visible prose without publishing literals from code, props or scripts", () => {
    const { text, components } = jsxProse(`
      const secret = "do-not-publish";
      export default () => <article>
        <h2>Moon phases</h2><p>Waxing <em>and</em> waning. {"Visible words"}</p>
        <Widget token={"private-prop"} title={<span>private-title-prop</span>} />
        <script>{"private-script"}</script><pre>example source</pre>
        <p>{secret}</p>
      </article>;
    `);
    expect(text).toBe("Moon phases Waxing and waning. Visible words");
    expect(components.has("Widget")).toBe(true);
  });
});
