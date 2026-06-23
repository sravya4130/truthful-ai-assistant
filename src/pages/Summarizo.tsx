import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Upload, Loader2, Copy, Check, Zap, ListTree, GraduationCap, Lightbulb, Wand2, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Mode = "quick" | "detailed" | "age" | "takeaways" | "simplify";
type AgeLevel = "10" | "15" | "college" | "pro";

const MODES: { id: Mode; label: string; desc: string; icon: any }[] = [
  { id: "quick", label: "Quick Summary", desc: "2–5 lines. Core essence.", icon: Zap },
  { id: "detailed", label: "Detailed Summary", desc: "Important points as bullets.", icon: ListTree },
  { id: "age", label: "Age-Based Explanation", desc: "Adapted to your level.", icon: GraduationCap },
  { id: "takeaways", label: "Key Takeaways", desc: "Insights, actions, facts.", icon: Lightbulb },
  { id: "simplify", label: "Smart Simplification", desc: "Difficult → easy language.", icon: Wand2 },
];

const AGES: { id: AgeLevel; label: string }[] = [
  { id: "10", label: "Like I'm 10" },
  { id: "15", label: "Like I'm 15" },
  { id: "college", label: "College student" },
  { id: "pro", label: "Professional" },
];

export default function Summarizo() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("quick");
  const [age, setAge] = useState<AgeLevel>("15");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { toast.error("File too large (max 15MB)"); return; }
    try {
      if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
        toast.loading("Reading PDF…", { id: "pdf" });
        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        const buf = await f.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        let full = "";
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          full += content.items.map((it: any) => it.str).join(" ") + "\n\n";
        }
        setText(full.trim());
        toast.success(`Loaded ${doc.numPages} pages`, { id: "pdf" });
      } else {
        const t = await f.text();
        setText(t);
        toast.success("File loaded");
      }
    } catch (e: any) {
      toast.error("Could not read file: " + e.message);
    }
  };

  const summarize = async () => {
    const content = text.trim();
    if (!content) { toast.error("Paste some content first"); return; }
    if (content.length < 30) { toast.error("Content is too short to summarize"); return; }
    setLoading(true);
    setResult("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const token = session?.access_token || apikey;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey,
        },
        body: JSON.stringify({ content: content.slice(0, 60000), mode, age }),
      });

      if (!resp.ok) {
        let msg = `Request failed (${resp.status})`;
        try {
          const j = await resp.json();
          if (j?.error) msg = typeof j.error === "string" ? j.error : JSON.stringify(j.error);
        } catch {}
        if (resp.status === 429) msg = "Too many requests. Please wait a moment and try again.";
        if (resp.status === 402) msg = "AI credits exhausted. Please add credits to continue.";
        toast.error(msg);
        setLoading(false);
        return;
      }
      if (!resp.body) { toast.error("No response from server"); setLoading(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE events are separated by blank lines; handle both \n\n and \r\n\r\n
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || "";
        for (const evt of events) {
          for (const rawLine of evt.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) { acc += delta; setResult(acc); }
            } catch {
              /* ignore non-JSON keepalives */
            }
          }
        }
      }
      if (!acc.trim()) toast.error("The model returned an empty response. Try again.");
    } catch (e: any) {
      toast.error(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };


  const copy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/app")} className="p-2 rounded-md hover:bg-accent transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center glow">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold text-gradient leading-none">Summarizo</h1>
              <p className="text-[11px] text-muted-foreground">Understand long content in seconds</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-2 gap-6">
        {/* INPUT */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-sm text-foreground">Your content</h2>
            <span className="text-xs text-muted-foreground">{wordCount} words</span>
          </div>

          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste an article, notes, essay, research, story, or anything long here…"
              className="w-full h-72 rounded-xl border border-border bg-card p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.pdf,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload .txt / .pdf
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output style</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-start gap-3 text-left p-3 rounded-lg border transition-all ${
                    mode === m.id
                      ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <m.icon className={`w-4 h-4 mt-0.5 shrink-0 ${mode === m.id ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {mode === "age" && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reading level</p>
              <div className="flex flex-wrap gap-2">
                {AGES.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAge(a.id)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                      age === a.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={summarize}
            disabled={loading || !text.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity glow"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Summarizing…</> : <><Sparkles className="w-4 h-4" /> Summarize</>}
          </button>
        </motion.section>

        {/* OUTPUT */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-sm text-foreground">Result</h2>
            {result && (
              <button onClick={copy} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md hover:bg-accent transition-colors">
                {copied ? <><Check className="w-3.5 h-3.5 text-primary" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
            )}
          </div>

          <div className="min-h-[28rem] rounded-xl border border-border bg-card p-5 overflow-auto">
            {!result && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-16">
                <FileText className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">Your summary will appear here</p>
                <p className="text-xs mt-1">Pick an output style and hit Summarize ✨</p>
              </div>
            )}
            {loading && !result && (
              <div className="h-full flex items-center justify-center text-muted-foreground py-16 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking…</span>
              </div>
            )}
            {result && (
              <article className="prose prose-sm prose-invert max-w-none dark:prose-invert">
                <ReactMarkdown>{result}</ReactMarkdown>
              </article>
            )}
          </div>
        </motion.section>
      </main>
    </div>
  );
}
