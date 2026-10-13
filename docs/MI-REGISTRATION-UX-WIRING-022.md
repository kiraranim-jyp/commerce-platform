# WU-022 `MI-REGISTRATION-UX-WIRING` — Gemini 후보를 등록 화면에 transient 표시

> 🟢 **PASS.** 🔴 Gemini 호출 **0** · flag **OFF** · DB 저장 **0** · schema **0** ·
> API 변경 **0** · 새 엔드포인트 **0** · Registry **0** · 카테고리 **0** ·
> 환산 **0** · 해외 집계 **0** · 판매판정/등록판정 로직 변경 **0** · 자동 1회차 배선 **0** ·
> Production 배포 **0** · CEO 액션 없음.
> 🔴 **소스 확인으로 끝내지 않았다** — fixture 주입 → `createRoot` **실제 마운트** →
> `textContent` 확인까지 했다(지시서 §5).

---

## 1. 변경 범위 — 운영 **2파일**(1 신규 + 1 배선 31줄)

```
① (신규) apps/admin/.../commerce/GeminiTransientCandidates.tsx
     표시 전용 컴포넌트 + 고정 문구 상수 + marketText/priceText(순수 함수)
     🔴 fetch 0 · 저장 0 · flag 참조 0 · 환산 0 (테스트로 잠갔다)
② apps/admin/.../commerce/DomesticPriceIntelligencePanel.tsx  (+31 / -1)
     ⒜ import 1줄
     ⒝ state 1개            `geminiEvidence`
     ⒞ 응답 타입에 칸 1개   `domesticShop.geminiEvidence`
     ⒟ `setGeminiEvidence(json.domesticShop?.geminiEvidence ?? null)`
     ⒠ MiPanelView prop 전달 + 구조분해 + props 타입
     ⒡ 렌더 1줄 — 「🔄 다시 분석」 결과 문구 **바로 아래**
🟢 기존 `candidates`(DB 링크) · 판정 · 가격 · 레이더 로직은 **한 줄도 안 건드렸다.**
🟢 운영 diff 에 새 `fetch(`/`insert`/`upsert`/`POST`/`PATCH` **0건**(grep 확인).
```

🟢 **「이미 응답에 있던 값을 버리던 것」을 줍는 작업이었다** — `check/route.ts:111` 이
`domesticShop` 을 통째로 싣고 있었고 패널이 그 json 을 **이미 파싱** 하고 있었다.

---

## 2. 화면에 무엇이 보이는가 (실제 마운트 DOM 으로 확인)

```
🔎 웹 검색 후보 2건
이번 확인에만 쓰이고 저장되지 않습니다.
이 후보 정보는 국내 최저가 및 판매판정에 영향을 주지 않습니다.
  ─ SAME  [국내]  KRW 150,000      babybubble.co.kr      품번 일치 · 색상 일치
  ─ PRESUMED_SAME  [해외]  EUR 75  smallable.com         보류 근거: BRAND_UNCONFIRMED
```

| 표시 | 규칙 |
|---|---|
| 판정 | 🟢 서버가 낸 `crossSellerVerdict` → 없으면 `matchTruth` → 둘 다 없으면 「판정 미확인」 |
| 시장 | 🔴 **`KR`/`OVERSEAS` 만** 뱃지로 적는다. `UNKNOWN`/없음 → **뱃지가 아예 없다** |
| 가격 | 🔴 **통화 그대로**(`EUR 75`). 환산 **0** |
| 가격 없음 | 🔴 **「가격 미확인」** — `0`·`-`·`0원` 으로 적지 않는다 |
| 출처 | 🟢 도메인 + 실제 링크(`target=_blank` · `rel=noopener`) |
| 근거 | 🟢 `matchReasons` 최대 3 · 블로커/충돌 최대 2(「보류 근거」) |
| 고정 문구 | 🔴 CPO 가 글자로 지정한 **두 문장** 을 구역 머리에 둘 다 |

🔴 **「동일상품 확인」 버튼을 달지 않았다** — 그것은 DB 링크 승격이고 저장 금지다.

---

## 3. §5 검증 — 9항 전부

| # | 요구 | 결과 |
|---|---|---|
| 1 | evidence 있음 → 구역 표시 | 🟢 **마운트 DOM** 에 `[data-testid=gemini-transient]` 존재 · 「후보 2건」·고정문구 2개·판정·출처·근거 확인 |
| 2 | evidence 없음/flag OFF → 미표시 | 🟢 `null` · `[]` 둘 다 `container.textContent === ""` |
| 3 | EUR → `EUR` 그대로 | 🟢 `EUR 75` · 🔴 10만 단위 숫자 **없음** · 「원」 **없음** |
| 4 | 가격 없음 → 「가격 미확인」 | 🟢 정확히 그 문자열 |
| 5 | UNKNOWN → 국내로 표시 안 됨 | 🟢 시장 뱃지 **null** · 항목 안에 「국내」·「해외」 **없음** · 🟢 후보 자체는 보인다 |
| 6 | 기존 판매판정/등록 버튼 흐름 불변 | 🟢 `onSellerVerdictChange`·`buildSellAndRegisterView` 경로 **무변경** · 회귀 0 FAIL |
| 7 | 저장 호출 0 | 🟢 컴포넌트에 `fetch(`·`POST/PATCH/PUT`·`confirmSameProduct` **0** |
| 8 | Gemini 호출 0 | 🟢 flag 어휘·pool 호출 **0**(두 파일 모두) |
| 9 | regression/build/guard | 🟢 아래 §5 |

🔴 **5번이 이 WU 의 핵심** 이다 — WU-019R 이 찾은 `bobochoses.com`(등록부 샵인데 **EUR**)
사례를 fixture 로 넣어 **화면이 그것을 「국내」로 말하지 않는 것** 을 DOM 으로 확인했다.

---

## 4. 음성 대조 6종 — 🔴 **전부 FAIL 해야 하고, 전부 FAIL 한다**

| 변형 | 내용 | 결과 |
|---|---|---|
| M0 / 원상복구 | 정상 | 🟢 **15 passed** |
| M1 | `UNKNOWN` → 「국내」로 강제 | 🔴 **2 FAIL** |
| M2 | EUR→KRW **환산** 추가 | 🔴 **3 FAIL** |
| M3 | 고정 문구(영향 없음) 제거 | 🔴 **1 FAIL** |
| M4 | 가격 없을 때 `0` 표기 | 🔴 **1 FAIL** |
| M5 | 빈 evidence 에도 구역 렌더 | 🔴 **2 FAIL** |
| M6 | transient 를 기존 `candidates` 에 **섞기** | 🔴 **1 FAIL** |

🔴 **M6 가 제일 중요하다** — 섞이면 기존 후보 목록·레이더·`bestMatchTruth` 가 오염된다.
🟢 그걸 막는 단언은 **개수가 아니라 속성** 으로 썼다(「`geminiEvidence` 가 판정/집계
어휘와 **같은 줄에** 나타나면 FAIL」). 🔴 처음에 `toBe(7)` 로 썼다가 8 이 나와 틀렸고,
맞춰도 주석 한 줄에 깨지는 약한 프록시였다.

---

## 5. 회귀 / 품질 게이트

```
🟢 admin 전수   Test Files **515 passed** / 49 skipped (564)
                Tests      **7678 passed** / 57 skipped (7735) · FAIL **0**
                (WU-021 기준 514/7,663 → **+1 파일 / +15 테스트** = 이번 추가분)
🟢 typecheck    **10** (baseline 10 — 추가 0)
🟢 build        `Compiled successfully` · exit 0
🟢 guard        `no-production-coupling` 6 passed
🟢 mutation     M1~M6 전부 FAIL · 원상복구 15 passed
```

---

## 6. 🔴 알아야 할 한계 — 「보인다」의 범위

```
🔴 **Production 실화면으로 확인한 것이 아니다.** jsdom 마운트 + fixture 주입이다.
🔴 그리고 **flag OFF 라 지금 Production 에서는 이 구역이 나타나지 않는다**
   (`geminiEvidence === null` → 미렌더). 🟢 그것이 설계된 안전 성질이고,
   그래서 배포해도 현재 화면이 **한 픽셀도 바뀌지 않는다.**
🔴 실제로 「셀러가 후보를 본다」까지 가려면 **① Gemini 크레딧 충전(CEO 비용 승인)** 이
   선행돼야 한다. 그 전에는 flag 를 켜도 항상 `API_FAILURE` 다(실측 16/16).
🔴 자동 1회차는 **배선하지 않았다**(CPO 결정 ⒝) — 셀러가 「🔄 다시 분석」을 눌렀을
   때만 구역이 나타난다.
🔴 해외 가격 **집계** 구역은 **제외** 했다(CPO 결정 ⒞). 후보 카드의 통화 그대로 한 줄까지만.
```

---

## 7. 자기 보고 — 이번에 밟은 함정 둘

```
🔴 ① 단언이 틀렸다 — `UNKNOWN` 테스트에서 구역 **전체** textContent 에 「국내」가
     없어야 한다고 썼는데, **고정 문구 자체** 가 「**국내** 최저가 및 판매판정에
     영향을 주지 않습니다」다. 🟢 단언 범위를 후보 항목(`li`)으로 좁혀 고쳤다.
     → 🔴 가드를 약화한 것이 아니다. 틀린 단언을 **정확한 단언으로** 바꾼 것이다.
🔴 ② `\r?\n` 정규식을 Python 으로 써 넣다가 **실제 줄바꿈** 이 박혀 esbuild 가
     「Unterminated regular expression」을 냈다. 메모에 **두 번** 기록된 함정을
     세 번째로 밟았다. 🟢 `.split("\n")` 로 바꿔 끝냈고, 파일이 **CRLF** 라
     needle 에 줄끝을 넣으면 매치가 안 되는 것도 같이 확인했다.
```
