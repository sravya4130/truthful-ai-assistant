import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Sparkles, Map, Image as ImageIcon, Zap, Target, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const { user } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 200]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const blob1Y = useTransform(scrollY, [0, 1000], [0, -300]);
  const blob2Y = useTransform(scrollY, [0, 1000], [0, 200]);
  const blob3Y = useTransform(scrollY, [0, 1500], [0, -400]);
  const titleScale = useTransform(scrollY, [0, 400], [1, 0.85]);

  const ctaTo = user ? "/app" : "/auth";

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "var(--gradient-surface)" }}>
      {/* Floating parallax blobs */}
      <motion.div
        style={{ y: blob1Y }}
        className="fixed top-20 -left-40 w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] pointer-events-none"
      />
      <motion.div
        style={{ y: blob2Y }}
        className="fixed top-[40%] -right-40 w-[600px] h-[600px] rounded-full bg-accent/15 blur-[140px] pointer-events-none"
      />
      <motion.div
        style={{ y: blob3Y }}
        className="fixed bottom-0 left-1/3 w-[450px] h-[450px] rounded-full bg-primary/10 blur-[120px] pointer-events-none"
      />

      {/* Nav */}
      <nav className="relative z-20 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="font-heading text-2xl font-bold text-gradient">TruthAI</Link>
        <div className="flex items-center gap-3">
          <Link to={ctaTo}>
            <Button variant="ghost" size="sm">{user ? "Open app" : "Sign in"}</Button>
          </Link>
          <Link to={user ? "/app" : "/auth"}>
            <Button size="sm" className="glow">{user ? "Continue" : "Get started"}</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-40 text-center">
        <motion.div style={{ y: heroY, opacity: heroOpacity, scale: titleScale }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-sm text-primary mb-8"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Brutally honest AI. No fluff.
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-heading text-6xl md:text-8xl font-bold mb-6 leading-[1.05]"
          >
            The truth, <br />
            <span className="text-gradient italic">unfiltered.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Get direct advice, transformation roadmaps, career plans, and AI-generated images — all in one place.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link to={ctaTo}>
              <Button size="lg" className="glow text-base px-8 h-12">
                {user ? "Open the app" : "Start for free"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="text-base px-8 h-12 bg-card/50">
                See features
              </Button>
            </a>
          </motion.div>
        </motion.div>

        {/* Decorative downward indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-32 text-muted-foreground text-xs uppercase tracking-[0.3em]"
        >
          Scroll
        </motion.div>
      </section>

      {/* Features */}
      <section ref={featuresRef} id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="font-heading text-5xl md:text-6xl font-bold mb-4">
            Four tools. <span className="text-gradient italic">One mission.</span>
          </h2>
          <p className="text-lg text-muted-foreground">Cut through the noise. Get to the point.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="group relative p-8 rounded-2xl border border-border bg-card/60 backdrop-blur-sm hover:border-primary/40 transition-all hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-heading text-2xl font-bold mb-2">{f.title}</h3>
              <p className="text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Quote / philosophy section */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-32 text-center">
        <motion.blockquote
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="font-heading text-4xl md:text-6xl italic leading-tight"
        >
          "Comfortable lies <br />keep you stuck. <br />
          <span className="text-gradient">Hard truths set you free.</span>"
        </motion.blockquote>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-32 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass rounded-3xl p-12 md:p-16"
        >
          <h2 className="font-heading text-4xl md:text-5xl font-bold mb-4">
            Ready for the truth?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join now. No credit card. No fluff.
          </p>
          <Link to={ctaTo}>
            <Button size="lg" className="glow text-base px-10 h-12">
              {user ? "Open the app" : "Get started free"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-border py-8 text-center text-sm text-muted-foreground">
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
];
