import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type GlobalAppContextStateV1 = {
  activeFiscalYear: string | null;
  activeWorkspaceId: string | null;
};

const emptyGlobalAppContextStateV1: GlobalAppContextStateV1 = {
  activeWorkspaceId: null,
  activeFiscalYear: null,
};

type GlobalAppContextUpdateV1 = Partial<GlobalAppContextStateV1>;

type GlobalAppContextValueV1 = GlobalAppContextStateV1 & {
  setActiveContext: (input: GlobalAppContextUpdateV1) => void;
};

const GlobalAppContextV1 = createContext<GlobalAppContextValueV1 | null>(null);

export function GlobalAppContextProviderV1({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<GlobalAppContextStateV1>({
    ...emptyGlobalAppContextStateV1,
  });

  const setActiveContext = useCallback((input: GlobalAppContextUpdateV1) => {
    setState((current) => {
      const hasWorkspaceId = Object.prototype.hasOwnProperty.call(
        input,
        "activeWorkspaceId",
      );
      const hasFiscalYear = Object.prototype.hasOwnProperty.call(
        input,
        "activeFiscalYear",
      );

      const nextWorkspaceId = hasWorkspaceId
        ? (input.activeWorkspaceId ?? null)
        : current.activeWorkspaceId;

      // Workspace changes without an explicit fiscal year should clear stale badges.
      const nextFiscalYear = hasFiscalYear
        ? (input.activeFiscalYear ?? null)
        : hasWorkspaceId && nextWorkspaceId !== current.activeWorkspaceId
          ? null
          : current.activeFiscalYear;

      const next: GlobalAppContextStateV1 = {
        activeWorkspaceId: nextWorkspaceId,
        activeFiscalYear: nextFiscalYear,
      };

      if (
        next.activeWorkspaceId === current.activeWorkspaceId &&
        next.activeFiscalYear === current.activeFiscalYear
      ) {
        return current;
      }

      return next;
    });
  }, []);

  const value = useMemo<GlobalAppContextValueV1>(
    () => ({
      ...state,
      setActiveContext,
    }),
    [setActiveContext, state],
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
