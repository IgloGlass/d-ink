import { z } from "zod";

import { loadAiModuleConfigV1 } from "../../runtime/module-config.v1";
import moduleSpecJson from "./module-spec.v1.json";
import policyPackJson from "./policy-pack.annual-report-tax-analysis.v1.json";

const AnnualReportTaxAnalysisPolicyPackV1Schema = z
  .object({
    schemaVersion: z.literal("ai_policy_pack_v1"),
    moduleId: z.literal("annual-report-tax-analysis"),
    policyVersion: z.string().trim().min(1),
    reviewThresholds: z
      .object({
        highRiskFindingCountAbove: z.number().int().nonnegative(),
        missingInformationCountAbove: z.number().int().nonnegative(),
      })
      .strict(),
    focusAreas: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

export type AnnualReportTaxAnalysisPolicyPackV1 = z.infer<
  typeof AnnualReportTaxAnalysisPolicyPackV1Schema
>;

export function loadAnnualReportTaxAnalysisModuleConfigV1() {
  return loadAiModuleConfigV1({
    moduleSpec: moduleSpecJson,
    policyPack: policyPackJson,
    policySchema: AnnualReportTaxAnalysisPolicyPackV1Schema,
  });
}
