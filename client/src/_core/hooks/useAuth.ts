import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const [session, setSession] = useState<Awaited<ReturnType<NonNullable<typeof supabase>["auth"]["getSession"]>>["data"]["session"]>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setSessionLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setSessionLoading(false);
      void utils.auth.me.invalidate();
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [utils]);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !sessionLoading && Boolean(session),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => utils.auth.me.setData(undefined, null),
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      if (supabase) await supabase.auth.signOut();
      setSession(null);
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    const user = meQuery.data ?? null;
    try {
      localStorage.setItem("personal-calendar-user-info", JSON.stringify(user));
    } catch {
      // Local storage is optional; authentication remains session-backed.
    }
    return {
      user,
      loading: sessionLoading || Boolean(session && meQuery.isLoading) || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(session && user),
    };
  }, [logoutMutation.error, logoutMutation.isPending, meQuery.data, meQuery.error, meQuery.isLoading, session, sessionLoading]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || sessionLoading || state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    window.dispatchEvent(new CustomEvent("supabase-auth-required"));
  }, [redirectOnUnauthenticated, redirectPath, sessionLoading, state.user]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
