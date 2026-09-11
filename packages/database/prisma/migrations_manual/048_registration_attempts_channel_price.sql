-- PHASE 3.2(CPO 확정, 2026-09-11) — 채널별 최종 등록가격의 감사 기록.
--
-- 무엇을 남기나: 채널 · 최종 등록가격 · 가격 출처 · 등록 시점.
--   {
--     "platform": "coupang",
--     "finalPriceKrw": 145000,
--     "priceOrigin": "CHANNEL_OVERRIDE",
--     "priceOriginLabel": "채널 최종 등록가격",
--     "registeredAt": "2026-09-11T12:34:56.000Z"
--   }
--
-- 왜 기존 price_breakdown에 얹지 않았나(중요):
-- price_breakdown의 뜻은 "등록 당시 상품 가격 **계산** 결과"(원본가/통화/배송비/
-- 수수료율/마진율, 그리고 그때 상품정보에서 확정돼 있던 최종 판매가격)다. 여기에
-- 채널 최종가를 섞으면 이미 쌓인 모든 행의 의미가 소급해서 바뀐다 — 과거 행에는
-- 채널이라는 축이 존재하지도 않았으므로 "채널 값이 없었다"인지 "그 시절엔 이
-- 개념 자체가 없었다"인지 영원히 구분할 수 없게 된다. 끝난 기록을 다시 해석하지
-- 않는다는 원칙(046과 동일)에 따라 새 구조는 새 컬럼에 따로 기록한다.
--
-- 기존 행은 backfill하지 않는다. 지금의 해석으로 과거 등록을 채워 넣으면 없는
-- 사실을 지어내는 것이다 — 이 컬럼은 배포 시점 이후의 등록부터만 채워진다.
-- 마이그레이션 실행 전에도 등록 자체는 정상 동작한다: 두 register route의
-- logRegistrationAttempt가 "컬럼 없음"을 감지하면 이 필드만 제외하고 재시도한다
-- (기존 016/025와 동일한 우아한 저하 패턴).

alter table registration_attempts add column if not exists channel_price_record jsonb;

comment on column registration_attempts.channel_price_record is
  'PHASE 3.2 — 이 등록 시도에서 해당 채널로 실제 나간 최종 등록가격과 그 출처(채널 최종가/상품정보 최종 판매가격/권장 판매가격) 및 등록 시점. price_breakdown(당시 가격 계산 결과)과 목적이 다르며 서로 대체하지 않는다.';
