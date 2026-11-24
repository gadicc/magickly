import { notFound } from "next/navigation";
import { privateUiMetadata } from "@/i18n/server";
import { isStudySetId } from "@/study/setIds";
import StudySetLoad from "../../../study/[_id]/studySet";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Flashcards");
}

export default async function StudySetPage({
  params,
}: PageProps<"/study/[_id]">) {
  const { _id } = await params;
  if (!isStudySetId(_id)) notFound();
  return <StudySetLoad _id={_id} />;
}
