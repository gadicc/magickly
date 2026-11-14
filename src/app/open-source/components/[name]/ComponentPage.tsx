import { hallPreset } from "magick-components/gd/hall/presets";
import { directoryUrl } from "@/app/open-source/PackageCard";
import BreakableName from "@/explorer/BreakableName";
import {
  COMPONENT_EXAMPLES,
  COMPONENTS_PATH,
  type ExplorerComponent,
  importLine,
} from "@/explorer/components";
import DocText from "@/explorer/DocText";
import Explorer, { type ExplorerExample } from "@/explorer/Explorer";
import { PROPS } from "@/explorer/props";
import OpenSource from "@/OpenSource";
import { GD_HALLS } from "@/render/contracts/gdHall";
import { Breadcrumbs, entityTrail } from "@/seo/Breadcrumbs";
import { hallFiles } from "@/seo/halls";
import { SITE_REPOSITORY } from "@/seo/site";
import { EntityFrame, Trail } from "@/ui/entity";
import Link from "@/ui/Link";
import styles from "./componentPage.module.css";
import DrawnAfter from "./DrawnAfter";
import PropsTable from "./PropsTable";

/**
 * A hall example's image: its published hall's SVG, found by comparing the
 * example's hall with each published preset's. The explorer's controls
 * cannot change the hall, so the image follows the example.
 */
function hallImage(hall: unknown): string | undefined {
  const json = JSON.stringify(hall);
  const entry = GD_HALLS.find(
    (candidate) => JSON.stringify(hallPreset(candidate.preset)?.hall) === json,
  );
  return entry && hallFiles(entry).svg.path;
}

/**
 * One component's page (plan 080, decisions 1, 5 and 6): its name as the
 * heading, its JSDoc, the line that imports it, the explorer and the props
 * table. A Server Component around the explorer, its one client island.
 */
export default function ComponentPage({
  component,
}: {
  component: ExplorerComponent;
}) {
  const docs = PROPS[component.name];
  const examples: ExplorerExample[] = COMPONENT_EXAMPLES[
    component.name
  ].examples.map((example) => {
    const props = example.props as Record<string, unknown>;
    const image =
      component.name === "GdHall" ? hallImage(props.hall) : undefined;
    return { title: example.title, props, ...(image ? { image } : {}) };
  });
  return (
    <EntityFrame maxWidth="lg">
      <Breadcrumbs
        trail={entityTrail(COMPONENTS_PATH, component.name, component.path)}
      />
      <Trail href={COMPONENTS_PATH}>Components</Trail>
      <h1>
        <code>
          <BreakableName name={component.name} />
        </code>
      </h1>
      <p className={styles.note}>{component.title}, from magick-components</p>
      <DocText text={docs.description} />
      <DrawnAfter name={component.name} className={styles.note} />
      <pre className={styles.importLine}>
        <code>{importLine(component)}</code>
      </pre>
      <p className={styles.note}>
        magick-components is not on npm yet. Until it is, the component is in{" "}
        <Link href={directoryUrl("packages/magick-components")}>
          the app&apos;s repository
        </Link>
        , where you may copy it under MIT (
        <Link href="/open-source#magick-components">more</Link>).
      </p>
      <Explorer
        name={component.name}
        examples={examples}
        props={docs.props}
        dark={component.dark}
        examplesUrl={`${SITE_REPOSITORY}/blob/main/${component.examplesFile}`}
      />
      <h2 id="props">Props</h2>
      <PropsTable props={docs.props} />
      <OpenSource
        files={[
          component.sourceFile,
          component.examplesFile,
          "src/explorer/Explorer.tsx",
        ]}
      />
    </EntityFrame>
  );
}
