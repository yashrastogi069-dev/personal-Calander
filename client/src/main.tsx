import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { supabase } from "./lib/supabase";
import { withTimeout } from "@shared/withTimeout";
import { PwaProvider } from "./contexts/PwaContext";
import "./index.css";

document.documentElement.dataset.release = "independent-workbench";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.dispatchEvent(new CustomEvent("supabase-auth-required"));
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        const session = supabase ? (await withTimeout(supabase.auth.getSession(), 10_000, "Session lookup timed out. Please try again.")).data.session : null;
        return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      },
      async fetch(input, init) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        if (init?.signal?.aborted) abort();
        init?.signal?.addEventListener("abort", abort, { once: true });
        const timer = window.setTimeout(abort, 20_000);
        try {
          return await globalThis.fetch(input, {
            ...(init ?? {}), signal: controller.signal, credentials: "include",
          });
        } finally {
          window.clearTimeout(timer);
          init?.signal?.removeEventListener("abort", abort);
        }
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <PwaProvider><App /></PwaProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
