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
      // A font URL has no control (Explorer.tsx, UNCONTROLLED).
      const label = prop.control && prop.name !== "fontBaseUrl" ? 1 : 0;
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

  it("links the printings the redrawn sigils follow", () => {
    const spirit = render("planetary-spirit");
    expect(spirit).toMatch(
      /<a [^>]*href="https:\/\/archive.org\/details\/theomagiaortempl00heyd\/page\/n124\/mode\/1up"[^>]*>Heydon, <cite>Theomagia<\/cite> \(1663\/4\), p. <!-- -->13<\/a>/,
    );
    expect(spirit).toMatch(
      /<a [^>]*href="https:\/\/archive.org\/details\/theomagiaortempl00heyd\/page\/n126\/mode\/1up"[^>]*aria-label="Heydon, Theomagia \(1663\/4\), p. 15"[^>]*>p. 15<\/a>/,
    );
    // Each opens the mirrored page in a dialog.
    expect(spirit.match(/aria-haspopup="dialog"/g)).toHaveLength(2);
    expect(render("tablet")).toMatch(
      /<a [^>]*href="https:\/\/archive.org\/details\/crowley-equinox_202110\/The%20Equinox%20Vol.%201%2C%20No.%207\/page\/n256\/mode\/1up"[^>]*><cite>The Equinox<\/cite> I\(7\) \(1912\), Plate X<\/a>/,
    );
    // The others name no source here.
    expect(render("tree-of-life")).not.toContain("drawn after");
  });

  it("renders every component's page", () => {
    for (const { slug, name } of EXPLORER_COMPONENTS)
      expect(render(slug), slug).toContain(`<code>${name}</code></h1>`);
  });
});
