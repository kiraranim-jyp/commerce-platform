-- N-4.18-G STEP G-1(대표님 지시, 2026-08-25: "한 번에 크게 만들지 말고, 실측된
-- 것만 단계적으로 저장한다") — price_observations(027)에 판매가/정가/품절
-- 여부를 분리해서 저장한다. 지금까지는 sale ?? regular를 price_krw 하나로
-- 뭉쳐서 저장했다(rulii.ts fetchRuliiProductPrice) — 할인 여부/품절 여부를
-- 구분해서 보여주려면 원본 신호를 그대로 남겨야 한다.
--
-- 중요(대표님 명시): price_krw의 기존 의미(그 시점의 "실제 판매가", 있으면
-- 할인가·없으면 정가)는 절대 바꾸지 않는다 — 기존 가격비교/마진 계산
-- (packages/pricing computePriceDecision 등)이 이 컬럼을 그대로 계속 읽는다.
-- 이번에 추가하는 3개 컬럼은 "추가 정보"이지 price_krw의 대체가 아니다.
--
-- sold_out은 boolean이 아니라 nullable boolean으로 둔다 — "정보 없음"과
-- "판매중"을 같은 값(false)으로 취급하지 않는다(대표님 명시 원칙). 품절
-- 감지를 아직 구현하지 않은 사이트(LOOXLOO/DEUXBEBE/bobochoses 등)는 계속
-- null을 쓴다 — 이 컬럼이 생겨도 그 사이트들의 기존 동작은 바뀌지 않는다.
alter table price_observations
  add column if not exists sale_price_krw numeric,
  add column if not exists original_price_krw numeric,
  add column if not exists sold_out boolean;
