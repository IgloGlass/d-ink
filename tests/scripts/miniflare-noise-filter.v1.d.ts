declare module "*.mjs" {
  export function filterKnownMiniflareCleanupFromStderrV1(input: string): {
    filteredText: string;
    suppressedLineCount: number;
  };

  export function isKnownMiniflareEbusyCleanupLineV1(input: string): boolean;

  const defaultExport: unknown;
  export default defaultExport;
}
