import { notFound } from "next/navigation";
import AboutPage from "@/app/about/AboutPage";
import { localizedPageMetadata } from "@/i18n/publicMetadata";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ locale: "he" }];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return localizedPageMetadata("/about", (await params).locale);
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if ((await params).locale !== "he") notFound();
  return <AboutPage />;
}
