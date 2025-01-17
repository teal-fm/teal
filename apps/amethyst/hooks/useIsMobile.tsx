import { useEffect, useState } from "react";
import { Platform } from "react-native";

export const isMobileInner = () =>
  Platform.OS === "web" && window.innerWidth > 1024;

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(isMobileInner());

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileInner());
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return isMobile;
}
