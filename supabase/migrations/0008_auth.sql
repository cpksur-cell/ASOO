-- ============================================================================
-- ASOO Portal — 0008 · Supabase Auth
-- ============================================================================
-- Identity moves from the development-only mock cookie to Supabase Auth.
--
-- `auth.users` is the identity; `public.users` is the application's mirror of
-- it, carrying the profile and the role. `public.users.id` is TEXT holding the
-- auth UUID rendered as text, which is what every existing foreign key
-- (report_submissions.submitted_by, audit_logs.actor_user_id, …) already
-- points at — so authentication lands without rewriting the schema around it.
--
-- ROLE IS SERVER-SIDE ONLY. It lives in `user_roles`, never in a JWT claim the
-- client could influence and never in a cookie. A user can change what they
-- send; they cannot change what this table says.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Mirror new auth users into public.users
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because the trigger runs as the signing-up user, who has no
-- rights on public.users. `search_path` is pinned: a SECURITY DEFINER function
-- with a mutable search_path is a privilege-escalation vector.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, preferred_locale)
  values (
    new.id::text,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'preferred_locale')::locale, 'ar')
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  -- Everyone starts as a member. Staff roles are granted deliberately by a
  -- super_admin; self-registration must never be able to mint one.
  insert into public.user_roles (user_id, role_id)
  select new.id::text, r.id from public.roles r where r.code = 'member'
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Role lookup
-- ---------------------------------------------------------------------------
-- Returns the caller's highest-privilege role code, or NULL when signed out.
-- STABLE so the planner may cache it within a statement — it is called from
-- RLS policies on every row.
create or replace function current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.code
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid()::text
  order by case r.code
    when 'super_admin' then 1
    when 'membership_officer' then 2
    when 'finance_officer' then 3
    when 'content_editor' then 4
    when 'support_agent' then 5
    when 'member' then 6
    else 99
  end
  limit 1;
$$;

create or replace function is_staff()
returns boolean
language sql
stable
as $$
  select coalesce(current_user_role() <> 'member', false);
$$;

-- ---------------------------------------------------------------------------
-- Member-scoped policies, bound to auth.uid()
-- ---------------------------------------------------------------------------
-- Layer 3 of the model in docs/08-security.md §3. The application already
-- checks permission before it reads, but these make a member PHYSICALLY unable
-- to read another member's rows even if the application layer is bypassed.

-- A signed-in user reads their own account row.
drop policy if exists own_user_row on users;
create policy own_user_row on users
  for select using (id = auth.uid()::text);

-- A member reads their own membership record in full (including the PII the
-- public directory policy never exposes).
drop policy if exists own_member_row on members;
create policy own_member_row on members
  for select using (user_id = auth.uid()::text);

-- Orders and submissions are visible to the surveyor who owns them.
drop policy if exists own_orders on orders;
create policy own_orders on orders
  for select using (owner_user_id = auth.uid()::text);

drop policy if exists own_submissions on report_submissions;
create policy own_submissions on report_submissions
  for select using (submitted_by = auth.uid()::text);

drop policy if exists own_submission_approvals on report_approvals;
create policy own_submission_approvals on report_approvals
  for select using (
    exists (
      select 1 from report_submissions s
      where s.id = report_approvals.submission_id
        and s.submitted_by = auth.uid()::text
    )
  );

-- Staff read the review queue and the audit trail. Note there is deliberately
-- no INSERT/UPDATE policy for anyone: all writes go through the server with the
-- service role, so that every mutation passes the audited wrapper rather than
-- being written directly from a browser.
drop policy if exists staff_read_submissions on report_submissions;
create policy staff_read_submissions on report_submissions
  for select using (is_staff());

drop policy if exists staff_read_orders on orders;
create policy staff_read_orders on orders
  for select using (is_staff());

drop policy if exists staff_read_members on members;
create policy staff_read_members on members
  for select using (is_staff());

drop policy if exists staff_read_audit on audit_logs;
create policy staff_read_audit on audit_logs
  for select using (current_user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- Claiming a membership record
-- ---------------------------------------------------------------------------
-- Links a signed-in account to an existing roster member by membership number.
-- Returns the member id, or NULL when the number is unknown or already claimed.
-- The roster was loaded without accounts, so this is how a real surveyor takes
-- ownership of their own record.
create or replace function claim_membership(p_membership_number text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  update public.members
     set user_id = auth.uid()::text,
         updated_at = now()
   where membership_number = p_membership_number
     and user_id is null
  returning id into v_id;

  return v_id;
end;
$$;

comment on function claim_membership(text) is
  'Links the calling account to an unclaimed member record. Never reassigns one that is already claimed.';
