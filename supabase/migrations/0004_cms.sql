-- ============================================================================
-- ASOO Portal — 0004 · content / CMS
-- ============================================================================
-- Tables exist and are ready; the public site still renders from the seed
-- repository until the CMS read path is wired to Supabase in a follow-up pass.
-- Creating them now keeps the schema whole and the migration order stable.
-- ============================================================================

create table post_categories (
  id       uuid primary key default gen_random_uuid(),
  slug     text unique not null,
  name_ar  text not null,
  name_en  text not null,
  position int not null default 0
);

create table media_assets (
  id          uuid primary key default gen_random_uuid(),
  storage_path text not null,
  file_name   text not null,
  mime_type   text not null,
  file_size   int,
  width       int,
  height      int,
  alt_text_ar text,          -- accessibility is not optional
  alt_text_en text,
  uploaded_by text references users(id),
  created_at  timestamptz not null default now()
);

create table posts (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid references post_categories(id),
  slug           text unique not null,      -- ASCII, transliterated, never raw Arabic
  status         publish_status not null default 'draft',
  published_at   timestamptz,
  featured_image uuid references media_assets(id),
  is_featured    boolean not null default false,
  view_count     int not null default 0,
  deleted_at     timestamptz,               -- archive, never hard-delete from admin UI
  created_by     text references users(id),
  updated_by     text references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger posts_set_updated_at
  before update on posts
  for each row execute function set_updated_at();
create index posts_status_published_idx on posts (status, published_at desc);

create table post_translations (
  post_id         uuid not null references posts(id) on delete cascade,
  locale          locale not null,
  title           text not null,
  excerpt         text,
  body            text,
  seo_title       text,
  seo_description text,
  primary key (post_id, locale)
);

-- Homepage block composition — see docs/09-cms.md.
create table layouts (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,          -- homepage, ...
  name_ar    text not null,
  name_en    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger layouts_set_updated_at
  before update on layouts
  for each row execute function set_updated_at();

-- position is gap-numbered by 10 so a reorder touches two rows, not all of them.
-- config is jsonb validated against a per-type Zod schema in the application.
create table layout_blocks (
  id           uuid primary key default gen_random_uuid(),
  layout_id    uuid not null references layouts(id) on delete cascade,
  type         layout_block_type not null,
  region       layout_region not null default 'main',
  position     int not null default 0,
  is_published boolean not null default false,
  config       jsonb,
  updated_by   text references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger layout_blocks_set_updated_at
  before update on layout_blocks
  for each row execute function set_updated_at();
create index layout_blocks_layout_position_idx on layout_blocks (layout_id, position);

create table layout_block_translations (
  block_id   uuid not null references layout_blocks(id) on delete cascade,
  locale     locale not null,
  heading    text,
  subheading text,
  body       text,
  cta_label  text,
  items      jsonb,           -- per-item text for grids and counters
  primary key (block_id, locale)
);
