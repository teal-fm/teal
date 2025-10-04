import { useWindowDimensions } from "react-native";

export default function useIsMobile() {
  const { width } = useWindowDimensions();

  return width < 1024;
}
