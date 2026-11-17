import { pageMetadata } from "@/seo/metadata";
import AboutPage from "../../about/AboutPage";
export const metadata = pageMetadata("/about");
export default function Page() {
  return <AboutPage />;
}
