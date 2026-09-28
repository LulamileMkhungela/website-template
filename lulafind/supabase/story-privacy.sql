-- One-time, re-runnable migration for audience-aware stories and private insights.
-- Apply this to an existing project after the records table has been created.
-- It moves legacy embedded replies/views into private records, then removes those
-- projections from story payloads (otherwise every story viewer can read them).

create index if not exists records_story_id_idx
  on public.records (collection, (payload->>'storyId'));

-- Preserve legacy reply bodies and viewer ids in their own RLS-protected rows.
insert into public.records (collection, id, owner_id, payload, updated_at)
select
  'story_replies',
  coalesce(nullif(item.value->>'id', ''), 'legacy_reply_' || s.id || '_' || item.ordinality::text),
  case when item.value->>'authorId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (item.value->>'authorId')::uuid else null end,
  item.value || jsonb_build_object(
    'id', coalesce(nullif(item.value->>'id', ''), 'legacy_reply_' || s.id || '_' || item.ordinality::text),
    'storyId', s.id
  ),
  case when item.value->>'at' ~ '^[0-9]+$' then (item.value->>'at')::bigint else s.updated_at end
from public.records s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.payload->'replies') = 'array' then s.payload->'replies' else '[]'::jsonb end
) with ordinality as item(value, ordinality)
where s.collection = 'stories'
  and jsonb_typeof(item.value) = 'object'
  and nullif(item.value->>'authorId', '') is not null
on conflict (collection, id) do nothing;

insert into public.records (collection, id, owner_id, payload, updated_at)
select
  'story_views',
  'sv_' || s.id || '_' || viewer.viewer_id,
  case when viewer.viewer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then viewer.viewer_id::uuid else null end,
  jsonb_build_object(
    'id', 'sv_' || s.id || '_' || viewer.viewer_id,
    'storyId', s.id,
    'viewerId', viewer.viewer_id,
    'at', 0
  ),
  s.updated_at
from public.records s
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(s.payload->'viewers') = 'array' then s.payload->'viewers' else '[]'::jsonb end
) as viewer(viewer_id)
where s.collection = 'stories'
  and nullif(viewer.viewer_id, '') is not null
on conflict (collection, id) do nothing;

update public.records
set payload = payload - 'replies' - 'viewers'
where collection = 'stories'
  and (payload ? 'replies' or payload ? 'viewers');

-- SECURITY DEFINER helpers avoid recursive RLS when one collection checks a
-- related row in records. The identity arguments are always clamped to auth.uid
-- so calling these helpers through PostgREST cannot probe another account.
create or replace function public.lula_is_admin()
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role') in ('admin', 'moderator'), false);
$$;

create or replace function public.lula_follows_accepted(follower text, following text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select follower is not distinct from (select auth.uid()::text)
    and exists (
      select 1 from public.records f
      where f.collection = 'follows'
        and coalesce(f.payload->>'status', 'accepted') = 'accepted'
        and f.payload->>'followerId' = follower
        and f.payload->>'followingId' = following
    );
$$;

create or replace function public.lula_spotlight_member(person text, spotlight text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select person is not distinct from (select auth.uid()::text)
    and exists (
      select 1 from public.records s
      where s.collection = 'spotlights'
        and s.id = spotlight
        and person in (select jsonb_array_elements_text(coalesce(s.payload->'memberIds', '[]'::jsonb)))
    );
$$;

create or replace function public.lula_post_visible(post_id text, person text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select person is not distinct from (select auth.uid()::text)
    and exists (
      select 1 from public.records p
      where p.collection = 'posts'
        and p.id = post_id
        -- Treat legacy rows with no status as active; NULL must not hide them.
        and (coalesce(p.payload->>'status', 'active') <> 'under_review'
          or p.payload->>'authorId' = person
          or public.lula_is_admin())
        and (
          public.lula_is_admin()
          or coalesce(p.payload->>'audience', 'public') = 'public'
          or p.payload->>'authorId' = person
          or (p.payload->>'audience' = 'followers'
            and public.lula_follows_accepted(person, p.payload->>'authorId'))
          or (p.payload->>'audience' = 'surname'
            and public.lula_spotlight_member(person, p.payload->>'spotlightId'))
        )
    );
$$;

create or replace function public.lula_story_visible(story_id text, person text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select person is not distinct from (select auth.uid()::text)
    and exists (
      select 1 from public.records s
      where s.collection = 'stories'
        and s.id = story_id
        and (
          coalesce(s.payload->>'audience', 'public') = 'public'
          or s.payload->>'authorId' = person
          -- A follower is someone this viewer follows, not someone who follows the viewer.
          or (s.payload->>'audience' = 'followers'
            and public.lula_follows_accepted(person, s.payload->>'authorId'))
          or (s.payload->>'audience' = 'surname'
            and public.lula_spotlight_member(person, s.payload->>'spotlightId'))
        )
    );
$$;

create or replace function public.lula_story_owner(story_id text, person text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select person is not distinct from (select auth.uid()::text)
    and exists (
      select 1 from public.records s
      where s.collection = 'stories'
        and s.id = story_id
        and s.payload->>'authorId' = person
    );
$$;

create or replace function public.lula_in_thread(thread_id text, person text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select person is not distinct from (select auth.uid()::text)
    and exists (
      select 1 from public.records t
      where t.collection = 'threads'
        and t.id = thread_id
        and person in (select jsonb_array_elements_text(coalesce(t.payload->'participantIds', '[]'::jsonb)))
    );
$$;

-- Signed image URLs are issued only if this caller can read the story/post that
-- references the object. The storage bucket itself must remain private.
create or replace function public.lula_media_visible(file_path text, person text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select person is not distinct from (select auth.uid()::text)
    and exists (
      select 1
      from public.records r
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(r.payload->'media') = 'array' then r.payload->'media' else '[]'::jsonb end
      ) as item(value)
      where r.collection in ('posts', 'stories')
        and (
          item.value->>'src' = ('storage://photos/' || file_path)
          or split_part(regexp_replace(
            item.value->>'src',
            '^https?://[^/]+/storage/v1/object/(public|sign|authenticated)/photos/',
            ''
          ), '?', 1) = file_path
        )
        and (
          (r.collection = 'posts' and public.lula_post_visible(r.id, person))
          or (r.collection = 'stories' and public.lula_story_visible(r.id, person))
        )
    );
$$;

-- Public-profile read surface; email, role fields, and unconsented location are not exposed.
create or replace view public.lula_user_profiles_public with (security_barrier = true) as
with profile_source as (
  select
    r.id,
    r.payload,
    r.updated_at,
    coalesce(r.payload #>> '{privacy,showLocation}', 'false') = 'true' as show_location,
    coalesce(r.payload #>> '{privacy,showStats}', 'true') = 'true' as show_stats,
    coalesce(r.payload #>> '{privacy,showSpotlights}', 'true') = 'true' as show_spotlights,
    coalesce(r.payload #>> '{privacy,allowMessages}', 'true') = 'true' as allow_messages,
    coalesce(r.payload #>> '{privacy,requireFollowApproval}', 'false') = 'true' as require_follow_approval
  from public.records r
  where r.collection = 'users'
), profile_flags as (
  select p.*,
    p.show_location
      and coalesce(p.payload #>> '{checkIn,liveShareOn}', 'false') = 'true'
      and case
        when p.payload #>> '{checkIn,liveUntil}' ~ '^[0-9]+$'
          then (p.payload #>> '{checkIn,liveUntil}')::bigint > floor(extract(epoch from now()) * 1000)::bigint
        else false
      end as show_live_location
  from profile_source p
)
select
  id,
  jsonb_build_object(
    'id', payload->'id',
    'email', '',
    'displayName', payload->'displayName',
    'handle', payload->'handle',
    'avatarHue', payload->'avatarHue',
    'avatarUrl', payload->'avatarUrl',
    'bio', payload->'bio',
    'province', case when show_location then payload->'province' else 'null'::jsonb end,
    'town', case when show_location then coalesce(payload->'town', '""'::jsonb) else '""'::jsonb end,
    'surname', payload->'surname',
    'createdAt', payload->'createdAt',
    'verified', coalesce(payload->'verified', 'false'::jsonb),
    'anonymous', coalesce(payload->'anonymous', 'false'::jsonb),
    'findableProfile', coalesce(payload->'findableProfile', 'false'::jsonb),
    'safetyBeacon', coalesce(payload->'safetyBeacon', 'false'::jsonb),
    'lastBeaconAt', 'null'::jsonb,
    'followers', case when show_stats then coalesce(payload->'followers', '0'::jsonb) else '0'::jsonb end,
    'following', case when show_stats then coalesce(payload->'following', '0'::jsonb) else '0'::jsonb end,
    'karma', case when show_stats then coalesce(payload->'karma', '0'::jsonb) else '0'::jsonb end,
    'contributorCredits', case when show_stats then coalesce(payload->'contributorCredits', '0'::jsonb) else '0'::jsonb end,
    'onboarded', coalesce(payload->'onboarded', 'false'::jsonb),
    'blockedUserIds', '[]'::jsonb,
    'spotlightIds', case when show_spotlights then coalesce(payload->'spotlightIds', '[]'::jsonb) else '[]'::jsonb end,
    'isAdmin', 'false'::jsonb,
    'suspended', 'false'::jsonb,
    'privacy', jsonb_build_object(
      'showLocation', show_location,
      'showStats', show_stats,
      'showSpotlights', show_spotlights,
      'allowMessages', allow_messages,
      'autoShareLocation', false,
      'notifyFollowersOnExpiry', false,
      'requireFollowApproval', require_follow_approval
    ),
    'checkIn', case
      when payload->'checkIn' is null or payload->'checkIn' = 'null'::jsonb then 'null'::jsonb
      else jsonb_build_object(
        'status', payload #> '{checkIn,status}',
        'note', case when show_location then coalesce(payload #> '{checkIn,note}', '""'::jsonb) else '""'::jsonb end,
        'at', payload #> '{checkIn,at}',
        'location', case when show_live_location then coalesce(payload #> '{checkIn,location}', 'null'::jsonb) else 'null'::jsonb end,
        'liveUntil', case when show_live_location then coalesce(payload #> '{checkIn,liveUntil}', 'null'::jsonb) else 'null'::jsonb end,
        'liveShareOn', show_live_location
      )
    end
  ) as payload,
  updated_at
from profile_flags;

revoke all on public.lula_user_profiles_public from public;
grant select on public.lula_user_profiles_public to anon, authenticated;

-- Enforce follow approval on the database, not just in the Follow button.
create or replace function public.lula_follow_insert_allowed(follower text, following text, new_status text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select follower is not distinct from (select auth.uid()::text)
    and following is distinct from (select auth.uid()::text)
    and new_status in ('pending', 'accepted')
    and exists (
      select 1 from public.records u
      where u.collection = 'users'
        and u.id = following
        and case
          when u.payload #>> '{privacy,requireFollowApproval}' = 'true'
            then new_status = 'pending'
          else new_status = 'accepted'
        end
    );
$$;

revoke all on function public.lula_is_admin() from public;
revoke all on function public.lula_follows_accepted(text, text) from public;
revoke all on function public.lula_spotlight_member(text, text) from public;
revoke all on function public.lula_post_visible(text, text) from public;
revoke all on function public.lula_story_visible(text, text) from public;
revoke all on function public.lula_story_owner(text, text) from public;
revoke all on function public.lula_in_thread(text, text) from public;
revoke all on function public.lula_follow_insert_allowed(text, text, text) from public;
revoke all on function public.lula_media_visible(text, text) from public;
grant execute on function public.lula_is_admin() to anon, authenticated;
grant execute on function public.lula_follows_accepted(text, text) to anon, authenticated;
grant execute on function public.lula_spotlight_member(text, text) to anon, authenticated;
grant execute on function public.lula_post_visible(text, text) to anon, authenticated;
grant execute on function public.lula_story_visible(text, text) to anon, authenticated;
grant execute on function public.lula_story_owner(text, text) to anon, authenticated;
grant execute on function public.lula_in_thread(text, text) to anon, authenticated;
grant execute on function public.lula_follow_insert_allowed(text, text, text) to authenticated;
grant execute on function public.lula_media_visible(text, text) to anon, authenticated;

-- Remove earlier additive policies: permissive RLS policies are ORed together.
drop policy if exists "lula stories audience read" on public.records;
drop policy if exists "lula story replies read" on public.records;
drop policy if exists "lula story views read" on public.records;
drop policy if exists "lula spotlight update" on public.records;
drop policy if exists "lula spotlight owner update" on public.records;
drop policy if exists "lula reports read" on public.records;
drop policy if exists "lula follow remove" on public.records;

drop policy if exists "lula read" on public.records;
create policy "lula read" on public.records
for select to anon, authenticated
using (
  (collection = 'posts' and public.lula_post_visible(id, (select auth.uid()::text)))
  or (
    collection = 'comments'
    and (payload->>'authorId' = (select auth.uid()::text)
      or public.lula_post_visible(payload->>'postId', (select auth.uid()::text)))
  )
  or collection in ('spotlights', 'tips')
  -- Accepted social edges are public; pending requests are visible only to their two parties.
  or (
    collection = 'follows'
    and (coalesce(payload->>'status', 'accepted') = 'accepted'
      or payload->>'followerId' = (select auth.uid()::text)
      or payload->>'followingId' = (select auth.uid()::text))
  )
  or (collection = 'stories' and public.lula_story_visible(id, (select auth.uid()::text)))
  or (
    collection = 'story_replies'
    and (payload->>'authorId' = (select auth.uid()::text)
      or public.lula_story_owner(payload->>'storyId', (select auth.uid()::text)))
  )
  or (
    collection = 'story_views'
    and (payload->>'viewerId' = (select auth.uid()::text)
      or public.lula_story_owner(payload->>'storyId', (select auth.uid()::text)))
  )
  or (collection = 'users'
    and (id = (select auth.uid()::text) or public.lula_is_admin()))
  or (collection = 'notifications' and payload->>'userId' = (select auth.uid()::text))
  or (collection = 'threads' and public.lula_in_thread(id, (select auth.uid()::text)))
  or (collection = 'messages' and public.lula_in_thread(payload->>'threadId', (select auth.uid()::text)))
);

drop policy if exists "lula insert" on public.records;
create policy "lula insert" on public.records
for insert to authenticated
with check (
  public.lula_is_admin()
  or (
    owner_id = (select auth.uid())
    and (
      (collection = 'users'
        and id = (select auth.uid()::text)
        and payload->>'id' = (select auth.uid()::text)
        and coalesce(payload->>'isAdmin', 'false') = 'false'
        and coalesce(payload->>'suspended', 'false') = 'false')
      or (collection = 'posts' and payload->>'authorId' = (select auth.uid()::text))
      or (collection = 'comments'
        and payload->>'authorId' = (select auth.uid()::text)
        and public.lula_post_visible(payload->>'postId', (select auth.uid()::text)))
      or (collection = 'stories'
        and payload->>'authorId' = (select auth.uid()::text)
        and coalesce(payload->>'audience', 'public') in ('public', 'followers', 'surname')
        and (coalesce(payload->>'audience', 'public') <> 'surname'
          or public.lula_spotlight_member((select auth.uid()::text), payload->>'spotlightId')))
      or (collection = 'story_replies'
        and payload->>'authorId' = (select auth.uid()::text)
        and public.lula_story_visible(payload->>'storyId', (select auth.uid()::text)))
      or (collection = 'story_views'
        and payload->>'viewerId' = (select auth.uid()::text)
        and public.lula_story_visible(payload->>'storyId', (select auth.uid()::text)))
      or (collection = 'follows'
        and public.lula_follow_insert_allowed(
          payload->>'followerId', payload->>'followingId', payload->>'status'))
      or (collection = 'threads'
        and (select auth.uid()::text) in (
          select jsonb_array_elements_text(coalesce(payload->'participantIds', '[]'::jsonb))))
      or (collection = 'messages'
        and public.lula_in_thread(payload->>'threadId', (select auth.uid()::text))
        and (payload->>'fromUserId' = (select auth.uid()::text) or payload->>'kind' = 'system'))
      -- Notifications are written by the actor, then read only by their recipient.
      or (collection = 'notifications' and nullif(payload->>'userId', '') is not null)
      or (collection = 'spotlights' and payload->>'ownerId' = (select auth.uid()::text))
      or (collection = 'reports' and payload->>'byUserId' = (select auth.uid()::text))
    )
  )
);

drop policy if exists "lula update" on public.records;
create policy "lula update" on public.records
for update to authenticated
using (
  public.lula_is_admin()
  or (collection in ('posts', 'comments', 'stories')
    and owner_id = (select auth.uid())
    and payload->>'authorId' = (select auth.uid()::text))
  or (collection = 'users'
    and id = (select auth.uid()::text)
    and coalesce(payload->>'suspended', 'false') = 'false')
  or (collection = 'notifications' and payload->>'userId' = (select auth.uid()::text))
  or (collection = 'follows'
    and payload->>'followingId' = (select auth.uid()::text)
    and coalesce(payload->>'status', 'pending') = 'pending')
  or (collection = 'spotlights' and payload->>'ownerId' = (select auth.uid()::text))
  or (collection = 'threads' and public.lula_in_thread(id, (select auth.uid()::text)))
  or (collection = 'messages' and public.lula_in_thread(payload->>'threadId', (select auth.uid()::text)))
)
with check (
  public.lula_is_admin()
  or (
    (collection in ('posts', 'comments', 'stories')
      and owner_id = (select auth.uid())
      and payload->>'authorId' = (select auth.uid()::text))
    or (collection = 'users'
      and id = (select auth.uid()::text)
      and payload->>'id' = (select auth.uid()::text)
      and coalesce(payload->>'isAdmin', 'false') = 'false'
      and coalesce(payload->>'suspended', 'false') = 'false')
    or (collection = 'notifications' and payload->>'userId' = (select auth.uid()::text))
    or (collection = 'follows'
      and payload->>'followingId' = (select auth.uid()::text)
      and payload->>'status' = 'accepted'
      and id = 'f_' || (payload->>'followerId') || '_' || (payload->>'followingId'))
    or (collection = 'spotlights' and payload->>'ownerId' = (select auth.uid()::text))
    or (collection = 'threads' and public.lula_in_thread(id, (select auth.uid()::text)))
    or (collection = 'messages'
      and public.lula_in_thread(payload->>'threadId', (select auth.uid()::text))
      and (payload->>'fromUserId' = (select auth.uid()::text) or payload->>'kind' = 'system'))
  )
);

drop policy if exists "lula delete" on public.records;
create policy "lula delete" on public.records
for delete to authenticated
using (
  public.lula_is_admin()
  or (owner_id = (select auth.uid()) and collection <> 'users')
  or (collection = 'users'
    and id = (select auth.uid()::text)
    and coalesce(payload->>'suspended', 'false') = 'false')
  or (collection = 'notifications' and payload->>'userId' = (select auth.uid()::text))
  or (collection = 'follows'
    and (payload->>'followerId' = (select auth.uid()::text)
      or payload->>'followingId' = (select auth.uid()::text)))
);

-- Spotlight membership changes go through a narrow SECURITY DEFINER function
-- rather than granting every signed-in user permission to rewrite communities.
create or replace function public.lula_set_spotlight_membership(spotlight_id text, joining boolean)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  current_user_id text := (select auth.uid()::text);
  current_payload jsonb;
  next_members jsonb;
begin
  if current_user_id is null then
    raise exception 'Sign in to change Spotlight membership';
  end if;

  select r.payload into current_payload
  from public.records r
  where r.collection = 'spotlights' and r.id = spotlight_id
  for update;

  if current_payload is null then
    raise exception 'That Spotlight is not available';
  end if;
  if exists (
    select 1 from public.records u
    where u.collection = 'users' and u.id = current_user_id and u.payload->>'suspended' = 'true'
  ) then
    raise exception 'Your account is suspended, so you cannot change Spotlight membership';
  end if;

  if joining then
    select coalesce(current_payload->'memberIds', '[]'::jsonb) || jsonb_build_array(current_user_id)
      into next_members
    where not (coalesce(current_payload->'memberIds', '[]'::jsonb) @> jsonb_build_array(current_user_id));
    if next_members is null then
      next_members := coalesce(current_payload->'memberIds', '[]'::jsonb);
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

  update public.records r
  set payload = current_payload,
      updated_at = floor(extract(epoch from clock_timestamp()) * 1000)::bigint
  where r.collection = 'spotlights' and r.id = spotlight_id;

  return current_payload;
end;
$$;
revoke all on function public.lula_set_spotlight_membership(text, boolean) from public;
grant execute on function public.lula_set_spotlight_membership(text, boolean) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lula photos read" on storage.objects;
create policy "lula photos read" on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    or public.lula_media_visible(name, (select auth.uid()::text))
  )
);

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
)
with check (
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
