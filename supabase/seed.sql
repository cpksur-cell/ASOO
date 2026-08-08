-- ============================================================================
-- ASOO Portal — seed data
-- ============================================================================
-- Mirrors the app's in-memory demo fixtures (seed.ts, report-demo.ts) so that a
-- freshly-migrated Supabase database shows exactly what the fallback demo shows.
-- Safe to re-run: every insert is idempotent via ON CONFLICT.
--
-- Fixed UUIDs are used for the demo rows so foreign keys line up deterministically.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Roles (the 7 from docs/08-security §2)
-- ---------------------------------------------------------------------------
insert into roles (code, name_ar, name_en) values
  ('super_admin',        'مدير النظام',        'Super administrator'),
  ('content_editor',     'محرر المحتوى',       'Content editor'),
  ('finance_officer',    'موظف مالي',          'Finance officer'),
  ('membership_officer', 'موظف العضوية',       'Membership officer'),
  ('support_agent',      'موظف دعم',           'Support agent'),
  ('member',             'عضو',                'Member')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Governorates (12) — codes match src/lib/data/seed.ts
-- ---------------------------------------------------------------------------
insert into governorates (code, name_ar, name_en, position) values
  ('amman',   'عمان',    'Amman',   1),
  ('irbid',   'إربد',    'Irbid',   2),
  ('zarqa',   'الزرقاء', 'Zarqa',   3),
  ('aqaba',   'العقبة',  'Aqaba',   4),
  ('mafraq',  'المفرق',  'Mafraq',  5),
  ('jerash',  'جرش',     'Jerash',  6),
  ('madaba',  'مادبا',   'Madaba',  7),
  ('karak',   'الكرك',   'Karak',   8),
  ('tafilah', 'الطفيلة', 'Tafilah', 9),
  ('maan',    'معان',    'Ma''an',  10),
  ('ajloun',  'عجلون',   'Ajloun',  11),
  ('balqa',   'البلقاء', 'Balqa',   12)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Member categories
-- ---------------------------------------------------------------------------
insert into member_categories (code, name_ar, name_en) values
  ('office_owner',        'صاحب مكتب',   'Office owner'),
  ('practising_surveyor', 'مساح مزاول',  'Practising surveyor')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Demo login accounts (match the mock UIDs the app issues)
-- ---------------------------------------------------------------------------
insert into users (id, email, display_name, preferred_locale) values
  ('mock-uid-member',             'member@asoo.invalid',             'أحمد وليد المصري', 'ar'),
  ('mock-uid-membership_officer', 'membership_officer@asoo.invalid', 'موظف العضوية',     'ar')
on conflict (id) do nothing;

insert into user_roles (user_id, role_id)
select 'mock-uid-member', id from roles where code = 'member'
on conflict do nothing;
insert into user_roles (user_id, role_id)
select 'mock-uid-membership_officer', id from roles where code = 'membership_officer'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Demo member (seed.ts m01 — Ahmad Waleed Al-Masri)
-- ---------------------------------------------------------------------------
insert into members (
  id, user_id, license_number, membership_number,
  category_id, governorate_id, status, joined_at,
  is_directory_visible, directory_address, search_normalized
) values (
  'd0000000-0000-4000-8000-000000000001',
  'mock-uid-member', 'SV-1042', 'ASOO-0412',
  (select id from member_categories where code = 'office_owner'),
  (select id from governorates where code = 'amman'),
  'active', '2004-03-14',
  true, 'عمّان — جبل الحسين', 'احمد وليد المصري ahmad waleed al masri'
) on conflict (id) do nothing;

insert into member_translations (member_id, locale, full_name, office_name) values
  ('d0000000-0000-4000-8000-000000000001', 'ar', 'أحمد وليد المصري', 'مكتب الميزان للمساحة'),
  ('d0000000-0000-4000-8000-000000000001', 'en', 'Ahmad Waleed Al-Masri', 'Al-Mizan Surveying Office')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Orders (report-demo.ts DEMO_ORDERS)
-- ---------------------------------------------------------------------------
insert into orders (
  id, order_number, member_id, owner_user_id, governorate_id,
  type, status, title, parcel_reference, client_name, created_by, created_at
) values
  ('a0000000-0000-4000-8000-000000000418', 'ORD-2026-000418',
   'd0000000-0000-4000-8000-000000000001', 'mock-uid-member',
   (select id from governorates where code = 'amman'),
   'land_subdivision', 'in_review',
   'إفراز قطعة أرض حوض 3 — الجبيهة', 'حوض 3 / قطعة 214',
   'شركة الإسكان الأردنية', 'mock-uid-member', '2026-01-18T00:00:00Z'),

  ('a0000000-0000-4000-8000-000000000512', 'ORD-2026-000512',
   'd0000000-0000-4000-8000-000000000001', 'mock-uid-member',
   (select id from governorates where code = 'amman'),
   'topographic_survey', 'draft',
   'رفع مساحي طبوغرافي — لواء الجامعة', 'حوض 7 / قطعة 88',
   'أمانة عمّان الكبرى', 'mock-uid-member', '2026-02-02T00:00:00Z'),

  ('a0000000-0000-4000-8000-000000000377', 'ORD-2026-000377',
   'd0000000-0000-4000-8000-000000000001', 'mock-uid-member',
   (select id from governorates where code = 'irbid'),
   'boundary_survey', 'completed',
   'تحديد حدود قطعة — إربد', 'حوض 12 / قطعة 45',
   'مالك خاص', 'mock-uid-member', '2026-01-06T00:00:00Z')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Report submissions (report-demo.ts DEMO_SUBMISSIONS)
-- ---------------------------------------------------------------------------
insert into report_submissions (
  id, order_id, submitted_by, file_type, file_name, file_size,
  version, status, note, created_at
) values
  ('b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000377', 'mock-uid-member',
   'pdf', 'boundary-report-irbid.pdf', 2340000, 1, 'approved',
   'التقرير النهائي بعد الرفع الميداني.', '2026-01-08T00:00:00Z'),

  ('b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000418', 'mock-uid-member',
   'dwg', 'subdivision-plan-juba.dwg', 5120000, 1, 'under_review',
   'مخطط الإفراز المبدئي.', '2026-01-20T00:00:00Z')
on conflict (id) do nothing;

-- Review row for the approved submission (append-only history)
insert into report_reviews (submission_id, reviewer_id, reviewer_role, decision, comments, created_at) values
  ('b0000000-0000-4000-8000-000000000001', 'mock-uid-membership_officer',
   'membership_officer', 'approved', 'مطابق للأصول الفنية.', '2026-01-10T00:00:00Z')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Approval (report-demo.ts DEMO_APPROVALS)
-- ---------------------------------------------------------------------------
insert into report_approvals (
  id, submission_id, order_id, approval_number, verification_code,
  status, approved_by, issued_at
) values (
  'c0000000-0000-4000-8000-000000000091',
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000377',
  'APR-2026-000091', 'ASOO-RPT-4K7Q-P9M2-T1A6',
  'valid', 'mock-uid-membership_officer', '2026-01-10T00:00:00Z'
) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Advance sequences past the seeded numbers so generated ids never collide.
-- ---------------------------------------------------------------------------
select setval('order_number_seq',    512, true);
select setval('approval_number_seq', 91,  true);
