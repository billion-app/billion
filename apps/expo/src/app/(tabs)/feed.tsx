import { Redirect } from "expo-router";

/** The former video feed is disabled; old deep links return to Browse. */
export default function FeedRedirect() {
  return <Redirect href="/" />;
}
