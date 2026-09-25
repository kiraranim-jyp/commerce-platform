-- ════════════════════════════════════════════════════════════════════════════
-- 066 — products 에 workspace_id (063 보완)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 내 실수다. 063 에서 products 를 만들면서 소유자 칸을 넣지 않았다.
-- 이 스키마의 다른 표는 전부 workspace 로 격리된다
-- (product_snapshots.workspace_id → workspaces). products 만 «무주공산» 이었다.
--
-- BETA-SECURITY-2 §11/§13 원칙: 소유자는 «세션에서만» 결정된다. 소유자 칸이
-- 없으면 그 원칙을 적용할 자리 자체가 없다. RLS 를 켜 둬도(064) 정책이 없으므로
-- 실질 보호는 service_role 하나뿐인데, 그마저도 「누구의 상품인가」를 말할 수
-- 없었다.
--
-- 이 결함은 snapshot-ownership 보안 테스트(CASE G)가 잡았다.
--
-- nullable 로 둔다 — products 는 0건이라 데이터 영향이 없고, 기존 표들과 같은
-- ON DELETE 동작(workspace 삭제 시 상품도 삭제)을 맞춘다.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS workspace_id UUID NULL
  REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS products_workspace_id_idx ON products(workspace_id);
