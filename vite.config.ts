import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const DEFAULT_API_PROXY_TARGET_V1 = "http://127.0.0.1:8787";

function resolveApiProxyTargetV1(rawValue: string | undefined): string {
  const configuredValue = rawValue?.trim() || DEFAULT_API_PROXY_TARGET_V1;

  try {
    return new URL(configuredValue).toString();
  } catch {
    throw new Error(
      `DINK_API_PROXY_TARGET must be a valid absolute URL. Received: ${configuredValue}`,
    );
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = resolveApiProxyTargetV1(env.DINK_API_PROXY_TARGET);

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy: {
        "/v1": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
