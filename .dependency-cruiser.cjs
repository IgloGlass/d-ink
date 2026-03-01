/** @type {import("dependency-cruiser").CruiseOptions} */
module.exports = {
  forbidden: [
    {
      name: "no-circular-deps",
      comment:
        "Circular dependencies make module behavior harder to reason about and test.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-client-to-server-db",
      comment:
        "Client code must never import server or database modules directly.",
      severity: "error",
      from: { path: "^src/client" },
      to: { path: "^src/(server|db)" },
    },
    {
      name: "no-server-db-to-client",
      comment:
        "Server and database layers must stay isolated from client code.",
      severity: "error",
      from: { path: "^src/(server|db)" },
      to: { path: "^src/client" },
    },
    {
      name: "no-routes-to-repositories",
      comment:
        "HTTP route handlers must call workflow/services, not repository implementations.",
      severity: "error",
      from: { path: "^src/server/http/.*-routes\\.v1\\.ts$" },
      to: { path: "^src/db/repositories" },
    },
  ],
  options: {
    includeOnly: "^src",
    doNotFollow: { path: "(^node_modules)|\\.d\\.ts$" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "^node_modules/[^/]+",
      },
    },
  },
};
