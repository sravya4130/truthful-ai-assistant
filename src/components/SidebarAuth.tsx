import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function SidebarAuth() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      setLoading(false);
    }
  };

  const handlePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!otpSent) {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) throw error;
        setOtpSent(true);
        toast.success("Code sent");
      } else {
        const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Phone sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-5 space-y-3"
    >
      <div>
        <p className="font-heading text-sm font-bold text-foreground">
          {mode === "signup" ? "Sign up to save chats" : "Welcome back"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {mode === "signup" ? "Free. No credit card." : "Sign in to continue"}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleGoogle}
        disabled={loading}
        className="w-full bg-card hover:bg-secondary text-xs h-9"
      >
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </Button>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <div className="flex-1 h-px bg-border" />
        OR
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-md bg-secondary p-1">
        <button
          type="button"
          onClick={() => setMethod("email")}
          className={`h-8 rounded text-xs transition-colors ${method === "email" ? "bg-card text-foreground" : "text-muted-foreground"}`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setMethod("phone")}
          className={`h-8 rounded text-xs transition-colors ${method === "phone" ? "bg-card text-foreground" : "text-muted-foreground"}`}
        >
          Phone
        </button>
      </div>

      {method === "email" ? (
        <form onSubmit={handleEmail} className="space-y-2">
          <Input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 text-xs"
          />
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 text-xs pr-9"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <Button type="submit" disabled={loading} size="sm" className="w-full h-9 text-xs">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
        </form>
      ) : (
        <form onSubmit={handlePhone} className="space-y-2">
          <Input
            type="tel"
            required
            placeholder="Phone number with country code"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-9 text-xs"
          />
          {otpSent && (
            <Input
              inputMode="numeric"
              required
              placeholder="Verification code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="h-9 text-xs"
            />
          )}
          <Button type="submit" disabled={loading} size="sm" className="w-full h-9 text-xs">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : otpSent ? "Verify code" : "Send code"}
          </Button>
        </form>
      )}

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </motion.div>
  );
}
