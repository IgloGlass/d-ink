import { useOutletContext } from "react-router-dom";

import type { SessionPrincipalV1 } from "../lib/http/auth-api";

/**
 * Returns the authenticated tenant principal provided by the protected app layout.
 */
export function useRequiredSessionPrincipalV1(): SessionPrincipalV1 {
  return useOutletContext<SessionPrincipalV1>();
}
