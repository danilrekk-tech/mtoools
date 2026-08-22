
ALTER TABLE public.tools
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

UPDATE public.tools SET category = 'Другое' WHERE category IS NULL OR category IN ('general','external','other');

CREATE TABLE IF NOT EXISTS public.tool_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tool_categories TO authenticated;
GRANT ALL ON public.tool_categories TO service_role;
ALTER TABLE public.tool_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tool_categories' AND policyname='cats_read') THEN
    CREATE POLICY "cats_read" ON public.tool_categories FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tool_categories' AND policyname='cats_admin') THEN
    CREATE POLICY "cats_admin" ON public.tool_categories FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

GRANT INSERT, UPDATE, DELETE ON public.tool_categories TO authenticated;

INSERT INTO public.tool_categories (name, color) VALUES
  ('SEO','#1E4FD9'), ('Продажи','#22C55E'), ('Дизайн','#A855F7'), ('Юридические','#F59E0B'),
  ('Аналитика','#06B6D4'), ('Продуктивность','#10B981'), ('Разработка','#6366F1'),
  ('Маркетинг','#EC4899'), ('Поддержка','#F97316'), ('Другое','#64748B')
ON CONFLICT (name) DO NOTHING;
