-- P-10 STEP 4(대표님/CPO 지시, 2026-08-30) — decision.ts의 decideCandidateEvidence()가
-- 내부적으로 deriveMatchTruth()로 이미 계산해 두고도 버리던 MatchTruth 값을
-- 명시적으로 저장한다. 지금까지는 UI가 이 값을 못 읽어서 matchReasons 문자열에서
-- "식별자 근거"라는 문구를 다시 찾아 정렬 기준을 추론했다(display-priority.ts) —
-- 새 판정 로직이 아니라, 이미 계산되는 값을 저장/전달 경로에 실어 나르는 배선
-- 작업이다. match.ts/scoreCandidateMatch()/compareModelCode()/deriveMatchTruth()
-- 판정 로직은 이 마이그레이션과 무관하게 그대로다.
--
-- 기존 행은 이 컬럼이 없던 시절에 계산된 것이라 modelCode 증거 자체가 저장되어
-- 있지 않다(match_type/verified만 있음) — MatchTruth를 안전하게 되돌릴 수 없으므로
-- backfill을 강행하지 않는다(matchReasons 문자열을 다시 파싱해서 채우는 것은
-- 부정확한 값을 영구 저장하는 결과라 P-10 STEP 3.5에서 명시적으로 배제했다).
-- 기존 행은 match_truth = NULL로 남고, "가격 다시 확인"이나 daily cron으로
-- upsertDomesticProductLink()가 그 행을 다시 갱신할 때 자연스럽게 채워진다
-- (해당 함수가 유일한 쓰기 경로임을 STEP 3.5에서 확인).
alter table domestic_product_links
  add column if not exists match_truth text
  check (match_truth is null or match_truth in (
    'EXACT_IDENTIFIER', 'STRONG_IDENTIFIER', 'TEXT_CONFIRMED',
    'SIMILAR', 'INSUFFICIENT_EVIDENCE', 'CONFLICT'
  ));
