import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

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
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    if (result.error) {
      setError(result.error.message);
    } else if (mode === "sign-up" && !result.data.session) {
      setNotice("Check your email to confirm the account, then return here to sign in.");
    } else {
      setNotice(mode === "sign-in" ? "Signed in." : "Account created.");
    }
    setPending(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-[0_22px_70px_-36px_hsl(var(--foreground)/.45)]">
        <CardHeader className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Personal Calendar</p>
          <CardTitle className="text-2xl font-bold tracking-tight">Sign in to continue</CardTitle>
          <CardDescription className="text-sm leading-6">
            Your planner is private to your account. Use the email and password you control for this deployment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
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
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
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
