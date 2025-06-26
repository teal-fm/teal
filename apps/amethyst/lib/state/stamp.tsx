import { createContext, PropsWithChildren, useContext, useState } from "react";
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

export const StampProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<StampContextState>({
    step: StampStep.IDLE,
    resetSearchState: false,
  });

  return (
    <StampContext.Provider value={{ state, setState }}>
      {children}
    </StampContext.Provider>
  );
};

export const useStampCtx = () => {
  const ctx = useContext(StampContext);
  if (!ctx) throw new Error('useStampCtx() must be called inside a <StampProvider />!');
  return ctx;
};
