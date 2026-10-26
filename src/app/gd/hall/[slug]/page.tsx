import { notFound } from "next/navigation";
import { GD_HALL_SLUGS, gdHall } from "@/render/contracts/gdHall";
import { hallMetadata } from "@/seo/halls";
import HallPage from "./HallPage";

// Unknown slugs are 404s without rendering, so arbitrary URLs add no cache entries.
export const dynamicParams = false;

export function generateStaticParams() {
  return GD_HALL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/gd/hall/[slug]">) {
  const metadata = hallMetadata((await params).slug);
  if (!metadata) notFound();
  return metadata;
}

export default async function Hall({ params }: PageProps<"/gd/hall/[slug]">) {
  const hall = gdHall((await params).slug);
  if (!hall) notFound();
  return <HallPage hall={hall} />;
}
