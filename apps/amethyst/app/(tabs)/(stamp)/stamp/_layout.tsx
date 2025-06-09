import { createContext, useState } from "react";
import { Slot, Stack } from "expo-router";
import { MusicBrainzRecording, PlaySubmittedData } from "@/lib/oldStamp";

export enum StampStep {
  IDLE = "IDLE",
  SUBMITTING = "SUBMITTING",
  SUBMITTED = "SUBMITTED",
}

export type StampContextState =
  | { step: StampStep.IDLE; resetSearchState: boolean }
  | { step: StampStep.SUBMITTING; submittingStamp: MusicBrainzRecording }
  | { step: StampStep.SUBMITTED; submittedStamp: PlaySubmittedData };

export type StampContextValue = {
  state: StampContextState;
  setState: React.Dispatch<React.SetStateAction<StampContextState>>;
};

export const StampContext = createContext<StampContextValue | null>(null);

const Layout = ({ segment }: { segment: string }) => {
  const [state, setState] = useState<StampContextState>({
    step: StampStep.IDLE,
    resetSearchState: false,
  });
  return (
    <StampContext.Provider value={{ state, setState }}>
      <Stack
        screenOptions={{
          headerStyle: {
            height: 50,
          } as any,
        }}
      >
        <Slot />
      </Stack>
    </StampContext.Provider>
  );
};

export default Layout;
