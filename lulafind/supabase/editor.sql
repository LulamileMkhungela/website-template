-- LulaFind — paste this whole file into the Supabase SQL editor and press Run once.
-- The read-policy script you already ran succeeded. This file does not ask you to save that again.
-- It is safe to run on a database that already has the table. It does not delete posts or accounts.
--
-- Where to put it:
-- Supabase → SQL Editor → New query → paste everything below → Run.
-- A good result is "Success. No rows returned."

-- 1. The one table the app writes to. Skipped if it is already there.
create table if not exists public.records (
  collection text not null,
  id text not null,
  owner_id uuid,
  payload jsonb not null,
  updated_at bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  primary key (collection, id)
);

alter table public.records enable row level security;

grant select on public.records to anon;
grant select, insert, update, delete on public.records to authenticated;

-- Live updates. Ignored if the table is already in the publication.
do $$
begin
  alter publication supabase_realtime add table public.records;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- 2. Helpers. Replacing them is safe. Your earlier run already created these.
create or replace function public.lula_follows_accepted(follower text, following text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.records
    where collection = 'follows'
      and payload->>'status' = 'accepted'
      and payload->>'followerId' = follower
      and payload->>'followingId' = following
  );
$$;

create or replace function public.lula_post_visible(post_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.records
    where collection = 'posts'
      and id = post_id
      and (
        coalesce(payload->>'audience', 'public') = 'public'
        or payload->>'authorId' = (select auth.uid()::text)
        or (
          payload->>'audience' = 'followers'
          and public.lula_follows_accepted((select auth.uid()::text), payload->>'authorId')
        )
      )
  );
$$;

create or replace function public.lula_in_thread(thread_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.records
    where collection = 'threads'
      and id = thread_id
      and (select auth.uid()::text) in (
        select jsonb_array_elements_text(coalesce(payload->'participantIds', '[]'::jsonb))
      )
  );
$$;

revoke all on function public.lula_follows_accepted(text, text) from public;
revoke all on function public.lula_post_visible(text) from public;
revoke all on function public.lula_in_thread(text) from public;
grant execute on function public.lula_follows_accepted(text, text) to anon, authenticated;
grant execute on function public.lula_post_visible(text) to anon, authenticated;
grant execute on function public.lula_in_thread(text) to anon, authenticated;

-- 3. Who can read a row.
-- This replaces the read rule you already saved, on purpose.
-- The old rule hid follower-only stories, surname stories, and reports.
drop policy if exists "lula read" on public.records;
create policy "lula read" on public.records
for select to anon, authenticated
using (
  (
    collection = 'posts'
    and (
      coalesce(payload->>'audience', 'public') = 'public'
      or payload->>'authorId' = (select auth.uid()::text)
      or (
        payload->>'audience' = 'followers'
        and public.lula_follows_accepted((select auth.uid()::text), records.payload->>'authorId')
      )
    )
  )
  or (
    collection = 'comments'
    and (
      payload->>'authorId' = (select auth.uid()::text)
      or public.lula_post_visible(records.payload->>'postId')
    )
  )
  or collection in ('spotlights', 'tips', 'follows', 'users')
  or (
    collection = 'stories'
    and (
      coalesce(payload->>'audience', 'public') = 'public'
      or payload->>'authorId' = (select auth.uid()::text)
      or (
        payload->>'audience' = 'followers'
        and public.lula_follows_accepted((select auth.uid()::text), records.payload->>'authorId')
      )
      or (
        payload->>'audience' = 'surname'
        and exists (
          select 1
          from public.records sp
          where sp.collection = 'spotlights'
            and sp.id = records.payload->>'spotlightId'
            and (select auth.uid()::text) in (
              select jsonb_array_elements_text(coalesce(sp.payload->'memberIds', '[]'::jsonb))
            )
        )
      )
    )
  )
  or (
    collection = 'notifications'
    and payload->>'userId' = (select auth.uid()::text)
  )
  or (
    collection = 'threads'
    and (select auth.uid()::text) in (
      select jsonb_array_elements_text(coalesce(payload->'participantIds', '[]'::jsonb))
    )
  )
  or (
    collection = 'messages'
    and public.lula_in_thread(records.payload->>'threadId')
  )
  or (
    collection = 'reports'
    and (
      payload->>'authorId' = (select auth.uid()::text)
      or payload->>'byUserId' = (select auth.uid()::text)
    )
  )
);

-- 4. Who can create a row. A signed-out visitor still cannot write.
drop policy if exists "lula insert" on public.records;
create policy "lula insert" on public.records
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (
    collection = 'notifications'
    or collection = 'spotlights'
    or collection = 'reports'
    or (collection = 'users' and id = (select auth.uid()::text))
    or payload->>'authorId' = (select auth.uid()::text)
    or payload->>'fromUserId' = (select auth.uid()::text)
    or payload->>'followerId' = (select auth.uid()::text)
    or payload->>'byUserId' = (select auth.uid()::text)
    or (
      collection = 'threads'
      and (select auth.uid()::text) in (
        select jsonb_array_elements_text(coalesce(payload->'participantIds', '[]'::jsonb))
      )
    )
  )
);

-- 5. Who can change a row they already own, plus a Spotlight join.
drop policy if exists "lula update" on public.records;
create policy "lula update" on public.records
for update to authenticated
using (
  owner_id = (select auth.uid())
  or id = (select auth.uid()::text)
  or payload->>'authorId' = (select auth.uid()::text)
  or (collection = 'notifications' and payload->>'userId' = (select auth.uid()::text))
  or (
    collection = 'follows'
    and (
      payload->>'followerId' = (select auth.uid()::text)
      or payload->>'followingId' = (select auth.uid()::text)
    )
  )
  or (
    collection = 'threads'
    and (select auth.uid()::text) in (
      select jsonb_array_elements_text(coalesce(payload->'participantIds', '[]'::jsonb))
    )
  )
  or (
    collection = 'messages'
    and public.lula_in_thread(records.payload->>'threadId')
  )
  or collection = 'spotlights'
)
with check (
  owner_id = (select auth.uid())
  or id = (select auth.uid()::text)
  or payload->>'authorId' = (select auth.uid()::text)
  or (collection = 'notifications' and payload->>'userId' = (select auth.uid()::text))
  or (
    collection = 'follows'
    and (
      payload->>'followerId' = (select auth.uid()::text)
      or payload->>'followingId' = (select auth.uid()::text)
    )
  )
  or collection = 'threads'
  or collection = 'messages'
  or collection = 'spotlights'
);

-- 6. Who can delete. Unfollow, and remove someone who follows you.
drop policy if exists "lula delete" on public.records;
create policy "lula delete" on public.records
for delete to authenticated
using (
  owner_id = (select auth.uid())
  or id = (select auth.uid()::text)
  or payload->>'authorId' = (select auth.uid()::text)
  or payload->>'followerId' = (select auth.uid()::text)
  or (
    collection = 'follows'
    and payload->>'followingId' = (select auth.uid()::text)
  )
);

-- 7. Photo bucket. The app currently stores pictures inside the record, not in this bucket.
-- Creating it does not break that. It is here so the bucket is not missing if a later build uses it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
)
on conflict (id) do nothing;

drop policy if exists "lula photos read" on storage.objects;
create policy "lula photos read" on storage.objects
for select to anon, authenticated
using (bucket_id = 'photos');

drop policy if exists "lula photos write" on storage.objects;
create policy "lula photos write" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "lula photos update" on storage.objects;
create policy "lula photos update" on storage.objects
for update to authenticated
using (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "lula photos delete" on storage.objects;
create policy "lula photos delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
