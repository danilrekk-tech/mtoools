
-- 1) Merge services -> tools (kind = external)
INSERT INTO public.tools (slug, name, description, icon, category, kind, url, color, is_active)
SELECT
  regexp_replace(lower(coalesce(s.name,'')||'-'||substr(s.id::text,1,6)), '[^a-z0-9]+','-','g'),
  s.name,
  s.description,
  coalesce(s.icon,'Link'),
  'external',
  'external',
  s.url,
  '#1E4FD9',
  true
FROM public.services s
WHERE NOT EXISTS (SELECT 1 FROM public.tools t WHERE t.url = s.url);

-- Attach to same department via department_tools if service had one
INSERT INTO public.department_tools (department_id, tool_id)
SELECT s.department_id, t.id
FROM public.services s
JOIN public.tools t ON t.url = s.url
WHERE s.department_id IS NOT NULL
ON CONFLICT DO NOTHING;

DROP TABLE public.services CASCADE;

-- 2) Audit log
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  entity text := TG_ARGV[0];
  eid text;
  payload jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    eid := coalesce((to_jsonb(OLD)->>'id'), '');
    payload := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    eid := coalesce((to_jsonb(NEW)->>'id'), '');
    payload := jsonb_build_object('new', to_jsonb(NEW));
  ELSE
    eid := coalesce((to_jsonb(NEW)->>'id'), '');
    payload := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, changes)
  VALUES (auth.uid(), TG_OP, entity, eid, payload);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('user_roles');
CREATE TRIGGER audit_profiles AFTER UPDATE ON public.profiles
  FOR EACH ROW WHEN (OLD.department_id IS DISTINCT FROM NEW.department_id OR OLD.position IS DISTINCT FROM NEW.position)
  EXECUTE FUNCTION public.log_audit('profiles');
CREATE TRIGGER audit_department_tools AFTER INSERT OR DELETE ON public.department_tools
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('department_tools');
CREATE TRIGGER audit_user_tool_overrides AFTER INSERT OR UPDATE OR DELETE ON public.user_tool_overrides
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('user_tool_overrides');
CREATE TRIGGER audit_tools AFTER INSERT OR UPDATE OR DELETE ON public.tools
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('tools');
CREATE TRIGGER audit_shifts AFTER INSERT OR UPDATE OR DELETE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('shifts');
CREATE TRIGGER audit_departments AFTER INSERT OR UPDATE OR DELETE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('departments');

-- 3) Telegram incoming messages
CREATE TABLE public.telegram_messages (
  update_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  user_id bigint,
  username text,
  text text,
  raw_update jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.telegram_messages TO authenticated;
GRANT ALL ON public.telegram_messages TO service_role;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tg_msg_admin_read ON public.telegram_messages FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- 4) Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'inapp',
  title text NOT NULL,
  body text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_self_read ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notif_self_update ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_admin_all ON public.notifications FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE INDEX notif_user_created_idx ON public.notifications (user_id, created_at DESC);

-- Auto-notify on shift changes
CREATE OR REPLACE FUNCTION public.notify_shift_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target uuid;
  title text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target := OLD.user_id;
    title := 'Смена отменена';
    INSERT INTO public.notifications (user_id, channel, title, body, meta)
    VALUES (target, 'telegram', title,
      'Отменена смена ' || to_char(OLD.starts_at at time zone 'Europe/Moscow','DD.MM HH24:MI'),
      jsonb_build_object('shift_id', OLD.id));
  ELSE
    target := NEW.user_id;
    title := CASE WHEN TG_OP='INSERT' THEN 'Новая смена назначена' ELSE 'Смена обновлена' END;
    INSERT INTO public.notifications (user_id, channel, title, body, meta)
    VALUES (target, 'telegram', title,
      coalesce(NEW.title,'Смена') || ': ' ||
      to_char(NEW.starts_at at time zone 'Europe/Moscow','DD.MM HH24:MI') || ' — ' ||
      to_char(NEW.ends_at at time zone 'Europe/Moscow','HH24:MI'),
      jsonb_build_object('shift_id', NEW.id));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER shifts_notify AFTER INSERT OR UPDATE OR DELETE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.notify_shift_change();

-- Auto-notify when department gets a new tool -> notify all users of that dept
CREATE OR REPLACE FUNCTION public.notify_department_tool()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tname text;
BEGIN
  SELECT name INTO tname FROM public.tools WHERE id = NEW.tool_id;
  INSERT INTO public.notifications (user_id, channel, title, body, meta)
  SELECT p.id, 'telegram', 'Новый инструмент', 'Вашему отделу назначен: ' || coalesce(tname,'инструмент'),
         jsonb_build_object('tool_id', NEW.tool_id)
  FROM public.profiles p
  WHERE p.department_id = NEW.department_id AND p.is_active = true;
  RETURN NEW;
END $$;
CREATE TRIGGER department_tools_notify AFTER INSERT ON public.department_tools
  FOR EACH ROW EXECUTE FUNCTION public.notify_department_tool();

-- Personal tool override -> notify user
CREATE OR REPLACE FUNCTION public.notify_user_tool_override()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tname text;
BEGIN
  IF NEW.granted THEN
    SELECT name INTO tname FROM public.tools WHERE id = NEW.tool_id;
    INSERT INTO public.notifications (user_id, channel, title, body, meta)
    VALUES (NEW.user_id, 'telegram', 'Персональный доступ', 'Вам открыт инструмент: ' || coalesce(tname,''),
      jsonb_build_object('tool_id', NEW.tool_id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_tool_overrides_notify AFTER INSERT ON public.user_tool_overrides
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_tool_override();
