import { Redirect } from "expo-router";

/** Album logging moved into Add a listen. */
export default function ManualListens() {
  return <Redirect href="/stamp?mode=album" />;
}
