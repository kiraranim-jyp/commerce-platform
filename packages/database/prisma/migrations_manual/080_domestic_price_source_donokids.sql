-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴🔴🔴 CORE-2R-1 — 국내 판매처 등록부에 **`donokids.com` 한 행** 추가
-- ════════════════════════════════════════════════════════════════════════════════
--
-- CPO 결정(2026-10-24) — 「**YES. 단, 1개 호스트만 최소 추가합니다.** 이건 우리가
-- 금지했던 «등록부를 다시 대규모 확장하는 작업» 과 다릅니다 … 새로운 판단 로직을
-- 만드는 게 아니라, **이미 존재하는 정상 입력 데이터 하나를 등록** 하는 것입니다.」
--
-- ── 🟢 왜 이 한 행이 필요한가 (CORE-2R 실측) ───────────────────────────────
--   donokids.com  가격 **KRW 88,000** 있음 · market **UNKNOWN**(`KRW_WITHOUT_DOMAIN_EVIDENCE`)
--   🔴 `.com` + KRW 라 **통화 단독으로는 KR 이 될 수 없다**
--      (`candidate-market.ts` · WU-020 §4 「통화 단독 결정 금지」)
--   🟢 유일한 합법 경로가 `REGISTERED_SHOP_AND_KRW` 이고, 그것은 이 표에 호스트가
--      있으면 발화한다(`run-domestic-price-check.ts:1574` → `registeredDomains`).
--   ⟹ 🟢 이 한 행이면 **운영 코드 변경 0** 으로
--      `market=KR` → 국내 가격 축 → `exact.averagePriceKrw` → `computeSellability`
--      까지 **기존 배선이 그대로** 이어진다.
--
-- ── 🔴🔴 `collection_strategy = 'MANUAL'` 인 이유 ──────────────────────────
--   🔴 `AUTO_SCRAPE` 로 넣으면 **그 샵을 크롤링하기 시작한다** — CPO 가 「검색 변경 0」
--      이라고 못 박았으므로 그 방향은 범위 밖이다.
--   🟢 그리고 **`MANUAL` 이어도 목적은 달성된다** — `registeredDomains` 는
--      `isBatchSurveyTarget` **필터 «전»** 목록으로 만든다
--      (`run-domestic-price-check.ts:949` · 그 자리의 주석이 이유를 적어 둔다).
--      ⟹ 🟢 **검색은 돌지 않고 시장 판정만 얻는다.** 정확히 최소 변경이다.
--   🔴 그리고 `MANUAL` 은 이 표에서 「수집 불가」가 아니라 **「아직 조사하지 않았다」**
--      는 뜻이다(`domestic-price-source.ts:261` 주석 · 추정 금지 원칙).
--
-- ── 🔴 멱등이다 ───────────────────────────────────────────────────────────
--   `domain` 이 **unique**(029:15) 이므로 `on conflict (domain) do nothing` 으로
--   **여러 번 적용해도 한 행** 이다. 🔴 기존 행을 **덮지 않는다**(이미 있으면 그대로).
--
-- 🔴 이 파일은 `migrations_manual` 이다 — **사람이 손으로 적용** 한다(029/030 과 같은 방식).
-- ════════════════════════════════════════════════════════════════════════════════

-- 🔴 칸 목록·값 모양·`on conflict` 를 **030 시드에서 그대로 베꼤다**(추측 0) —
--    `…, status, source, enabled` 열 개이고 scope 는 `array['KIDS_FASHION']` 꼴이다.
insert into domestic_price_sources (name, domain, url, currency, category_scope, priority, collection_strategy, status, source, enabled)
values
  ('도노키즈', 'donokids.com', 'https://www.donokids.com', 'KRW', array['KIDS_FASHION'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true)
on conflict (domain) do nothing;
