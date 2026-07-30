-- P0-1(가격 계산 투명화) — 등록 시점에 실제로 어떤 환율/배송비/수수료율/
-- 마진율로 판매가격이 산출됐는지 등록 이력에서 재구성할 수 있게 jsonb로
-- 통째로 저장한다(brand_resolution/compliance_report와 같은 패턴).
alter table registration_attempts add column if not exists price_breakdown jsonb;
