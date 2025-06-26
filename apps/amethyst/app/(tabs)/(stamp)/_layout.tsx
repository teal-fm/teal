import { Stack } from "expo-router";
import { StampProvider } from "@/lib/state/stamp";

const Layout = ({ segment }: { segment: string }) => {
  const screenOpts = {
    headerShown: false,
  };

  return (
    <StampProvider>
      <Stack>
        {segment == '(stamp)' && <Stack.Screen name="stamp/index" options={screenOpts} />}
        {segment == 'explore' && <Stack.Screen name="stamp/explore" options={screenOpts} />}
      </Stack>
    </StampProvider>
  );
};

export default Layout;
