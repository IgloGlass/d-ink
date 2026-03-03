import {
  type ReactNode,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

export type GlobalAppContextStateV1 = {
  activeFiscalYear: string | null;
  activeWorkspaceId: string | null;
};

type GlobalAppContextValueV1 = GlobalAppContextStateV1 & {
  setActiveContext: (input: GlobalAppContextStateV1) => void;
};

const GlobalAppContextV1 = createContext<GlobalAppContextValueV1 | null>(null);

export function GlobalAppContextProviderV1({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<GlobalAppContextStateV1>({
    activeWorkspaceId: null,
    activeFiscalYear: null,
  });

  const value = useMemo<GlobalAppContextValueV1>(
    () => ({
      ...state,
      setActiveContext: (input) => setState(input),
    }),
    [state],
  );

  return (
    <GlobalAppContextV1.Provider value={value}>
      {children}
    </GlobalAppContextV1.Provider>
  );
}

export function useGlobalAppContextV1(): GlobalAppContextValueV1 {
  const value = useContext(GlobalAppContextV1);
  if (!value) {
    throw new Error(
      "useGlobalAppContextV1 must be used inside GlobalAppContextProviderV1.",
    );
  }

  return value;
}
