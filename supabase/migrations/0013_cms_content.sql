-- ============================================================================
-- ASOO Portal — 0013 · close the gaps that kept the CMS off the public site
-- ============================================================================
-- The CMS tables were designed in 0004, before the block text model settled and
-- before the news seed was written. Wiring the admin screens to Postgres turned
-- up two places where the schema cannot hold what the site already renders.
-- Both are additive; nothing existing changes shape.
--
-- 1. A post's featured image
--
-- `posts.featured_image` is a uuid referencing `media_assets` — right for an
-- image an editor uploads through the media library, which does not exist yet.
-- The five seeded articles point at static files committed to the repository
-- (`/images/news/*.png`). Minting media_assets rows for repo files would be
-- inventing upload records that never happened. A nullable URL column holds
-- the honest thing: a path. When the media library lands, `featured_image`
-- takes over and this stays for externally-hosted art.
--
-- 2. Block text the schema could not store
--
-- `layout_block_translations` has heading / subheading / body / cta_label /
-- items. The BlockText model the renderer actually consumes also carries a
-- badge, a secondary CTA label, and a "view all" label — the hero block on the
-- live homepage uses the first two right now. Without these columns the
-- homepage composer could not round-trip its own hero.
-- ============================================================================

alter table posts
  add column if not exists featured_image_url text;

comment on column posts.featured_image_url is
  'Path or URL of the article image. Used when the image is a repository asset or externally hosted; media_assets.featured_image takes precedence once the media library exists.';

alter table layout_block_translations
  add column if not exists badge_text text,
  add column if not exists secondary_cta_label text,
  add column if not exists view_all_label text;

-- The public site reads published blocks by layout code, ordered by position.
-- Make that an index rather than a scan now that it is the homepage's hot path.
create index if not exists layout_blocks_layout_published_idx
  on layout_blocks (layout_id, is_published, position);

-- Articles are listed newest-first, filtered to published and not soft-deleted.
create index if not exists posts_published_at_idx
  on posts (published_at desc)
  where status = 'published' and deleted_at is null;
