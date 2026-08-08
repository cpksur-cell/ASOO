-- ============================================================================
-- ASOO Portal — 0006 · Row Level Security
-- ============================================================================
-- Posture: DENY by default. RLS is enabled on every table; only the narrow,
-- genuinely-public reads below are opened to the anon/authenticated roles.
--
-- The application server talks to Postgres with the SERVICE ROLE key, which
-- BYPASSES RLS entirely — authorization for privileged reads/writes is done in
-- the app layer (the three-layer model in docs/08-security §3). RLS here is the
-- safety net: if the anon (public) key is ever used from the browser, it must
-- be physically unable to read invoices, PII, unpublished content, or the raw
-- report files' metadata.
--
-- When Supabase Auth lands, these policies grow member-scoped rules bound to
-- auth.uid() so a member can read only their own rows directly. Until then,
-- privileged access is exclusively server-side.
-- ============================================================================

-- Enable RLS everywhere. No policy = no access for anon/authenticated.
alter table users                     enable row level security;
alter table roles                     enable row level security;
alter table permissions               enable row level security;
alter table role_permissions          enable row level security;
alter table user_roles                enable row level security;
alter table audit_logs                enable row level security;
alter table governorates              enable row level security;
alter table member_categories         enable row level security;
alter table members                   enable row level security;
alter table member_translations       enable row level security;
alter table member_documents          enable row level security;
alter table post_categories           enable row level security;
alter table media_assets              enable row level security;
alter table posts                     enable row level security;
alter table post_translations         enable row level security;
alter table layouts                   enable row level security;
alter table layout_blocks             enable row level security;
alter table layout_block_translations enable row level security;
alter table orders                    enable row level security;
alter table report_submissions        enable row level security;
alter table report_reviews            enable row level security;
alter table report_approvals          enable row level security;

-- ---------------------------------------------------------------------------
-- Public reads (reference data + published content only)
-- ---------------------------------------------------------------------------
create policy public_read_governorates       on governorates       for select using (true);
create policy public_read_member_categories  on member_categories  for select using (true);
create policy public_read_post_categories    on post_categories    for select using (true);
create policy public_read_layouts            on layouts            for select using (true);

create policy public_read_published_blocks on layout_blocks
  for select using (is_published = true);

create policy public_read_block_translations on layout_block_translations
  for select using (
    exists (select 1 from layout_blocks b
            where b.id = block_id and b.is_published = true)
  );

create policy public_read_published_posts on posts
  for select using (status = 'published' and deleted_at is null);

create policy public_read_post_translations on post_translations
  for select using (
    exists (select 1 from posts p
            where p.id = post_id and p.status = 'published' and p.deleted_at is null)
  );

-- Directory shows only members who consented to be listed. PII columns stay off
-- limits by never being selected client-side; a follow-up column-scoped view
-- will harden this further when the public directory reads Supabase directly.
create policy public_read_directory_members on members
  for select using (is_directory_visible = true and status = 'active');

create policy public_read_directory_member_translations on member_translations
  for select using (
    exists (select 1 from members m
            where m.id = member_id and m.is_directory_visible = true and m.status = 'active')
  );

-- NOTE: orders, report_submissions, report_reviews, report_approvals,
-- audit_logs, invoices/PII — NO anon policy. Server-only via the service role.
-- Public approval verification is served by the server (service role), which
-- returns only the minimal non-sensitive fields.
