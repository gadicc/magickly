import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Candlestick from "./candlestick";

export const metadata = pageMetadata("/gd/symbols/candlestick");

export default function CandlestickPage() {
  return (
    <>
      <PageBreadcrumbs path="/gd/symbols/candlestick" />
      <Candlestick />
    </>
  );
}
