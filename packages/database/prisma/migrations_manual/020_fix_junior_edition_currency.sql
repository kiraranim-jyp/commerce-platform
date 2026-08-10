-- Sprint B-1.7 — comparison_shops 시드 데이터 정정(스키마 변경 아님, 데이터 1건만).
-- B-1.6 조사에서 Junior Edition의 실제 매장 통화가 HKD가 아니라 GBP임을
-- junioredition.com/meta.json으로 직접 확인했다(country: GB, currency: GBP).
-- country는 그 필드의 의미(소재국/사업자등록국/배송대상국/UI표시국)가 코드상
-- 확정되지 않아 이번에는 currency만 정정한다(country는 Hong Kong 그대로 유지).
update comparison_shops
set currency = 'GBP', updated_at = now()
where domain = 'junioredition.com';
