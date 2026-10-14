import RecoveryPage from "@/components/teal/RecoveryPage";

export default function ErrorScreen() {
  return (
    <RecoveryPage
      title="Something went wrong"
      description="We could not complete that request. Check your connection and try again."
      retry
    />
  );
}
