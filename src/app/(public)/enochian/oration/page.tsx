import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Oration from "../../../enochian/oration/Oration";
import OrationText from "../../../enochian/oration/OrationText";

export const metadata = pageMetadata("/enochian/oration");

const OrationPage = () => (
  <>
    <PageBreadcrumbs path="/enochian/oration" />
    <Oration />
    <OrationText />
  </>
);

export default OrationPage;
