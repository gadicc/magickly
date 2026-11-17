import { privateUiMetadata } from "@/i18n/server";
import StudySetLoad from "../../../study/[_id]/studySet";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Flashcards");
}

export default async function StudySetPage({
  params,
}: PageProps<"/study/[_id]">) {
  return <StudySetLoad _id={(await params)._id} />;
}
