import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";

function getFriendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();

  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Can’t reach login right now. The backend is paused or waking up — try again in a moment.";
  }
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Email or password is incorrect.";
  }
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "This email already has an account. Switch to Sign in.";
  }
  if (lower.includes("rate limit")) {
    return "Too many tries. Please wait a minute and try again.";
  }

  return message || "Authentication failed. Please try again.";
}

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/app", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: {
              full_name: displayName.trim() || cleanEmail.split("@")[0],
            },
          },
        });

        if (error) throw error;

        toast.success(data.session ? "Account created — welcome in ✨" : "Account created. Please sign in to continue.");
        if (data.session) navigate("/app", { replace: true });
        else setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        toast.success("Login successful");
        navigate("/app", { replace: true });
      }
    } catch (err: any) {
      toast.error(getFriendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen auth-den-bg flex items-center justify-center px-4 py-8">

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md auth-browser rounded-lg overflow-hidden">

        <div className="h-8 flex items-center justify-between px-3 border-b border-border/70 bg-secondary/50">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <Link to="/" className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
            truthful.ai / den
          </Link>
          <span className="w-12" />
        </div>

        <div className="px-5 pb-6 pt-12 relative">
          <div className="absolute left-1/2 top-4 -translate-x-1/2 h-24 w-24 rounded-full auth-mascot flex items-end justify-center text-3xl" aria-hidden="true">
            <span className="translate-y-2">🐾</span>
          </div>

          <div className="auth-card rounded-2xl px-5 pb-5 pt-16 space-y-4 mt-8">
            <div className="text-center space-y-1">
              <h1 className="font-heading text-3xl font-bold text-foreground">Den</h1>
              <p className="text-xs text-muted-foreground">
                {mode === "signup" ? "Create your account. Your chats stay safe." : "Welcome back. Your AI is keeping watch."}
              </p>
            </div>

            <form onSubmit={handleEmail} className="space-y-3">

              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Display name</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="frostpup"
                    className="auth-input h-11 text-sm"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="auth-input h-11 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Password</Label>

                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="auth-input h-11 pr-10 text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Session saved</span>
                <button type="button" onClick={() => toast("Password reset is coming soon.")} className="hover:text-foreground transition-colors">
                  Forgot password?
                </button>
              </div>

              <Button type="submit" disabled={loading} className="auth-button w-full h-11 rounded-lg text-sm font-semibold hover:opacity-95">
                {loading ? <Loader2 className="animate-spin" /> :
                  <>{mode === "signup" ? "Create account" : "Sign in"}<ArrowRight className="h-4 w-4" /></>}
              </Button>

            </form>

            <button
              type="button"
              onClick={() => navigate("/app")}
              className="w-full rounded-lg border border-border/70 bg-secondary/50 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
            >
              Continue as guest
            </button>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "signup"
                ? "Already have an account?"
                : "Don't have an account?"}

              <button
                onClick={() =>
                  setMode(mode === "signup" ? "signin" : "signup")
                }
                className="text-primary hover:text-foreground ml-1 font-medium transition-colors"
              >
                {mode === "signup" ? "Login" : "Sign up"}
              </button>
            </p>

          </div>
        </div>

      </motion.div>
    </div>
  );
}
