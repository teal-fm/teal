import RecoveryPage from "@/components/teal/RecoveryPage";
import { CloudOff } from "lucide-react-native";

export default function Offline() {
  return (
    <RecoveryPage
      title="Cannot connect to Teal"
      description="Check your internet connection, then return to the previous page to continue."
      icon={CloudOff}
      retry
    />
  );
}
