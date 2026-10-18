import { usePathname } from "expo-router";
import Head from "expo-router/head";

/** Cached account screens must not keep overriding the current page title. */
export default function AuthPageTitle({
  path,
  title,
}: {
  path: string;
  title: string;
}) {
  if (usePathname() !== path) return null;
  return (
    <Head>
      <title>{title} · Teal</title>
    </Head>
  );
}
