import { z } from "zod";

import { loadAiModuleConfigV1 } from "../../runtime/module-config.v1";
import moduleSpecJson from "./module-spec.v1.json";
import policyPackJson from "./policy-pack.annual-report-analysis.v1.json";

const AnnualReportAnalysisPolicyPackV1Schema = z
  .object({
    schemaVersion: z.literal("ai_policy_pack_v1"),
    moduleId: z.literal("annual-report-analysis"),
    policyVersion: z.string().trim().min(1),
    reviewThresholds: z
      .object({
        fieldConfidenceBelow: z.number().min(0).max(1),
        warnOnMissingFields: z.boolean(),
      })
      .strict(),
    taxSignalCatalog: z.array(
      z
        .object({
          code: z.string().trim().min(1),
          label: z.string().trim().min(1),
        })
        .strict(),
    ),
  })
  .strict();

export type AnnualReportAnalysisPolicyPackV1 = z.infer<
  typeof AnnualReportAnalysisPolicyPackV1Schema
>;

export function loadAnnualReportAnalysisModuleConfigV1() {
  return loadAiModuleConfigV1({
    moduleSpec: moduleSpecJson,
    policyPack: policyPackJson,
    policySchema: AnnualReportAnalysisPolicyPackV1Schema,
  });
}
