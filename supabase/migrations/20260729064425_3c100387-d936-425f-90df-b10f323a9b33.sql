
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee');

-- ============ DEPARTMENTS ============
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#1E4FD9',
  icon TEXT DEFAULT 'Building2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  position TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  timezone TEXT DEFAULT 'Europe/Moscow',
  telegram_chat_id TEXT,
  telegram_username TEXT,
  telegram_link_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES (separate table for security) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ============ TOOLS ============
CREATE TABLE public.tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Wrench',
  category TEXT DEFAULT 'general',
  kind TEXT NOT NULL DEFAULT 'internal', -- internal | external
  url TEXT, -- for external kind
  color TEXT DEFAULT '#22C55E',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tools TO authenticated;
GRANT ALL ON public.tools TO service_role;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

-- ============ SERVICES (external link cards) ============
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Link',
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- ============ DEPARTMENT ↔ TOOL ============
CREATE TABLE public.department_tools (
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  PRIMARY KEY (department_id, tool_id)
);
GRANT SELECT ON public.department_tools TO authenticated;
GRANT ALL ON public.department_tools TO service_role;
ALTER TABLE public.department_tools ENABLE ROW LEVEL SECURITY;

-- ============ USER TOOL OVERRIDES ============
CREATE TABLE public.user_tool_overrides (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT true, -- true = extra grant, false = explicit deny
  PRIMARY KEY (user_id, tool_id)
);
GRANT SELECT ON public.user_tool_overrides TO authenticated;
GRANT ALL ON public.user_tool_overrides TO service_role;
ALTER TABLE public.user_tool_overrides ENABLE ROW LEVEL SECURITY;

-- ============ DASHBOARD LAYOUTS (per user tool placement) ============
CREATE TABLE public.dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  location TEXT NOT NULL DEFAULT 'dashboard', -- dashboard | sidebar | hidden
  position INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, tool_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_layouts TO authenticated;
GRANT ALL ON public.dashboard_layouts TO service_role;
ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- ============ TELEGRAM SETTINGS ============
CREATE TABLE public.telegram_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL, -- 'department' | 'user'
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- example: { "task_reminders": true, "daily_report": true, "new_lead_alerts": false }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((scope = 'department' AND department_id IS NOT NULL AND user_id IS NULL)
      OR (scope = 'user' AND user_id IS NOT NULL AND department_id IS NULL))
);
GRANT SELECT ON public.telegram_settings TO authenticated;
GRANT ALL ON public.telegram_settings TO service_role;
ALTER TABLE public.telegram_settings ENABLE ROW LEVEL SECURITY;

-- ============ SHIFTS ============
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  title TEXT,
  color TEXT DEFAULT '#1E4FD9',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- ============ TIME ENTRIES ============
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  status TEXT NOT NULL DEFAULT 'todo', -- todo | in_progress | done
  due_at TIMESTAMPTZ,
  project TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tools_updated BEFORE UPDATE ON public.tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_telegram_updated BEFORE UPDATE ON public.telegram_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + first admin role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  SELECT count(*) INTO user_count FROM public.profiles;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ POLICIES ============
-- profiles
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_read_all_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- departments
CREATE POLICY "departments_read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_admin" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tools
CREATE POLICY "tools_read" ON public.tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "tools_admin" ON public.tools FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- services
CREATE POLICY "services_read" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "services_admin" ON public.services FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- department_tools
CREATE POLICY "dt_read" ON public.department_tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "dt_admin" ON public.department_tools FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_tool_overrides
CREATE POLICY "uto_read_self" ON public.user_tool_overrides FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "uto_admin" ON public.user_tool_overrides FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- dashboard_layouts
CREATE POLICY "layouts_self" ON public.dashboard_layouts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- telegram_settings
CREATE POLICY "tg_read_self_or_dept" ON public.telegram_settings FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR department_id = (SELECT department_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "tg_admin" ON public.telegram_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- shifts
CREATE POLICY "shifts_read_self" ON public.shifts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "shifts_manager_read_all" ON public.shifts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "shifts_admin_all" ON public.shifts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- time_entries
CREATE POLICY "te_self" ON public.time_entries FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "te_manager_read" ON public.time_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- tasks
CREATE POLICY "tasks_self" ON public.tasks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ SEED ============
INSERT INTO public.departments (name, description, color, icon) VALUES
('Разработка', 'Backend и frontend разработчики', '#1E4FD9', 'Code2'),
('Маркетинг', 'SMM, реклама, контент', '#22C55E', 'Megaphone'),
('Продажи', 'Работа с клиентами и сделками', '#F59E0B', 'TrendingUp'),
('Поддержка', 'Клиентский сервис', '#8B5CF6', 'Headphones'),
('Дизайн', 'UI/UX и графический дизайн', '#EC4899', 'Palette');

INSERT INTO public.tools (slug, name, description, icon, category, kind, color) VALUES
('time-tracker','Учёт времени','Таймер для отслеживания рабочего времени','Timer','productivity','internal','#22C55E'),
('calculator','Калькулятор','Быстрые расчёты','Calculator','utility','internal','#1E4FD9'),
('notes','Заметки','Личные заметки и списки','StickyNote','productivity','internal','#F59E0B'),
('tasks','Задачи','Личный список задач','ListTodo','productivity','internal','#8B5CF6'),
('calendar','Календарь','График смен и событий','Calendar','productivity','internal','#EC4899'),
('unit-converter','Конвертер величин','Пересчёт единиц измерения','Ruler','utility','internal','#06B6D4'),
('pomodoro','Помодоро','Таймер помодоро для фокуса','TimerReset','productivity','internal','#EF4444'),
('password-gen','Генератор паролей','Безопасные пароли','KeyRound','utility','internal','#64748B'),
('color-picker','Пипетка цветов','Инструмент выбора цвета','Pipette','design','internal','#F97316'),
('markdown','Markdown-редактор','Редактор заметок в markdown','FileText','productivity','internal','#0EA5E9');
