import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { ArrowRight, Sparkles, Map, Image as ImageIcon, Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

/* -------- Mouse-reactive particles (lightweight, paused off-screen) -------- */
function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (reduce) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const count = isMobile ? 28 : 70;
    const mouse = { x: -9999, y: -9999 };

    type P = { x: number; y: number; vx: number; vy: number; r: number };
    const parts: P[] = Array.from({ length: count }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.4 + 0.4,
    }));

    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", onResize);

    let raf = 0;
    let running = true;
    const obs = new IntersectionObserver(([e]) => { running = e.isIntersecting; }, { threshold: 0 });
    obs.observe(canvas);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      for (const p of parts) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 140 * 140) {
          const f = (140 - Math.sqrt(d2)) / 140;
          p.vx += (dx / Math.sqrt(d2 || 1)) * f * 0.4;
          p.vy += (dy / Math.sqrt(d2 || 1)) * f * 0.4;
        }
        p.vx *= 0.96; p.vy *= 0.96;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(235, 90%, 75%, 0.7)";
        ctx.fill();
      }

      // links
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i], b = parts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 120 * 120) {
            ctx.strokeStyle = `hsla(235,90%,70%,${0.18 * (1 - Math.sqrt(d2) / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="fixed inset-0 -z-0 pointer-events-none opacity-60" aria-hidden />;
}

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
  const blob1Y = useTransform(scrollY, [0, 1200], [0, -360]);
  const blob2Y = useTransform(scrollY, [0, 1200], [0, 240]);
  const blob3Y = useTransform(scrollY, [0, 1800], [0, -460]);
  const titleScale = useTransform(scrollY, [0, 400], [1, 0.88]);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ctaTo = "/app";

  return (
    <div className="min-h-screen overflow-x-hidden relative" style={{ background: "var(--gradient-surface)" }}>
      {/* Animated grid */}
      <div className="absolute inset-0 bg-grid-fade pointer-events-none" />
      {/* Mouse-reactive particles */}
      <ParticleField />

      {/* Floating parallax blobs */}
      <motion.div
        style={{ y: blob1Y }}
        className="fixed top-20 -left-40 w-[500px] h-[500px] rounded-full bg-primary/25 blur-[140px] pointer-events-none"
      />
      <motion.div
        style={{ y: blob2Y }}
        className="fixed top-[40%] -right-40 w-[620px] h-[620px] rounded-full bg-accent/20 blur-[160px] pointer-events-none"
      />
      <motion.div
        style={{ y: blob3Y }}
        className="fixed bottom-0 left-1/3 w-[460px] h-[460px] rounded-full bg-primary/15 blur-[140px] pointer-events-none"
      />

      {/* Nav */}
      <nav
        className={`sticky top-0 z-30 transition-all duration-300 ${
          scrolled ? "backdrop-blur-xl bg-background/60 border-b border-border/50" : ""
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-heading text-2xl md:text-3xl font-bold text-gradient">
            TruthAI
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
            <Link to={ctaTo}>
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
        © {new Date().getFullYear()} TruthAI · Built with conviction
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
