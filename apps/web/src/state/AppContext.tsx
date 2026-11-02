import { createContext, useContext, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Store } from "../platform/store";
import type { AiClient } from "../platform/ai";

interface Services { store: Store; ai: AiClient }
const Ctx = createContext<Services | null>(null);

/** Dependency injection: components get the store and AI client from here, so tests can pass fakes. */
export function AppProviders({ store, ai, client, children }: Services & { client?: QueryClient; children: ReactNode }) {
  const qc = client ?? new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  return (
    <Ctx.Provider value={{ store, ai }}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </Ctx.Provider>
  );
}

export function useServices(): Services {
  const s = useContext(Ctx);
  if (!s) throw new Error("useServices must be used inside <AppProviders>");
  return s;
}
