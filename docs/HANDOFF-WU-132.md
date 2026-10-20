# 🔴 인수인계 — WU-132 **SAME→가격비교 / SIMILAR→셀러검토 / feedback→재활용**

> 🔴🔴🔴 **새 세션은 준비 단계 없이 §3 의 ⒜ 부터 «바로 코드»** 다.
> **재조사 금지 · 재설계 금지 · 설계 WU 추가 금지**(헌장 §4-C ①).
> 🔴 그리고 **거기서 멈추지 않는다** — 아래 **13 단계를 한 세션에서 끝까지** 간다.
> 🔴 중간 보고 없이 **완료 보고 1회**(지시서 §17 의 21항 형식).
>
> ```
> ① MI SAME → 기존 시장 가격 비교 패널 공급   ② SAME + 현재 판매중 + 가격확인 필터
> ③ unified-price-comparison 제거            ④ SIMILAR 이미지 비교 UI
> ⑤ 동일상품/다른제품/판단불가 저장           ⑥ candidate_reviews 재활용
> ⑦ B226AC009 E2E                           ⑧ **다른 실제 상품 최소 2개 교차검증**
> ⑨ 전체 회귀(기준 8,462)                    ⑩ typecheck 0 / build 0
> ⑪ deploy                                  ⑫ production 확인      ⑬ 최종 보고
> ```
> 🔴🔴 **이 WU 의 PASS 는 코드 구현이 아니라 Production E2E + 교차검증 + 회귀 + 배포** 다.
>
> 🟢 현재 — 작업트리 clean · `origin/main` ahead 0 / behind 0 · WU-131 배포 완료(`6fd4186e`).
> 🟢 **전수검토·설계는 끝났다**(§1·§2). 그것 때문에 세션을 다시 나누지 않는다.

---

## 0. 🔴 이번 WU 의 PASS 는 「유사상품 영역이 생겼다」가 **아니다**

```
원본 URL → 후보 자동 발견 → MI 가 후보별 SAME/SIMILAR/DIFFERENT/UNDECIDED
 ├ SAME      → **현재 판매상태·가격 재확인** → 기존 「📊 시장 가격 비교」에 표시
 ├ SIMILAR   → 가격비교 **제외** → 원본/후보 **이미지 비교** → 셀러 3선택 → feedback 저장
 └ DIFF/UNDE → 제외
기존 feedback → **다음 검색 후보 pool 에 재활용**
🔴 그리고 「가격비교에 SAME 만 들어간다」를 **데이터로 증명** 해야 한다.
```

## 1. 🟢 §16 이 요구한 **전수검토 — 연결점은 이미 확정됐다**(이 세션에서 만든 코드다)

| 축 | owner (실측) |
|---|---|
| 「📊 시장 가격 비교」 **본체** | `StageBody.tsx:242` CollapsibleSection → `CommerceWorkspace.tsx:3780·3796` 의 **`DomesticShopSearch` + `ComparisonShopSearch`** 두 패널 |
| 그 패널의 **표시 게이트** | 🔴🔴 **`mayShowCandidate`**(`match-display.ts`) + `displayTierForCandidate` + `isDefaultVisibleTier` — `ComparisonShopSearch.tsx:769` · `DomesticShopSearch.tsx:552` · 요약은 `:395` |
| 그 패널의 **데이터** | 🔴 **클라이언트가 직접 부른다** — `/api/comparison/search`(해외 · `useCollectOnce` 1회) · `/api/domestic-price-sources/search`(국내) |
| MI 후보 판정 | `judgeDomesticCandidate` → `priceTierFromLink` → `classifyCandidateMarket` (`run-domestic-price-check.ts`) |
| transient 후보 sink | `transientEvidenceSink`(일시 샵 가드 **안** · 하나) → `check/route.ts:~170` → `computeMarketIntelligence` |
| 후보 검토 이력(WU-131) | `candidate_reviews` 테이블 · `_lib/candidate-review.ts` · `GET/POST /api/price-history/[snapshotId]/candidate-reviews` |
| 이력 **생산자** | `check/route.ts` 의 `recordSeenCandidates(...)`(세 출처) |
| 과거 GT | `candidate_reviews` 에 `source='GT_IMPORT'` · **B226AC009 17건**(SAME 13 · DIFFERENT 4) |
| WU-130 ④ 영역(**제거 대상**) | `DomesticPriceIntelligencePanel.tsx` 의 `data-testid="unified-price-comparison"` + `UNIFIED_PRICE_COMPARISON_TITLE` |

🔴🔴 **가장 중요한 구조적 사실** — 「📊 시장 가격 비교」는 **MI verdict 를 보지 않는다.**
그 두 패널은 **클라이언트가 따로 부른 검색 결과** 를 `mayShowCandidate`(등급+충돌 기반)로
거를 뿐이고, `/check` 의 `judgeDomesticCandidate` 산출과 **다른 경로** 다.
⟹ 🔴 **「SAME 만 표시」를 하려면 그 두 패널에 MI verdict 를 «공급» 해야 한다.**
그것이 이번 WU 의 **진짜 작업** 이고, 「영역 하나 더 만들기」가 아니다.

## 2. 🔴 설계 결정 셋 (구현 전에 고정한다)

```
① SAME 공급 경로 — 🔴 새 검색을 만들지 않는다.
   `/check` 가 이미 후보별 verdict/tier/가격/market 을 낸다(`overseasAutoEvidence` 등 세 배열).
   🟢 그 배열을 **「📊 시장 가격 비교」 패널의 입력으로 올려보낸다**(`onEvidenceChange` 와
      같은 방향 · CommerceWorkspace 가 이미 `overseasMarketEvidence` 를 그렇게 받는다).
   🔴 그 패널이 **자기 검색 결과 대신/와 함께** MI SAME 만 그리게 한다 — 가격 계산식은 불변.
② 「현재 판매상태·가격 재확인」(§6) — 🟢 **기존 owner 를 쓴다**
   `enrichCandidatePrices` / `factsFromProductUrl`(`priceStatus`) · 🔴 새 수집기 금지.
   🔴 과거 SAME 이어도 **지금 판매중+가격 확인** 이 아니면 가격비교에서 뺀다.
③ feedback 재활용(§9) — 🟢 **WU-131 테이블을 그대로** 쓴다(새 테이블 금지).
   `candidate_reviews` 에서 `human_verdict='SAME'` 인 URL 을 읽어
   **후보 pool 입력**(`candidateUrls` 와 같은 자리)으로 넣는다 → 그 뒤는 기존 경로.
   🔴 과거 `DIFFERENT` 는 자동 편입 **금지** · 과거 사람 판단을 **MI 판정으로 위조 금지**.
```

## 3. 구현 순서 (이대로 간다)

```
⒜ MI verdict → 「📊 시장 가격 비교」 공급 배선(①) + **SAME 만** 필터
⒝ WU-130 ④ `unified-price-comparison` **제거** + `wu-056r1`·`wu-130 F-3/F-4` 계약 갱신
⒞ SIMILAR 영역 — 원본/후보 **이미지 나란히** + 3버튼(동일/다른제품/판단불가) + §4 안내문
   🟢 버튼·저장은 **WU-131 의 것을 그대로** 쓴다(`onReview`/`saveState`/POST) —
   🔴 단 어휘가 셋이다: `SAME` · `DIFFERENT` · `UNDECIDED`(`SIMILAR` 버튼은 **없다**)
⒟ 과거 feedback → 후보 pool 재활용(③) + canonical 중복 제거(`reviewKey` 재사용)
⒠ E2E(B226AC009) → 회귀 → build → 배포 → 보고 1회
```

## 4. 🔴 반드시 지킬 것

```
🔴 셀러 판단이 `systemVerdict` 를 **덮지 않는다**(WU-131 계약 B-4/B-5 가 이미 잠근다)
🔴 SIMILAR 가격을 **시장가격 계산에 넣지 않는다**
🔴 SAME 기준을 낮추지 않는다 · threshold 0 · 새 판단축 0
🔴 가격비교 영역을 **둘 만들지 않는다**(WU-130 ④ 를 **지우고** 기존 하나만 남긴다)
🔴 범위 밖 — MI 축/threshold · Registry 확대 · 새 adapter · AI/Gemini · 카테고리 확장
```

## 5. 🔴 알려진 함정 (이 세션에서 실제로 밟았다)

```
🔴 「📊 시장 가격 비교」의 두 패널은 **클라이언트가 자기 검색을 돌린다** — `/check` 와
   **다른 경로** 다. 그 사실을 모르고 작업하면 「MI SAME 인데 화면에 없다」가 난다
🔴 `mayShowCandidate` 를 **완화해서** SAME 을 늘리지 않는다(그 축은 WU-017 에서 닫혔다)
🔴 SQL 계약은 `create unique index` 의 **`unique` 키워드까지** 본다(칼럼 문자열만 보면 뚫린다)
🔴 컴포넌트를 **직접 부르는** 테스트는 **렌더 배선을 못 본다** — 렌더 줄 앵커를 같이 둔다
🔴 `python3` 가 **없다** — 치환은 Edit 로 하고 변이는 **grep 으로 적용 확인**
🔴 회귀 기준 **8,462** · typecheck **0** · `migrations_manual` 은 **손으로** 적용(078 은 미적용 상태)
```

## 6. 🟡 CEO 최종 확인 (배포 후 1회)

> `B226AC009` → 동일상품 가격비교 확인 → 유사상품 펼침 → 원본/후보 이미지 확인 →
> `동일상품/다른제품/판단불가` 선택 → 저장 → 같은 상품 **재검색**

🔴 국내 후보는 0 일 수 있다(WU-130 ②: 어댑터 부재 12/18 · 화면 결함 아님).
