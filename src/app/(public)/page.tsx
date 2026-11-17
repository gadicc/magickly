import { pageMetadata } from "@/seo/metadata";
import HomePage from "../HomePage";
export const metadata = pageMetadata("/");
export default function Page() {
  return <HomePage />;
}
