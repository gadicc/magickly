import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EXPLORER_COMPONENTS, explorerComponent } from "@/explorer/components";
import { PROPS } from "@/explorer/props";
import ComponentPage from "./ComponentPage";
import { dynamicParams, generateMetadata, generateStaticParams } from "./page";

const render = (slug: string) =>
  renderToString(<ComponentPage component={explorerComponent(slug)!} />)
    .replace(/<style\b[^>]*>.*?<\/style>/g, "")
    // The heading's name may break between words.
    .replace(/<wbr\/>/g, "");

describe("/open-source/components/[name]", () => {
  it("prerenders a page per component and no other", async () => {
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual(
      EXPLORER_COMPONENTS.map(({ slug }) => ({ name: slug })),
    );
    await expect(
      generateMetadata({
        params: Promise.resolve({ name: "kamea" }),
      } as PageProps<"/open-source/components/[name]">),
    ).resolves.toMatchObject({
      title: "Planetary Kamea React Component",
      alternates: { canonical: "/open-source/components/kamea" },
    });
  });

  const tree = render("tree-of-life");

  it("names the component in its heading, and imports it", () => {
    expect(tree).toMatch(/<h1\b[^>]*><code>TreeOfLife<\/code><\/h1>/);
    expect(tree).toContain(
      "import TreeOfLife from &quot;magick-components/kabbalah/TreeOfLife&quot;;",
    );
    expect(tree).toContain("magick-components is not on npm yet.");
    expect(tree).not.toMatch(/npm i\b/);
  });

  it("lists every prop docgen read, with its description", () => {
    for (const prop of PROPS.TreeOfLife.props)
      expect(tree).toContain(`id="prop-${prop.name}"`);
    expect(tree).toContain("The scale the spheres are coloured in");
  });

  it("offers a control for each prop whose type allows one", () => {
    for (const prop of PROPS.TreeOfLife.props) {
      const label = prop.control ? 1 : 0;
      expect(
        tree.includes(`>${prop.name}</label>`) ||
          tree.includes(`<code>${prop.name}</code></span></label>`),
        prop.name,
      ).toBe(Boolean(label));
    }
  });

  it("links each hall example's published image", () => {
    const hall = render("gd-hall");
    expect(hall).toContain(
      'href="/gd/halls/neophyte/golden-dawn-neophyte-temple.svg"',
    );
  });

  it("lets a long name break between its words", () => {
    const html = renderToString(
      <ComponentPage
        component={explorerComponent("seven-branched-candlestick")!}
      />,
    );
    expect(html).toContain(
      "<h1><code>Seven<wbr/>Branched<wbr/>Candle<wbr/>Stick</code></h1>",
    );
  });

  it("renders every component's page", () => {
    for (const { slug, name } of EXPLORER_COMPONENTS)
      expect(render(slug), slug).toContain(`<code>${name}</code></h1>`);
  });
});
