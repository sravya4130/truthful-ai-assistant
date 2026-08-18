import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { ArrowRight, Sparkles, Map, Image as ImageIcon, Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import VraiVisual, { type VraiState } from "@/components/vrai/VraiVisual";

/* -------- 3D tilt feature card -------- */
function TiltCard({ children, index }: { children: React.ReactNode; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 10);
    rx.set(-py * 10);
  };
  const onLeave = () => { rx.set(0); ry.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      className="group relative will-change-transform"
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 180]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const titleScale = useTransform(scrollY, [0, 400], [1, 0.88]);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* The presence wakes up: brief thinking flare, then a calm breathing idle. */
  const [aiState, setAiState] = useState<VraiState>("thinking");
  useEffect(() => {
    const t1 = window.setTimeout(() => setAiState("speaking"), 2200);
    const t2 = window.setTimeout(() => setAiState("idle"), 5200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const ctaTo = "/vrai";

  return (
    <div className="min-h-screen overflow-x-hidden relative bg-[#03060f]">
      {/* Living AI presence — cinematic WebGL environment */}
      <VraiVisual state={aiState} className="fixed inset-0 z-0 pointer-events-none" />
      {/* Readability veil over the visualization */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 42%, hsl(230 60% 4% / 0.62), transparent 70%), linear-gradient(180deg, hsl(230 60% 3% / 0.35), hsl(230 60% 3% / 0.86))",
        }}
      />

      {/* Nav */}
      <nav
        className={`sticky top-0 z-30 transition-all duration-300 ${
          scrolled ? "backdrop-blur-xl bg-background/60 border-b border-border/50" : ""
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-heading text-2xl md:text-3xl font-bold text-gradient tracking-tight">
            VRAI-AI
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to={ctaTo}>
              <Button variant="ghost" size="sm">{user ? "Open app" : "Sign in"}</Button>
            </Link>
            <Link to={user ? "/app" : "/auth"}>
              <Button size="sm" className="glow">{user ? "Continue" : "Get started"}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        ref={heroRef}
        className="relative z-10 max-w-5xl mx-auto px-6 pt-24 md:pt-32 pb-40 text-center"
      >
        <motion.div style={{ y: heroY, opacity: heroOpacity, scale: titleScale }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-premium text-sm text-primary-foreground/90 mb-10"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-shine font-medium">Brutally honest AI. No fluff.</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-heading text-[3.5rem] sm:text-7xl md:text-[8.5rem] font-bold mb-8 leading-[1.02] tracking-tight"
          >
            The truth, <br />
            <span className="text-gradient italic">unfiltered.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Direct advice, transformation roadmaps, career plans, AI images, and instant summaries — all in one premium workspace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link to={ctaTo} onMouseEnter={() => setAiState("listening")} onMouseLeave={() => setAiState("idle")}>
              <Button size="lg" className="glow text-base px-9 h-13 sm:h-14">
                {user ? "Open the app" : "Start for free"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="text-base px-9 h-13 sm:h-14 glass-premium border-0">
                See features
              </Button>
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-28 md:mt-36 text-muted-foreground text-xs uppercase tracking-[0.4em]"
        >
          Scroll
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-28 md:py-36">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 md:mb-24"
        >
          <h2 className="font-heading text-4xl sm:text-5xl md:text-7xl font-bold mb-5 tracking-tight">
            Five tools. <span className="text-gradient italic">One mission.</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground">
            Cut through the noise. Get to the point.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5 md:gap-6">
          {features.map((f, i) => (
            <TiltCard key={f.title} index={i}>
              <div className="relative p-7 md:p-9 rounded-2xl glass-premium hover:border-primary/40 transition-all duration-300 h-full">
                <div
                  className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary) / 0.4), transparent 60%)",
                    WebkitMask:
                      "linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)",
                    WebkitMaskComposite: "xor",
                    padding: "1px",
                  } as React.CSSProperties}
                />
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary/15 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform glow">
                  <f.icon className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <h3 className="font-heading text-2xl md:text-3xl font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground text-base leading-relaxed">{f.desc}</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* Quote */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-28 md:py-36 text-center">
        <motion.blockquote
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="font-heading text-4xl sm:text-5xl md:text-7xl italic leading-tight"
        >
          "Comfortable lies <br />keep you stuck. <br />
          <span className="text-gradient">Hard truths set you free.</span>"
        </motion.blockquote>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-24 md:py-32 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-premium rounded-3xl p-10 md:p-16"
        >
          <h2 className="font-heading text-4xl md:text-6xl font-bold mb-5 tracking-tight">
            Ready for the truth?
          </h2>
          <p className="text-base md:text-lg text-muted-foreground mb-10">
            Join now. No credit card. No fluff.
          </p>
          <Link to={ctaTo}>
            <Button size="lg" className="glow text-base px-10 h-13 sm:h-14">
              {user ? "Open the app" : "Get started free"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-border/50 py-8 text-center text-sm text-muted-foreground backdrop-blur-sm">
        © {new Date().getFullYear()} VRAI-AI · Built with conviction
      </footer>
    </div>
  );
}

const features = [
  {
    icon: Zap,
    title: "Brutal Chat",
    desc: "Direct, no-sugarcoating answers to anything you ask. Markdown-formatted, actionable, real.",
  },
  {
    icon: Sparkles,
    title: "Transform Me",
    desc: "Tell us who you want to become. Get a phased behavioral blueprint with daily habits.",
  },
  {
    icon: Map,
    title: "Roadmap Generator",
    desc: "State a career goal. Get a step-by-step plan with timelines, skills, and free resources.",
  },
  {
    icon: ImageIcon,
    title: "Image Generator",
    desc: "Turn any prompt into stunning AI-generated visuals. Save and revisit your gallery.",
  },
  {
    icon: BookOpen,
    title: "Summarizo",
    desc: "Paste long articles, PDFs, or notes. Get clear summaries, key insights, and simple explanations in seconds.",
  },
];
