WITH ranked_profiles AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS row_number
  FROM public.profiles
)
DELETE FROM public.profiles
WHERE id IN (
  SELECT id FROM ranked_profiles WHERE row_number > 1
);

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);