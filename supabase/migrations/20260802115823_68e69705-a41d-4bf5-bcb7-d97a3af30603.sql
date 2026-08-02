ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS icon_mode text NOT NULL DEFAULT 'icon';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS extension_token text;
UPDATE public.profiles SET extension_token = encode(gen_random_bytes(12),'hex') WHERE extension_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_extension_token_key ON public.profiles(extension_token);