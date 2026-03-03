import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    maxWorkers: 1,
    minWorkers: 1,
    poolOptions: {
      workers: {
        singleWorker: true,
        wrangler: {
          configPath: "./wrangler.toml",
        },
      },
    },
  },
});
