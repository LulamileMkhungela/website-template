-- Rollback-only integration check for the RLS rules in schema.sql/story-privacy.sql.
-- Run as the SQL editor's postgres role after applying the migration. All fixture
-- rows are rolled back. The script switches JWT subjects while using the real
-- authenticated database role, so each assertion runs through RLS.

begin;

insert into public.records (collection, id, owner_id, payload) values
  ('users', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000101',
    '{"id":"00000000-0000-4000-8000-000000000101","email":"private@example.invalid","displayName":"Private Person","handle":"private","province":"GP","town":"Johannesburg","followers":9,"following":8,"privacy":{"showStats":false,"showSpotlights":false,"allowMessages":true,"requireFollowApproval":false},"checkIn":{"status":"safe","note":"at home","at":1,"location":{"lat":-26.2,"lng":28.0},"liveShareOn":true,"liveUntil":4102444800000},"suspended":true}'::jsonb),
  ('users', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000102',
    '{"id":"00000000-0000-4000-8000-000000000102","privacy":{"requireFollowApproval":false},"suspended":false}'::jsonb),
  ('users', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000103',
    '{"id":"00000000-0000-4000-8000-000000000103","privacy":{"requireFollowApproval":false},"suspended":false}'::jsonb),
  ('users', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000104',
    '{"id":"00000000-0000-4000-8000-000000000104","privacy":{"requireFollowApproval":true},"suspended":false}'::jsonb),
  ('spotlights', 'rls_test_spotlight', '00000000-0000-4000-8000-000000000101',
    '{"id":"rls_test_spotlight","ownerId":"00000000-0000-4000-8000-000000000101","memberIds":["00000000-0000-4000-8000-000000000101","00000000-0000-4000-8000-000000000102"],"followers":2}'::jsonb),
  ('follows', 'f_00000000-0000-4000-8000-000000000102_00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102',
    '{"id":"f_00000000-0000-4000-8000-000000000102_00000000-0000-4000-8000-000000000101","followerId":"00000000-0000-4000-8000-000000000102","followingId":"00000000-0000-4000-8000-000000000101","status":"accepted"}'::jsonb),
  ('follows', 'f_00000000-0000-4000-8000-000000000103_00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000103',
    '{"id":"f_00000000-0000-4000-8000-000000000103_00000000-0000-4000-8000-000000000101","followerId":"00000000-0000-4000-8000-000000000103","followingId":"00000000-0000-4000-8000-000000000101","status":"pending"}'::jsonb),
  ('posts', 'rls_test_legacy_post', '00000000-0000-4000-8000-000000000101',
    '{"id":"rls_test_legacy_post","authorId":"00000000-0000-4000-8000-000000000101","audience":"public"}'::jsonb),
  ('posts', 'rls_test_review_post', '00000000-0000-4000-8000-000000000101',
    '{"id":"rls_test_review_post","authorId":"00000000-0000-4000-8000-000000000101","audience":"public","status":"under_review"}'::jsonb),
  ('stories', 'rls_test_public_story', '00000000-0000-4000-8000-000000000101',
    '{"id":"rls_test_public_story","authorId":"00000000-0000-4000-8000-000000000101","audience":"public","media":[{"src":"storage://photos/author/public.jpg"}]}'::jsonb),
  ('stories', 'rls_test_follow_story', '00000000-0000-4000-8000-000000000101',
    '{"id":"rls_test_follow_story","authorId":"00000000-0000-4000-8000-000000000101","audience":"followers","media":[{"src":"storage://photos/author/followers.jpg"}]}'::jsonb),
  ('stories', 'rls_test_spotlight_story', '00000000-0000-4000-8000-000000000101',
    '{"id":"rls_test_spotlight_story","authorId":"00000000-0000-4000-8000-000000000101","audience":"surname","spotlightId":"rls_test_spotlight"}'::jsonb),
  ('story_replies', 'rls_test_reply', '00000000-0000-4000-8000-000000000102',
    '{"id":"rls_test_reply","storyId":"rls_test_follow_story","authorId":"00000000-0000-4000-8000-000000000102","body":"private test reply"}'::jsonb),
  ('story_views', 'rls_test_view', '00000000-0000-4000-8000-000000000102',
    '{"id":"rls_test_view","storyId":"rls_test_follow_story","viewerId":"00000000-0000-4000-8000-000000000102"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- An accepted follower may see follower stories; an accepted Spotlight member
-- may see that Spotlight story. Legacy missing status is treated as active.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
do $$
begin
  if not exists (select 1 from public.records where collection = 'stories' and id = 'rls_test_follow_story') then
    raise exception 'RLS check failed: accepted follower cannot read follower story';
  end if;
  if not public.lula_media_visible('author/followers.jpg', (select auth.uid()::text)) then
    raise exception 'RLS check failed: accepted follower cannot sign the story photo';
  end if;
  if not exists (select 1 from public.records where collection = 'stories' and id = 'rls_test_spotlight_story') then
    raise exception 'RLS check failed: Spotlight member cannot read Spotlight story';
  end if;
  if not exists (select 1 from public.records where collection = 'posts' and id = 'rls_test_legacy_post') then
    raise exception 'RLS check failed: legacy post with missing status was hidden';
  end if;
  if not exists (
    select 1 from public.lula_user_profiles_public
    where id = '00000000-0000-4000-8000-000000000101'
  ) then
    raise exception 'RLS check failed: sanitized public profile is missing';
  end if;
  if exists (
    select 1 from public.lula_user_profiles_public
    where id = '00000000-0000-4000-8000-000000000101'
      and (payload->'email' is distinct from '""'::jsonb
        or payload->'province' is distinct from 'null'::jsonb
        or payload->'town' is distinct from '""'::jsonb
        or payload #>> '{checkIn,location,lat}' is not null
        or payload #>> '{checkIn,note}' is distinct from ''
        or payload->'followers' is distinct from '0'::jsonb
        or payload->'isAdmin' is distinct from 'false'::jsonb
        or payload->'suspended' is distinct from 'false'::jsonb
        or payload #>> '{privacy,showLocation}' is distinct from 'false')
  ) then
    raise exception 'RLS check failed: public profile exposed private email, location, stats, or role data';
  end if;
  if exists (select 1 from public.records where collection = 'users' and id = '00000000-0000-4000-8000-000000000101') then
    raise exception 'RLS check failed: non-owner read the full user record';
  end if;

  begin
    update public.records
    set payload = payload || '{"isAdmin":true,"suspended":true}'::jsonb
    where collection = 'users' and id = (select auth.uid()::text);
    raise exception 'RLS check failed: user self-assigned admin or suspension status';
  exception when insufficient_privilege then
    null;
  end;
  if exists (select 1 from public.records where collection = 'posts' and id = 'rls_test_review_post') then
    raise exception 'RLS check failed: under-review post leaked to a non-author';
  end if;
  if not exists (select 1 from public.records where collection = 'story_replies' and id = 'rls_test_reply') then
    raise exception 'RLS check failed: reply author cannot read their own reply';
  end if;
  if not exists (select 1 from public.records where collection = 'story_views' and id = 'rls_test_view') then
    raise exception 'RLS check failed: viewer cannot read their own view record';
  end if;
end $$;

-- A person with a pending request is not a follower or Spotlight member and
-- cannot read another viewer's reply/view record.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
do $$
begin
  if not exists (select 1 from public.records where collection = 'stories' and id = 'rls_test_public_story') then
    raise exception 'RLS check failed: public story is not public';
  end if;
  if not public.lula_media_visible('author/public.jpg', (select auth.uid()::text)) then
    raise exception 'RLS check failed: public story photo is not available';
  end if;
  if public.lula_media_visible('author/followers.jpg', (select auth.uid()::text)) then
    raise exception 'RLS check failed: private story photo bypassed its audience';
  end if;
  if exists (select 1 from public.records where collection = 'stories' and id = 'rls_test_follow_story') then
    raise exception 'RLS check failed: pending request was treated as an accepted follow';
  end if;
  if exists (select 1 from public.records where collection = 'stories' and id = 'rls_test_spotlight_story') then
    raise exception 'RLS check failed: non-member read a Spotlight story';
  end if;
  if exists (select 1 from public.records where collection = 'story_replies' and id = 'rls_test_reply') then
    raise exception 'RLS check failed: a third party read a private story reply';
  end if;
  if exists (select 1 from public.records where collection = 'story_views' and id = 'rls_test_view') then
    raise exception 'RLS check failed: a third party read a private story view';
  end if;

  begin
    insert into public.records (collection, id, owner_id, payload)
    values ('story_replies', 'rls_test_forbidden_reply', '00000000-0000-4000-8000-000000000103',
      '{"id":"rls_test_forbidden_reply","storyId":"rls_test_follow_story","authorId":"00000000-0000-4000-8000-000000000103","body":"must be denied"}'::jsonb);
    raise exception 'RLS check failed: non-follower inserted a reply to a private story';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.records (collection, id, owner_id, payload)
    values ('follows', 'f_00000000-0000-4000-8000-000000000103_00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000103',
      '{"id":"f_00000000-0000-4000-8000-000000000103_00000000-0000-4000-8000-000000000104","followerId":"00000000-0000-4000-8000-000000000103","followingId":"00000000-0000-4000-8000-000000000104","status":"accepted"}'::jsonb);
    raise exception 'RLS check failed: private follow approval was bypassed';
  exception when insufficient_privilege then
    null;
  end;

  insert into public.records (collection, id, owner_id, payload)
  values ('follows', 'f_00000000-0000-4000-8000-000000000103_00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000103',
    '{"id":"f_00000000-0000-4000-8000-000000000103_00000000-0000-4000-8000-000000000104","followerId":"00000000-0000-4000-8000-000000000103","followingId":"00000000-0000-4000-8000-000000000104","status":"pending"}'::jsonb);
end $$;

-- Only the story author may see every reply and viewer of that story.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
do $$
begin
  if not exists (
    select 1 from public.records
    where collection = 'users' and id = '00000000-0000-4000-8000-000000000101'
      and payload->>'email' = 'private@example.invalid'
      and payload->>'suspended' = 'true'
  ) then
    raise exception 'RLS check failed: owner cannot read their full user record';
  end if;
  if not exists (select 1 from public.records where collection = 'story_replies' and id = 'rls_test_reply') then
    raise exception 'RLS check failed: story author cannot read private reply';
  end if;
  if not exists (select 1 from public.records where collection = 'story_views' and id = 'rls_test_view') then
    raise exception 'RLS check failed: story author cannot read private viewer record';
  end if;
  if not exists (select 1 from public.records where collection = 'posts' and id = 'rls_test_review_post') then
    raise exception 'RLS check failed: author cannot read own under-review post';
  end if;
  delete from public.records where collection = 'users' and id = (select auth.uid()::text);
  if found then
    raise exception 'RLS check failed: suspended user deleted their protected account row';
  end if;
end $$;

reset role;
rollback;
