-- Sprint 0(CEO 지시, 2026-08-07) — 상세설명 템플릿의 5개 섹션(배송/교환/반품/구매대행/A·S)을
-- 단일 문자열에서 텍스트/이미지 블록 배열로 확장한다. 기존 *_info text 컬럼은 그대로 두고
-- (mergeCoupangDescription 레거시 폴백 경로와 하위호환 미러용) *_blocks jsonb만 추가한다 —
-- 013/017과 같은 "추가만 하고 기존 컬럼은 안 건드린다" 패턴.
alter table coupang_description_templates
  add column if not exists shipping_blocks jsonb not null default '[]'::jsonb,
  add column if not exists exchange_blocks jsonb not null default '[]'::jsonb,
  add column if not exists return_blocks jsonb not null default '[]'::jsonb,
  add column if not exists agent_buy_blocks jsonb not null default '[]'::jsonb,
  add column if not exists as_blocks jsonb not null default '[]'::jsonb;
