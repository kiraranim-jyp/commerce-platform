# WU-077 — 국내 후보의 ⑥ Market KR 확정 병목 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「market gate 완화 ❌ · KRW-only ❌ · whitelist 확대 ❌ ·
> 한국어만으로 KR ❌ · MI gate ❌ · price parser ❌ — 조사 → counterfactual → GO/HOLD 까지」

---

## 0. 결론 — 🔴 **HOLD. 완화하면 「국내 최저가」가 틀린 가격으로 바뀐다**

CPO 의 종료 질문 — 「17 중 10 이 KR 에서 탈락하는 이유는 **실제 해외** 인가, **증거 부족** 인가」:

```
🔴 **셋으로 갈린다. 「증거 부족」은 그중 4건뿐이다.**
  ⒜ 실제로 외화를 표시한다      **4** — global.trenbe(USD)×3 · kihanan(JPY)
                                 ⟹ 해외 축이 **맞다.** 회수 대상이 아니다
  ⒝ KRW 인데 도메인 증거 없음     **4** — luxboy(1) · donokids(3)  ← **유일한 회수 후보**
  ⒞ 가격 자체가 없다            **2** — beaumonde ×2
                                 ⟹ ⑥ 문제가 아니라 **⑤ 문제**(WU-063 이 이미 HOLD)
```

🔴🔴 **그리고 그 4건을 회수하면 셀러가 보는 국내 최저가가 틀어진다**:
```
현재      ₩88,000  C07 biskuit      🟢 Human SAME
완화 후   ₩59,000  C08 m.luxboy     🔴 Human **DIFFERENT**
```
🔴 WU-063 의 제1원칙 — 「**잘못된 국내 최저가를 보여주는 것이 가격 미노출보다 더 큰 오류다**」 —
이것 하나로 **완화는 기각** 이다.

---

## 1. 🔴🔴 분모 셋을 먼저 가른다 (WU-073 의 「17」을 정정한다)

```
① 내 **도메인 휴리스틱** 으로 「국내 계열」이라 센 것   → **17**
② WU-063 표의 `kr` 라벨                              → **9**
③ 운영 `classifyCandidateMarket` 이 KR 로 확정한 것    → **7**
🔴 WU-073 의 ⑤~⑧ 분모 17 은 **①** 이다. ②③과 섞지 않는다.
🟢 ①에만 있고 ②에 없는 8건 = `.kr` 이 아닌 한국계 도메인
   (global.trenbe ×3 · donokids ×3 · m.luxboy · kihanan)
```

🟢 **§5-B CONTROL** — 운영 owner `classifyCandidateMarket` 을 **복제하지 않고 그대로 불러**
표의 `market` 을 **전건 재현** 했다(mismatch **0/51**).

---

## 2. ① 전수 표 — 휴리스틱 17건

| id | Human | domain | cur | basis | market | tier | langKo | bizNo | 통판 | 「원」 | 제목한 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C06 | DIFF | global.trenbe.com | USD | FOREIGN_CURRENCY | OVERSEAS | EXACT | ✗ | ✓ | ✗ | ✗ | ✗ |
| C07 | SAME | biskuit.kr | KRW | KR_TLD_AND_KRW | **KR** | COMPARISON | ✓ | ✓ | ✓ | ✓ | ✓ |
| C08 | DIFF | m.luxboy.com | KRW | KRW_WITHOUT_DOMAIN_EVIDENCE | UNKNOWN | COMPARISON | ✓ | ✓ | ✓ | ✓ | ✓ |
| C10 | SAME | global.trenbe.com | USD | FOREIGN_CURRENCY | OVERSEAS | COMPARISON | ✗ | ✓ | ✗ | ✗ | ✗ |
| C13 | DIFF | beaumonde.co.kr | — | NO_PRICE_EVIDENCE | UNKNOWN | COMPARISON | ✓ | ✓ | ✗ | ✓ | ✓ |
| C14 | SAME | kihanan.com | JPY | FOREIGN_CURRENCY | OVERSEAS | COMPARISON | ✗ | ✗ | ✗ | ✗ | ✗ |
| C15 | SAME | m.web.mustit.co.kr | KRW | KR_TLD_AND_KRW | **KR** | COMPARISON | ✗ | ✗ | ✗ | ✓ | ✓ |
| C21 | SAME | donokids.com | KRW | KRW_WITHOUT_DOMAIN_EVIDENCE | UNKNOWN | COMPARISON | ✗ | ✓ | ✓ | ✓ | ✓ |
| C22 | **DIFF** | donokids.com | KRW | KRW_WITHOUT_DOMAIN_EVIDENCE | UNKNOWN | COMPARISON | ✗ | ✓ | ✓ | ✓ | ✓ |
| C23 | **DIFF** | littleluna.co.kr | KRW | KR_TLD_AND_KRW | **KR** | COMPARISON | ✓ | ✓ | ✗ | ✓ | ✓ |
| C24 | **DIFF** | miniboutique.co.kr | KRW | KR_TLD_AND_KRW | **KR** | COMPARISON | ✓ | ✓ | ✗ | ✓ | ✓ |
| C27 | SAME | beaumonde.co.kr | — | NO_PRICE_EVIDENCE | UNKNOWN | COMPARISON | ✓ | ✓ | ✗ | ✓ | ✓ |
| C28 | UNC | luksusbaby.kr | KRW | KR_TLD_AND_KRW | **KR** | EXCLUDED | ✓ | ✗ | ✗ | ✗ | ✗ |
| C32 | DIFF | luksusbaby.kr | KRW | KR_TLD_AND_KRW | **KR** | EXCLUDED | ✓ | ✗ | ✗ | ✗ | ✗ |
| C41 | DIFF | global.trenbe.com | USD | FOREIGN_CURRENCY | OVERSEAS | COMPARISON | ✗ | ✓ | ✗ | ✗ | ✗ |
| C43 | SAME | donokids.com | KRW | KRW_WITHOUT_DOMAIN_EVIDENCE | UNKNOWN | COMPARISON | ✗ | ✓ | ✗ | ✓ | ✓ |
| C47 | SAME | biskuit.kr | KRW | KR_TLD_AND_KRW | **KR** | COMPARISON | ✓ | ✓ | ✓ | ✓ | ✓ |

🔴 **C22 와 C21·C43 의 증거가 «완전히 같다»**(같은 샵 · langKo ✗ · bizNo ✓ · 「원」 ✓)인데
Human 은 SAME / **DIFFERENT** 로 갈린다. ⟹ **샵 단위 한국 증거로는 가를 수 없다**(WU-063 재확인).

---

## 3. ③ Counterfactual — KR 확정 → 국내 버킷 → Human 라벨

🔴 운영 국내 버킷 자격 = `market KR && priceKrw && tier ∈ {EXACT, COMPARISON}`

| 축 | KR 확정 | 버킷 진입 | SAME | 🔴 DIFFERENT | 국내축 precision |
|---|---:|---:|---:|---:|---:|
| **CF-1 현재(운영)** | **7** | **5** | **3** | **2** | **60.0%** |
| CF-2 KRW 만으로 | 27 | 21 | 13 | 8 | 61.9% |
| CF-3 `.kr` 만으로 | 9 | **5** | 3 | 2 | 60.0% |
| CF-4 현재 + 한국어 | 11 | 9 | 5 | **4** | 55.6% |
| CF-5 현재 + 사업자/통신판매 | 11 | 9 | 5 | **4** | 55.6% |
| CF-6 복합(KRW+한국어+사업자) | 11 | 9 | 5 | **4** | 55.6% |

```
🔴 CF-3 은 **아무것도 바꾸지 않는다** — 버킷이 현재와 같다(통화 충돌만 다시 연다).
🔴 CF-4 · CF-5 · CF-6 이 **숫자가 완전히 같다** — 한국어 축과 사업자 축이 **같은 4건** 을
   연다. 서로 **독립 증거가 아니다**(복합으로 묶어도 더 안전해지지 않는다).
🔴 세 축 전부 precision 이 **60.0% → 55.6% 로 떨어진다.**
```

### 🔴🔴 ④ 결정적 — 「국내 최저가」가 누구에게서 오는가

| 축 | 최저가 | 출처 | Human |
|---|---:|---|---|
| **CF-1 현재** | **₩88,000** | C07 biskuit.kr | 🟢 **SAME** |
| CF-2 KRW 만으로 | ₩40,300 | **C09 junioredition.com** | 🟢 SAME |
| CF-3 `.kr` 만으로 | ₩88,000 | C07 | 🟢 SAME |
| CF-4/5/6 | **₩59,000** | **C08 m.luxboy.com** | 🔴 **DIFFERENT** |

🔴🔴 **CF-2 는 «다른 성질» 로 틀린다 — 내 1차 단언이 여기서 깨졌고 그것이 발견이었다.**
```
CF-2 의 최저가는 Human **SAME** 이라 **라벨로는 안 잡힌다.** 그런데 출처가
`junioredition.com` — **해외 사이트의 한국 표시가** 다.
⟹ CF-2 는 「틀린 상품」이 아니라 **「국내 판매처가 아닌 곳」** 을 국내 최저가로 만든다.
🔴 그것이 `classifyCandidateMarket` 머리 주석의 금지(「통화 단독 결정」)이고
   WU-051 이 막은 바로 그 모양이다. 🔴 **Human 라벨만 봤으면 놓쳤을 오류다.**
```

---

## 4. Mutation (운영 owner `classifyCandidateMarket`)

baseline **1 passed**

| | 변형 | 결과 |
|---|---|---|
| Y1 | KRW 면 **무조건** KR(통화 단독 결정) | 🔴 **1 failed** |
| Y2 | `.kr` + 외화를 KR 로(충돌 무시) | 🟡 **1 passed** |
| Y3 | 가격 없어도 `.kr` 이면 KR | 🔴 **1 failed** |
| — | 원상복구 | 🟢 1 passed |

🔴 **Y2 를 조사했다 — 가드 공백이 «아니다»**(§10):
```
⒜ 표본에 `.kr + 외화` 가 **0건** 이다(.kr 9건 전부 KRW 7 · 가격없음 2) → 이 하니스는 못 본다
⒝ 🟢 **기존 계약이 잡는다** — Y2 를 넣고 `mi-020` 을 돌리면
   「🔴 KR TLD 인데 외화여도 UNKNOWN(충돌)」이 **FAIL** 한다(실행 확인).
⟹ 「통과했다」를 「가드 없다」로 읽지 않는다. 다른 파일이 소유하고 있었다.
```

---

## 5. 회귀 / Type / Build

```
apps/admin  **584 files / 8,286 passed** / failed **0** (skipped 100)
🔴 CPO §10 포착 장치 적용 — 포착된 실패명 **없음**
typecheck **0** · build **exit 0** · WU-076 baseline(583/8,285)에서 **+1 file / +1 test**
```

🔴 금지 준수 — 운영 코드 변경 **0** · market gate 완화 0 · KRW-only 0 · whitelist 0 ·
한국어 단독 0 · MI gate 0 · price parser 0 · 배포 0. 🟢 HTTP **0**(전부 캐시).

---

## 6. 🔴 Known Unknowns

```
① 🔴 분모 17 은 **내 휴리스틱** 이다. 운영 라벨이 아니다 — 셋을 섞지 않는다
② 🔴 Human GT 는 17 중 SAME 8 · DIFFERENT 8 · UNCERTAIN 1 이다. **분모가 작다**
③ 🔴 `.kr` + 외화 모양이 표본에 **0건** — 그 분기는 이 WU 로 평가되지 않았다(측정불가)
④ 🔴 「국내 최저가 ₩88,000 → ₩59,000」은 **이 표본의 원상품 집합** 에서의 값이다
⑤ 🔴 `global.trenbe.com` 을 「해외가 맞다」로 적었지만, 그것은 **한국 회사의 글로벌 사이트** 다.
   「한국 셀러에게 의미 있는 가격인가」는 **제품 정책** 이고 이 WU 가 답하지 않았다
⑥ 🔴 사업자등록번호/통신판매 문자열은 **푸터 전역** 에 있다 — 상품 단위 증거가 아니다
```

---

## 7. Final Gate

```
Code PASS:   ⚪ 해당 없음(운영 변경 0)   Deploy PASS:         ⚪ 해당 없음
Test PASS:   🟢                        Production UI PASS:  ⚪ 해당 없음
Type PASS:   🟢                        Production API PASS: ⚪ 해당 없음
Build PASS:  🟢                        Production PASS:     ⚪ 해당 없음
```

## 8. CEO Action — **없음**

---

## 9. 🔴 권고 (CTO 가 고르지 않았다 · 구현 0)

```
🔴 **HOLD — 현재 market gate 를 유지한다.** 안전한 최소 evidence 조합이 **존재하지 않는다.**
   근거 셋:
   ① 회수 가능한 분모가 **4건뿐** 이고 그중 **절반(2)이 Human DIFFERENT** 다
   ② 네 축(한국어·사업자·통신판매·복합)이 **같은 4건** 을 연다 — 독립 증거가 없다
   ③ 🔴🔴 열면 **국내 최저가가 Human DIFFERENT(₩59,000)로 바뀐다**

🟢 **그리고 ⑥은 애초에 «가장 큰» 병목이 아니다** — 탈락 10 중
   **4건은 해외가 맞고**(⒜) **2건은 ⑤ 가격 추출 문제**(⒞) 다. ⑥ 고유 손실은 **4건** 이다.

🟡 다음 축 후보(CPO 판단) — 이 WU 에서 **측정된 것만** 적는다:
   ⒜ 🔴 `donokids.com` 처럼 **같은 샵에서 SAME/DIFFERENT 가 갈리는** 문제는 ⑥이 아니라
      **⑦⑧(판정)** 의 일이고 WU-069~072 가 **완화 불가** 로 닫았다
   ⒝ 🟡 `beaumonde` 2건(⒞)은 **⑤ 가격 추출** 이고 WU-059·061·063 이 HOLD 했다
   ⒞ 🔴 남는 것은 **국내 후보를 «더» 찾는 것이 아니라 «판정을 정확히»** 하는 축이다 —
      그런데 그 축의 완화는 전부 기각됐다(WU-063~072). ⟹ **현재 구조의 상한에 닿았다.**
```
