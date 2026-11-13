import { notFound } from "next/navigation";
import { EXPLORER_COMPONENTS, explorerComponent } from "@/explorer/components";
import { componentMetadata } from "@/seo/components";
import ComponentPage from "./ComponentPage";

/** Unknown names are 404s without rendering, so arbitrary URLs add no pages. */
export const dynamicParams = false;

export function generateStaticParams() {
  return EXPLORER_COMPONENTS.map(({ slug }) => ({ name: slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/open-source/components/[name]">) {
  const metadata = componentMetadata((await params).name);
  if (!metadata) notFound();
  return metadata;
}

export default async function ComponentRoute({
  params,
}: PageProps<"/open-source/components/[name]">) {
  const component = explorerComponent((await params).name);
  if (!component) notFound();
  return <ComponentPage component={component} />;
}
