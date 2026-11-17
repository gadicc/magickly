import { describe, expect, it } from "vitest";
import { decodeReferences, jsxProse } from "./prose";

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

  it("reads character references as the page shows them", () => {
    const { text } = jsxProse(
      "export default () => <p>Dee&apos;s &quot;Keys&quot; &amp; Kelley&#39;s&nbsp;tables &#x2014; &unknown;</p>;",
    );
    expect(text).toBe(`Dee's "Keys" & Kelley's tables \u2014 &unknown;`);
    expect(decodeReferences("&#x110000; &mdash;")).toBe("&#x110000; \u2014");
  });
});

it("reads literal rich messages only through the explicitly imported presentation adapter", () => {
  const source = `import Copy from "@/i18n/UiRichText";
    export default () => <><Copy message={/*i18n*/ "Read <0>the book</0>."} components={{0: <a href="private-prop">ignored component children</a>}} />
    <Other message={"not public prose"} /><Copy message={secret} /></>;`;
  expect(jsxProse(source).text).toBe("Read the book .");
  expect(
    jsxProse(`export default () => <UiRichText message={"not imported"} />;`)
      .text,
  ).toBe("");
});
