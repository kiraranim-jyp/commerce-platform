# WU-127 — **AI 후보 공급 경로 확정** (조사 · 구현 0 · 가격 0)

> 🔴 CPO 2026-10-20: 「코드 수정부터 하지 말고 **현재 제품에서 실제로 사용할 수 있는 AI 후보
> 공급 경로를 확정** 한다. 새 MI 축 ❌ · threshold ❌ · 가격 ❌ · Registry ❌ · 1-hop ❌ ·
> Gemini ❌ · 외부 AI API ❌ · AI URL 영구 저장 ❌」

---

# [WU-127 완료 보고]

## 1. 🟢 **공급 생산자는 «둘» 뿐이고, 지금 쓸 수 있는 것은 하나다**(운영 코드 전수)

```
① `__gemini_discovery__`  gemini-candidate-pool.ts  → 🔴 **flag OFF · 비용 미승인**(§12 HOLD)
② `__url_candidates__`    url-candidate-pool.ts:226 → 🟢 **지금 작동한다**
   입력은 **`candidateUrls`**(셀러가 AI 답변 URL 을 붙여넣는 값)
🔴 **세 번째 생산자는 없다** — 운영 코드 전수 grep 결과다(테스트 제외).
⟹ 🟢 **정책 충돌 없이 지금 쓸 수 있는 경로는 ② 하나** 다.
```

## 2. 🟢🟢 **국내와 해외는 «같은 파이프라인» 이다**(갈리는 지점이 한 곳뿐)

```
candidateUrls → collectUrlCandidatePool → factsFromProductUrl → withConfidence
              → attachMatchTruth → judgeDomesticCandidate → transientEvidenceSink
              → computeMarketIntelligence(:226 같은 배열을 돈다)
갈리는 곳은 **classifyCandidateMarket 하나** 다:
   market === "KR"  → 국내 축(🔴 `priceKrw` + tier 를 **더** 요구한다)
   그 외            → 해외 축(`push` 뒤 `continue` · 판정에 닿지 않는다)
⟹ 🟢 **국내 전용 코드 경로가 따로 있는 것이 아니다**(CPO 질문 3 의 답: **같게 처리된다**)
🔴 단 **국내 축만 가격을 요구한다** ⟹ 가격 없는 국내 후보는 「미확정」으로 남는다(WU-114 beaumonde)
```

## 3. 🔴 자동 1회차에 `candidateUrls` 가 없는 이유 — **만들 공급원이 없다**

```
pipeline/page.tsx:478 이 보내는 body = **{ snapshotId }** 뿐이다(WU-126 확정).
자동으로 그 값을 채우려면 공급원이 필요하고, 가능한 셋은 **전부 정책 HOLD** 다:
  ⒜ Gemini flag ON          🔴 비용 미승인
  ⒝ 외부 AI API             🔴 전면 제외(§12 확정)
  ⒞ 저장된 AI 답변 재사용    🔴 WU-119 `SNAPSHOT REUSE POLICY CONFLICT`
⟹ 🔴 **CTO 가 배선을 만들 수 없다.** 세 금지 중 하나를 CPO 가 열어야 생긴다.
🟢 그러므로 **지금 제품에서 국내/해외 후보를 보는 유일한 길은 ②(셀러 입력)** 이고,
   그것은 **이미 작동한다** — 🔴 단 **실제 화면 확인은 CTO 가 할 수 없다**(로그인 뒤).
```

## 4. 🔴 그래서 WU-127 의 성공 기준은 **CEO 확인으로만** 닫힌다

```
🔴 「CTO 검토 화면에서 확인됐다」를 제품 PASS 로 쓰지 않는다(CPO 확정 · 내가 지난 보고에서 넘겼던 선).
🟡 그래서 **붙여넣기만 하면 되는 입력값** 을 준비했다 — 아래 §CEO.
🟢 그 URL 들은 **이미 Human GT 가 SAME 으로 확정** 한 것들이고, 재투입 시 **19/19 생존**
   이 측정돼 있다(WU-118) ⟹ 후보로 서지 않으면 그것이 **새 결함** 이다.
```

---

## 🔴 Known Unknowns

```
① 🔴 **실제 따져 화면은 CTO 가 볼 수 없다** — §1~3 은 전부 **코드 추적** 이다
② 🔴 셀러 입력 경로의 **UI 문구/위치**는 손대지 않았다(WU-049-R 의 2단 접힘 그대로)
③ 🔴 가격은 한 건도 건드리지 않았다
```

## 결론 — 🟢 **경로는 하나로 확정됐다 · 제품 PASS 는 CEO 확인 1회로만 닫힌다**

```
공급 생산자 **2개** 중 쓸 수 있는 것 **1개**(셀러 입력 → `candidateUrls`)
국내/해외 **같은 파이프라인** · 갈리는 곳은 `classifyCandidateMarket` 하나
자동 1회차 배선은 **정책 셋 중 하나를 열어야** 생긴다 ⟹ **CPO 결정**
🔴 운영 변경 **0** · 배포 0 · 가격 **0**
```
