-- Local compose only: a super user and the admin key
-- HAPPYVIEW_ADMIN_KEY=hv_local_development_only, so sync.ts runs without signing in to the
-- dashboard. Never run this against a real instance.
--
--   docker compose -f happyview/compose.yaml exec -T postgres psql -U happyview < happyview/dev-admin.sql
INSERT INTO happyview_users (id, did, is_super, created_at)
VALUES ('local-dev', 'did:plc:localdevelopment', 1, now()::text)
ON CONFLICT (did) DO NOTHING;

INSERT INTO happyview_api_keys (id, user_id, name, key_hash, key_prefix, permissions, created_at)
VALUES (
  'local-dev', 'local-dev', 'local sync',
  -- sha256("hv_local_development_only")
  '41f0d9be6d3a4644361f8538f16bf9c57603c381ad9bda5dc349e8391db228dd', 'hv_local',
  '["lexicons:create","lexicons:read","lexicons:delete","scripts:manage","scripts:read","backfill:create","backfill:read","api-clients:create","api-clients:view","records:read","events:read"]',
  now()::text
)
ON CONFLICT (id) DO NOTHING;
