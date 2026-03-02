import { createD1AuditRepositoryV1 } from "../../db/repositories/audit.repository.v1";
import { createD1AuthRepositoryV1 } from "../../db/repositories/auth.repository.v1";
import { createD1MappingPreferenceRepositoryV1 } from "../../db/repositories/mapping-preference.repository.v1";
import { createD1TbPipelineArtifactRepositoryV1 } from "../../db/repositories/tb-pipeline-artifact.repository.v1";
import { createD1WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { executeMappingReviewModelV1 } from "../ai/modules/mapping-review/executor.v1";
import { loadMappingReviewModuleConfigV1 } from "../ai/modules/mapping-review/loader.v1";
import type { Env } from "../../shared/types/env";
import type {
  AuthMagicLinkDepsV1,
  ResolveSessionPrincipalDepsV1,
} from "./auth-magic-link.v1";
import type { MappingOverrideDepsV1 } from "./mapping-override.v1";
import type { MappingReviewDepsV1 } from "./mapping-review.v1";
import type { TrialBalancePipelineRunDepsV1 } from "./trial-balance-pipeline-run.v1";
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

/**
 * Creates environment-backed dependencies for deterministic TB pipeline runs.
 */
export function createTrialBalancePipelineRunDepsV1(
  env: Env,
): TrialBalancePipelineRunDepsV1 {
  return {
    artifactRepository: createD1TbPipelineArtifactRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    mappingPreferenceRepository: createD1MappingPreferenceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

/**
 * Creates environment-backed dependencies for mapping override workflows.
 */
export function createMappingOverrideDepsV1(env: Env): MappingOverrideDepsV1 {
  return {
    artifactRepository: createD1TbPipelineArtifactRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    mappingPreferenceRepository: createD1MappingPreferenceRepositoryV1(env.DB),
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

/**
 * Creates environment-backed dependencies for mapping-review suggestion workflows.
 */
export function createMappingReviewDepsV1(env: Env): MappingReviewDepsV1 {
  return {
    artifactRepository: createD1TbPipelineArtifactRepositoryV1(env.DB),
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    loadModuleConfig: loadMappingReviewModuleConfigV1,
    runModel: executeMappingReviewModelV1,
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}
