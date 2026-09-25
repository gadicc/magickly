import { notFound } from "next/navigation";
import Data from "@/../data/data";
import { rowOf } from "@/../data/rowOf";
import { entityIds, gradePage } from "@/seo/entities";
import { seoMetadata } from "@/seo/metadata";
import GradePage from "./Grade";

const grades = Data.gdGrade;

// Unknown ids are 404s without rendering, so arbitrary URLs add no cache entries.
export const dynamicParams = false;

export function generateStaticParams() {
  return entityIds("gdGrade");
}

export async function generateMetadata({
  params,
}: PageProps<"/gd/grade/[id]">) {
  const page = gradePage(decodeURIComponent((await params).id));
  if (!page) notFound();
  return seoMetadata(page.path, page);
}

export default async function Grade({ params }: PageProps<"/gd/grade/[id]">) {
  const id = decodeURIComponent((await params).id);
  // The same lookup the page's description is built from, and the same 404.
  const grade = rowOf(grades, id);
  if (!grade) notFound();

  return <GradePage grade={grade} />;
}
