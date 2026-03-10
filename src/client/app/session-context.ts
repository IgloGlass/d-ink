import { useOutletContext } from "react-router-dom";

import type { SessionPrincipalV1 } from "../lib/http/auth-api";

/**
 * Returns the authenticated tenant principal provided by the protected app layout.
 */
export function useRequiredSessionPrincipalV1(): SessionPrincipalV1 {
  const principal = useOutletContext<SessionPrincipalV1 | undefined>();
  if (!principal) {
    throw new Error(
      "Session principal context is missing. Reload the app or return to the company landing page.",
    );
  }

  return principal;
}
