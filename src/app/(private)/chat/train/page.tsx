import Link from "next/link";
import EnglishText from "@/i18n/EnglishText";
import { privateUiMetadata } from "@/i18n/server";
import UiText from "@/i18n/UiText";
import { trainingAccess } from "../../../chat/train/access";
import TrainingUpload from "../../../chat/train/TrainingUpload";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Chat Training");
}

export default async function TrainingPage() {
  const access = await trainingAccess();
  return (
    <main>
      <h1>
        <UiText message={/*i18n*/ "Chat training"} />
      </h1>
      {access === 200 ? (
        <TrainingUpload />
      ) : (
        <p>
          <EnglishText>Administrator sign-in is required.</EnglishText>{" "}
          <Link href="/signin?callbackURL=%2Fchat%2Ftrain">
            <UiText message={/*i18n*/ "Sign in"} />
          </Link>
        </p>
      )}
    </main>
  );
}
