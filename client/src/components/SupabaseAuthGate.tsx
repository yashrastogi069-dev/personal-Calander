import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@shared/withTimeout";

type GoogleOAuthClient = {
  auth: {
    signInWithOAuth(input: {
      provider: "google";
      options: { redirectTo: string };
    }): Promise<{ data: unknown; error: { message: string } | null }>;
  };
};

export function startGoogleOAuth(client: GoogleOAuthClient, redirectTo: string) {
  return withTimeout(
    client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    }),
    15_000,
    "Google sign-in took too long. Please try again.",
  );
}

export function SupabaseAuthGate() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const open = () => document.getElementById("supabase-email")?.focus();
    window.addEventListener("supabase-auth-required", open);
    return () => window.removeEventListener("supabase-auth-required", open);
  }, []);

  async function signInWithGoogle() {
    setPending(true);
    setError(null);
    setNotice(null);
    if (!supabase) {
      setError("Authentication is not configured for this deployment.");
      setPending(false);
      return;
    }
    try {
      const result = await startGoogleOAuth(supabase, window.location.origin);
      if (result.error) {
        setError(`Google sign-in is unavailable: ${result.error.message}. Check that the Google provider and this site's redirect URL are configured in Supabase.`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    if (!supabase) {
      setError("Authentication is not configured for this deployment.");
      setPending(false);
      return;
    }
    try {
      const result = await withTimeout(mode === "sign-in"
        ? supabase.auth.signInWithPassword({ email: email.trim(), password })
        : supabase.auth.signUp({ email: email.trim(), password }), 15_000, "Sign-in took too long. Please try again.");
      if (result.error) {
        setError(result.error.message);
      } else if (mode === "sign-up" && !result.data.session) {
        setNotice("Check your email to confirm the account, then return here to sign in.");
      } else {
        setNotice(mode === "sign-in" ? "Signed in." : "Account created.");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-[0_22px_70px_-36px_hsl(var(--foreground)/.45)]">
        <CardHeader className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Personal Calendar</p>
          <CardTitle className="text-2xl font-bold tracking-tight">Sign in to continue</CardTitle>
          <CardDescription className="text-sm leading-6">
            Your planner is private to your account. Continue with Google or use the email and password you control.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            {!supabase ? <p role="alert">Sign-in is not configured for this deployment. Contact the deployment owner.</p> : null}
            <Button type="button" size="lg" className="w-full" disabled={pending || !supabase} onClick={() => void signInWithGoogle()}>
              {pending ? "Working…" : "Continue with Google"}
            </Button>
            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">or use email</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supabase-email">Email</Label>
              <Input id="supabase-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supabase-password">Password</Label>
              <Input id="supabase-password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={event => setPassword(event.target.value)} />
            </div>
            {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{error}</p> : null}
            {notice ? <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">{notice}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={pending || !supabase}>
              {pending ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
            <button type="button" className="w-full rounded-md py-2 text-sm font-bold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(null); setNotice(null); }}>
              {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
