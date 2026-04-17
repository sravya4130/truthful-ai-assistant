import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Download, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface GeneratedImage {
  id: string;
  prompt: string;
  image_url: string;
  created_at: string;
}

export default function ImageGenerator() {
  const { user, loading: authLoading } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadGallery();
  }, [user]);

  const loadGallery = async () => {
    setLoadingGallery(true);
    const { data, error } = await supabase
      .from("generated_images")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load gallery");
    } else if (data) {
      setImages(data as GeneratedImage[]);
    }
    setLoadingGallery(false);
  };

  const handleGenerate = async () => {
    const text = prompt.trim();
    if (!text) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: text },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const img = (data as any).image as GeneratedImage;
      setImages((prev) => [img, ...prev]);
      setPrompt("");
      toast.success("Image generated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (img: GeneratedImage) => {
    const { error } = await supabase.from("generated_images").delete().eq("id", img.id);
    if (error) {
      toast.error("Delete failed");
      return;
    }
    setImages((prev) => prev.filter((i) => i.id !== img.id));
    toast.success("Deleted");
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-surface)" }}>
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to chat
          </Link>
          <h1 className="font-heading text-2xl font-bold text-gradient">Image Generator</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Prompt input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 mb-10"
        >
          <label className="block text-sm font-medium mb-2 text-muted-foreground">
            Describe what you want to see
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A futuristic skyline at golden hour, cinematic, ultra-detailed..."
            rows={3}
            className="bg-background/60 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">⌘/Ctrl + Enter to generate</p>
            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} className="glow">
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </motion.div>

        {/* Gallery */}
        <h2 className="font-heading text-2xl font-bold mb-4">Your gallery</h2>
        {loadingGallery ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-2xl">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No images yet. Generate your first one above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {images.map((img) => (
                <motion.div
                  key={img.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative rounded-xl overflow-hidden border border-border bg-card"
                >
                  <img src={img.image_url} alt={img.prompt} className="w-full aspect-square object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                    <p className="text-xs text-foreground/90 line-clamp-3 mb-3">{img.prompt}</p>
                    <div className="flex gap-2">
                      <a href={img.image_url} target="_blank" rel="noreferrer" download className="flex-1">
                        <Button size="sm" variant="secondary" className="w-full">
                          <Download className="w-3.5 h-3.5 mr-1.5" /> Open
                        </Button>
                      </a>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(img)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
