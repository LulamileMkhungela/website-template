-- Optional compatibility patch for projects that previously ran the older
-- wire-fix.sql. Prefer schema.sql for new projects or story-privacy.sql for the
-- existing project migration. This file intentionally removes the broad policies
-- from the old script rather than re-adding them.

-- Never let every authenticated account rewrite every Spotlight or read every
-- report. Community joins/leaves use the narrow RPC below; reports remain private.
drop policy if exists "lula spotlight update" on public.records;
drop policy if exists "lula reports read" on public.records;
drop policy if exists "lula follow remove" on public.records;

drop policy if exists "lula spotlight owner update" on public.records;
create policy "lula spotlight owner update" on public.records
for update to authenticated
using (collection = 'spotlights' and payload->>'ownerId' = (select auth.uid()::text))
with check (collection = 'spotlights' and payload->>'ownerId' = (select auth.uid()::text));

create or replace function public.lula_set_spotlight_membership(spotlight_id text, joining boolean)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  current_user_id text := (select auth.uid()::text);
  current_payload jsonb;
  next_members jsonb;
begin
  if current_user_id is null then raise exception 'Sign in to change Spotlight membership'; end if;

  select r.payload into current_payload from public.records r
  where r.collection = 'spotlights' and r.id = spotlight_id for update;
  if current_payload is null then raise exception 'That Spotlight is not available'; end if;
  if exists (
    select 1 from public.records u
    where u.collection = 'users' and u.id = current_user_id and u.payload->>'suspended' = 'true'
  ) then
    raise exception 'Your account is suspended, so you cannot change Spotlight membership';
  end if;

  if joining then
    if coalesce(current_payload->'memberIds', '[]'::jsonb) @> jsonb_build_array(current_user_id) then
      next_members := coalesce(current_payload->'memberIds', '[]'::jsonb);
    else
      next_members := coalesce(current_payload->'memberIds', '[]'::jsonb) || jsonb_build_array(current_user_id);
    end if;
  else
    if current_payload->>'ownerId' = current_user_id then
      raise exception 'The community owner cannot leave their own Spotlight';
    end if;
    select coalesce(jsonb_agg(value), '[]'::jsonb) into next_members
    from jsonb_array_elements_text(coalesce(current_payload->'memberIds', '[]'::jsonb)) as members(value)
    where value <> current_user_id;
  end if;

  current_payload := jsonb_set(current_payload, '{memberIds}', next_members, true);
  current_payload := jsonb_set(current_payload, '{followers}', to_jsonb(jsonb_array_length(next_members)), true);
  update public.records r set payload = current_payload,
    updated_at = floor(extract(epoch from clock_timestamp()) * 1000)::bigint
  where r.collection = 'spotlights' and r.id = spotlight_id;
  return current_payload;
end;
$$;
revoke all on function public.lula_set_spotlight_membership(text, boolean) from public;
grant execute on function public.lula_set_spotlight_membership(text, boolean) to authenticated;
