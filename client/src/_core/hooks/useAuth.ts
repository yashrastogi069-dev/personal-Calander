import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

export function useAuth(_options?: UseAuthOptions) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<Error | null>(null);
  const [bootstrap, setBootstrap] = useState(0);
  const currentUser = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setSessionLoading(true);
    setSessionError(null);
    if (!supabase) {
      setSessionLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      if (!active) return;
      setSessionError(new Error("Your session could not be loaded. Please try again."));
      setSessionLoading(false);
    }, 10_000);
    const acceptSession = (next: Session | null) => {
      if (!active) return;
      window.clearTimeout(timer);
      const nextId = next?.user.id ?? null;
      if (currentUser.current !== nextId) {
        // A different account must never inherit planner data from the query cache.
        void queryClient.cancelQueries();
        queryClient.clear();
        currentUser.current = nextId;
      }
      setSession(next);
      setSessionError(null);
      setSessionLoading(false);
    };
    // Keep this callback synchronous: Supabase holds its auth lock while calling it.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => acceptSession(next));
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      acceptSession(data.session);
    }).catch(error => {
      if (!active) return;
      window.clearTimeout(timer);
      setSessionError(error instanceof Error ? error : new Error("Session unavailable."));
      setSessionLoading(false);
    });
    return () => {
      active = false;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [bootstrap, queryClient]);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !sessionLoading && !sessionError && Boolean(session),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const user = session && meQuery.data?.supabaseUserId === session.user.id ? meQuery.data : null;
  const logout = useCallback(async () => {
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      }
      await queryClient.cancelQueries();
      queryClient.clear();
      currentUser.current = null;
      setSession(null);
      setSessionError(null);
    } catch (error) {
      setSessionError(error instanceof Error ? error : new Error("Sign-out failed. Please try again."));
    }
  }, [queryClient]);

  return {
    user,
    loading: sessionLoading || Boolean(session && meQuery.isLoading && !sessionError),
    error: sessionError ?? (session ? meQuery.error : null),
    isAuthenticated: Boolean(user),
    refresh: async () => {
      if (sessionError) setBootstrap(value => value + 1);
      else await meQuery.refetch();
    },
    logout,
  };
}
