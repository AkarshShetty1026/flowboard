-- Restore the intended API grants for the labels RPC and audit trigger.
-- This migration changes no task, label, association, or activity rows and does not alter RLS policies.
begin;

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.task_labels to authenticated;
grant select, insert, delete on public.task_label_assignments to authenticated;
grant select on public.task_activity to authenticated;

grant execute on function public.set_task_labels(uuid, uuid[]) to authenticated;
grant execute on function public.record_task_activity() to authenticated;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.task_labels'::regclass) then
    raise exception 'RLS must remain enabled on public.task_labels';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.task_label_assignments'::regclass) then
    raise exception 'RLS must remain enabled on public.task_label_assignments';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.task_activity'::regclass) then
    raise exception 'RLS must remain enabled on public.task_activity';
  end if;
end;
$$;

-- Make new tables and functions immediately visible to Supabase PostgREST.
notify pgrst, 'reload schema';

commit;
