import { privateUiMetadata } from "@/i18n/server";
import StudyInfo from "../../../../study/info/[_id]/info";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Flashcard Progress");
}

export default async function StudyInfoPage({
  params,
}: PageProps<"/study/info/[_id]">) {
  return <StudyInfo _id={(await params)._id} />;
}
