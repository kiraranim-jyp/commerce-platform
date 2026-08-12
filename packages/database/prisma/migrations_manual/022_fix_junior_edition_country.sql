-- Sprint N-3.8 — comparison_shops.country의 의미를 "Seller Origin Country"로
-- 확정한다(스키마 변경 아님, 데이터 1건만).
--
-- Migration 020에서 이미 junioredition.com/meta.json 실측으로 country: GB를
-- 확인했지만, 그 시점에는 country 필드의 의미(소재국/사업자등록국/배송대상국/
-- UI표시국)가 코드상 확정되지 않아 currency만 정정하고 country는 "Hong Kong"
-- 그대로 남겨뒀다. N-3.7/N-3.8에서 이 필드의 의미를 "Seller Origin Country
-- (판매처 원본 국가, 가격 Intelligence의 참고 표시값)"로 확정했으므로,
-- 이미 실측된 값(GB → "United Kingdom", 다른 행의 표기 형식과 통일)으로
-- 정정한다.
--
-- 주의: 이 값은 여전히 "참고 표시값"일 뿐이다 — 실제 원본가격 조회(N-3.7의
-- /api/price-intelligence)는 이 컬럼을 전혀 읽지 않고, 매 요청마다 판매처의
-- 실제 공식 사이트 `/meta.json`을 직접 fetch해서 국가를 재검증한다(N-3.8
-- Section 3 "저장값을 맹목적으로 신뢰하지 않는다" 원칙 — 이미 아키텍처상
-- 충족되어 있었다).

update comparison_shops
set country = 'United Kingdom', updated_at = now()
where domain = 'junioredition.com';
