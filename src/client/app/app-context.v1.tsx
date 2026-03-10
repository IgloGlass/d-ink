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

const ACTIVE_FISCAL_YEAR_STORAGE_KEY_V1 = "dink.activeFiscalYear";

const emptyGlobalAppContextStateV1: GlobalAppContextStateV1 = {
  activeWorkspaceId: null,
  activeFiscalYear: null,
};

type GlobalAppContextUpdateV1 = Partial<GlobalAppContextStateV1>;

type GlobalAppContextValueV1 = GlobalAppContextStateV1 & {
  setActiveContext: (input: GlobalAppContextUpdateV1) => void;
};

const GlobalAppContextV1 = createContext<GlobalAppContextValueV1 | null>(null);

function normalizeWorkspaceIdV1(
  workspaceId: string | null | undefined,
): string | null {
  const normalizedWorkspaceId = workspaceId?.trim() ?? "";
  return normalizedWorkspaceId.length > 0 ? normalizedWorkspaceId : null;
}

function normalizeFiscalYearV1(
  fiscalYear: string | null | undefined,
): string | null {
  const normalizedFiscalYear = fiscalYear?.trim() ?? "";
  return normalizedFiscalYear.length > 0 ? normalizedFiscalYear : null;
}

function readPersistedFiscalYearV1(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeFiscalYearV1(
    window.localStorage.getItem(ACTIVE_FISCAL_YEAR_STORAGE_KEY_V1),
  );
}

function persistFiscalYearV1(fiscalYear: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (fiscalYear === null) {
    window.localStorage.removeItem(ACTIVE_FISCAL_YEAR_STORAGE_KEY_V1);
    return;
  }

  window.localStorage.setItem(ACTIVE_FISCAL_YEAR_STORAGE_KEY_V1, fiscalYear);
}

/**
 * Extract workspace context from canonical IA workspace paths.
 * This remains deterministic and route-shape aware for shared app-shell context sync.
 */
export function readWorkspaceIdFromPathnameV1(pathname: string): string | null {
  const workspaceMatch = pathname.match(
    /^\/app\/workspaces?\/([^/]+)(?:\/|$)/i,
  );
  const workspaceIdFromPath = workspaceMatch?.[1];
  if (!workspaceIdFromPath) {
    return null;
  }

  try {
    return normalizeWorkspaceIdV1(decodeURIComponent(workspaceIdFromPath));
  } catch {
    return normalizeWorkspaceIdV1(workspaceIdFromPath);
  }
}

export function GlobalAppContextProviderV1({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<GlobalAppContextStateV1>({
    ...emptyGlobalAppContextStateV1,
    activeFiscalYear: readPersistedFiscalYearV1(),
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
        ? normalizeWorkspaceIdV1(input.activeWorkspaceId)
        : current.activeWorkspaceId;

      const nextFiscalYear = hasFiscalYear
        ? normalizeFiscalYearV1(input.activeFiscalYear)
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

      if (next.activeFiscalYear !== current.activeFiscalYear) {
        persistFiscalYearV1(next.activeFiscalYear);
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
