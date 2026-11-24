// The existing actions carry safe English messages. Recognize only their owned
// vocabulary here; arbitrary URL parameters/provider details are not message IDs.
const FIXED = new Set([
  /*i18n*/ "Check the submitted values and try again.",
  /*i18n*/ "Sign in and try again.",
  /*i18n*/ "Your signed-in account changed. Switch back and try again.",
  /*i18n*/ "You do not have permission to manage this temple.",
  /*i18n*/ "The temple or membership was not found.",
  /*i18n*/ "No temple matches that slug and join code.",
  /*i18n*/ "Too many incorrect join codes from your account today. Try again tomorrow.",
  /*i18n*/ "A temple needs an administrator. Make another member an administrator first.",
  /*i18n*/ "The temple service is temporarily unavailable. Try again.",
  /*i18n*/ "Enter a valid slug and join code.",
  /*i18n*/ "Enter a temple name of 1–200 characters and retry with a valid request.",
  /*i18n*/ "Sign in before creating a temple.",
  /*i18n*/ "Your signed-in account changed. Switch back before retrying this request.",
  /*i18n*/ "The pending creation request changed. Restore the original request before retrying.",
  /*i18n*/ "This temple address is already in use. Change the name, or join your existing temple.",
  /*i18n*/ "Temple creation is busy. Please retry.",
  /*i18n*/ "We could not confirm whether the temple was created. Retry to check its status.",
  /*i18n*/ "The temple was not found.",
  /*i18n*/ "This server cannot protect forum keys yet, so forum connections are switched off.",
  /*i18n*/ "The forum settings could not be saved. Try again.",
  /*i18n*/ "The saved API key can no longer be read. Enter the API key again.",
  /*i18n*/ "Could not reach that forum.",
  /*i18n*/ "The forum did not accept that key as an administrator's for that username.",
  /*i18n*/ "The API username may use letters, numbers, dots, dashes and underscores.",
  /*i18n*/ "That does not look like an API key.",
  /*i18n*/ "That is the Magick.ly forum, which site administrators sync for you.",
  /*i18n*/ "Enter the API key again when you change the forum address.",
  /*i18n*/ "Enter the forum's API key.",
  /*i18n*/ "Enter the forum's web address, such as https://forum.example.org.",
  /*i18n*/ "The forum address must use https.",
  /*i18n*/ "Remove the username and password from the address.",
  /*i18n*/ "Use only the forum's address, without a path.",
  /*i18n*/ "Use the forum's standard https port.",
  /*i18n*/ "Use the forum's public web address.",
  /*i18n*/ "That address could not be found.",
  /*i18n*/ "The sync request is invalid.",
  /*i18n*/ "Temple administrator access is required.",
  /*i18n*/ "This server cannot read forum keys at the moment. Try again later.",
  /*i18n*/ "This temple's forum key can no longer be read. Enter the API key again.",
  /*i18n*/ "Add this temple's forum details first.",
  /*i18n*/ "Discourse sync is not configured.",
  /*i18n*/ "The forum connection was removed.",
  /*i18n*/ "The forum connection was saved.",
  /*i18n*/ "Sync stopped because your administrator access changed.",
  /*i18n*/ "Sync stopped because a forum identity link changed. No existing link was overwritten.",
  /*i18n*/ "Sync stopped because temple membership data changed. Run it again to use the current membership.",
  /*i18n*/ "Discourse sync stopped after a forum operation failed. Check forum availability before retrying.",
  /*i18n*/ "Forum grade groups are ready.",
  /*i18n*/ "Discourse sync completed.",
]);

const SKIPPED: Record<string, string> = {
  "membership changed": /*i18n*/ "Skipped member {member}: membership changed.",
  "grade is outside 0–6":
    /*i18n*/ "Skipped member {member}: grade is outside 0–6.",
  "an established forum link no longer resolves; the link was retained":
    /*i18n*/ "Skipped member {member}: an established forum link no longer resolves; the link was retained.",
  "there is no verified email available":
    /*i18n*/ "Skipped member {member}: there is no verified email available.",
  "a verified email matches multiple forum accounts":
    /*i18n*/ "Skipped member {member}: a verified email matches multiple forum accounts.",
  "the verified emails match different forum accounts":
    /*i18n*/ "Skipped member {member}: the verified emails match different forum accounts.",
  "the matched forum account changed during reconciliation":
    /*i18n*/ "Skipped member {member}: the matched forum account changed during reconciliation.",
  "a forum username could not be derived":
    /*i18n*/ "Skipped member {member}: a forum username could not be derived.",
  "forum account creation had an unresolved outcome; reconciliation is required before retrying":
    /*i18n*/ "Skipped member {member}: forum account creation had an unresolved outcome; reconciliation is required before retrying.",
};

/** A recognized action result, ready to translate at render time after locale changes. */
export interface TempleFeedbackMessage {
  message: string;
  values?: Record<string, number>;
}

/** Adapt existing action feedback without changing its transport or accepting arbitrary copy. */
export function templeFeedback(text: unknown): TempleFeedbackMessage {
  if (typeof text === "string") {
    if (FIXED.has(text)) return { message: text };
    const skipped = /^Skipped member (\d+): (.+)\.$/.exec(text);
    if (
      skipped &&
      Object.hasOwn(SKIPPED, skipped[2]) &&
      Number.isSafeInteger(Number(skipped[1]))
    )
      return {
        message: SKIPPED[skipped[2]],
        values: { member: Number(skipped[1]) },
      };
    const synced = /^Synced member (\d+) of (\d+)\.$/.exec(text);
    if (
      synced &&
      synced.slice(1).every((value) => Number.isSafeInteger(Number(value)))
    )
      return {
        message: /*i18n*/ "Synced member {member} of {total}.",
        values: { member: Number(synced[1]), total: Number(synced[2]) },
      };
    const summary = /^Sync completed with (\d+) members? skipped\.$/.exec(text);
    if (summary && Number.isSafeInteger(Number(summary[1])))
      return {
        message:
          /*i18n*/ "Sync completed with {count, plural, one {# member skipped} other {# members skipped}}.",
        values: { count: Number(summary[1]) },
      };
    const removed =
      /^Removed (\d+) former members? from forum grade groups\.$/.exec(text);
    if (removed && Number.isSafeInteger(Number(removed[1])))
      return {
        message:
          /*i18n*/ "Removed {count, plural, one {# former member} other {# former members}} from forum grade groups.",
        values: { count: Number(removed[1]) },
      };
  }
  return {
    message:
      /*i18n*/ "The temple action returned an unrecognized result. Refresh the page and try again.",
  };
}
