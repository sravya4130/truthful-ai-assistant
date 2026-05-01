import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function OnboardingModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded, age")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data && !data.onboarded) setOpen(true);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const ageNum = parseInt(age);
    if (!ageNum || ageNum < 5 || ageNum > 120) {
      toast.error("Please enter a valid age");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ age: ageNum, onboarded: true })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save — try again");
      return;
    }
    toast.success("All set. Responses will be tuned for you.");
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="glass rounded-2xl p-8 max-w-md w-full"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-heading text-2xl font-bold">One quick question</h2>
            </div>
            <p className="text-muted-foreground mb-6 text-sm">
              How old are you? TruthAI tunes its tone, examples, and depth to your age — so a 12-year-old and a 35-year-old get different answers to the same question.
            </p>
            <div className="space-y-2 mb-6">
              <Label htmlFor="age">Your age</Label>
              <Input
                id="age"
                type="number"
                min={5}
                max={120}
                placeholder="e.g. 18"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Stored on your profile. You can change it later.</p>
            </div>
            <Button onClick={handleSave} disabled={saving || !age} className="w-full glow">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
