ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimate_minutes integer,
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

UPDATE public.tasks SET assignee_id = user_id WHERE assignee_id IS NULL;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Managers can manage team tasks" ON public.tasks;
CREATE POLICY "Managers can manage team tasks" ON public.tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Assignees can see their tasks" ON public.tasks;
CREATE POLICY "Assignees can see their tasks" ON public.tasks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR assignee_id = auth.uid());

CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS time_entries_task_idx ON public.time_entries(task_id);