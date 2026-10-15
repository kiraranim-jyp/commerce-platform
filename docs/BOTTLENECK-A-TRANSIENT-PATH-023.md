# WU-023 — 병목 A · transient 경로 검증 (§8 기술 차단점 보고)

## 1. 완료 판정 — 🔴 **HOLD (구현 불가 · 차단점 확정)**
> 병목 A 는 유효하고, transient **소비자(consumer)** 배선도 실재한다.
> 🔴 그러나 그 경로에 **AI 없이 후보를 넣을 생산자(producer) 진입점이 코드에 없다.**
> 지시서 §8 이 지시한 대로 **AI Search/API/Registry 를 확장하지 않고** 차단점만 확정했다.

## 2. 선정한 병목 — **A. 국내 판매처가 Registry 밖이라 운영 경로가 영구히 못 찾는다**
```
핵심 KPI 55/498 = **11.0%** · 병목은 계산 사슬이 아니라 **입구**(NO_LINK 331)
🟢 WU-022-5-1 이 그 입구에 실제 답이 있음을 보였다 — GT 로 확정된 **국내** 판매처 5곳:
   biskuit.kr · m.luxboy.com · m.web.mustit.co.kr · beaumonde.co.kr · donokids.com
🔴 다섯 곳 전부 **등록부에 없다** → `searchDomesticShops` 가 **구조적으로 못 찾는다**
→ 「검색이 약한 것」이 아니라 **「뒤질 목록에 없는 것」** 이다
```
🔴 다른 후보(B 무관상품 노출 · C `.co.jp` KR 부재 · D 스코프 비대칭)보다 우선한 이유:
**셋은 UX/설명 문제이고 A 만 「가격비교 자체가 성립하지 않는」 축**이다(KPI 11% 의 직접 원인).

## 3. 기존 상태 — transient 경로는 **절반만** 있다

🟢 **소비자(consumer) 쪽은 완비돼 있고 Registry 를 요구하지 않는다**(실측):
```
GEMINI_VIRTUAL_SHOP_ID = "__gemini_discovery__"   gemini-candidate-pool.ts:47
  → 가상 샵 하나로 등록부를 우회한다 (Registry 추가 0)
run-domestic-price-check.ts:938  기존 후보 루프에 그대로 합류
                        :1009  judgeDomesticCandidate — **Gemini 전용 규칙 0**
                        :1067  저장 차단(transient 유지)
🟢 즉 「Registry 밖 국내 후보를 MI 에 태우고 저장은 안 한다」는 **이미 구현돼 있다**
```

🔴🔴 **그런데 생산자(producer)가 Gemini 에 하드결합돼 있다** — 이것이 차단점이다:
```
collectGeminiCandidatePool(input: GeminiPoolInput)      gemini-candidate-pool.ts:212
  입력 = { dna, scopedDomains, categoryScopes, maxCandidates, targetUsable,
           maxQueries, existingNormalizedUrls }
  🔴 **후보 URL 목록을 받는 파라미터가 없다.** dna 를 받아 함수가 «스스로»
     buildPrimaryQuery → Gemini 호출 → 후보 생성 까지 전부 한다(:231~:255).
  🔴 호출부도 하나뿐이고 flag 안에 있다 — `isGeminiDiscoveryEnabled()` (:890)
→ 🔴🔴 **「이미 있는 배선을 재사용해 다른 출처의 후보를 넣는다」가 지금 코드로는 불가능하다.**
   주입하려면 **새 진입점을 만들어야** 하고, 그것은 §5「새 abstraction 남발 금지」와
   §9「범위 확대 금지」의 경계에 바로 걸린다.
```

## 4. 해결 내용 — **없음 (구현 0)**
🔴 §8 이 「불가능하면 임의로 AI Search/API/Registry 를 확장하지 말고 정확한 기술적
차단점을 보고하라」고 지시했고, 그 조건에 정확히 해당하므로 **코드를 만지지 않았다.**

🔴 **임의로 하지 않은 것 셋**(각각 왜 안 했는지):
```
⒜ `GeminiPoolInput` 에 `injectedCandidates` 를 추가 — 🔴 생산자 계약을 바꾸는 일이고
   그 파라미터를 채울 **운영 출처가 현재 0** 이다(§5: 미래 기능 선행 구현 금지)
⒝ 5개 국내 샵을 Registry 에 추가 — 🔴 CPO 결정 ③「Registry 확대하지 않음」
⒞ AI Search 를 되살려 producer 로 쓴다 — 🔴 CPO 결정 ⑤「AI Search 를 새로 구현하지 않는다」
   + WU-021(약관·비용) + WU-022-11 Q6(HOLD)
```

## 5. 검증 — §7(「그 경로가 병목 A 를 해결할 수 있는가」)의 답
```
🟢 소비자 경로가 병목 A 를 해결할 «능력» 은 있다 — Registry 밖 국내 후보를
   판정·집계까지 태우고 저장은 막는다. 구조적으로 맞다.
🔴 그러나 **그 경로에 후보를 넣을 비-AI 생산자가 코드에 존재하지 않는다.**
   현재 운영 생산자는 둘뿐이고 둘 다 병목 A 를 못 푼다:
     ① searchDomesticShops — **등록부 안만** 뒤진다(= 병목 A 그 자체)
     ② collectGeminiCandidatePool — **Gemini 전용**이고 flag OFF · 경로 닫힘
→ 🔴 **결론: 현재 코드로는 해결 불가.** 「있는 배선 재사용」으로 닿지 않는다.
```

## 6. KPI / 효과
```
수정 전 = 수정 후 (변경 0). 🔴 개선 수치 **없음** — 「0% 개선」이 아니라 **구현 미수행** 이다.
🟢 확정된 수치는 진단뿐 — 병목 A 의 크기: GT 확정 국내 판매처 **5곳이 등록부 밖**,
   그로 인해 해당 상품들이 NO_LINK 로 남는다(핵심 KPI 11.0% 의 구성요소)
```

## 7. 품질
```
typecheck **0 errors** · code **0** · test 0 · build ⚪(코드 0) · deploy **0**
🔴 regression 재실행 안 함 — 직전 PASS(545 files / 7,857) · 이번 코드 변경 0
worktree **clean** · branch wu-010-display-provenance 0/0 · origin/main **ahead 59 / behind 0**
```

## 8. 배포 경계 (CPO 결정 ②)
```
🟢 **이번 WU 는 배포할 것이 없다**(코드 0) — 따라서 59커밋 분리 작업도 **발동하지 않았다.**
🔴 분리 경계 자체는 그대로 남아 있다: origin/main 에 안 간 **운영 코드 7파일**
   (snapshot.ts · self-reference.ts · ai-answer-pool.ts · ai-answer-urls.ts ·
    discovery-url-identity.ts · url-shape.ts · comparison-search/index.ts)
🟡 분리 방법은 존재한다 — 그 7파일은 **WU-007A/009-C 계열의 독립 수정**이라
   `origin/main` 에서 분기한 새 브랜치로 **cherry-pick 이 가능해 보인다**.
   🔴 단 실행하지 않았다 — 이번 WU 가 배포할 코드를 만들지 않았으므로 **지금 할 이유가 없다**.
```

## 9. 잔여 문제 (남은 것만)
```
① 🔴 **병목 A 는 미해결 상태로 남는다.** 해결하려면 셋 중 하나를 CPO 가 열어야 한다:
   ⒜ transient pool 에 **비-AI 생산자 진입점**을 신설(= 계약 변경 · 범위 확대)
   ⒝ Registry 확대(현재 금지)
   ⒞ AI Search 재개(현재 금지)
   🔴 셋 다 이번 WU 의 금지 목록에 걸려 있어 **CTO 가 고를 수 없다.**
② 🔴 미배포 운영 코드 7파일이 계속 main 밖에 있다(분리 경계 미정리 · 이번 WU 범위 아님)
```

## 10. 최종 판단 — 🔴 **HOLD**
production 상태 **변화 없음**(배포 0 · 코드 0 · main 불변).

## 11. CEO Action — **NONE**
