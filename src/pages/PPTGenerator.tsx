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
import muslimInvite from "@/assets/wedding-muslim.jpg";
import christianInvite from "@/assets/wedding-christian.jpg";
import hinduInvite from "@/assets/wedding-hindu.jpg";

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function parseInvitation(text: string) {
  const names = text.match(/([A-Z][a-zA-Z]+)\s*(?:&|and)\s*([A-Z][a-zA-Z]+)/);
  const date = text.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  const time = text.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))/);
  const venue = text.match(/(?:venue|at|@)\s*[:\-]?\s*([A-Z][\w\s&,'\-]{3,60})/);
  return {
    names: names ? `${names[1]} & ${names[2]}` : null,
    date: date ? date[1] : null,
    time: time ? time[1] : null,
    venue: venue ? venue[1].trim().replace(/[,.]$/, "") : null,
  };
}

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

    if (tplKey === "wedding") return renderWedding(pptx, title, subtitle, slides, prompt);
    if (tplKey === "resume") return renderResume(pptx, title, subtitle, slides);
    if (tplKey === "school") return renderSchool(pptx, title, subtitle, slides);
    return renderWork(pptx, title, subtitle, slides, tpl);
  };

  // Detect religion/culture cues from user prompt to theme the wedding deck
  const detectReligion = (text: string) => {
    const t = text.toLowerCase();
    if (/(hindu|indian|sangeet|mandap|baraat|saree|sanskrit)/.test(t))
      return { key: "hindu", bg: "FFF5E6", ink: "5C1A1B", accent: "C8102E", gold: "D4A017", couple: "🕉  •  💑  •  🌺", motto: "शुभ विवाह", couples: "👰🏽‍♀️ 🤵🏽‍♂️" };
    if (/(christian|church|catholic|cathedral|bible)/.test(t))
      return { key: "christian", bg: "FFFFFF", ink: "1A1F36", accent: "8B7355", gold: "B8924A", couple: "✝  •  💒  •  🤍", motto: "Holy Matrimony", couples: "👰‍♀️ 🤵‍♂️" };
    if (/(muslim|islam|nikah|mehndi|arabic)/.test(t))
      return { key: "muslim", bg: "F4F1E8", ink: "1B3A2E", accent: "0F5132", gold: "C9A227", couple: "☾  •  💚  •  ❀", motto: "نکاح مبارک", couples: "👰🏽 🤵🏽" };
    if (/(sikh|gurdwara|anand karaj|punjabi)/.test(t))
      return { key: "sikh", bg: "FFF8E7", ink: "5A2A0C", accent: "FF6B1A", gold: "D4A017", couple: "☬  •  💛  •  ✦", motto: "Anand Karaj", couples: "👰🏽‍♀️ 🤵🏽‍♂️" };
    if (/(jewish|chuppah|mazel|hebrew)/.test(t))
      return { key: "jewish", bg: "F6F8FB", ink: "1B2A4E", accent: "1B4F8C", gold: "C9A84C", couple: "✡  •  💙  •  ❀", motto: "Mazel Tov", couples: "👰 🤵" };
    return { key: "classic", bg: "FBF6F0", ink: "3D2E2A", accent: "B8924A", gold: "B8924A", couple: "♡  •  ⚜  •  ♡", motto: "Together Forever", couples: "👰 🤵" };
  };

  // ───────── WEDDING — religion-aware, image-based invitations ─────────
  const renderWedding = async (
    pptx: pptxgen, title: string, subtitle: string, slides: SlideContent[], userPrompt: string
  ) => {
    const theme = detectReligion(userPrompt + " " + title + " " + subtitle);
    const info = parseInvitation(userPrompt);
    const names = info.names || title || "Bride & Groom";
    const date = info.date || "Date to be announced";
    const time = info.time || "";
    const venue = info.venue || "Venue to be announced";

    // Religion-specific reference invitation as background
    const REF: Record<string, { src: string; cover: { x: number; y: number; w: number; h: number; fill: string }; ink: string; nameFont: string; bodyFont: string; nameSize: number }> = {
      muslim: {
        src: muslimInvite,
        cover: { x: 0.5, y: 7.4, w: 6.5, h: 2.6, fill: "F5E0CC" },
        ink: "5C2A1B", nameFont: "Monotype Corsiva", bodyFont: "Georgia", nameSize: 40,
      },
      christian: {
        src: christianInvite,
        cover: { x: 0.6, y: 3.8, w: 6.3, h: 2.2, fill: "FFFFFF" },
        ink: "1A1F36", nameFont: "Monotype Corsiva", bodyFont: "Georgia", nameSize: 38,
      },
      hindu: {
        src: hinduInvite,
        cover: { x: 0.6, y: 1.6, w: 6.3, h: 4.6, fill: "ECE8D4" },
        ink: "5A4A1A", nameFont: "Monotype Corsiva", bodyFont: "Georgia", nameSize: 42,
      },
    };

    const ref = REF[theme.key];

    if (ref) {
      // Portrait layout to match the reference invitation
      pptx.defineLayout({ name: "INV_PORTRAIT", width: 7.5, height: 11.25 });
      pptx.layout = "INV_PORTRAIT";

      const dataUrl = await urlToDataUrl(ref.src);
      const slide = pptx.addSlide();
      // Full-bleed reference image as background
      slide.addImage({ data: dataUrl, x: 0, y: 0, w: 7.5, h: 11.25 });

      // Cover the original printed text region with a soft tinted rect
      slide.addShape("rect", {
        x: ref.cover.x, y: ref.cover.y, w: ref.cover.w, h: ref.cover.h,
        fill: { color: ref.cover.fill, transparency: 10 },
        line: { color: ref.cover.fill, width: 0 },
      });

      // Names — calligraphy
      slide.addText(names, {
        x: ref.cover.x, y: ref.cover.y + 0.15, w: ref.cover.w, h: 1.2,
        fontSize: ref.nameSize, italic: true, bold: true, color: ref.ink,
        fontFace: ref.nameFont, align: "center", valign: "middle",
      });

      // Date / Time / Venue
      const detailY = ref.cover.y + 1.4;
      const lines: any[] = [
        { text: `📅  ${date}`, options: { fontSize: 14, color: ref.ink, fontFace: ref.bodyFont, align: "center", paraSpaceAfter: 6 } },
      ];
      if (time) lines.push({ text: `🕐  ${time}`, options: { fontSize: 14, color: ref.ink, fontFace: ref.bodyFont, align: "center", paraSpaceAfter: 6 } });
      lines.push({ text: `📍  ${venue}`, options: { fontSize: 14, color: ref.ink, fontFace: ref.bodyFont, align: "center", paraSpaceAfter: 6 } });
      slide.addText(lines as any, {
        x: ref.cover.x, y: detailY, w: ref.cover.w, h: ref.cover.h - 1.5, valign: "top",
      });

      const fname = `${(names || "wedding").replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}_invitation.pptx`;
      await pptx.writeFile({ fileName: fname });
      return;
    }

    // ---------- Fallback: classic ornamental invitation (no reference image) ----------
    const BG = theme.bg, INK = theme.ink, GOLD = theme.gold, ACCENT = theme.accent, MUTED = "8A7A6F";

    const cover = pptx.addSlide();
    cover.background = { color: BG };
    cover.addShape("rect", { x: 0.6, y: 0.6, w: 12.13, h: 6.3, fill: { type: "none" } as any, line: { color: GOLD, width: 1.5 } });
    cover.addShape("rect", { x: 0.85, y: 0.85, w: 11.63, h: 5.8, fill: { type: "none" } as any, line: { color: GOLD, width: 0.5 } });
    cover.addText(theme.couple, { x: 1, y: 1.2, w: 11.33, h: 0.6, fontSize: 22, color: GOLD, align: "center", charSpacing: 6 });
    cover.addText(theme.motto, { x: 1, y: 1.85, w: 11.33, h: 0.45, fontSize: 14, italic: true, color: MUTED, fontFace: "Garamond", align: "center", charSpacing: 4 });
    cover.addText(names, { x: 1, y: 2.5, w: 11.33, h: 1.8, fontSize: 64, italic: true, bold: true, color: INK, fontFace: "Monotype Corsiva", align: "center", valign: "middle" });
    cover.addShape("line", { x: 5.16, y: 4.5, w: 3, h: 0, line: { color: GOLD, width: 1.25 } });
    cover.addText(theme.couples, { x: 1, y: 4.7, w: 11.33, h: 0.9, fontSize: 54, align: "center" });
    cover.addText(`${date}${time ? "  •  " + time : ""}`, { x: 1, y: 5.55, w: 11.33, h: 0.4, fontSize: 16, color: INK, fontFace: "Georgia", align: "center" });
    cover.addText(venue, { x: 1, y: 5.95, w: 11.33, h: 0.4, fontSize: 14, italic: true, color: MUTED, fontFace: "Garamond", align: "center" });
    cover.addText("♥", { x: 6.16, y: 6.4, w: 1, h: 0.4, fontSize: 18, color: ACCENT, align: "center" });

    const fname = `${(names || "wedding").replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}_invitation.pptx`;
    await pptx.writeFile({ fileName: fname });
  };

  // ───────── RESUME — clean professional ─────────
  const renderResume = async (
    pptx: pptxgen, title: string, subtitle: string, slides: SlideContent[]
  ) => {
    const BG = "FFFFFF", INK = "1F2937", ACCENT = "1E40AF", MUTED = "6B7280", SIDE = "F3F4F6";

    const cover = pptx.addSlide();
    cover.background = { color: BG };
    cover.addShape("rect", { x: 0, y: 0, w: 4.5, h: 7.5, fill: { color: SIDE } });
    cover.addShape("rect", { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: ACCENT } });
    cover.addText(title, {
      x: 0.6, y: 2.6, w: 3.6, h: 1.6, fontSize: 36, bold: true, color: INK, fontFace: "Calibri", valign: "middle",
    });
    cover.addText(subtitle || "Curriculum Vitae", {
      x: 0.6, y: 4.2, w: 3.6, h: 0.5, fontSize: 16, color: ACCENT, fontFace: "Calibri", bold: true, charSpacing: 2,
    });
    cover.addShape("line", { x: 0.6, y: 4.8, w: 1.5, h: 0, line: { color: ACCENT, width: 2 } });
    cover.addText("Professional Profile", {
      x: 5.0, y: 0.8, w: 7.7, h: 0.5, fontSize: 14, color: MUTED, fontFace: "Calibri", charSpacing: 4,
    });
    cover.addText("A modern résumé presentation\noutlining experience, skills,\nand accomplishments.", {
      x: 5.0, y: 3.0, w: 7.7, h: 2.0, fontSize: 20, color: INK, fontFace: "Calibri", valign: "middle",
    });

    slides.forEach((s) => {
      const slide = pptx.addSlide();
      slide.background = { color: BG };
      slide.addShape("rect", { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: ACCENT } });
      slide.addText(s.title.toUpperCase(), {
        x: 0.7, y: 0.6, w: 12.0, h: 0.6, fontSize: 22, bold: true, color: ACCENT, fontFace: "Calibri", charSpacing: 3,
      });
      slide.addShape("line", { x: 0.7, y: 1.3, w: 1.2, h: 0, line: { color: ACCENT, width: 2 } });

      const items = (s.bullets || []).slice(0, 8).map((b) => ({
        text: b,
        options: { bullet: { code: "25AA" }, color: INK, fontSize: 17, fontFace: "Calibri", paraSpaceAfter: 10 },
      }));
      slide.addText(items as any, { x: 0.85, y: 1.7, w: 11.8, h: 5.2, valign: "top" });
      if (s.notes) slide.addNotes(s.notes);
    });

    const fname = `${title.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "resume"}.pptx`;
    await pptx.writeFile({ fileName: fname });
  };

  // ───────── SCHOOL — clear, friendly, structured ─────────
  const renderSchool = async (
    pptx: pptxgen, title: string, subtitle: string, slides: SlideContent[]
  ) => {
    const BG = "FFFFFF", INK = "1A2A3A", ACCENT = "0EA5E9", BAND = "0EA5E9", MUTED = "6B7280";

    const cover = pptx.addSlide();
    cover.background = { color: BG };
    cover.addShape("rect", { x: 0, y: 0, w: 13.33, h: 1.4, fill: { color: BAND } });
    cover.addShape("rect", { x: 0, y: 6.1, w: 13.33, h: 1.4, fill: { color: BAND } });
    cover.addText("PROJECT PRESENTATION", {
      x: 0.6, y: 0.4, w: 12.13, h: 0.6, fontSize: 16, bold: true, color: "FFFFFF", fontFace: "Trebuchet MS", charSpacing: 4, align: "center",
    });
    cover.addText(title, {
      x: 0.6, y: 2.8, w: 12.13, h: 1.6, fontSize: 44, bold: true, color: INK, fontFace: "Trebuchet MS", align: "center",
    });
    cover.addText(subtitle || "An academic presentation", {
      x: 0.6, y: 4.5, w: 12.13, h: 0.6, fontSize: 20, color: MUTED, fontFace: "Calibri", align: "center", italic: true,
    });

    slides.forEach((s, idx) => {
      const slide = pptx.addSlide();
      slide.background = { color: BG };
      // header band
      slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 1.1, fill: { color: BAND } });
      slide.addText(s.title, {
        x: 0.6, y: 0.2, w: 11.0, h: 0.7, fontSize: 26, bold: true, color: "FFFFFF", fontFace: "Trebuchet MS", valign: "middle",
      });
      slide.addText(`Slide ${idx + 1}`, {
        x: 11.6, y: 0.2, w: 1.5, h: 0.7, fontSize: 12, color: "FFFFFF", fontFace: "Calibri", align: "right", valign: "middle",
      });

      const items = (s.bullets || []).slice(0, 7).map((b) => ({
        text: b,
        options: { bullet: { code: "25B8" }, color: INK, fontSize: 19, fontFace: "Calibri", paraSpaceAfter: 12 },
      }));
      slide.addText(items as any, { x: 0.9, y: 1.5, w: 11.6, h: 5.5, valign: "top" });
      // footer
      slide.addShape("line", { x: 0.6, y: 7.0, w: 12.13, h: 0, line: { color: ACCENT, width: 1 } });
      if (s.notes) slide.addNotes(s.notes);
    });

    const closing = pptx.addSlide();
    closing.background = { color: BG };
    closing.addShape("rect", { x: 0, y: 3.0, w: 13.33, h: 1.5, fill: { color: BAND } });
    closing.addText("Thank you!", {
      x: 0.6, y: 3.0, w: 12.13, h: 1.5, fontSize: 48, bold: true, color: "FFFFFF", fontFace: "Trebuchet MS", align: "center", valign: "middle",
    });
    closing.addText("Any questions?", {
      x: 0.6, y: 4.8, w: 12.13, h: 0.6, fontSize: 20, color: MUTED, fontFace: "Calibri", align: "center", italic: true,
    });

    const fname = `${title.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "project"}.pptx`;
    await pptx.writeFile({ fileName: fname });
  };

  // ───────── WORK — dark corporate ─────────
  const renderWork = async (
    pptx: pptxgen, title: string, subtitle: string, slides: SlideContent[], tpl: typeof TEMPLATES.work
  ) => {
    const subText = "94A3B8";
    const cover = pptx.addSlide();
    cover.background = { color: tpl.bg };
    cover.addShape("rect", { x: 0, y: 6.7, w: 13.33, h: 0.15, fill: { color: tpl.accent } });
    cover.addText(tpl.label.toUpperCase(), {
      x: 0.6, y: 0.5, w: 12.1, h: 0.4, fontSize: 12, bold: true, color: tpl.accent, fontFace: tpl.bodyFont, charSpacing: 4,
    });
    cover.addText(title, {
      x: 0.6, y: 2.4, w: 12.1, h: 1.6, fontSize: 48, bold: true, color: tpl.text, fontFace: tpl.titleFont, align: "left", valign: "middle",
    });
    cover.addText(subtitle, {
      x: 0.6, y: 4.2, w: 12.1, h: 0.8, fontSize: 22, color: subText, fontFace: tpl.bodyFont, align: "left",
    });

    slides.forEach((s, idx) => {
      const slide = pptx.addSlide();
      slide.background = { color: tpl.bg };
      slide.addText(String(idx + 1).padStart(2, "0"), {
        x: 12.3, y: 0.3, w: 0.8, h: 0.4, fontSize: 11, color: subText, align: "right", fontFace: tpl.bodyFont,
      });
      slide.addShape("rect", { x: 0.6, y: 0.6, w: 0.08, h: 0.7, fill: { color: tpl.accent } });
      slide.addText(s.title, {
        x: 0.85, y: 0.55, w: 11.5, h: 0.8, fontSize: 32, bold: true, color: tpl.text, fontFace: tpl.titleFont, valign: "middle",
      });
      const bullets = (s.bullets || []).slice(0, 7).map((b) => ({
        text: b,
        options: { bullet: { code: "25CF" }, color: tpl.text, fontSize: 18, fontFace: tpl.bodyFont, paraSpaceAfter: 10 },
      }));
      slide.addText(bullets as any, { x: 0.85, y: 1.7, w: 11.6, h: 5.2, valign: "top" });
      if (s.notes) slide.addNotes(s.notes);
    });

    const closing = pptx.addSlide();
    closing.background = { color: tpl.bg };
    closing.addText("Thank you", {
      x: 0.6, y: 3.0, w: 12.1, h: 1.5, fontSize: 60, bold: true, color: tpl.text, fontFace: tpl.titleFont, align: "center",
    });
    closing.addShape("rect", { x: 5.5, y: 4.6, w: 2.3, h: 0.06, fill: { color: tpl.accent } });

    const fname = `${title.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "presentation"}.pptx`;
    await pptx.writeFile({ fileName: fname });
  };

  const handleGenerate = async () => {
    const text = prompt.trim();
    if (!text) return;
    const cap = template === "wedding" || template === "resume" ? 4 : 15;
    const finalCount = Math.min(slideCount, cap);
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ppt-content", {
        body: { prompt: text, template, slideCount: finalCount },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const { title, subtitle, slides } = data as { title: string; subtitle: string; slides: SlideContent[] };
      if (!slides?.length) throw new Error("No slides returned");
      await buildAndDownload(title, subtitle || "", slides.slice(0, finalCount), template);
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
              <Slider
                min={1}
                max={template === "wedding" || template === "resume" ? 4 : 15}
                step={1}
                value={[Math.min(slideCount, template === "wedding" || template === "resume" ? 4 : 15)]}
                onValueChange={(v) => setSlideCount(v[0])}
              />
              {(template === "wedding" || template === "resume") && (
                <p className="text-xs text-muted-foreground mt-1">{template === "wedding" ? "Wedding" : "Resume"} presentations are limited to 1–4 pages.</p>
              )}
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
