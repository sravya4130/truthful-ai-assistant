-- Model registry
CREATE TABLE public.models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  category TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'lovable-gateway',
  endpoint TEXT,
  parameter_count TEXT,
  precision TEXT,
  memory_requirement TEXT,
  estimated_compute_cost NUMERIC NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active',
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.models TO anon, authenticated;
GRANT ALL ON public.models TO service_role;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Model registry is readable by everyone" ON public.models FOR SELECT USING (true);

-- Routing decisions
CREATE TABLE public.routing_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  session_id UUID,
  category TEXT NOT NULL,
  router_confidence NUMERIC,
  router_reason TEXT,
  model_key TEXT NOT NULL,
  model_id TEXT NOT NULL,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  fallback_from TEXT,
  latency_ms INTEGER,
  prompt_chars INTEGER,
  context_messages INTEGER,
  estimated_compute NUMERIC,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.routing_logs TO authenticated;
GRANT ALL ON public.routing_logs TO service_role;
ALTER TABLE public.routing_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own routing logs" ON public.routing_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX routing_logs_created_at_idx ON public.routing_logs (created_at DESC);

-- Usage metrics (tokens / latency; real measurements can be added later)
CREATE TABLE public.usage_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  routing_log_id UUID REFERENCES public.routing_logs(id) ON DELETE CASCADE,
  model_key TEXT NOT NULL,
  category TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  latency_ms INTEGER,
  estimated_compute NUMERIC,
  measured_energy_wh NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.usage_metrics TO authenticated;
GRANT ALL ON public.usage_metrics TO service_role;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own usage metrics" ON public.usage_metrics FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- User preferences (learning level, default personality)
CREATE TABLE public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  learning_level TEXT NOT NULL DEFAULT 'intermediate',
  default_personality TEXT NOT NULL DEFAULT 'auto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own preferences" ON public.user_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON public.models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the registry with the models currently wired to the gateway
INSERT INTO public.models (key, name, model_id, category, provider, endpoint, parameter_count, precision, estimated_compute_cost, priority, notes) VALUES
  ('GENERAL_MODEL', 'VRAI General', 'google/gemini-3.6-flash', 'general', 'lovable-gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'undisclosed', 'provider-default', 1.0, 10, 'Default lightweight conversational model'),
  ('LIGHT_MODEL', 'VRAI Light', 'google/gemini-3.1-flash-lite', 'smalltalk', 'lovable-gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'undisclosed', 'provider-default', 0.4, 5, 'Cheapest model for greetings and trivial turns'),
  ('CODING_MODEL', 'VRAI Code', 'google/gemini-3.7-flash', 'coding', 'lovable-gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'undisclosed', 'provider-default', 2.0, 10, 'Software engineering specialist slot'),
  ('MATH_MODEL', 'VRAI Math', 'openai/gpt-5.4-mini', 'math', 'lovable-gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'undisclosed', 'provider-default', 2.5, 10, 'Math and quantitative reasoning slot'),
  ('REASONING_MODEL', 'VRAI Reasoning', 'openai/gpt-5.4', 'reasoning', 'lovable-gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'undisclosed', 'provider-default', 4.0, 20, 'Hard multi-step reasoning slot'),
  ('EDUCATION_MODEL', 'VRAI Education', 'google/gemini-3.6-flash', 'education', 'lovable-gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'undisclosed', 'provider-default', 1.2, 10, 'Level-aware teaching slot'),
  ('WRITING_MODEL', 'VRAI Writing', 'google/gemini-3.6-flash', 'writing', 'lovable-gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'undisclosed', 'provider-default', 1.2, 10, 'Creative and long-form writing slot'),
  ('SUMMARIZATION_MODEL', 'VRAI Summarizer', 'google/gemini-3.1-flash-lite', 'summarization', 'lovable-gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'undisclosed', 'provider-default', 0.6, 10, 'Summarization slot, intentionally small'),
  ('SCIENCE_MODEL', 'VRAI Science', 'google/gemini-3.6-flash', 'science', 'lovable-gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'undisclosed', 'provider-default', 1.2, 10, 'Science explanation slot'),
  ('PLANNING_MODEL', 'VRAI Planner', 'google/gemini-3.6-flash', 'planning', 'lovable-gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'undisclosed', 'provider-default', 1.3, 10, 'Roadmap and Transform Me slot'),
  ('IMAGE_MODEL', 'VRAI Image', 'google/gemini-3.1-flash-image', 'image', 'lovable-gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'undisclosed', 'provider-default', 3.0, 10, 'Image generation slot');