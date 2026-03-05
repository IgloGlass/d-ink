import {
  QueryClient,
  type QueryClientConfig,
  QueryClientProvider,
} from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { I18nProviderV1 } from "../lib/i18n/i18n-provider.v1";
import { GlobalAppContextProviderV1 } from "./app-context.v1";

function createQueryClient(): QueryClient {
  const config: QueryClientConfig = {
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 10_000,
      },
      mutations: {
        retry: false,
      },
    },
  };

  return new QueryClient(config);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Keep app context outside locale wiring so navigation state survives i18n updates. */}
      <GlobalAppContextProviderV1>
        <I18nProviderV1>{children}</I18nProviderV1>
      </GlobalAppContextProviderV1>
    </QueryClientProvider>
  );
}
