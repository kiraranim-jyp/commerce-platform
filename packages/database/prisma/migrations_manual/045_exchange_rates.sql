-- PRICE-ACCURACY-REGRESSION-1.1(CPO 승인, 2026-09-11) — 마지막 정상 환율 보관.
--
-- 왜 테이블인가: Vercel 서버리스는 인스턴스가 요청마다 새로 뜰 수 있어 메모리
-- 캐시가 남아있다는 보장이 없다. 지금 구조는 캐시가 아예 없어서 Frankfurter가
-- 한 번 실패하면 즉시 코드에 박힌 고정 환율표로 떨어지는데, 그 표는 오늘 기준
-- 실제 환율과 최대 6.7% 어긋나 있다(SEK 130 vs 139.4). 마진·CASE 판정까지
-- 그 오차가 그대로 들어간다.
--
-- 왜 이 모양인가: 통화당 한 행만 유지한다(UPSERT). 과거 환율 이력을 쌓지 않는
-- 이유는 CPO 지시 때문이다 — **이미 끝난 분석의 KRW 원가를 나중 환율로 다시
-- 계산하면 안 된다.** 분석 시점의 환산값과 조회시각은 그 분석 결과에 이미
-- 박혀 있어야 하고, 이 표는 "다음 분석이 쓸 최신값" 하나만 들고 있으면 된다.
-- 이력이 필요해지면 그때 별도 설계한다(지금 만들면 재계산 유혹만 생긴다).

CREATE TABLE IF NOT EXISTS exchange_rates (
  -- 1 <currency> = <rate> KRW. KRW 자체는 저장하지 않는다(항상 1).
  currency    TEXT PRIMARY KEY,
  rate        NUMERIC(18, 6) NOT NULL CHECK (rate > 0),
  -- 이 값을 어디서 받았는지. 지금은 'frankfurter' 하나뿐이지만, 공급원을
  -- 바꾸거나 추가할 때 어떤 행이 어디서 왔는지 구분할 수 있어야 한다.
  source      TEXT NOT NULL,
  -- 공급원이 고시한 기준일시(요청 시각이 아니다 — ECB는 하루 1회 고시하므로
  -- 응답의 date를 그대로 쓴다). 화면에 "마지막 조회"로 보여주는 값.
  fetched_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 이 표는 사용자 데이터가 아니라 전역 참조 데이터다 — workspace로 나뉘지 않는다.
-- 서버(service role)만 쓰고 읽으므로 RLS를 켜고 정책을 두지 않는다(= 익명/사용자
-- 키로는 접근 불가, service role은 RLS를 우회한다).
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
