-- Add age column to profiles (already nullable, just ensure existence)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- Bucket for source images users upload to edit
INSERT INTO storage.buckets (id, name, public)
VALUES ('source-images', 'source-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for source-images storage
CREATE POLICY "Users can upload to their folder in source-images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'source-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Source images are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'source-images');

CREATE POLICY "Users can delete their own source images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'source-images' AND auth.uid()::text = (storage.foldername(name))[1]);