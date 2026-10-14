import { Redirect, usePathname } from "expo-router";
import RecoveryPage from "@/components/teal/RecoveryPage";
import { atUriFromRoutePath, hrefFromAtUri } from "@/lib/teal/routes";

export default function NotFoundScreen() {
  const pathname = usePathname();
  const atUri = atUriFromRoutePath(
    typeof window !== "undefined" ? window.location.pathname : pathname,
  );
  const href = hrefFromAtUri(atUri);
  if (href) return <Redirect href={href as any} />;
  return (
    <RecoveryPage
      title="Page not found"
      description="This link may be incomplete or the page may have moved. Head home or find something to listen to."
    />
  );
}
