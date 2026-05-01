import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, FileText, Download, ArrowLeft, Heart, GraduationCap, Briefcase, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import pptxgen from "pptxgenjs";

type TemplateKey = "wedding" | "resume" | "school" | "work";

const TEMPLATES: Record<TemplateKey, {
  label: string;
  desc: string;
  icon: typeof FileText;
  bg: string;
  accent: string;
  text: string;
  titleFont: string;
  bodyFont: string;
}> = {
  wedding: {
    label: "Wedding",
    desc: "Romantic, warm, elegant",
    icon: Heart,
    bg: "FFF8F5",
    accent: "C9A96E",
    text: "3D2E2A",
    titleFont: "Georgia",
    bodyFont: "Calibri",
  },
  resume: {
    label: "Resume",
    desc: "Professional CV slides",
    icon: Briefcase,
    bg: "FFFFFF",
    accent: "1E2761",
    text: "212121",
    titleFont: "Calibri",
    bodyFont: "Calibri",
  },
  school: {
    label: "School Project",
    desc: "Clear, educational, friendly",
    icon: GraduationCap,
    bg: "F5F9FF",
    accent: "028090",
    text: "1A2A3A",
    titleFont: "Trebuchet MS",
    bodyFont: "Calibri",
  },
  work: {
    label: "Work / Business",
    desc: "Corporate, executive, sharp",
    icon: BookOpen,
    bg: "0F172A",
    accent: "60A5FA",
    text: "F1F5F9",
    titleFont: "Calibri",
    bodyFont: "Calibri",
  },
};

interface SlideContent {
  title: string;
  bullets: string[];
  notes?: string;
}

export default function PPTGenerator() {
  const { user, loading: authLoading } = useAuth();
  const [template, setTemplate] = useState<TemplateKey>("work");
  const [prompt, setPrompt] = useState("");
  const [slideCount, setSlideCount] = useState(8);
  const [generating, setGenerating] = useState(false);
  const [lastTitle, setLastTitle] = useState<string | null>(null);

  const buildAndDownload = async (
    title: string,
    subtitle: string,
    slides: SlideContent[],
    tplKey: TemplateKey
  ) => {
    const tpl = TEMPLATES[tplKey];
    const pptx = new pptxgen();
    pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
    pptx.title = title;

    const isDark = tplKey === "work";
    const subText = isDark ? "94A3B8" : "6B7280";

    // Cover slide
    const cover = pptx.addSlide();
    cover.background = { color: tpl.bg };
    cover.addShape("rect", { x: 0, y: 6.7, w: 13.33, h: 0.15, fill: { color: tpl.accent } });
    cover.addText(title, {
      x: 0.6, y: 2.4, w: 12.1, h: 1.6,
      fontSize: 48, bold: true, color: tpl.text, fontFace: tpl.titleFont,
      align: "left", valign: "middle",
    });
    cover.addText(subtitle, {
      x: 0.6, y: 4.2, w: 12.1, h: 0.8,
      fontSize: 22, color: subText, fontFace: tpl.bodyFont, align: "left",
    });
    cover.addText(tpl.label.toUpperCase(), {
      x: 0.6, y: 0.5, w: 12.1, h: 0.4,
      fontSize: 12, bold: true, color: tpl.accent, fontFace: tpl.bodyFont, charSpacing: 4,
    });

    // Content slides
    slides.forEach((s, idx) => {
      const slide = pptx.addSlide();
      slide.background = { color: tpl.bg };

      // Slide number
      slide.addText(String(idx + 1).padStart(2, "0"), {
        x: 12.3, y: 0.3, w: 0.8, h: 0.4,
        fontSize: 11, color: subText, align: "right", fontFace: tpl.bodyFont,
      });

      // Title bar
      slide.addShape("rect", {
        x: 0.6, y: 0.6, w: 0.08, h: 0.7, fill: { color: tpl.accent },
      });
      slide.addText(s.title, {
        x: 0.85, y: 0.55, w: 11.5, h: 0.8,
        fontSize: 32, bold: true, color: tpl.text, fontFace: tpl.titleFont,
        valign: "middle",
      });

      // Bullets
      const bullets = (s.bullets || []).slice(0, 7).map((b) => ({
        text: b,
        options: { bullet: { code: "25CF" }, color: tpl.text, fontSize: 18, fontFace: tpl.bodyFont, paraSpaceAfter: 10 },
      }));
      slide.addText(bullets as any, {
        x: 0.85, y: 1.7, w: 11.6, h: 5.2,
        valign: "top",
      });

      if (s.notes) slide.addNotes(s.notes);
    });

    // Closing slide
    const closing = pptx.addSlide();
    closing.background = { color: tpl.bg };
    closing.addText("Thank you", {
      x: 0.6, y: 3.0, w: 12.1, h: 1.5,
      fontSize: 60, bold: true, color: tpl.text, fontFace: tpl.titleFont, align: "center",
    });
    closing.addShape("rect", { x: 5.5, y: 4.6, w: 2.3, h: 0.06, fill: { color: tpl.accent } });

    const fname = `${title.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "presentation"}.pptx`;
    await pptx.writeFile({ fileName: fname });
  };

  const handleGenerate = async () => {
    const text = prompt.trim();
    if (!text) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ppt-content", {
        body: { prompt: text, template, slideCount },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const { title, subtitle, slides } = data as { title: string; subtitle: string; slides: SlideContent[] };
      if (!slides?.length) throw new Error("No slides returned");
      await buildAndDownload(title, subtitle || "", slides, template);
      setLastTitle(title);
      toast.success("Presentation downloaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--gradient-surface)" }}>
        <div className="glass rounded-2xl p-8 max-w-sm text-center">
          <p className="mb-4">Sign up to use the PPT Generator.</p>
          <Link to="/app"><Button>Go sign up</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-surface)" }}>
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to chat
          </Link>
          <h1 className="font-heading text-2xl font-bold text-gradient">PPT Generator</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-heading text-lg font-bold mb-3">1. Pick a template</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {(Object.keys(TEMPLATES) as TemplateKey[]).map((key) => {
              const t = TEMPLATES[key];
              const active = template === key;
              return (
                <button
                  key={key}
                  onClick={() => setTemplate(key)}
                  className={`group p-5 rounded-xl border text-left transition-all ${
                    active
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: `#${t.accent}20`, color: `#${t.accent}` }}
                  >
                    <t.icon className="w-5 h-5" />
                  </div>
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                </button>
              );
            })}
          </div>

          <h2 className="font-heading text-lg font-bold mb-3">2. Describe what you want</h2>
          <div className="glass rounded-2xl p-6 mb-6">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                template === "wedding"
                  ? "Wedding of Sarah & Daniel, July 2026 in Tuscany. Include love story, venue, ceremony details..."
                  : template === "resume"
                  ? "Resume for a senior product designer with 8 years of experience, skilled in Figma, design systems..."
                  : template === "school"
                  ? "Class 9 science project on the water cycle. Cover evaporation, condensation, precipitation..."
                  : "Q4 strategy presentation for SaaS company. Focus on growth, retention, and product roadmap..."
              }
              rows={5}
              className="bg-background/60 resize-none mb-4"
            />
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Number of content slides</label>
                <span className="text-sm text-primary font-medium">{slideCount}</span>
              </div>
              <Slider min={3} max={15} step={1} value={[slideCount]} onValueChange={(v) => setSlideCount(v[0])} />
            </div>
            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} className="w-full glow">
              {generating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Generate & Download .pptx</>
              )}
            </Button>
          </div>

          {lastTitle && (
            <div className="text-sm text-muted-foreground text-center">
              Last generated: <span className="text-foreground font-medium">{lastTitle}</span>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
