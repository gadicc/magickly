import { notFound } from "next/navigation";
import HomePage from "@/app/HomePage";
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
  return localizedPageMetadata("/", (await params).locale);
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if ((await params).locale !== "he") notFound();
  return <HomePage locale="he" />;
}
