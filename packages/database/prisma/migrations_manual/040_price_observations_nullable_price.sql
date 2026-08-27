-- N-4.18-Q3 PART E-1(대표님 지시, 2026-08-27: "가격이 없어도 품절이라는 중요한
-- 운영 정보는 보존") — price_observations.price_amount/price_krw가 not null이라
-- "완전 품절이라 가격 자체가 없음"(price=null, soldOut=true) 관측치를 저장할 수
-- 없었다(039까지의 스키마로는 이 케이스 자체가 insert 불가능 — 코드 버그가 아니라
-- 스키마 제약 때문이었다). 0원을 지어내는 대신(대표님이 명시적으로 금지) 두
-- 컬럼을 nullable로 바꾼다. currency는 그대로 not null 유지 — 국내 소스는
-- 완전 품절이어도 통화(KRW)는 항상 알 수 있다(domestic_price_sources.currency
-- 참고, 가격을 몰라서 통화까지 모르는 경우는 없음).
alter table price_observations alter column price_amount drop not null;
alter table price_observations alter column price_krw drop not null;
