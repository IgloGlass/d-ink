import { createD1AuthRepositoryV1 } from "../../db/repositories/auth.repository.v1";
import { createD1WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import type { Env } from "../../shared/types/env";
import type {
  AuthMagicLinkDepsV1,
  ResolveSessionPrincipalDepsV1,
} from "./auth-magic-link.v1";
import type { WorkspaceLifecycleDepsV1 } from "./workspace-lifecycle.v1";

/**
 * Creates environment-backed dependencies for the auth magic-link workflow.
 */
export function createAuthMagicLinkDepsV1(env: Env): AuthMagicLinkDepsV1 {
  return {
    authRepository: createD1AuthRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    generateToken: () => {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);

      let binary = "";
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }

      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    },
    nowIsoUtc: () => new Date().toISOString(),
    hmacSecret: env.AUTH_TOKEN_HMAC_SECRET,
  };
}

/**
 * Creates dependencies for session-token principal lookups.
 */
export function createResolveSessionPrincipalDepsV1(
  env: Env,
): ResolveSessionPrincipalDepsV1 {
  return {
    authRepository: createD1AuthRepositoryV1(env.DB),
    nowIsoUtc: () => new Date().toISOString(),
    hmacSecret: env.AUTH_TOKEN_HMAC_SECRET,
  };
}

/**
 * Creates environment-backed dependencies for workspace lifecycle workflows.
 */
export function createWorkspaceLifecycleDepsV1(
  env: Env,
): WorkspaceLifecycleDepsV1 {
  return {
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}
