-- ============================================================
-- RESET — drop everything this bundle manages so it re-runs cleanly.
-- Safe here: the project holds only demo/seed data at this point.
-- Drops tables first (cascade clears their indexes/triggers/rules/
-- policies/FKs), then the enum types.
-- ============================================================
drop table if exists
  report_approvals, report_reviews, report_submissions, orders,
  layout_block_translations, layout_blocks, layouts,
  post_translations, posts, media_assets, post_categories,
  member_documents, member_translations, members,
  member_categories, governorates,
  audit_logs, user_roles, role_permissions, permissions, roles, users
cascade;

drop type if exists
  approval_status, review_decision, submission_status, report_file_type,
  order_status, order_type, layout_block_type, layout_region,
  publish_status, document_type, member_status, locale
cascade;
