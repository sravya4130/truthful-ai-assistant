import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Download, Trash2, ArrowLeft, Upload, Wand2, X, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

interface GeneratedImage {
  id: string;
  prompt: string;
  image_url: string;
  created_at: string;
}

export default function ImageGenerator() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"generate" | "edit">("generate");
  const [prompt, setPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (error) toast.error("Failed to load gallery");
    else if (data) setImages(data as GeneratedImage[]);
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
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("source-images").upload(path, file, {
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("source-images").getPublicUrl(path);
      setSourceUrl(data.publicUrl);
      toast.success("Image uploaded — now describe your edit");
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = async () => {
    if (!sourceUrl) {
      toast.error("Upload or pick an image first");
      return;
    }
    const text = editPrompt.trim();
    if (!text) return;
    setEditing(true);
    try {
      const { data, error } = await supabase.functions.invoke("edit-image", {
        body: { prompt: text, imageUrl: sourceUrl },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const img = (data as any).image as GeneratedImage;
      setImages((prev) => [img, ...prev]);
      setEditPrompt("");
      setSourceUrl(null);
      toast.success("Image edited");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Edit failed");
    } finally {
      setEditing(false);
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

  const pickFromGallery = (img: GeneratedImage) => {
    setSourceUrl(img.image_url);
    setTab("edit");
    toast("Selected — now describe your edit");
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
          <p className="mb-4">Sign up to use the Image Generator.</p>
          <Link to="/app"><Button>Go sign up</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-surface)" }}>
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to chat
          </Link>
          <h1 className="font-heading text-2xl font-bold text-gradient">Image Studio</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-10">
          <TabsList className="grid w-full max-w-sm grid-cols-2 mb-6">
            <TabsTrigger value="generate"><Sparkles className="w-4 h-4 mr-1.5" /> Generate</TabsTrigger>
            <TabsTrigger value="edit"><Wand2 className="w-4 h-4 mr-1.5" /> Edit</TabsTrigger>
          </TabsList>

          <TabsContent value="generate">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
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
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Generate</>
                  )}
                </Button>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="edit">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Source image */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">Source image</label>
                  {sourceUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <img src={sourceUrl} alt="Source" className="w-full aspect-square object-cover" />
                      <button
                        onClick={() => setSourceUrl(null)}
                        className="absolute top-2 right-2 p-1.5 bg-background/80 backdrop-blur rounded-md hover:bg-destructive/80 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {uploading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">or pick from gallery below</p>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    className="hidden"
                  />
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">Edit instruction</label>
                  <Textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Make the sky purple and add a moon..."
                    rows={6}
                    className="bg-background/60 resize-none"
                  />
                  <Button
                    onClick={handleEdit}
                    disabled={editing || !editPrompt.trim() || !sourceUrl}
                    className="w-full mt-4 glow"
                  >
                    {editing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Editing...</>
                    ) : (
                      <><Wand2 className="w-4 h-4 mr-2" /> Apply Edit</>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>

        <h2 className="font-heading text-2xl font-bold mb-4">Your gallery</h2>
        {loadingGallery ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-2xl">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No images yet. Generate or edit your first one above.</p>
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
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => pickFromGallery(img)}>
                        <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Edit
                      </Button>
                      <a href={img.image_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline">
                          <Download className="w-3.5 h-3.5" />
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
