import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import MoonText from "../../../astrology/moon/MoonText";
import Moon from "../../../astrology/moon/moon";

export const metadata = pageMetadata("/astrology/moon");

export default function MoonPage() {
  return (
    <>
      <PageBreadcrumbs path="/astrology/moon" />
      <Moon />
      <MoonText />
    </>
  );
}
