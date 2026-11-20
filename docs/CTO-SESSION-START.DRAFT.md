# ▶ CTO 세션 시작 인수인계 — **보조 자료**

> 🔴🔴 **공식 진입점은 `docs/START-HERE.md` 하나다**(CPO 결정 2026-11-18).
> 이 파일은 그 진입점을 **보조** 하는 인수인계 자료이고 🔴 **진입점으로 승격하지 않는다.**
> 새 세션도 **START-HERE 가 공식 기준** 이고, 이 문서는 최신 좌표를 보조하는 역할이다.
> 🔴 이 문서가 START-HERE 와 충돌하면 **START-HERE 가 이긴다** — 차이를 발견하면
> 임의로 판단하지 말고 **보고** 한다.
>
> 🔴 새 세션에 복붙하는 블록은 **편의상 임시 전달 수단** 이지 공식 문서 진입점이 아니다.
>
> 기준 시각 **2026-11-18** · 작성 CTO · 승인 CPO · 최종 의사결정 CEO
> 🔴 직전 CTO 보고의 「16K」는 **오기** 다 — 1차 작성본 실측 **13,079B / 250줄**
> (갱신하면 크기가 바뀐다 ⟹ §E 절차에서 **매번 재측정** 해 적는다)

---

## A-MI. 🔵🔵🔵 MI 핵심 식별 전략 — **상시 규칙**(CPO 확정 2026-11-20)

> **동일상품 판단의 핵심은 브랜드·모델 코드·상품명이다. 판매처가 등록한 제목이나 SKU 를
> 그대로 믿지 말고, 원본과 후보의 상세 설명을 읽어 실제 상품 정보를 확인해야 한다.
> 국문·영문 번역 및 키워드 차이를 고려해 세 가지 핵심 근거를 교차 검증하고,
> 소재·색상·사이즈 등은 보완 근거로 활용한다. 판단이 어려우면 후보를 임의로 제거하거나
> SAME 으로 승격하지 말고 CPO 가 검토할 수 있도록 근거를 제공한다.**

🔴 이 절은 스프린트와 무관하게 **항상** 유효하다. 🔴 **표준 `docs/STANDARD-V1.md` 와 충돌하면
표준이 이긴다** — 이 절은 표준을 **대체하지 않고 실행 기준으로 번역** 한 것이다.
🔴 **CTO 는 표준 조항을 고치지 않는다**(헌장 §12-0-STANDARD) — 표준 개정은 CPO 산출물이다.

### A-MI-1. 핵심 식별 3 ↔ 보완 9  🟢 **이미 구현돼 있다(재구현 금지)**

```
핵심  BRAND       🟢 점수가 아니라 **게이트** 다 — `brandOk`(cross-seller.ts:953)
      MODEL_CODE  🟢 **3점**(exact) · 2점(부분)      PRODUCT_NAME/TITLE 🟢 2점 · 1점(일부)
보완  CATEGORY · COLOR · MATERIAL · SIZE · FIT · AUDIENCE  🟢 **각 1점**
표시  IMAGE       🟢 1점이지만 **corePoints 에서 제외**(SAME 정원 밖)
⟹ 🔴 「핵심/보완 구분을 새로 만든다」는 작업은 **없다.** 이미 점수 구조가 그것이다
```

🔴 **`BRAND + MODEL_CODE` 를 자동 SAME 으로 승격하지 않는다** — 이미 시도되고 깨졌다
(cross-seller.ts:934 「`brandKnown`/`brandOk` 를 품번 exact 로 충족시켜 봤더니 아래가 전부 깨졌다」).
🔴 품번만 일치하고 브랜드가 다르면 SAME 이 아니다(`BRAND_MISMATCH` 가 그 자리를 지킨다).

### A-MI-2. 상세 설명은 «핵심 증거» 다 — 🟡 **절반만 구현돼 있다**

```
🟢 표준이 이미 인정한다 — §2.2 `MODEL_CODE` 주요 출처 **첫 항목이 「설명문」** ·
   `PRODUCT_NAME` 「제목·설명문」 · COLOR/MATERIAL/FIT 도 설명문
🟢 원상품측 원문   운영 DB `product_snapshots.workspace->canonicalProduct->description` **662/668**
                  fixture `wu-059-gt-facts.json` `origins[S1..S6].canonicalProduct` **6/6**
🔴🔴 후보측 원문   **담는 DB 칸이 0개** 다(migration 전수 · `candidate_reviews` · `searchRun`)
                  ⟹ transient 이고 **재수집해야 한다** · 🔴 운영 `CHROME_UA` 에 **HTTP 429 를
                  주는 호스트 12곳** 이고 **UA 우회는 금지**(CPO 현상 유지 확정)
🔴 운영 Identity 연결  **계약 2건이 잠근다** —
   `brand-1-description-evidence.test.ts:256` · `sprint3-gate-gt-precision.test.ts:371·372`
   (운영 owner 소스에 그 모듈명이 있으면 FAIL)
```

🔴🔴 **그래서 보고에 「상세 설명을 비교했다」를 쓸 때 축을 갈라 적는다** — ⒜ 원상품측 ⒝ 후보측
⒞ 운영 판정 반영. 🔴 ⒜만 하고 「상세설명 비교 완료」로 적지 않는다.

### A-MI-3. 번역·키워드 정규화 — 🟡 **부분 구현 · 🔴 언어 축은 CPO 가 닫아 둔 상태다**

```
🟢 구현   `brand-alias.ts` — 브랜드 표기/한글 alias 대응
🔴 닫힘   **음역·언어 축을 생산 로직에 넣지 않는다**(WU-078 CPO 확정) —
          회수 효과 **0** · 분모 4 · 오히려 GT DIFFERENT(C08)를 열 위험
🔴 표준   §2.4 「정규화는 원문을 **대체하지 않는다**」 · §2.2 「원문 보존 · 제목 정규화 **별도**」
⟹ 🔴 번역을 쓰더라도 **정규화값을 따로** 두고 원문을 덮지 않는다
⟹ 🔴 **번역 일치만으로 SAME 을 확정하지 않는다**(CPO 명시)
🟡 언어 축 재개는 **CPO 재판정 사안** 이다 — CTO 가 WU-078 결정을 스스로 뒤집지 않는다
```

### A-MI-4. 후보 사전 필터링 — 🟢 **이미 CPO 원칙대로 설계돼 있다**

`isEvidenceEvaluationWorthwhile`(run-domestic-price-check.ts:721) 는 **탈출구가 넷** 이다:

```
① crossSellerVerdict 가 SAME · PRESUMED_SAME 이면 **통과**  ← 제목이 틀려도 살아남는 자리
② matchLevel !== "low" 면 통과
③ 품번이 후보 **제목** 에서 확인되면 통과
④ 🔴 `domain === "foretforet.com"` — **사이트 전용 조건 1건**(「사이트별 예외 금지」와 긴장 · 기존)
🟢 그 함수 주석이 CPO 의 우려를 **그대로** 적어 뒀다 — 「Smallable 430701 ↔ Bobo B226AC114 는
   상품명이 겹치지 않아 텍스트로는 low 인데 브랜드·상품군·색상·소재·핏·대상이 맞아 동일상품이다.
   이 가드가 그 후보를 평가 전에 버리면 판정기가 아무리 정확해도 닿을 자리가 없다」
⟹ 🔴 「제목 오류로 유력 후보가 탈락한다」는 **이 게이트의 문제가 아니다** —
   막는 것은 **후보 설명 원문이 애초에 수집되지 않는 것**(A-MI-2)이다
```

### A-MI-5. 자동 판단이 어려우면 사람에게 — 🟡 **경로는 있고 자료 2항목이 없다**

```
🟢 저장소  `candidate_reviews`(079) · 셀러/CPO 4상태 입력 · 📚 이력 ·
          🔴 **사람 판정이 시스템 판정을 덮지 않는다**(양방향 계약)
🔴 미구현  검토 자료 10항목 중 ⒜ **양쪽 상세설명 핵심 추출 결과** ⒝ **국문·영문 번역 비교**
🔴 판단이 어렵다고 후보를 **버리지 않고** 확신 없이 **SAME 으로 올리지 않는다**
```

### A-MI-6. 🔴 DESCRIPTION_ONLY 단독 레버 ↔ 복합 식별 전략은 **다르다**

```
🔴 기각된 것(재시도 금지)  「설명 속 **품번 문자열 단독** 확인을 운영 SAME 에 반영」
   실측 — 20쌍 · 4호스트 · GT SAME 7 중 **실제 이득 1** ↔ **GT DIFFERENT 2건 오염**
   오염 2건은 `codeCause = CODE_PRESENT_BUT_DIFFERENT`(후보 자신의 품번은 다른데
   원상품 품번이 설명에만 등장) ⟹ **순손실** ⟹ `a-identity-axis` 계약이 결론을 잠근다
🟡 기각되지 **않은** 것  브랜드 + 품번 + 실제 상품명을 **설명에서 함께** 확인하고
   **문맥으로 교차검증** 하는 복합 근거 — 🔴 **아직 측정되지 않았다**(0% 아님 · 측정불가)
🔴 그 측정의 선행 조건은 **후보측 원문 확보** 이고 지금 **429 12호스트** 가 막는다
```

### A-MI-8. 🔴🔴🔴 [2026-11-20 발견] **지배적 오판은 recall 이 아니라 precision 이다**

🟢 근거는 **저장된 운영 verdict** 다(하니스 재구성 아님 · CONTROL 문제 없음) —
`fixtures/mi-reeval-01-db-human.json` **38행**(`human_verdict` ↔ `system_verdict` ↔ `price_tier`).

```
GT SAME **22**       sys null **15**(🔴 측정불가) · SAME 3 · PRESUMED_SAME 4
                     ⟹ 측정가능 **7** · 오판 **0**   🟢 동일상품을 놓치지 않는다
🔴🔴 GT DIFFERENT **15**  sys null 2 · **PRESUMED_SAME 13**
                     ⟹ 측정가능 **13** · **오판 13/13 (100%)**
                     🔴 그중 **10건이 `tier COMPARISON`** ⟹ **가격 비교에 들어간다**
GT SIMILAR 1         PRESUMED_SAME 1(과도)
🔴 분모 합산 금지 — 이 38행은 16·32·A군 7·IDENTITY_AXIS 26 과 **다른 집합** 이다
```

🔵🔵🔵 **기전 — 파일 자신의 불변식이 깨져 있다**(이 발견이 핵심이다):

```
`buildCoreTitleTokens(title, [brand, color, fabrics])`   걷어내는 것이 **셋** 뿐이다
  (seller-facts.ts:40 · product-identity-dna.ts:162 — **두 곳 다 같다**)
그런데 `product-facts.ts:753` 주석이 그 원칙을 명시한다 —
  「그 셋은 **각자 별도 축으로 이미 세고 있어서**, 제목에 남겨두면 **같은 근거를 두 번 세게 된다**」
🔴🔴 **`CATEGORY` 도 별도 축(1점) 인데 상품유형 낱말(`sweatshirt`·`t-shirt`)은 걷어내지 않는다**
⟹ 같은 근거가 **TITLE 2점 + CATEGORY 1점 = 3점** ⟹ 정확히 `PRESUMED_SAME_MIN_AXES(3)`
🟢 독립 재현 — 같은 세션의 조합 평가에서 **PRODUCT_NAME 단독이 GT DIFFERENT 5/9 를 오염** 시켰고
   그 후보들은 **Hugo Boss · Marc Jacobs · DG · 무브랜드** 였다(상품유형 토큰으로만 겹친다)
```

🔴🔴 **수정하지 않았다 — §6 STOP 조건이다.** 상품유형 낱말을 `noiseSources` 에 더하는 것은
**TITLE 축의 실효 점수를 바꾼다** ⟹ 「판정 점수·축 가중치 변경 금지」에 걸리고, GT SAME 쌍도
같은 낱말을 공유하므로 **recall 손실을 먼저 측정해야** 한다(미측정).

🟡 **CPO 판단 사안 하나** — 「별도 축으로 세는 낱말을 제목에서 걷어낸다」는 **그 파일이 이미
선언한 불변식** 이다. 그 불변식을 `CATEGORY` 까지 확장하는 것을 **정책 변경으로 볼 것인가,
기존 불변식의 버그 수정으로 볼 것인가.** 🔴 CTO 가 고르지 않았다.
🔴 열 때의 선행 측정 — GT SAME 측정가능 **7** 과 DIFFERENT **13** 에서 **변경 전후 verdict 대조**.

### A-MI-9. 🔴🔴🔴 [2026-11-20] **핵심 증거 전수 감사 — 둘은 「없고」, 충돌도 보류를 못 막는다**

🟢 산출 `preserved/kids-core-evidence-audit.json` · 하니스 `kids-core-evidence-audit.test.ts`.
🔴 **verdict 재계산 0** — 저장된 운영 결과(`system_verdict`·`price_tier`)와 원문 증거를
`(origin_code, candidate_url)` 로 **조인** 했다(하니스 재구성값을 운영값으로 쓰지 않는다).

```
기준선  증거쌍 **109** · 저장행 38 · 조인 **39** · GT 라벨 36 · 저장 verdict 21 ·
       🟢 **대조 가능 19** · 🔴 측정불가 — 미조인 **70** · GT 있는데 verdict 없음 **17**
       설명 보유 — 원상품 92 · 후보 98 · 양쪽 82 · 🔴 **원상품 제목 없음 17**
```

🔴🔴 **증거 추출률(분모 109) — 핵심 셋 중 «둘» 이 대부분 없다**:

```
BRAND       PRESENT **17** · **ABSENT 91(83%)** · CONFLICT 1
            🔴 비대칭이 원인 — 원상품은 **목록 필드 88/109** 로 받는데
               후보는 **텍스트 추출**(제목 35 · 설명 29)에 의존한다
MODEL_CODE  PRESENT **18** · **ABSENT 86(79%)** · CONFLICT 5
            (후보 설명 라벨 26 · 후보 설명 맨문자열 15 · 후보 제목 맨문자열 5)
PRODUCT_NAME PRESENT **72(66%)** · ABSENT 17 · CONFLICT 20
⟹ 🔵🔵 **유일하게 자주 PRESENT 인 축이 PRODUCT_NAME 하나다** — 그것이 `PRESUMED_SAME`(3점)을
   채우는 주력이고 §A-MI-8 의 이중계산과 **같은 자리** 를 가리킨다
```

🔴🔴🔴 **정답 대조(분모 19) 와 오판 14건의 증거 조합 — 이것이 핵심이다**:

```
GT DIFFERENT 13 → **전부 PRESUMED_SAME**(오염 13/13) · GT SAME 5 → SAME 3 · PRESUMED 2(놓침 **0**) ·
GT SIMILAR 1 → PRESUMED_SAME(과도 1) · 🔴 오판 14 중 **12건이 tier COMPARISON**(가격 유입)

오판의 증거 조합
  7건  DIFFERENT · brand ABSENT · code ABSENT · **name PRESENT**   · COMPARISON
  4건  DIFFERENT · brand ABSENT · code ABSENT · 🔴 **name CONFLICT** · COMPARISON
  2건  DIFFERENT · brand ABSENT · code ABSENT · name ABSENT        · tier 없음
  1건  SIMILAR   · brand PRESENT · 🔴 **code CONFLICT** · name PRESENT · COMPARISON
```

🔴🔴 **그래서 결론이 「증거가 없어서 보류」가 아니다 — 「증거가 «달랐는데도» 보류」 다**:

```
구조   `!blocked && brandOk && corePoints >= 5 → SAME`  /  `totalPoints >= 3 → PRESUMED_SAME`
🔴🔴 **blocker 는 SAME 게이트에만 걸린다 — `PRESUMED_SAME` 은 막지 않는다**
⟹ 관측된 차이(NO_TITLE_OVERLAP · MODEL_CODE 충돌)가 있어도 **PRESUMED_SAME 이 되고**
   그것이 **tier COMPARISON 으로 가격 비교에 들어간다**
🟢 WU-123/125 가 이미 같은 자리를 지적했고 §00-B 가 **가격 사안으로 보류** 했다
```

🔴 **수정하지 않았다 — 두 길 다 금지축이다**: ⒜ blocker 가 `PRESUMED_SAME` 도 막게 =
**판정 정책 변경**(§6 STOP) ⒝ blocker 있는 보류를 가격에서 제외 = **가격 자격 변경**(§1 금지).
🟡 **CPO 판단 사안** 이고 CTO 가 고르지 않았다.

### A-MI-10. 🔵🔵🔵 [2026-11-20] **후보측 증거 — 추출은 거의 완벽하다. 없는 것이 없다**

```
후보 설명 보유 **98** · 그 안에 「Bobo Choses」 문자열이 **실제로 있는 건수 30** ·
별칭 owner 가 읽은 건수 **29**
⟹ 🟢🟢 **추출 성능 29/30 ≈ 완벽** — 나머지 68건은 **추출 실패가 아니라 실제 부재** 다
🔴 그래서 「추출을 개선하면 BRAND 83% 결손이 메워진다」는 **사실이 아니다**
```

🔵🔵 **BRAND 충돌이 0/19 인 진짜 이유** — 별칭 사전이 **원상품 브랜드 계열 중심** 이라
후보 «자신의» 다른 브랜드(Hugo Boss · Marc Jacobs · DG)를 **모른다** ⟹ `CONFLICT` 가 아니라
`ABSENT` 로 떨어진다. 🔴 그것을 메우는 것은 **브랜드 별칭 사전 확대** 이고 Registry 확대 금지축과 인접하다.

🔴 **계약 2건의 실제 보호 범위(원문 확인)**:
```
① `brand-1-description-evidence.test.ts` **④-1** — owner **5개**
   (`product-url-facts` · `product-identity-dna` · `brand-identity` · `cross-seller` · `seller-facts`)가
   `brand-description-evidence` · `analyzeBrandDescriptionEvidence` 를 **import 하지 않는다**
② `sprint3-gate-gt-precision.test.ts` **F-1** — owner **3개** 가 brand **그리고**
   `product-name-description-evidence` · `analyzeProductNameDescriptionEvidence` 를 **import 하지 않는다**
🔴🔴 **금지 축은 「import」 다** ⟹ **「단순 저장」과 「판정 사용」이 계약상 구분되지 않는다.**
   `ProductFacts` 를 만드는 owner 가 전부 금지 대상이므로 **보관만 하려 해도 계약 위반** 이다
🟢 단 **원문 자체는 이미 보관된다** — `ProductFacts.description`(seller-facts:412 · product-url-facts:594)
```

🔴 `corroborated` **0/19** — 그 값은 `product-name-description-evidence.ts:298` **한 분기에서만**
세워지고 `UNKNOWN`(:275) · `CONFLICT`(:286) · `OBSERVED`(:309)는 **전부 null** 이다.
🔴 이 분모의 `state` 분포는 **측정하지 않았다**(내가 `corroborated` 만 기록했다) ⟹ **미측정**.

### A-MI-11. 🔵🔵🔵 [2026-11-20] **원상품 `CORROBORATED` 0 의 원인 — 「두 출처 반복」이 없다**

🟢 원인은 **추출 실패가 아니다.** `product-name-description-evidence.ts` 의 승격 조건이다:

```
승격 조건  `const sources = new Set(direct.map(o => o.source)); if (sources.size >= 2)`
          ⟹ 🔴 **제목 «그리고» 상세설명 — 독립 출처 «둘» 에서 핵심 토큰을 공유해야** 한다
상태 분기(코드 조건별)
  UNKNOWN **17**      `usable.length === 0` — 관측이 없거나 전부 `genericTypeOnly`
                      (「남은 말이 제품 «유형» 뿐이다」 — owner 가 그렇게 적는다)
  CONFLICT 0          `disjoint` — 핵심 토큰이 전혀 안 겹치는 상품명 후보 둘 이상
  OBSERVED **92**     usable 은 있는데 **DIRECT 독립 출처가 1곳** 이다 ⟹ 승격 안 됨
  CORROBORATED **0**  🔴 **두 출처가 성립한 적이 없다**
```

🔵🔵 **기전** — 원상품 상세설명은 **사양 정보** 다(실측 「… 100% Organic Cotton. **Product code
B226AC009** AW26 Made in Portugal.」). 제목에는 「Hug Hairy Monster T-Shirt」가 있지만
**설명이 그 이름을 다시 적지 않는다** ⟹ 독립 출처 2곳이 **구조적으로 성립하지 않는다**.
🟢 후보는 2건이 성립했다(제목·설명 둘 다에 고유명을 적는 리테일러가 있다).

🔴 **CPO 질문 둘에 답한다**:
```
「목록 제목과 상세설명에서 같은 제품명이 확인되면 확증 가능한가?」
  🟢 **그것이 정확히 현재 조건** 이다(`sources.size >= 2`) — 가능하지만 **데이터가 그 모양이 아니다**
「원상품과 후보에 서로 다른 기준을 적용하는가?」
  🟢 **아니다 — 같은 함수·같은 조건** 이다. 비대칭은 **기준이 아니라 데이터** 다
```

🔴 **미측정** — 행별 `reasons`/`observations` 를 산출물에 담지 않았다 ⟹ OBSERVED 92 안에서
「설명에 고유명이 아예 없다」 ↔ 「있는데 `genericTypeOnly` 로 걸렸다」의 **분할은 측정하지 않았다**.
🔴 그래서 「원상품 설명에 고유 제품명이 없다」로 **단정하지 않는다**.

🟡 **정책 변경 없이 가능한 개선 후보(구현 0)** — 「제목 **또는** 설명 한 곳에서만 나온 고유명도
**원상품 자신의 이름으로는** 쓸 수 있는가」. 🔴 그것은 **승격 조건(`sources.size >= 2`) 완화** 이고
`OBSERVED → CORROBORATED` 를 **92건 열 수 있다** ⟹ 🔴 **CPO 판정 사안**(효과·오염 미측정).

### A-MI-7. 바꾸지 않는 것 (동결 — 이 전략 정리가 승인이 아니다)

```
SAME_MIN_AXES **5** · PRESUMED_SAME_MIN_AXES **3** · IMAGE SAME 집계 제외 ·
1점 TITLE 집계 제외 · 설명 유사성만으로 DIFFERENT→SAME 금지 · 모델코드 충돌 무시 금지 ·
사이트별 예외 신설 금지 · Human DIFFERENT → 시스템 DIFFERENT 유지 ·
가격 적격성·가격 계산·시장가격 원칙 동결 · 표준 §3.4 Identity 변경 **7조건** 준수
🔴 Evidence 를 추가했다고 **자동으로 판정 규칙을 바꾸지 않는다**(표준 §2.3 · §3.4)
```

---

## A. 변하지 않는 프로젝트 헌장

### A-1. 제품이 만드는 것

> **「따져보고 판매하라.」** 국내외 **소싱 의사결정 플랫폼** 이다 — 수집·자동등록 도구가 아니다.

```
해외 상품 발견 → 상품 사실 확인 → 시장/가격/수익성 판단 → 판매 가능 여부 판단 → Commerce 등록
```

### A-2. 🔵 핵심 목표 — **후보 수가 아니라 «확인된 SAME» 이다**

```
🔴 목표가 아닌 것   검색 후보를 많이 모으는 것 · 자동 판단률 자체를 올리는 것 ·
                  CEO 가 다수 상품을 손으로 판정하는 구조
🟢 목표            판매자가 «실제 가격 판단» 에 쓸 수 있는 신뢰도 높은 동일상품 근거
                  국내 **확인된 SAME 3~5개** · 해외 **확인된 SAME 3~5개**

흐름  근거 충분 → 자동 SAME  →  정보 부족 → 상세정보로 «부족한 칸만» 복구
      → 그래도 모호 → 판매자에게 후보 «선택» 요청
🔴 SIMILAR·PRESUMED_SAME 을 「확인된 SAME」에 넣지 않는다
🔴 수를 맞추려고 근거 없는 자동 판정을 하지 않는다
🔴 모든 후보를 상세조회하지 않는다 — 상세정보는 «부족한 식별정보 복구» 용이다
```

### A-3. 핵심 동일성 조합 **v2** — 품번은 필수 조건이 아니다

> 🔵 **CPO 기준 수정 2026-11-17** · `docs/START-HERE.md` 와 동일 ·
> 원문 `docs/HANDOFF-P0-MI-ACCURACY-RECOVERY.md` **§D-sxI**
> 🔴 아래 표가 기준이다 — 이 문서가 **요약해 바꿔 적지 않는다.**

| 확보된 정보 | 처리 |
|---|---|
| **브랜드 + 상품명 MATCH** | 🟢 **동일상품 판단**(품번 불필요) |
| **품번 MATCH 만** | 🟡 **상세설명·기타정보 확인 대상** |
| **품번 + 상세설명 브랜드** | 🟢 동일상품 판단 가능 |
| 일부 불일치(충돌) | 🔴 **CEO 검토**(브랜드·상품명·상세설명 근거를 함께 제시) |
| 근거 없음 | 정보 부족 |

```
🔴 「품번 MATCH 만」을 «자동 SAME 금지» 로만 적지 않는다 — 그 자리는 «상세설명 확인 대상» 이다
   (v2 실측 — 그 경로 NEEDS_DETAIL_CHECK **6건이 전부 GT SAME** ⟹ 버리는 자리가 아니다)
🔴 「양쪽에 품번이 있으나 서로 다름」은 **CEO 검토** 자리다 — CTO 가 DIFFERENT 로 단정하지 않는다
   (v2 실측 — CEO_REVIEW 7 의 GT 가 SAME 1 · DIFFERENT 2 · SIMILAR 1 로 **갈려 있다**)
🔴 브랜드 단독 일치나 「품번처럼 보이는 문자열」 하나로 동일상품 판정을 하지 않는다
🔴 SIMILAR·PRESUMED_SAME 은 「확인된 SAME」이 아니다
```

### A-4. 역할과 승인 절차

```
CEO  제품 방향 · 사업 결정 · 실제 Production 화면 최종 확인
CPO  범위·우선순위·작업지시·중간 선택지 판단·PASS/REWORK/HOLD
CTO  조사 → 원인 확정 → 전수검토 → 구현 → 테스트 → 음성대조 → 회귀 → 보고 **1회**

🔴 CTO 는 「⒜⒝⒞ 중 무엇을 할까요」를 CEO 에게 묻지 않는다 — CPO 에게 올린다
🔴 CTO 는 선제적으로 WU 를 만들지 않는다 — CPO 가 지정한다
🔴 게이트: CTO 1차 → CPO 2차 → CEO 최종. CTO→CEO 직행 금지
```

### A-5. 🔴 측정·보고 원칙 (이 트랙에서 반복해 틀린 것들)

```
① 「측정불가」를 **0% 나 「없음」으로 적지 않는다**
② 분모를 섞지 않는다 — 행 ≠ 고유 URL ≠ 쌍 ≠ 상품. **쌍 키는 (originUrl, candidateUrl) 하나만 유일**
③ 사실 / 추론 / 측정불가 를 **갈라서** 적는다
④ 완료하지 않은 것을 완료라고 적지 않는다. 테스트 PASS ≠ Production PASS
⑤ 소스 문자열 검사는 **주석을 벗기고** 한다(자기 자신을 잡는 계약이 반복해서 났다)
⑥ 칸 이름을 추측하지 않는다 — 타입/운영 코드에서 **읽고** 쓴다
⑦ 기존 산출물은 **읽기 전용** 으로 다루고 새 결과는 별도 파일에 쓴다(해시 전후 대조)
⑧ 계측은 **전수 저장** 한다 — 요약만 남기면 사후 분석이 불가능하다(실제로 두 번 막혔다)
```

### A-6. 🔴 상시 금지 사항

```
threshold 완화 · 8축(COLOR·TITLE·MODEL_CODE·LINE·MARKET·PRICE·LANGUAGE·BRAND) 재개방
PRESUMED_SAME 자동 승격 · 품번 충돌 가드 제거 · 브랜드 alias 등록부 확장
새 사전/동의어/정규식 신설 · 외부 AI·검색 API 사용 · 소비자 구독 우회
Registry·Adapter 확대 · 외부 URL 영구 저장 · 외화 자동 환산 · 이미지를 SAME 근거로 승격
`git add .` · `git reset --hard` · `git clean` · `stash` · 강제 checkout
사용자 수정 파일 덮어쓰기 · 보호 문서 임의 수정
```

### A-7. 🔴 보호 문서 (읽기 전용)

```
docs/START-HERE.md              CEO 가 직접 수정 · 승인 없이 수정·삭제·재작성 금지
docs/CEO-GT-LEDGER-2026-11-08.md  CEO 육안 판정 원장 · 읽기 전용
docs/STANDARD-V1.md             제품 운영 표준 · CTO 가 조항을 고치지 않는다
```

---

## B. 현재 프로젝트 좌표 (2026-11-18)

### B-1. Git

```
origin/main      **d28d01c9**  ⟸ 🟢 **UIRD-1/2/3 배포 완료**(2026-11-18)
                 197f7fc6 → **ecff8848**(UIRD-1/2) → **d28d01c9**(UIRD-3) · 둘 다 fast-forward
                 🟢 Vercel ● Ready · alias `ttaejyo.vercel.app` 연결 확인 · Production 200
현재 브랜치       **uird-deploy-01**(origin/main 과 **0/0**) — origin/main 기준으로 만든 배포 브랜치
작업트리          추적 수정 **15건 = 전부 사용자 변경**(CTO 것이 아니다 · 건드리지 않는다)
🔴 main push = **그 순간 Production 배포** 다(Vercel Git 연동 · GitHub Actions 없음)

🔴🔴 **보존된 브랜치 — `mi-locale-link-01`(미push · ahead 2)**
  7b18c642  feat(MI-LOCALE-LINK-01) 로케일 브랜드 복구 구현
  7b093ef4  test(MI-LOCALE-LINK-01) 계약 11 + 네 상태 관측
🔴🔴 **배포 때 이것을 «일부러» 남겼다** — 그 WU 는 **운영 검증 보류 · CEO 사업 승인 대기** 다.
   그 브랜치에서 그대로 push 했으면 **동결된 운영 코드 5 파일이 Production 에 같이 나갔다**.
   🟢 그래서 `git checkout -b uird-deploy-01 origin/main` 으로 **base 를 갈아** 배포했다
   (그 6 파일이 전부 clean 이고 내 4 파일과 겹치지 않아 안전했다 · 검산 완료).
🔴 재개할 때는 그 브랜치에서 이어간다 — 🔴 **main 에 머지하지 않는다**(CEO 승인 전).
```

### B-2. 진행 중 / 보류 / 완료

| 작업 | 상태 | 비고 |
|---|---|---|
| **MI-LOCALE-LINK-01** | 🟡 **구현·계약 완료 / 운영 검증 보류** | 커밋 둘 · 배포 0 · DB 쓰기 0 |
| 국문 검색 확장 A/B | 🔴 **보류** | 후보 +105 · **SAME 증가 0** · 검증 SAME 0 |
| 원상품 식별정보 분석 | 🟢 완료 | 27건 분류 S1 20 / S2 0 / S3 7 / S4 0 |
| CEO 검토 화면(86건 수동 판정) | 🔴 **중단** | 프로토타입만 존재 · 방향 전환됨 |
| CODE_ONLY_LINK 확대 | 🔴 불허 | B226AC009 한정 승인뿐 |
| DB 백필 | 🔴 불허 | — |
| **Smallable 가격 표시** | 🟢 **종료(2026-11-18)** | **코드 변경 0** — ⒜ 가 기존 구현으로 이미 충족 |
| **MI-KIDS-DOMESTIC-MATCH-ACCURACY** | 🟢 **분석 완료(2026-11-18)** | **코드 변경 0** — 결함 0 · 아래 B-7 |
| **취급 제외 브랜드 = `Main Story`** | 🟢 **구현·배포 완료** | CEO 결정 2026-11-07 · 커밋 `21d4a5fa`(origin/main) · 아래 B-8 |
| **MI-OVERSEAS-PRICE-COMPARISON-ACCURACY** | 🟢 **분석 완료(2026-11-18)** | **코드 변경 0** — FP 0 · 아래 B-8 |
| **MI-ORIGINAL-PRICE-ACCURACY** | 🟢 **분석 완료(2026-11-18)** | **코드 변경 0** — 결함 0 · 아래 B-9 |
| **MI-PRICE-COMPARISON-FINALIZATION** | 🟡 **A~D 완료 / E 측정불가** | **코드 변경 0** — 아래 B-10 |
| **MI-PRICE-COMPARISON-UI-REDESIGN** | 🟢 **UIRD-1/2/3 배포 완료** | `ecff8848` · `d28d01c9` · 아래 B-11~B-13 |

### B-3. MI-LOCALE-LINK-01 상세

```
무엇   같은 상품의 다른 로케일 스냅샷에서 브랜드를 빌려온다. **B226AC009 한정**
근거   /en-kr 36 스냅샷 brand 36/36 「Bobo Choses」 ↔ /ko-kr 0/16 · /(로케일없음) 0/8
       제목은 셋 다 동일 ⟹ 브랜드가 «상품에» 없는 것이 아니라 «그 로케일 수집에» 없다
안전조건 ① 같은 호스트 ② 로케일 조각만 다른 동일 경로 ③ isKnownProductBrand 통과
       ④ donor 브랜드 유일 ⑤ 그룹 제목 유일 — **하나라도 어긋나면 복구하지 않는다**
출처등급 `brandResolution.ruleApplied` 에 `URL_LOCALE_LINK` 만 기록(기존 SEASON_CODE 보존)
       🔴 `FieldSource` 유니온은 **불변** · DNA 는 등급을 소비하지 않는다(판정 영향 0)
관측   네 상태 — RESTORED / NO_DONOR / REJECTED / LOOKUP_ERROR · `[MI-LOCALE-LINK-01]` 한 줄
       🔴 로그에 상품명·제목·URL 을 적지 않는다
검증   계약 11/11 · typecheck 0 · 음성 대조 5종 전부 FAIL→바이트 복구
🔴 실행하면 기존 ko-kr 16건이 고쳐지는 게 아니라 **17번째 스냅샷이 새로 생긴다**
   (`saveSnapshot` 은 insert) ⟹ 「기존 16건 복구」로 적지 않는다
```

### B-4. 🔴🔴 기술적 제약 — **격리된 검증 환경이 없다**

```
Vercel 프로젝트는 `ttaejyo` 하나 — staging 프로젝트 없음
NEXT_PUBLIC_SUPABASE_URL · ANON_KEY · SERVICE_ROLE_KEY · ADMIN_USERNAME/PASSWORD/SESSION_SECRET
  ⟹ 전부 **Production 전용** · Preview 전용 값 **0행**
로컬 `.env.local` 에도 Supabase 3변수가 **없다**
⟹ Preview 는 「분리된 환경」이 아니라 **「DB 가 아예 없는 환경」** 이다
⟹ DB·로그인을 쓰는 기능은 **구현·계약까지만** 하고 운영 검증은 보류로 보고한다
🔴 내가 가진 유일한 DB 자격증명(`packages/database/.env`)은 **production** 이다
```

### B-5. 🔴 다시 조사하지 않는 것 (CLOSED)

```
8축 완화 효과            전부 측정됨 — 완화하면 Human DIFFERENT 가 같이 열린다
국내 recall 한계          현 구조의 한계로 확정
상세설명 추가 확인         S2 = 0 — ⒜ 설명문 라벨이 이미 1순위라 더 건질 것이 없다
extractDetailModelCodes 원상품 연결  추가 수확 **0건** — 연결해도 이득이 없다
국문 검색 확장            SAME 증가 0 · alias 폴백을 막는 부작용 확인
후보 이미지               candidate_reviews.image_url 347행 전부 공백 · vision 경로 교집합 0
원상품 쌍 연결(17건)      originUrl 이 없어 복구 불가
**Smallable 가격 표시**   🟢 **CPO 종료 2026-11-18 · 코드 변경 0** — 아래 B-6 참조
```

### B-6. 🟢 Smallable 가격 표시 — **종료 · 재조사 금지**(CPO 판정 2026-11-18)

```
🔴🔴 **폐기된 안** — 「EUR 75 → 75,000원」(외화 숫자 ×1000 을 원화로 표시).
   CTO STOP · CPO 폐기. 사유 — 우리 데이터로 함의 환율 ≈ **1,653 KRW/EUR**
   (EUR 50 ↔ KRW 82,673 · `docs/LONG-SPRINT-BASELINE.md:191`) ⟹ EUR 75 의 실제값은
   약 **₩124,000** 이고 75,000원은 **-40%** 다. 국내 참고가 ₩88,000 과 비교하면
   「해외가 15% 싸다」로 보이는데 실제로는 **41% 비싸다** ⟹ **소싱 판단이 뒤집힌다**
   🔴 같은 종류의 버그가 이미 났다 — `CAD 64 → 「약 ₩64」`(overseas-reference.ts:133 · CORE-2E §4-4)
   🔴 그리고 `wu-056r1:168`(`not.toMatch(/₩|원화|환산된|≈/)`)이 그 변경을 FAIL 로 막는다

🟢 **채택안 ⒜ 는 이미 구현돼 있었다**(코드 변경 0 · 아래가 그 배선이다)
   pickJudgingMarketRow(global-market.ts:460)  판단 시장(한국) 관측을 **정확히 하나일 때만** 고른다
     🔴 `kr` 과 `en-kr` 이 함께 관측되면 **고르지 않는다**(null) — 「모르면 고르지 않는다」
   DomesticPriceIntelligencePanel :4229 선택 → :1476 「원본 판매자 한국 표시가」 렌더
   :729  costBasis = **KR_MARKET(실제 한국 표시가 «우선»)** / ORIGIN_FX(환산)
   :655  KR_MARKET 관측은 **환산이 없어** 환율이 null · :4169·:4295 「환산값이 아니다」 명시
   수집  `probeAdditionalMarkets(sourceUrl, ["", "en-kr"])` — 환율 API **0** · 추가 API **0**

🟢 **유지되는 기존 정책**(CEO 확정 · 확대 해석 금지)
   첫 화면 = 판단에 필요한 가격만 · 본문은 `ⓘ 글로벌 시장 가격 ▸` **이름 하나**
   상세 펼침 = **국가별 원자료 보존**(MI-UX-FINAL-REVIEW 2026-09-12)
   🔴 「국가별 노출 제거」를 **원자료 삭제로 확대하지 않는다** — CPO 가 명시적으로 닫았다

🟢 검증 — wu-056r1 6/6 · global-market-observations 25/25 · commerce 전수
   **275 files / 4,043 passed / 0 failed / 5 skipped** · 코드·DB·배포 **0**
```

### B-7. 🟢 KIDS 국내 동일상품 매칭 정확도 — **분석 완료 · 결함 0**(2026-11-18 · 코드 변경 0)

```
🔴🔴 **분모를 세 층으로 가른다 — 하나로 합치면 거짓이 된다**
   전체 쌍                      **109**   (쌍 키 `(originUrl,candidateUrl)` **109/109 유일** 🟢)
   originTitle 있음              **92**   (🔴 공백 **17** = 측정불가)
   🟢 **측정가능 분모(GT + 제목)** **20**   GT SAME 9 · DIFFERENT 10 · SIMILAR 1
   🔴 `(originCode,candidateUrl)` 키는 **103/109** ⟹ 중복 6 ⟹ **그 키로 집계하지 않는다**

🟢🟢 **Precision 결함 0** (CPO 의 Precision 우선 원칙 기준 — 이것이 이 스프린트의 답이다)
   JUDGEABLE 6 → GT SAME **6 / FP 0**                 ⟹ Precision **6/6**
   🟢 **GT DIFFERENT 10 중 JUDGEABLE 0** ⟹ 가격비교 오염 **0**
   🟢 운영 게이트도 코드로 확인 — `selectMiSameCandidates = SAME + 판매중 + VERIFIED_CURRENT`
      (mi-same-candidates.ts:135) · `market-evidence.ts:276` = `tier === "SAME"`
      ⟹ 🔴 **SIMILAR·PRESUMED_SAME 은 「확인된 SAME」 가격 축에 들어가지 않는다**
   🟡 단 국내 **참고가격** 축은 PRESUMED_SAME 을 받아들이고, 그 사실을 이름이 말한다
      (`DOMESTIC_SAME_NOT_CONFIRMED` 「동일상품으로 확정된 국내 판매처는 없습니다」) ⟹ 결함 아님

🔴 **FN(누락) 3건 — 전부 「근거 부족」이고 판정 로직 결함이 아니다**
   ① global.trenbe  code MATCH · brand UNKNOWN · name UNKNOWN → NEEDS_DETAIL_CHECK
      ⟹ 🟢 v2 기준의 **「품번만 일치 → 상세설명 확인 대상」 그대로** (설계된 보류)
   ② (B226AC009)   name MATCH · brand UNKNOWN → INSUFFICIENT
      ⟹ 🟡 **브랜드 미확인이 상품명 MATCH 를 못 쓰게 한다.** 해소 경로는 **MI-LOCALE-LINK-01**
         이고 🔴 **CPO 가 동결**했다 ⟹ 재개하지 않았다
   ③ (B226AC036)   제목 겹침 0 · 품번 없음 → INSUFFICIENT ⟹ 🟢 증거 0 이라 올바른 보류

🔴🔴 **「GT SAME 누락이 많다」로 읽으면 틀린다 — 원인은 GT 자료의 origin 공백이다**
   제목 공백 **17건은 전부 `originUrl = null`** 이고 **GT SAME 13 · DIFFERENT 4** 다.
   🟢 같은 상품(B226AC009)의 제목 있는 9행은 **`en-kr` 과 `ko-kr` 둘 다** 제목을 갖는다
      ⟹ 🔴 **로케일 문제가 아니다**(동결 영역과 무관)
   🔴 그 17건 중 **16건은 「제목 있는 쌍둥이」가 없다** = 중복 그림자가 아니라 **진짜 공백**
   🟢 후보 제목은 **전건 있다**(candidateTitle 공백 **0/109**) ⟹ 공백은 **원상품측** 이다
   ⟹ 🔴 **운영 경로는 스냅샷에서 시작하므로 원상품 제목이 있다.** 이 공백은
      **GT 자료(candidate_reviews 계열)가 origin 을 안 적은 것** 이고 B-5 가 이미
      「원상품 쌍 연결 17건 · originUrl 이 없어 복구 불가」로 **CLOSED** 해 둔 그 자리다
   ⟹ 🔴 그래서 그 16건을 **정확도 분모에 넣지 않았다** · 「FN 16건」으로 적지 않는다

🔴 **위험 1건(고치지 않았다)** — `kids-triage-v2.test.ts` 가 `writeFileSync` 로
   `docs/MI-KIDS-TRIAGE-V2.json` 을 **덮어쓰는데 그 파일은 git 추적 대상이 아니다**
   ⟹ 회귀로 돌리면 CPO 가 참조하는 자료가 **복구 불가로 바뀔 수 있다**.
   🟢 그래서 이번에 **그 하니스를 돌리지 않았고** 해시로 불변을 증명했다
   (`1408034e…f1c37` 전후 동일 · 백업은 스크래치패드)

🟢 회귀 — SAME 축 **40 passed / 0 failed / 7 skipped** · commerce 전수 4,043 passed
🔴 운영 코드 **0** · 산출물 **0** · fixture **0** · threshold·alias·사전·정규식 **0**
```

### B-8. 🔵🔵🔵 취급 제외 브랜드 = **`Main Story`** · 해외 가격비교 정확도(2026-11-18 · 코드 0)

```
🟢🟢 **브랜드 확정 — 추측 0 · 원문 근거 둘**
   ⒜ 커밋 **`21d4a5fa`** 「feat(brand-exclusion): **Main Story 한정 취급 제외** —
      진입점 + 후보 choke point 둘」 · 🟢 **origin/main 에 포함**(배포됨)
   ⒝ CEO 원문 사유(`excluded-brands.ts` 머리에 보존) —
      「**품번 코드가 모든 제품 동일한게 문제가 있음, 그리고 셀러 취급도 하지 않음**」
      CEO 결정 **2026-11-07** · CPO 승인 §1~§3
   ⒞ `docs/MI-REEVAL-STEP5-SHADOW.md:99` 「그 브랜드는 **이미 취급 제외가 배포됐다**」
🔴 **「Story」 단독을 제외어로 적지 않는다** — 다른 브랜드(Story Loris)를 지운다

🟢 **정책 owner 는 코드다**(사본 금지)
   `packages/crawler/src/comparison-search/excluded-brands.ts`
   EXCLUDED_BRAND_NAMES = ["Main Story","메인스토리","매인스토리"]
   EXCLUDED_BRAND_HOSTS = ["main-story.com"] · EXCLUDED_BRAND_LABEL = "Main Story"
   배선 ① `runDomesticPriceCheck` 진입점(검색 전 종료 · HTTP 0)
        ② `judgeDomesticCandidate`(생산자 여섯을 덮는 **유일 choke point**)
        ③ 화면 `brand-excluded-notice`(「후보 없음」과 **다른 칸**)
   🟢 계약 **16/16 PASS**(실행 확인) · alias 등록부 **불변** · 다른 브랜드 영향 **0**
   🔴 한계(기록됨) — 「Main Story Kids」는 안 걸린다(선언 brand 칸 **완전 일치** 술어)
🔵 전략 정본 기록 위치 = **`docs/START-HERE.md:2080~2088`**(이미 있다 · 21건 언급)
   🔴 **중복 기록을 만들지 않았다**(CPO 지시) · 🔴 START-HERE 는 보호 문서라 수정 0

🔴🔴 **아래 셋은 «아직 정책이 아니다» — CEO 미승인 상태다**(CPO 명시 2026-11-18)
   ② 그 브랜드의 품번·모델코드 **개선 작업을 하지 않는다**
   ④ 기존 데이터·과거 분석 기록을 **삭제하지 않는다**
   ⑦ 취급 제외는 CEO 결정이며 **CTO 가 임의로 해제할 수 없다**
   🔴🔴 **이 셋을 「기존 정책에 이미 포함된 것」처럼 적거나 보고하지 않는다.**
      정본(START-HERE)에 **없고** CEO 승인 **전** 이다 ⟹ 지금은 **CPO 의 제안** 이다.
   🔴 보호 문서라 CTO 가 추가하지 않았다 · 🔴 그렇다고 **근거 없이 행동하지도 않는다**
      (②④⑦ 에 반하는 작업을 하려면 그때 CPO/CEO 에게 올린다)
   🟢 반면 ①③⑤⑥ 은 **이미 정본·코드에 있다**(위 블록이 그 자리다)

🟢🟢 **해외 가격비교 정확도 — FP 0**
   측정가능 분모(GT + originTitle) **19~20** 🔴 조인 키에 따라 흔들려 **단일 수치로 쓰지 않는다**
   🌎 해외 **19** (DIFFERENT 12 · SAME 6 · SIMILAR 1)
      JUDGEABLE 4 → TP **4 / FP 0** ⟹ Precision **4/4**
      🟢🟢 **GT DIFFERENT 12 중 JUDGEABLE 유입 0** ⟹ 수익성 판단 오염 **0**
      🔴 GT SAME 누락 **2**(근거 부족 — B-7 의 FN 유형과 같다)
   🔴 🇰🇷 국내 **측정가능 분모 0** ⟹ 「국내 해외비교 정확도」는 **측정불가**
      (국내 GT 가 originTitle 공백군에 몰려 있다 · B-7 참조)
   🟢 **두 조인 모두에서 불변** — FP **0** · DIFFERENT 유입 **0** ⟹ 그 결론만 사용한다
🟡 109쌍 중 Main Story 포함 **4건**(folkberlin ×2 · junioredition ×2) · **전부 GT null**
   ⟹ 정확도 분모 밖이고, 운영에서는 비교 **전** 에 제외된다
🔴 운영 코드 0 · 산출물 0 · fixture 0 · provider/adapter/alias/threshold 0
```

### B-9. 🟢 원본가격 정확도 — **분석 완료 · 결함 0**(2026-11-18 · 코드 0)

```
🟢 **A. 할인 전 가격 ↔ 현재 판매가 — 구분돼 있다**(WU-059 의 「정가 오인 위험」이 닫혔다)
   `priceFromGodoSaleField`(product-url-facts.ts:704) 는 `set_goods_price`(**판매가**)만 읽고
   `set_goods_fixedPrice`(**정가**)는 **절대 읽지 않는다**(CPO STEP 10 명시 · 실측 83,600 ↔ 88,000)
   🟢 통화 가드 — 같은 금액이 「…원」으로도 적혀 **2차 출처가 동의할 때만** KRW · 없으면 **null**
   🟢 어댑터 축도 같은 방향 — 「정가가 **더 클 때만** 노출」(looxloo·chocoel·deuxbebe) ·
      littleluna 는 정가 칸이 **항상 0원** 이라 **미사용 칸으로 처리**(0 을 정가로 올리면 100% 할인)

🟢 **B. 한국 기준 가격 ↔ 환산값 — 섞이지 않는다**
   원가 owner `selectCostBasisOriginObservations`(price-observations.ts:305)
     ⟹ **ORIGIN_FX 가 하나라도 있으면 KR_MARKET 행을 뺀다**(원가는 원본 시장 통화 기준)
   화면 owner `pickJudgingMarketRow` → Panel :4229 → :1476 「원본 판매자 한국 표시가」
     :655 「KR_MARKET 관측은 **환산이 없어** 환율이 null」 · :4169·:4295 「**환산값이 아니다**」
   🟢 환율 없으면 **null** — `computeKrwAmount`(price-truth.ts) 는 환율 없으면 null
     (「추측 환율을 만들지 않는다」) · `convertToKrwStrict` 도 모르는 통화에 null
   🔴 「kr」 과 「en-kr」 이 함께 관측되면 **고르지 않는다**(「모르면 고르지 않는다」)

🟢 **C. 가격 판단 유입 — 미검증 가격이 금액에서 빠진다**
   승격 owner `derivePriceStatus`(match.ts:570) — **상세 페이지 조회 성공만** VERIFIED_CURRENT
     ⟹ 🟢 임의 승격 경로 **없음**
   UI owner `isPriceDisplayable`(price-truth.ts:14) = `VERIFIED_CURRENT && price != null`
     🟢 `undefined`(구버전 스냅샷)는 **안전 측(숨김)**
   🟢🟢 **WU-111 모순은 «해소됐다»** — `summarizeCandidateOverseasPrices` 가 이제
      `unverifiedCount`(「금액 집계에서 『가격 미확인』으로 빠진 수」)를 두고 **byCurrency 에서 뺀다**
      🔴 전에는 「EXCLUDED 만」 걸러서 「최저가는 뜨는데 근거 줄엔 『가격 확인 필요』」가 났다
      🟢 후보는 **그대로 보인다** — 빠지는 것은 `byCurrency` 하나다(관측은 보존)
   🟢 `isPresumedSameVerdict` 가 **판정하지 않고 생산자 값을 읽기만** 한다 ·
      🔴 그 술어를 집계 파일에 두지 않고 **어휘의 집** 으로 옮겨 기존 계약을 **살린 채** 해결했다

🟢 회귀 — global-market-observations 25/25 · price-truth **25/25** · core-2e-price-evidence ·
   wu-056r1 6/6 ⟹ **42 passed / 0 failed**(+ price-truth 25) · commerce 전수 4,043 passed
🔴 측정불가 — ⒜ 실제 Production 화면은 CTO 가 볼 수 없다(마운트 DOM·소스 축까지) ⒝ 정가·할인가
   **전수 빈도 미측정**(고도몰 1 플랫폼 실측) ⒞ 「kr ↔ en-kr 동시 관측」 실제 발생률 미측정
🔴 운영 코드 0 · DB 0 · 수집 0 · provider 0 · 가격 정책 0 · Smallable 재개 0 · Main Story 유지
```

### B-10. 🟡 가격비교 최종 완성 — **A~D 충족 / E 측정불가**(2026-11-18 · 코드 0)

```
🔴🔴 **E(실제 셀러 화면)는 «측정불가» 다 — 그리고 그것을 «실행으로» 확인했다**
   `preview_start(admin)` → 서버 기동 🟢 → `/pipeline` 요청 → **리다이렉트(opaqueredirect)**
   → 로그인 화면이 **앱 스스로** 말한다:
     「**인증 설정이 준비되지 않아 로그인할 수 없습니다. 운영자에게 문의해 주세요.**」
   🟢 로컬 env 실측 — `apps/admin/.env.local` · `.env.local` · `packages/database/.env` 의
      SUPABASE/ADMIN_ 키 **0건** ⟹ 로그인·DB 둘 다 없다(B-4 와 같은 결론 · **이번엔 실행 증거**)
   🔴🔴 **그러므로 「실제 셀러 화면을 확인했다」고 적지 않는다.** 화면 축은 **마운트 DOM** 이다.
   🟡 E 를 닫는 길은 **CEO 확인 1회** 뿐이다(또는 Staging 확보)

🟢 **A 첫 화면(판단)** — owner 하나 · 격자 밖 최상단
   `marketDecisionLines(judgement, references)`(MarketPriceComparison:562) ·
   DOM `data-testid="seller-decision"`(:1483) · 🔴 「결론 owner 는 하나다」(:1478)
   게이트 `stageFocus.mi !== "HIDDEN"` ⟹ 커머스 탭 맨 위에 판단이 서지 않는다
🟢 **B 상세 화면(근거)** — 2차 접힘 `▸ MI 상세 분석`(이 영역) ·
   `▸ 판단 근거 N/M 확인됨`(:720 · **다른 컴포넌트**) ⟹ 🔴 둘을 섞지 않는다(:607~612)
🟢 **C 등급 분리** — `SAME_PRICE_LABEL`「동일상품 확인 가격」 ·
   `SAME_CONFIRMED_COUNT_LABEL`「동일상품 확정」 · 가격 축 게이트 `tier === "SAME"` +
   판매중 + `VERIFIED_CURRENT` ⟹ SIMILAR·PRESUMED_SAME **유입 0**(B-7/B-8 측정)
   🔴 내부 토큰(`PRESUMED_SAME`·tier·blocker)은 그 영역에 **노출 금지**(계약)
🟢 **D 수익성** — 「착지원가 · 권장 판매가 · 예상 이익」 세 줄(원가 역산 **A 축**)
   🔴 **시장 기반 추천가(B 축)는 만들지 않았다** — §00-B 가격 보류 유지 ·
      「시장 평균/적정」 어휘 **0**(부정문 외) · 환산 **0**

🟢 회귀 — 셀러 표면 마운트 DOM E2E **8 files / 121 passed / 0 failed**
   (core-2s-seller-screen 35 · core-ux-seller-01-decision-order 24 ·
    core-2v-seller-reading-order 14 · core-e2e-close-03-presumed-area 14 ·
    e2e03-evidence-reaches-screen 10 · core-e2e-close-01-seller-surface 9 ·
    e2e04-domestic-candidate-visible 7 · market-comparison 8)
🔴 결함 **0** ⟹ 코드 변경 **0** · 신규 카테고리 0 · provider 0 · threshold 0 · 정책 0
```

### B-11. 🟡 가격비교 UI 재설계 — **STEP 1~4 완료 · STEP 5 CPO 검토 대기**(코드 0)

```
🔴🔴 **CTO 는 스크린샷을 받지 못했다.** 아래는 **코드 조사** 결과이고 화면을 본 것이 아니다.

🟢 **STEP 1 — 「국내·해외 동일 템플릿」은 과거 합의로 실재한다**(5건 복원)
   START-HERE:501          「⑤ 국내·해외 «동일 템플릿» 노출」
   HANDOFF-WU-131:104·175  「국내·해외가 **같은 카드 · 같은 판단 체계** 를 쓴다(§8)」
   HANDOFF-NEXT-CTO:393    「국내·해외 **같은 카드 컴포넌트** · 상품명·가격 간결」
   HANDOFF-NEXT-CTO:2042   「통일은 **SAME 분기도 같은 카드 셸로** 그리는 일이다(집계 변경 0)」
   HANDOFF-NEXT-CTO:2123   「두 가격 블록이 **같은 카드** 로 선다(**배포 완료**)」

🔴🔴 **STEP 1 — 그런데 「가격 «해석»」은 «의도적으로 다르다»**(WU-148 · CPO 확정)
   CLAUDE.md:782-783 · START-HERE:4317-4319 · START-HERE:2980
     🇰🇷 국내 = **시장 가격대**(1개면 「가격대 확정 불가」) ↔ 🌎 해외 = **최저 확인가**
   ⟹ 🔴 **충돌 지점은 정확히 하나다**:
      「동일 템플릿」 = **같은 카드 셸·같은 정보 순서** 로 읽으면 🟢 **충돌 없음**
      「동일 템플릿」 = **같은 가격 표현**(둘 다 최저가 or 둘 다 가격대) 로 읽으면
        🔴 **WU-148 CPO 확정과 충돌** ⟹ **CTO 가 해석하지 않았다 · CPO 판정 사안**

🟢🟢 **STEP 2 — 「국내/해외 비대칭」은 이미 고쳐져 있다**(CORE-2S §5-④)
   MarketPriceComparison:1006  `reference={mk === "KR" ? domesticReference : overseasReference}`
   🟢 **같은 컴포넌트**(`MarketBlock` → `OverseasReferencePrice`) · `variant="SUMMARY"`
   🟢 코드 주석이 그 이력을 적어 뒀다(:994~1004) — 「CORE-2R-5 는 **국내만** 1차로 올렸고
      🌎 는 접힘을 열어야 보였다. 그 비대칭이 CPO §5-④ 가 지목한 것」 ⟹ **이동으로 해결**
   🟢 중복 방지도 그 자리에 있다 — 2차의 해외 칸을 `reference={null}` 로 **껐다**
   🔴 ⟹ CPO 문제 ②(표현 방식 다름)는 **구조 축에서는 이미 닫혀 있다.**
      남는 가능성 셋 — ⒜ 스크린샷이 **구 배포** ⒝ 비대칭이 **다른 영역**
      (후보 목록 `GeminiTransientCandidates`) ⒞ 구조는 같고 **CSS(카드 높이·정렬)** 가 다르다
   🔴 **셋 중 어느 것인지 스크린샷 없이 가릴 수 없다** ⟹ 측정불가

🟡 **STEP 3 — 첫 화면의 «접힘/문구 블록» 전수**(CPO 문제 ③④ 의 코드 근거)
   `selling-summary`(headline·numbers·action) · `brand-market-profile` ·
   `▸ 이 추천이 나온 이유`(seller-action-reasons) · `▸ 판단 설명`(selling-guidance) ·
   `▸ 판단 근거 N/M 확인됨`(confidence-basis) · `market-recheck` ·
   `market-price-basis` · `market-krw-comparison` · `seller-decision` ·
   🇰🇷/🌎 `MarketBlock` · `▸ MI 상세 분석`
   🔴 ⟹ **1차에 설명성 접힘이 셋**(이유 / 설명 / 근거)이고 이름이 서로 가깝다
      ⟹ CPO 문제 ③(텍스트 과다) ④(같은 의미가 다른 위치)의 **구조적 근거** 다
   🟢 단 **가격 숫자 owner 는 하나다**(`buildPriceGuide` · :589) ⟹ 숫자 중복은 아니다

🔴 **STEP 4 설계는 제출만 했고 구현하지 않았다**(STEP 5 승인 대기) — 핵심 둘:
   ⒜ 설명성 접힘 **3 → 1** 로 통합(문구 삭제 0 · 근거·검증 정보 보존)
   ⒝ 🇰🇷/🌎 는 **이미 같은 컴포넌트** 이므로 **새 템플릿을 만들지 않는다** —
      바꿀 것이 있다면 **그 컴포넌트 하나** 이고 그래야 한쪽만 바뀌는 재발을 막는다
🔴 가격 정책 보존 — SAME 게이트 · PRESUMED 분리 · REFERENCE/EXCLUDED · 미검증 제외 ·
   KR_MARKET↔ORIGIN_FX · 환산 0 · threshold 0 · Main Story 유지 **전부 불변 예정**
```

#### 🟢 UIRD-1 **구현 완료**(CPO STEP 5 승인 · 2026-11-18 · 운영 1 파일)

```
🟢 **설명성 접힘 3 → 1** — `▸ 판단 근거`(`data-testid="judgment-basis"`)
   순서 **근거 → 이유 → 설명 → 브랜드 참고** · 🔴 문구·항목·근거 데이터 **삭제 0**
   세 그룹의 `*-items`/`*-item` testid **그대로 유지** ⟹ 내용 계약이 산다
   사라진 것은 옛 접힘 셋뿐 — `confidence-basis` · `selling-guidance` · `seller-action-reasons`
🟢 게이트 `hasJudgmentBasis` = **설명성 셋 중 하나라도 있으면** · 셋 다 없으면 **안 만든다**
🔴 `brand-market-profile` 은 **게이트에 넣지 않았다** — 접힘 있으면 그 안, 없으면 **제자리**
   ⟹ 🔴 정보 삭제 0 · 두 자리 동시 노출 0 (JSX 변수 하나 `brandProfileLine` · 사본 0)
🔴 `market-price-basis` 는 **옮기지 않았다** — 설명이 아니라 **가격 블록의 기준 줄** 이고
   바로 아래 🇰🇷/🌎 숫자와 같은 자리에서 읽혀야 한다(CPO 「필요한 내용은 적절한 상세 영역」 판단)
🔴 가격 집계·판정·수익성·데이터 계약 **변경 0** · WU-148 가격 의미 **불변**

🔴🔴 **내가 두 번 틀렸고 둘 다 가드가 잡았다 — 기록한다**
   ⒜ 게이트에 `brandMarketProfile` 을 넣었다 ⟹ 그 줄만 있는 상태에서 **빈 「판단 근거」
      접힘이 섰고** 기존 계약 「서버가 주지 않으면 영역을 만들지 않는다」가 **FAIL**.
      🟢 가드가 맞았다 — 설명이 없는데 설명 접힘을 세우면 셀러가 빈손으로 돌아온다
   ⒝ 그 계약을 고치면서 `judgment-basis === null` 로 단언했는데 **과했다** —
      fixture 는 `confidenceBasis.items: []` 이지만 `sellingGuidance` 가 **비어 있지 않다**
      ⟹ 그 상태에서 접힘이 서는 것이 맞다(옛 코드도 `▸ 판단 설명` 을 세웠고 옛 단언이 **안 봤을 뿐**)
      🟢 원래 의도를 그 축에서 잠갔다 — 「`items` 가 비면 그 **그룹** 을 만들지 않는다」
   🔴🔴 ⒞ **음성 대조가 내 계약의 구멍을 찾았다** — M1(게이트 항상 true)이 **10/10 통과** 했다.
      세 축이 **전부 빈** fixture 가 없어서 게이트를 지워도 관측이 안 바뀌었다.
      🟢 그 케이스를 추가해 **M1 이 1 FAIL** 로 바뀌었다(계약 10 → 11)

🟢 계약 **11/11 PASS** · 음성대조 **M1 1F · M2(open) 3F · M3(브랜드줄 삭제) 3F** → 바이트 복구
🟢 회귀 **275 files / 4,045 passed / 0 failed / 5 skipped**(이전 4,043 → **+2**) · typecheck **0**

🟡 **§3 국내·해외 시각 비대칭 — 코드 축 답 + 측정불가 경계**
   🟢 후보 카드는 **단일 컴포넌트**(`GeminiTransientCandidates`) · **단일 라벨 맵** 이다 —
      그 파일 머리가 그 이력을 적어 뒀다(:22 「국내/해외 화면이 각자 라벨 맵을 들고 있다가
      같은 판정이 화면마다 다르게 보였던」) ⟹ **구조·정보 순서는 이미 통일**
   🔴 단 후보 구역의 **분할 축은 «출처(생산자)»** 다(`OVERSEAS_AUTO` 「해외 자동검색」 ·
      `DOMESTIC_LISTING` 「국내 목록 탐색」). 🔴 그것을 국내/해외 분할로 바꾸면
      **WU-130 계약이 FAIL** 한다(「머리 문구를 하나로 바꾸면 **출처 축이 사라진다**」)
      ⟹ 🔴 이번 범위에서 **바꾸지 않았다** · 바꾸려면 CPO 가 그 계약을 열어야 한다
   🔴🔴 **카드 높이·너비·이미지 크기·정렬·반응형은 CSS 축이고 마운트 DOM 으로 볼 수 없다**
      ⟹ **측정불가** · 🔴 스크린샷 없이는 ⒜구배포 ⒝다른영역 ⒞CSS 를 가를 수 없다
```

### B-12. 🟡 UIRD-2 — **STEP 1~2 완료 · 착수 전 CPO 판정 2건**(코드 0 · 다음 세션 진입점)

```
🔴🔴 **다음 세션은 여기서 «준비 없이» 이어간다 — 조사 다시 하지 않는다.**

🟢 **STEP 1 — 이미 충족된 것 셋**(코드 변경 불필요)
   ⒜ 후보 카드는 **단일 컴포넌트 · 단일 라벨 맵** — `GeminiTransientCandidates`
      (그 파일 :22 가 「국내/해외가 각자 라벨 맵을 들고 있다가 같은 판정이 화면마다
       다르게 보였던」 이력을 적어 뒀다 ⟹ 이미 통일됨). 🔴 **새 카드 만들지 않는다**
   ⒝ 후보 이미지 없음 칸이 **크기를 유지한다** — `h-24 w-full` + dashed border +
      `IMAGE_MISSING_TEXT`「이미지 없음」(:654~661) ⟹ 「레이아웃 유지」 요구 **충족**
   ⒞ 🇰🇷/🌎 가격 블록은 **같은 MarketBlock** (B-11 ③)

🔴 **STEP 2 — 실제 카드 정보 순서**(코드 실측 · CPO 고정 순서와 «다르다»)
   현재  ① `gt-verdict`(판정 :594) → ② 이미지쌍(:632) → ③ `gt-title`(:667)
         → ④ 링크+`domain`(:675) → ⑤ `gt-price`(:683)
   CPO   ① 이미지 → ② 상품명 → ③ 판매처·링크 → ④ 가격·통화 → ⑤ **동일상품 판정**
   ⟹ 🔴 **판정이 맨 앞 ↔ 맨 뒤** 로 정반대다. 나머지 ②~⑤ 는 **순서가 이미 맞다**

🔴🔴 **그래서 착수 전 CPO 판정이 «둘» 필요하다 — CTO 가 열지 않았다**
   ① **판정 배지를 맨 뒤로 옮기는 것** — 🔴 기존 계약과 충돌할 수 있다:
      `wu-132 B-2`「**판매 결론이 제목 바로 뒤에** 선다」 · WU-091 ③「행마다 판정 라벨」 ·
      `core-ux-rebuild-01-exposure-depth`(노출 깊이 순서 계약) ·
      그리고 :554 주석이 그 자리를 **CPO 결정으로** 적어 뒀다
      ⟹ 🔴 옮기면 그 계약들이 FAIL 한다. **가드를 풀지 않고** 하려면 CPO 가 그 계약을 갱신해야 한다
   ② **`NO IMAGE` 의 뜻** — 🔴 기존 계약은 「**대체 사진을 쓰지 않는다**」(:366·:629 ·
      「다른 상품 사진으로 메우면 판단 자체가 거짓이 된다」). 🟢 CPO 요구(레이아웃 유지)는
      **이미 충족**(⒝) ⟹ 「NO IMAGE 라는 **글자**」로 바꾸는 것인지, 현행 「이미지 없음」을
      유지하는 것인지 **판정 필요**(둘 다 대체 사진이 아니므로 계약과 충돌하지 않는다)

🟡 **CTO 가 찾은 «순수한» 결함 1건**(정책 무관 · 판정 불필요 · 다음 세션 1순위)
   `gt-origin-image`(:637~642)에 **대체 칸이 없다** — `src={originImageUrl ?? undefined}` ⟹
   원본 이미지가 null 이면 **깨진 `<img>`** 가 뜬다. 🔴 후보 쪽은 대체 칸이 있는데
   **원본 쪽만 없다** = 그 자체가 비대칭이다.
   🟢 고치는 법 — 후보 쪽과 **같은 모양**(`h-24 w-full` dashed + `IMAGE_MISSING_TEXT`)으로
      원본에도 분기를 둔다. 🔴 `onError` 로드 실패 처리도 **둘 다 없다**(같이 볼 것)

🟢🟢 **UIRD-2 STEP 3 구현 완료**(CPO 판정 ①② 2026-11-18 · 운영 2 파일)
```
① 판정 배지 위치 **변경 0**(CPO 판정 ① — 기존 계약 유지) · ②~⑤ 순서는 이미 CPO 고정 순서
② `IMAGE_MISSING_TEXT` 「이미지 없음」 → **「NO IMAGE」** · 🔴 대체 사진 금지 원칙 **그대로**
③ `IMAGE_BOX_CLASS` **신설** — 두 칸의 크기 규칙 owner 하나(사본 제거)
④ `cardImage()` **신설** — 원본·후보가 **같은 함수** · `onError` 포함 · URL 없으면 `<img>` 안 만듦
   🔴 고친 결함 — 전엔 원본이 `src={originImageUrl ?? undefined}` 로 **깨진 `<img>`** 를 그렸다
🔴🔴 **훅을 쓰지 않았다** — 이 파일은 **서버 모듈**(`run-domestic-price-check.ts`)도 import 한다
   ⟹ `"use client"` 를 붙이면 서버 그래프가 클라이언트 모듈을 **값으로** 끌어온다.
   🟢 그래서 `onError` 에서 **숨겨진 형제 노드를 드러내는** 최소 명령형 방식을 썼다
🟢 계약 **42/42**(wu-132 +U2-1~4) · UIRD-1 **11/11** · 음성대조 **M1·M2·M3 각 1F** → 바이트 복구
🟢 회귀 **510 files / 5,855 passed / 0 failed** · typecheck **0**
🔴 이미지 **6케이스 중 4는 DOM 확정 · 2(로딩 실패)는 «배선만»** — jsdom 이 이미지를 로드하지
   않아 행동 재현이 불가능하다 ⟹ 🔴 「6/6 검증」으로 적지 않는다
```

🔴🔴🔴 **작업트리 분리 — 다음 세션이 «이것만» 커밋한다**(CPO 명시 2026-11-18)
```
추적 수정 **19 = 사용자 15 + 내 4**(검산 일치)

🟢 **UIRD 변경 = 커밋 대상 4건**(이것만 `git add`)
   +112 -63  apps/admin/src/app/pipeline/commerce/MarketPriceComparison.tsx
   + 67 -24  apps/admin/src/app/pipeline/commerce/GeminiTransientCandidates.tsx
   +113 - 8  apps/admin/src/app/pipeline/commerce/__tests__/s5-wire-confidence-basis.test.ts
   + 69 - 0  apps/admin/src/app/api/price-history/_lib/__tests__/wu-132-mi-same-price-comparison.test.ts
   (+ 문서 `docs/CTO-SESSION-START.DRAFT.md` — 보조 자료)

🔴 **사용자 변경 15건 = 손대지 않는다** · 🔴 `git add .` **금지** · 🔴 섞어서 커밋 **금지**
🔴 배포 **미승인** — CPO 가 「실제 화면 확인 가능 상태 확보 후 함께 검토」로 보류했다
```

🔵🔵🔵 **다음 단계는 코드가 아니다 — «검증 환경 확보» 다**(CPO 확정)
```
🔴 지금 막는 것(실측) — `/pipeline` 리다이렉트 → 앱이 「**인증 설정이 준비되지 않아
   로그인할 수 없습니다**」. 로컬 `.env.local`·`packages/database/.env` 에
   `SUPABASE`/`ADMIN_` 키 **0건** · Vercel 프로젝트는 `ttaejyo` **하나**(staging 없음)
🟡 필요한 것 — ⒜ Supabase Staging(또는 읽기 전용 복제) ⒝ 그 환경의 ADMIN 로그인 자격증명
   ⒞ Vercel Preview 전용 env ⟹ **셋 중 하나라도 열리면** CTO 가 실제 화면 전후를 낸다
🔴 그 전까지 **추가 UI 개발은 중단** 이다 — CPO 가 명시했다
🔵 확인해야 할 넷 — ① 국내·해외 카드 같은 구조 ② NO IMAGE 표시 ③ 판단 근거 접힘 동작
   ④ 화면이 이전보다 간결해졌는가
```

---

## C. 다음 작업 인수인계

### C-1. 🔴 지금 CTO 가 할 코드 작업이 **없다**

🔵 **다음 스프린트는 CPO 작업지시서 대기 중이다**(CPO 통보 2026-11-18) —
방향은 **국내 동일상품 가격 매칭 정확도** 이고, 기존 **KIDS 검증 결과** 와 **보류된 국문 검색 A/B 결과** 를
**재사용** 한다. 🔴 목표는 **후보 수가 아니라 「확인된 SAME 의 정확도 + 가격 판단 품질」** 이다.
🔴 지시서가 오기 전에 CTO 가 그 범위를 **선제적으로 착수하지 않는다** · 🔴 재조사하지 않는다.

MI-LOCALE-LINK-01 은 **종료·보류** 다. 재개 조건 셋 중 하나가 실제로 마련될 때만 CPO 가 지시한다.

```
⒜ Production 과 분리된 Supabase Staging 확보
⒝ 별도 인증·DB 자격증명을 갖춘 검증 환경 확보
⒞ Production 배포 + 신규 스냅샷 생성에 대한 **CEO 의 명시적 사업 승인**
   🔴 ⒞ 는 기술 테스트가 아니라 **운영 데이터가 늘어나는 사업 결정** 이다
```

### 🟢🟢 B-13. UIRD-3 — 국내 이미지 결함 **배포 완료**(`d28d01c9` · CPO PASS 2026-11-18)

```
🔴🔴🔴 **원인(코드 좌표까지 확정)** — 수집도 정규화도 CSS 도 아니었다
   `GeminiTransientCandidates.tsx:557`  `const showImagePair = originImageUrl != null;`
   ⟹ prop 이 없으면 **이미지쌍 칸 자체가 생기지 않는다** ⟹ 실제 이미지도
      **`NO IMAGE` 도 «둘 다»** 사라진다(CEO 가 「NO IMAGE 도 안 보인다」고 한 그 기전)
   호출부 **8곳 중 3곳만** 전달했고 누락 5곳 —
      **`domesticListingRest`(국내 목록 탐색)** · `webSearchRest` · `webRest` ·
      `suppliedRest` · `weak`
   🟢 해외 자동검색(:3677)은 넘기고 있어서 **그쪽만 보였다**

🟢 **수정 = prop 전달뿐**(운영 1 파일 · 8/8 전달 검산) — 이미지 URL 생성 0 · 정규화 0 ·
   판정 0 · 가격 0 · CSS 0 · 기존 `cardImage()` 그대로

🔴🔴🔴 **이 트랙의 가장 중요한 교훈 — 계약으로 박았다**
   **「같은 컴포넌트를 쓴다」가 「같게 보인다」를 보장하지 않는다.**
   UIRD-2 는 컴포넌트 **안** 을 통일하고 계약 **42건이 PASS** 였는데, 호출부가 prop 을
   다르게 주어 **실제 화면은 비대칭** 이었다. 컴포넌트 안만 보는 계약은 그것을 못 본다.
   🟢 `UIRD-3 A-1` 이 **호출부 전수** 를 단언한다 — 한 곳만 빠져도 **그 구역 이름을 들어**
      FAIL 한다(주석 벗김 · 닫는 괄호까지만 본다). `A-2` 가 `showImagePair` 술어를 고정한다

🟢 음성대조 — M1(국내 구역 prop 제거) **「#5 evidence={domesticListingRest}」 지목 FAIL** ·
   M2(`showImagePair = true`) **2 FAIL** → 바이트 복구
🔴 `mi-022` 의 한 줄 앵커가 **내 변경을 잡았다** — 느슨하게 풀지 않고
   ⒜ 여전히 접힘 ⒝ prop 전달 **둘을 같이** 단언해 **강화** 했다
🟢 회귀 **510 files / 5,857 passed / 0 failed** · typecheck **0**

🔵 **건수 라벨 — CPO 판정: 현행 유지(코드 0)**
   8개 heading 이 **이미 전부 「후보」** 를 담는다(「🧭 국내 목록 탐색 **후보** 5건」) ·
   확정은 「**동일상품 확정** N곳」으로 **단어가 갈려 있다** ⟹ 「검토 후보」를 덧붙이면 중복
   🟡 **남은 CPO 판정 1건** — `evidence.length` 만 **URL 중복 제거가 없다**(나머지 셋은 URL 단위).
      🔴 집계 변경이라 **손대지 않았다** · CPO: 「실제 중복이 판단을 왜곡하는지 확인 후 별도 판단」

🔴 **측정불가** — 국내 후보의 `imageUrl` null 비율(운영 DB 접근 불가) ⟹ 수정 후에도
   **국내는 NO IMAGE 다수일 수 있다.** 🟢 그것은 **정상** 이다 — 전엔 「칸이 없다」였고
   이제는 **「없다고 말한다」** 다. 🔴 「칸이 사라지는 것」이 결함이었다(CPO 명시)
```

### 🔵 B-14. UIRD 트랙 **최종 상태** — 추가 개발 중단(CPO)

```
🟢 UIRD-1 배포 `ecff8848` — 설명성 접힘 3 → 「판단 근거」 1
🟢 UIRD-2 배포 `ecff8848` — `cardImage()` 하나 · `NO IMAGE` · 크기 상수 하나
🟢 UIRD-3 배포 `d28d01c9` — 호출부 8/8 prop 전달 + 전수 계약
🔴 **추가 UI 개발 중단** · 후보 카드 정보 이동(③)은 **보류 유지**
🔴 사용자 변경 **15건 보존**(한 줄도 안 건드렸다) · `git add .` 미사용
🔴 `mi-locale-link-01` **동결 유지** — 🔴 **main 에 머지하지 않는다**(CEO 사업 승인 전).
   배포 때 `git checkout -b uird-deploy-01 origin/main` 으로 **base 를 갈아** 그 2 커밋을 남겼다
   🔴🔴 그 브랜치에서 그냥 push 했으면 **동결 코드가 Production 에 같이 나갔다**

🟡 **남은 것은 CEO 화면 확인 하나다**
   `/pipeline → B226AC009 → 📊 시장 판매 판단 → 🧭 국내 목록 탐색 후보` 펼침
   ① 국내 후보에 **이미지 또는 NO IMAGE** 가 보이는가
   ② 해외와 **이미지 영역 크기·위치가 같은가**
   🔴 NO IMAGE 가 많은 것은 **정상** · **칸이 사라지는 것**이 결함이었다
```

### 🔵🔵🔵 B-15. **다음 작업 단위 — 사전 확정됨**(MI-CASE-ACCURACY-02 · 조사 1회 · 보고 1회)

> 🔵🔵🔵 **작업지시서 전문이 디스크에 있다 — `docs/WORKORDER-MI-CASE-ACCURACY-02.md`**
> (CPO 발행 2026-11-18). 🔴 **다음 세션은 그 파일을 열어 그대로 실행한다** — 대화는 전달되지 않는다.
> 🔴 그 안에 §2 재조사 금지 9항 · §5 금지 · §6 완료기준 10 · §7 보고양식 8절 ·
> §8 「이미 확인된 측정불가」가 들어 있다. 아래 B-15 는 그 요약이다.
> 🔴🔴 **새 정책 — 관세·부가세는 «판매자 입력 항목이 아니다»**: MI 선산출 → 판매자 수정 →
> 총원가·권장가·CASE 재계산. 판매자가 처음부터 입력해야 분석되는 구조는 **금지**.

```
🔴🔴 **CPO 운영 원칙(2026-11-18)** — 작업지시서 **하나 = 완료 보고 하나**.
   중간 보고 금지(예외: 데이터 손실 · 보안/Production 장애 · 가격·판정 정책 변경 ·
   승인 범위 밖 DB·스키마). 🔴 **착수 전에 용량을 판단** 하고 완결 못 할 범위는
   **처음부터 단위에서 제외** 한다. 🔴 매 단계 재승인 요구 금지.

🟢🟢 **다시 조사하지 않는다 — 이미 확정됨**
   ⒜ CASE owner  `computePriceRecommendation`(packages/pricing/src/price-recommendation.ts:120)
   ⒝ CASE 조건    **D** = `domesticBasis !== "EXACT" || domesticLowestPriceKrw == null`
                  **C** = `netProfitAt(marketPrice) <= 0` ⟹ 🟢 **추천가 `null`**(억지 추천 0)
                  A/B = 그 뒤 분기
   ⒞ 원가 owner   `packages/pricing/src/breakdown.ts:70`
                  **`landedCostKrw = costKrw + shippingKrw`** (상품가 + 배송비 **뿐**)
   ⒟ 수수료       `netProfitAt = priceKrw − landedCost − platformFeeKrwAt(priceKrw, fee)`
                  🟢 **이중 차감 없음**(landedCostKrw 가 수수료를 포함하지 않으므로)
   ⒠ 환율         `isRateEstimate` 면 **추천을 아예 만들지 않는다**(market-intelligence:956)
   ⒡ 🔴🔴 **관세·수입 부가세·기타비용은 CASE 원가에 «들어갈 경로가 없다»**
      `computeLandedCost` 의 `totalCostKrw`(misc·수수료 포함)는 **CASE 에 쓰이지 않는다** —
      쓰이는 것은 ⒞ 의 `landedCostKrw` 다 ⟹ `miscCostKrw` 에 관세를 넣어도 **CASE 에 반영 0**
      🔴 등급 **③ 미반영(경로 부재)** · 🔴 CTO 의 이전 「② 조건부」 보고는 **정정됐다**

🔵 **다음 단위에 «포함» 하는 것**(한 묶음 · 중간 보고 없이)
   ① GT 상품별 입력 여섯 확보 — `landedCostKrw` · `domesticBasis` ·
      `domesticLowestPriceKrw` · `brandMedianPriceKrw` · `expectedFeePercent` ·
      `minimum/targetMarginPercent`
      🟢 출처는 **기존 fixture 재사용** — `product-tab-composition.ts`(CASE_D_FACTS 계열) ·
         기존 GT · 이번 세션 B-7/B-8 의 측정분. 🔴 근거 없는 값은 **채우지 않는다**
   ② `computePriceRecommendation` **순수 함수 측정**(환율 HTTP 불필요 · 코드 변경 0)
   ③ 상품별 결과표 — marketCase · minimumPrice · targetPrice · referencePriceKrw ·
      competitiveBasis · 수수료 반영 순이익 · 판단 가능 여부
   ④ 분기 검증 — 🔴 **4-A(실제 GT 도달 CASE)** 와 **4-B(합성 입력 분기 동작)** 를
      **섞지 않는다** · 도달 못 한 CASE 는 **미측정** 으로 표시
   ⑤ 전체 회귀 + 최소 수정안(영향·비용 포함)

🔴 **단위에서 «처음부터 제외» 하는 것**(원칙 6)
   ⒜ 관세·부가세 **입력 구조 변경** — 가격 계산 정책이라 **CPO 결정 후** 에만
   ⒝ 실제 Production/DB 측정 — **인증 설정 없음**(구조적 측정불가)
   ⒞ UIRD-4 의 C·D(영역 매핑표 · 건수 재확인) — **별 단위**
   ⒟ B축(시장 기반 추천가) · threshold · 카테고리 — **금지 유지**

🔴 표현 규칙 — 「모든 상품이 CASE D」로 적지 않는다. 정확히는
   **「확인된 국내 가격 데이터에서는 D 조건이 우선 적용되어 A/B/C 를 실측할 수 없다」** ·
   그리고 🔴 **「거짓 추천을 막는다」 ≠ 「정확하다」**(CPO 정정 2건, 둘 다 수용)
```

### 🟢🟢 B-16. MI 계산 검증 기반 — **배포 완료**(`2ede5b1c` · CPO PASS 2026-11-18)

```
🟢 `buildRecommendationFromInput`(`_lib/recommendation-input.ts`) — **운영·테스트 공용 순수 진입점**
   운영 호출부가 그 함수를 쓰고 계약도 **같은 함수** 를 쓴다 ⟹ 테스트 전용 계산식 **0**
🟢 계약 5 신규 + 기존 2 강화(`mspr-1` · `sprint2-1` — 옛 직접 호출 부활 금지)
🟢 `MI_MINIMUM_MARGIN_PERCENT = 10` — 운영 하드코딩 값을 **값 그대로** 드러낸 것
🔴 불변 — 계산식 · CASE 조건 · 수수료·마진 정책 · 응답 스키마 · DB/권한 · 환율 게이트 **전부 0**

🔵🔵 **부수 성과 — fixture 거짓 기준을 계약으로 차단했다**
   `product-tab-composition.ts` 의 `recommendation` 은 **손으로 쓴 스텁** 이고
   `referencePriceKrw` 를 **84,459**(brandMedian 원값)로 적어 뒀다.
   운영은 `min(targetPrice, round(brandMedian × 0.95))` = **80,236** ⟹ **4,223원 차이**.
   🟢 `mi-case-06 A-2` 가 그 차이를 잠근다(스텁으로 되돌아가면 FAIL).

🔴🔴 **아직 «미완» 인 것 하나 — 실제 운영 `cost.landedCostKrw` 실측**
   열린 것은 **계산 경로** 이고 그 **입력값 자체는 DB 가 만든다** ⟹ 금액 정확도는 **미검증**.
   🔴 「MI 금액 정확도 검증 완료」로 적지 않는다.

🔴 **그리고 CTO 의 과거 서술을 정정한다** — 「Staging DB 확보만이 유일한 길」은 **과했다**(CPO 지적).
   🟡 고객 데이터에 닿지 않는 대안 셋(다음 세션 검토 대상 · 아직 어느 것도 채택 안 됨):
   ⒜ **합성 스냅샷** — `getSnapshot`/`getPriceHistory` 를 `vi.mock` 으로 갈아 **운영 계산부를
      그대로 통과**시킨다(실데이터 0 · DB 0). 🔴 단 「운영이 실제로 넣는 값」은 아니다
   ⒝ **운영 응답에 입력 에코 추가** — `recommendation` 옆에 그 **입력 객체를 같이 내보낸다**.
      🔴 응답 스키마 변경이라 CPO 승인 사안 · 🟢 민감정보 아님(금액·마진·basis 뿐)
   ⒞ **로그 한 줄** — `[MI-CASE-INPUT]` 로 Vercel 런타임 로그에 찍는다
      (메모 `vercel-runtime-logs-are-reachable` · 🔴 고객 식별자 금지)
   🔴 셋 다 **코드 변경** 이라 승인 전 착수 금지. 🟢 ⒝⒞ 가 「운영 실제값」에 가장 가깝다
```

### 🟢🟢🟢 B-17. MI 금액 정확도 — **CLOSED**(`1cab4a1a` · CPO 종료 2026-11-18)

```
🟢🟢 **임시 로그 제거 의무는 «이행 완료» 다 — 찾지 않는다.**
   Production `1cab4a1a` 에 `[MI-CASE-INPUT]` **0건** · `console.info` **0건**(실측).
   🔴 이 블록이 전에는 「제거해야 할 로그가 Production 에 있다」였다 — **지금은 거짓** 이므로 갱신했다.

🟢 **확보한 실제 운영 입력**(Vercel 런타임 로그 2회 · 14:44 · 14:46)
   landedCostKrw **95,443** · domesticBasis **COMPARISON**(check 직후) / **NONE**(재조회) ·
   domesticLowestPriceKrw 138,000 / null · brandMedianPriceKrw **null** ·
   targetMarginPercent **12** · expectedFeePercent **10** · currentSellingPriceKrw null

🟢 **재현 결과**(`buildRecommendationFromInput` 직접 호출)
   CASE **D** · minimumPrice **106,048** · targetPrice **108,458** · recommendedPrice **null**
   검산 95,443/0.90 = 106,048 · 95,443/0.88 = 108,458 ⟹ **오차 0**
   🟢 그 숫자는 `mi-case-06-pure-entry.test.ts` **머리 주석에 기록** 돼 있다(로그 없이 근거가 남는다)

🟢 **보존된 영구 자산** — `recommendation-input.ts`(순수 진입점) · 계약 **A-1~A-5**
   (fixture ×0.95 오차 차단 · 최소마진 10 · 배선 소스 앵커 · 순수성)
🟢 제거된 것 — 운영 `console.info` 블록 + 계약 B-1~B-4 (**같은 커밋** `1cab4a1a`)

🔴🔴 **과장 금지 — CPO 가 고정한 표현을 그대로 쓴다**
   🟢 계산 경로 · CASE D 실측 재현 · A/B/C/D 분기 · A/B 경계(targetPrice) — **완료**
   🔴 **실제 상품 표본 기반 전체 금액 정확도 — 미측정**(표본 1건 · CASE D 하나)
   🔴 **CASE A/B/C 의 실제 운영 입력 검증 — 미실시**(국내 `domesticBasis = EXACT` 가 필요)
   ⟹ 🔴 「MI 금액 정확도 N%」·「전체 상품 검증 완료」로 **적지 않는다**
🟡 이번 실측의 부수 사실 — 그 상품은 `brandMedianPriceKrw` 가 **null** 이라 CASE D 에서도
   **참고가격조차 만들 수 없었다**. 🟢 결함이 아니라 「국내 비교 근거가 없다」는 정직한 상태다.
```

### C-2. 재개할 때 지킬 것

```
🟢 두 커밋(`7b18c642` · `7b093ef4`)에서 **그대로 이어간다** — 조사·설계·계약을 다시 만들지 않는다
🔴 범위는 **B226AC009 하나**(`LOCALE_LINK_SCOPE`) — 다른 상품 확대 금지
🔴 CODE_ONLY_LINK 적용 금지 · 브랜드 등록부 확장 금지 · 국문 검색 재개 금지
🔴 품번 추출기 신규 연결 금지 · SAME 기준 변경 금지 · DB 백필 금지
```

### C-3. 수정 금지 파일

```
docs/START-HERE.md · docs/CEO-GT-LEDGER-2026-11-08.md · docs/STANDARD-V1.md
작업트리의 사용자 변경 14건 + 추적되지 않은 사용자 파일
  (`golf01-wire-page-chain.test.ts` 포함 — 그 테스트의 3건 실패는 **기존 실패** 이고 CTO 것이 아니다)
```

### C-4. 승인 대기

```
🟢 **종결** — 진입점 배치는 CPO 가 결정했다(START-HERE 유지 · 이 파일은 보조 · 아래 D 참조).
   🔴 그 선택지를 CEO 에게 다시 올리지 않는다
CEO  MI-LOCALE-LINK-01 운영 배포 및 신규 분석 실행(**사업 결정** · 유일한 미결 승인)
CEO  `docs/START-HERE.md` §0 수정 — 🔴 **승인 전까지 손대지 않는다**
```

---

## D. 🔴🔴 문서 체계 — **진입점이 넷이고 서로 다른 현재를 말한다**

| 문서 | 크기 | 수정일 | 자기 선언 | 말하는 「현재 WU」 |
|---|---:|---|---|---|
| `START-HERE.md` | **524K / 7,470줄** | 11-17 | 🟢 **공식 진입점**(CPO 유지 결정) | §NEXT SESSION 블록이 **11-07** 자 |
| `HANDOFF-NEXT-CTO.md` | 132K / 2,160줄 | 11-11 | 🟡 **과거 기록**(안내 추가됨 2026-11-18) | MI-UNIFIED-MARKET-PRICE-COMPARISON-1 |
| `CTO-HANDOVER-NEXT.md` | 44K / 603줄 | 11-07 | 🟡 **과거 기록**(안내 추가됨 2026-11-18) | MI 매칭 정확도 |
| `HANDOFF-P0-MI-ACCURACY-RECOVERY.md` | 120K / 1,897줄 | 11-17 | 🟢 「진입점이 **아니다**」 | — |
| `CLAUDE.md` §12 | — | — | 자동 로드 · 🔴 이번 작업에서 **수정 금지** | CORE-UX-SELLER-01 |

```
🔴 **진단(2026-11-18 조사)** — 위 넷이 각각 다른 WU 를 「현재」라고 말했고
   **어느 것도 실제 최신(MI-LOCALE-LINK-01)이 아니었다**
🟢 **조치** — 공식 진입점을 START-HERE 하나로 고정하고 과거 둘에 안내를 붙였다(D-1)
🔴 남은 사실 — START-HERE 는 520KB 이고 §NEXT SESSION 이 **11-07 자** 다.
   🔴 그 §0 갱신은 **CEO 승인 사안** 이라 이번에 손대지 않았다 ⟹ 최신 좌표는 이 문서 **B 절** 이다
🟢 HANDOFF-WU-*.md 39개와 ARCHIVE-CLOSED-WU.md(289K)는 **과거 기록** 으로 역할이 명확하다
```

### D-1. 🟢 **CPO 결정 (2026-11-18 · 종결 · 재논의 금지)**

| 쟁점 | 결정 |
|---|---|
| 공식 진입점 | 🟢 **`docs/START-HERE.md` 하나로 유지** |
| 이 파일 | 🟢 **보조 인수인계 자료로 유지** · 🔴 진입점 승격 **금지** |
| `HANDOFF-NEXT-CTO.md` | 🟢 과거 기록 안내 추가 **승인** (내용 삭제 0) |
| `CTO-HANDOVER-NEXT.md` | 🟢 과거 기록 안내 추가 **승인** (내용 삭제 0) |
| `CLAUDE.md` §12 | 🔴 **수정 금지** — 읽기·참조 관계 확인만 |
| `START-HERE.md` §0 | 🔴 **CEO 승인 전 수정 금지** |
| 보호 문서 | 🔴 **수정 금지** |

```
🔴 「진입점을 어디로 둘까」를 **다시 논의하지 않는다** — 끝난 결정이다
🟢 이 파일은 작업 종료마다 **B·C 두 영역만** 갱신한다(A 는 전략이 바뀔 때만)
🔴 START-HERE 와 이 문서가 다르면 **START-HERE 가 이긴다** · 차이는 판단하지 말고 보고한다
```

---

## E. 작업 종료 시 갱신 절차 (CTO 필수)

```
① 실제 변경사항·완료 결과 확인        ② git 브랜치·HEAD·원격·작업트리 확인
③ 테스트 결과와 **실패 항목** 기록      ④ 보호 문서 해시 + 사용자 변경 보존 확인
⑤ 확정된 결정과 보류 사항 갱신         ⑥ 다음 작업의 «정확한 시작 지점» 기록
⑦ 이 문서의 B·C 영역 갱신
🔴 작업이 끝났는데 이 문서가 이전 상태면 **그 작업은 완료가 아니다**
🔴 보호 문서는 승인 없이 갱신하지 않는다 — 권한이 불분명하면 변경 «전» 에 승인을 요청한다
```

## F. CTO 보고 형식 (고정)

```
① 현재 프로젝트 좌표  ② 이번 작업 목표  ③ 완료  ④ 미완료  ⑤ 변경 파일
⑥ 테스트·검증        ⑦ Git 상태       ⑧ 리스크·측정불가
⑨ CEO/CPO 승인 필요  ⑩ 다음 작업      ⑪ **인수인계 문서 갱신 여부**
```

---

## B-18. 🟢 CASE-01 **CPO 최종 종결** (2026-11-19 · 배포 `b6a9d1a4`)

🔴🔴 **다시 조사하지 않는다.** 상세 좌표는 메모리
`case-01-observation-base-is-reusable` 하나로 충분하다 — 다섯 유형 · 관측기 위치 ·
하니스 위치 · 영구 제약 셋 · 열지 않은 것 둘이 거기 있다.

```
🔴 확정   B226AC033 은 **MI 판정에서 탈락한 것이 아니다** — ② 수집에서 죽었다
          trenbe: 운영 CHROME_UA → HTTP 429 → limiter backoff → 10초 타임아웃 초과
          → TimeoutError → UNREACHABLE · MI 진입 후보 **0건** · MI 오류 증거 **0**
🟢 개선   실패 사유를 더는 삼키지 않는다(`[PLAIN-HTML-FAIL]`) ·
          주경로 탈락이 **host:reason**(형제 생산자와 같은 모양) ·
          임시 계측 `[CASE-01-INPUT]` **제거 완료**(코드 전수 0 · 되살아남 방지 계약 3)
🔴 유지   Trenbe 접근 제한 **현상 유지**(UA 변경·우회 금지 · `C-4` 가 잠근다) ·
          `status` union 무변경 · SAME 기준 무변경 · 화면 변경 0
🟡 부채   `donokids`/`shopbrand.html` 이 `PRODUCT_PAGE` 로 오통과(WU-073 · WU-052 HOLD)
          🔴 `NO_FACTS` 가 막아 «안전» 한 것이고 분류가 정상인 것은 아니다
🔴 금지   이번 성과를 **「국내 소싱 성공률 개선」으로 적지 않는다**(CPO 명시) —
          국내 상세 상품의 **일반화 검증은 아직 부족하다**
```

커밋 다섯 — `6ae85261` `698360ee` `f97c3e39` `f38c3350` `b6a9d1a4`.
typecheck **0** · 회귀 **515 files / 5,890 passed / 0 failed** · Production **200**.

### 🔵 다음 한 수 — **CTO 가 WU 를 만들지 않는다**

CPO 문장 그대로: 「**다음 신규 상품 사례부터** 개선을 이어간다.」 범위의 중심은
**MI 가 국내·해외 동일상품 가격 비교를 정확히 수행하는 것** 이고, 카테고리 확장·
기능 확대는 하지 않는다. 🔴 새 상품에서 문제가 나오면 **CASE-01 조사를 되풀이하지
말고** 위 다섯 유형으로 갈라 **기존 관측기·하니스를 재사용** 한다.

---

## B-19. 🔵 범용 MI 개선 Sprint — **단계 1~3 확정 · 다음 세션은 «구현부터»**(2026-11-19)

🔴🔴 **조사를 다시 하지 않는다.** CPO 작업지시서 §5 의 1~3(기존 확인 · 반복 실패 식별 ·
개선 지점 선정)이 **끝났다**. 다음 세션은 **4(구현)부터** 들어간다.

### ① 반복 실패 유형 — **식별 완료**(분모 명시)

```
A군 22 GET 실측(preserved/a22-candidate-descriptions.json)
  FETCH_FAIL      14건 · **12 호스트**   HTTP_429 **12** · TimeoutError 2   ← 🔴 반복 확정
  NO_DESCRIPTION   1건 ·  1 호스트                                          ← 🟡 단일 ⟹ 패스
  OK               7건 ·  7 호스트
🔴 CPO 기준 — 「한 사이트만 실패 → 패스 · **여러 사이트 반복 → 범용 개선**」 ⟹ 승격 대상은 FETCH_FAIL
🔴 **429 를 «우회» 하지 않는다**(CPO 확정 · UA 변경·재시도 변경 금지). 개선 축은 **분류의 정직성** 이다
```

### ② 개선 지점 — **CPO 우선순위 5 + 6**

```
현재  `ProductUrlFactsStatus = OK | NOT_PRODUCT_URL | UNREACHABLE | NO_FACTS | REDIRECTED_AWAY`
🔴 `UNREACHABLE` 하나가 **「접근 거부(4xx)」와 「닿지 못함(timeout/DNS)」을 뭉갠다**
   ⟹ 파이프라인·화면이 「그 판매처는 우리를 막는다」와 「우리가 못 닿았다」를 **구분하지 못한다**
🟢🟢 그 사유는 **이미 계산돼 있다** — `recordPlainHtmlFailure`(shopify-product-json.ts)가
   `HTTP_<status>` · undici `cause.code` · `name` 을 만들어 **로그로만** 내보낸다
   ⟹ 🟢 **값을 만드는 작업이 아니라 «버리는 것을 멈추는» 작업** 이다(§4-D · WU-137 과 같은 모양)
```

### ③ 설계(확정) — 🔴 **union 을 바꾸지 않는다**

```
⒜ `fetchPlainHtmlWithFinalUrlDetailed(url): {ok:true,html,finalUrl} | {ok:false,reason}` 신설
   🟢 기존 `fetchPlainHtmlWithFinalUrl` 은 그것에 **위임하는 껍데기** 로 남긴다 —
      **WU-075 가 `fetchPlainHtml` 에 쓴 바로 그 패턴**(fetch 규칙 owner 를 둘로 가르지 않는다)
   🔴 기존 호출부 변경 **0**(반환 모양이 그대로다)
⒝ `ProductUrlFactsResult` 에 **옵셔널** `failureReason?: string` 추가
   🔴 **union 값을 추가하지 않는다** ⟹ 두 drop union 과 소비자 **영향 0**
   🟢 `htmlPath` 가 detailed 를 써서 `UNREACHABLE` 에 사유를 **같이** 싣는다
⒞ 🔴 재시도·타임아웃·UA **불변** · SAME 기준 **불변** · 가격 **불변** · 운영 연결 **0**
```

### ④ 다음 세션 실행 순서(그대로 따른다)

```
1 ⒜⒝ 구현(운영 2파일 · 새 fetcher 0)
2 계약 — 사유가 «반환» 된다 · union 미변경 · 429↔timeout 구분 · UA 고정(CASE-01 `C-4` 재사용)
3 음성 대조 — 사유 제거 / union 확장 / 껍데기 제거 각 FAIL 확인 → 바이트 복구
4 회귀 교차검증 — 🟢 기존 정상 사례로: Shopify(`bobochoses` SHOPIFY_JSON) ·
  비-Shopify(`donokids` PLAIN_HTML 200) · 404(`miniboutique`) · 429(A군 12 호스트)
5 typecheck + 전체 회귀(기준선 **518 files / 5,907 passed / 0 failed**)
6 배포 → Production 확인 → 완료 보고 **1회**
🔴 CEO 화면 작업 없음 · 새 승인 없음 — 전부 승인된 범위 안이다
```

🔴 **영구 금지 재확인** — Smallable 개별 개선 · 사이트 전용 어댑터 · 접근 우회 ·
SAME 완화 · 상세설명으로 DIFFERENT→SAME · verdict 재계산 · 추출 가드 기본 ON ·
SPRINT 3 · KIDS 전 상품군 확대 · 보호 문서/사용자 파일 변경.

## §B-20 범용 MI 개선 Sprint — **단계 4~9 완료 · 배포 `0cadf4ce`** (2026-11-19)

🟢 §B-19 의 설계대로 **조사 없이 구현부터** 들어가 끝까지 갔다. 다음 세션은 이 절만 읽으면 된다.

```
구현   fetchPlainHtmlWithFinalUrlDetailed  → {ok:true,html,finalUrl} | {ok:false,reason}
       fetchPlainHtmlWithFinalUrl          → **위임 껍데기**(WU-075 패턴 · 호출부 변경 0)
       ProductUrlFactsResult.failureReason?: string   🔴 status union **다섯 그대로**
계약   comparison-search/__tests__/mi-fetch-failure-reason.test.ts — **17건 · 네트워크 0**
       (운영 limiter 대역 → 429 · 404 · TimeoutError · ENOTFOUND · UNKNOWN_ERROR ·
        성공엔 사유 없음 · **Shopify→HTML 폴백** httpCalls 2 · union 다섯 · 껍데기 위임만 ·
        UA 하나·고정 · **호스트 리터럴 0**)
음성   M1 사유 제거 6F · M2 union 확장 2F · M3 껍데기에 규칙 복제 1F · M4 사유로 분기 2F
       → 전부 **바이트 복구** · 17 passed
갱신   `case-01` **C-5** 가 FAIL 로 뒤집혔다(실패 반환이 `null` → `{ok:false}`) ⟹
       느슨하게 하지 않고 `ok:false` **두 번** + 껍데기 `null` 을 **같이** 잠갔다
검증   typecheck 0 · 회귀 **914 files / 11,358 passed / 0 failed** · Production 200 · /pipeline 307
```

🔴 **별건 FAIL 2파일은 사용자 untracked 테스트다 — 손대지 않았다**:
`golf01-wire-page-chain.test.ts`(사용자 수정 `comparison/search/route.ts` 의존) ·
`kids-locale-link-integration-design.test.ts`(**동결 트랙** · `locale-brand-link` 모듈 부재).
🟢 둘 다 내 변경 파일을 **참조하지 않는다**(grep 0) ⟹ 구조적 비인과.

🔴 **다음 세션이 열지 않을 것** — 429 우회(UA 변경·회전) · 재시도/타임아웃 상향 ·
사유로 분기 · `UNREACHABLE` 쪼개기 · 사이트 전용 어댑터. 🟡 남은 범용 축은
**C 후보 품질 평가** 와 **A 상품 식별 정확도** 이고 **CPO 가 지정** 한다.

## §B-21 C 후보 품질 평가 — **완료 · 개선 승격 0** (2026-11-19 · 배포 `271d47da`)

🔴 **운영 코드 변경 0 · HTTP 0 · 판정 재계산 0 · DB 0.** 산출
`preserved/c-candidate-quality.json` · 하니스 `c-candidate-quality.test.ts`(계약 5).

```
분모 B군 **109쌍**(기존 실측 조인 · 운영 classifyUrlShape + confirmBrandCodeInEvidence)
① 상품페이지 적합성  PRODUCT_PAGE 109/109   🔴 **선별 편향**(이미 쌍이 된 후보 분모)
② 사실 충분성        제목 109/109 · 설명문 98 · 품번 추출 **25** / 확인 **6** / 합집합 **26**
③ 근거 품질          brand UNKNOWN 83 · code UNKNOWN 85 · name MATCH 45 · NO_OVERLAP 20
품질 ↔ 식별   QUALITY_NO_CODE **83 · 17 호스트**(반복 확정) · IDENTITY_AXIS 26 · 9 호스트
              QUALITY_SHAPE 0 · QUALITY_NO_TITLE 0 · GT 35(SAME 20 · DIFFERENT 15)
```

🔴🔴 **승격할 개선이 없다** — 유일한 레버(제목 토큰 → 후보 `brandModelCode` 승격)는
**실측 REJECT**(판매처 SKU 동반 승격 → false SAME · 되돌린 커밋 `32a0f374` · 재시도 방지
계약 11건). 🟢 「안전한 레버가 없다」도 정당한 결론이다.

🟡 **다음 = A 상품 식별 정확도** 이고 그 분모는 **이 평가가 가른 `IDENTITY_AXIS` 26쌍 ·
9 호스트** 다. 🔴 A 실측은 **재조사하지 않는다** — `MI-KIDS-CODE-NAME-CAUSES.json` ·
`MI-KIDS-TRIAGE-FEASIBILITY.json` · `MI-B16-FULLTEXT-EXTRACTION.json` · `preserved/a07-*` 을
**근거로 재사용** 한다. 🔴 금지 그대로 — SAME 기준 완화 · 상세설명만으로 DIFFERENT→SAME ·
접근 우회 · verdict 재계산 · 사이트 전용 어댑터.

## §B-22 A 식별 정확도 평가 — **완료 · 개선 승격 0** (2026-11-19 · 배포 `58f3266b`)

🔴 운영 변경 0 · HTTP 0 · verdict 재계산 0. 산출 `preserved/a-identity-axis.json` ·
하니스 `a-identity-axis.test.ts`(계약 **6**). 분모 **26쌍 · 9 호스트**(GT 13).

```
축    modelCode MATCH 17 · MISMATCH 7 · UNKNOWN 2
      productName MATCH 12 · MISMATCH 1 · **UNKNOWN 13**
      brand MATCH 16 · UNKNOWN 10        🟢 비MATCH 의 지배 성분은 **UNKNOWN**
GT    SAME 9 → modelCode MATCH 8/9        🟢 품번 축이 SAME 을 잘 지지한다
      DIFFERENT 3 → MISMATCH 2 · **MATCH 1** · 3건 전부 name·brand UNKNOWN
레버  ① 제목토큰 승격 REJECT(기존) ② **상세설명 품번 REJECT(신규 측정 · GT DIFFERENT 2 동반)**
      ③ 선행문자 없는 품번 **0쌍** ④ 원상품 복구 **효과 0(이미 측정)**
```

🔴🔴 **A-5 가 결론을 기계로 잠갔다** — `opensGtDifferent` 가 0 이 되면 **FAIL** 로 뒤집혀
CPO 재판정으로 간다. 🟢 다음 세션이 **같은 레버를 다시 제안할 수 없다**(산출물
`closedLevers` 가 넷을 들고 있다).

🔵 **좌표** — ⑤⑥ CLOSED → C CLOSED(승격 0) → **A CLOSED(승격 0)**.
🟡 다음 범위는 **CPO 가 지정** 한다. 🔴 CTO 가 선제적으로 WU 를 만들지 않는다.

## §B-23 ③ KIDS MI 흐름 검증 — **완료** (2026-11-19 · 배포 `f3d80979`)

🔴 검증 전용(운영 0 · HTTP 0 · 동결 0). 산출 `preserved/kids-flow-verification.json` ·
하니스 `kids-flow-verification.test.ts`(계약 **7**).

```
① MI 입력   PARTIAL  경계 계약 O · 🔴 AI Search = 사용자 브라우저 ⟹ **구조적 측정불가**
② 후보 수집 PARTIAL  사유 반환 계약 17 + 실측 22→8→7 · 🔴 **Production API 미검증**
③ 식별 근거 VERIFIED 109행 전수(품질 83 ↔ 식별 26) · 🔴 선별 편향 명시
④ 판정      PARTIAL  축 26 · A군 baseline 33/33 · 🔴 그 26 안에 **재현실패 5쌍**
⑤ 가격      FROZEN_NOT_MEASURED  🔴 열지 않았다
```

🔴🔴 **다음 세션이 반드시 알아야 할 셋**:
```
① 분모 축 — 「109쌍」이 아니다. **행 109 · 고유 쌍 103 · 고유 후보 95**(집계는 행 단위)
② 🔴 **낡은 GT** — `fixtures/mi-reeval-03-keyword-input.json` 의 `humanGt` 는 **대체 전**
   라벨이다(최신 CEO 판정이 2건 갱신 · `gtSuperseded`). 🟢 A 거부 근거와 **겹침 0**(F-7)
   🟡 최신 truth 재집계 = **CPO 판정 사안**
③ 🟡 **A④ 분모 7 은 과소** — A군 후보 6곳이 B군 fixture 에 설명문을 갖고 있고 A22 확보는 2
   ⟹ **새 HTTP 0 으로 최대 +4**. 🔴 A 결론(승격 0)은 **흔들리지 않는다**
```

🔴 조인 규칙 — `a22` 는 **`pairId`** 로 조인한다(URL 칸이 없다) · C·A 산출물은 이제
**`originCode`** 를 들고 있다(없을 때 재조인이 전건 `undefined` 가 됐다).

🔵 **좌표** — ⑤⑥ CLOSED → C CLOSED(승격 0) → A CLOSED(승격 0) → **③ 흐름 검증 완료**.
🟡 다음 범위는 **CPO 지정**. 🔴 CTO 가 선제적으로 WU 를 만들지 않는다.

## §B-24 ① 최신 GT 재집계 — **완료** (2026-11-19 · 배포 `0cb64975`)

🔴 기준 truth 정합성 작업(정확도 개선 아님) · HTTP 0 · verdict 0 · **덮어쓰기 0**.
산출 `preserved/gt-latest-recount.json` · 하니스 `gt-latest-recount.test.ts`(계약 5).

```
적용  core-2m-ceo-visual-gt(`gtSuperseded: true` 표시 행 · origin **B226AC009** 둘 다)
      bornyesterdaykids.com SAME → UNCERTAIN · m.luxboy.com DIFFERENT → **SAME**
바뀜  C GT 분모 35 → **34** · C DIFFERENT 15 → **14** · C SAME 20 → 20(구성 이동 9→10)
      A SAME 9 → **10**(code MATCH 8→9) · A DIFFERENT **3 → 2**
      🟢🟢 품번 반례(GT DIFFERENT + code MATCH) **1 → 0**
안 바뀜 C 버킷 83/26 · A 레버② pairs 20 · hosts 4 · opensGtDifferent **2** ·
      거부 근거 cemarose.ca · tinyapple.net · 교집합 0 ⟹ **승격 0 불변**
```

🔴 조인 규칙(다음 세션 필수) — 갱신 행은 **URL 유일성을 증명한 뒤에만** 재집계한다 ·
A 는 **`originCode`** 로 쌍 축 조인한다 · 「조인 0」을 **안전으로 읽지 않는다**(G-5 1차
탐지가 상수 경로를 못 봐 0 이 나왔고 그것은 **탐지 실패** 였다).

🔵 **좌표** — ⑤⑥ → C → A → ③ → **① 재집계 완료**.
🟡 다음 = **② A④ 분모 7 → 최대 11 보강**(새 HTTP 0)이고 **CPO 가 판단** 한다.
🔴 두 작업을 한꺼번에 하지 않는다(CPO 명시).

## §B-25 ② A④ 분모 보강 — **완료 7 → 11** (2026-11-19 · 배포 `e4566354`)

🔴 평가 전용 · HTTP 0 · 덮어쓰기 0. 산출 `preserved/a11-fulltext-axes-boosted.json` ·
하니스 `a11-fulltext-axes-boosted.test.ts`(계약 4 · 축 로직은 **기존 모듈 그대로**).

```
분모  A군 33 · 기존 **7**(a22 라이브) · 추가 후보 4 · **실제 추가 4** · 합 **11**
조인  pairId → originUrl → wu-059 origins[S*] · 추가분은 **쌍 유일성 증명 + 설명문 고유 1**
      🔴 `pairId`·`originS`·`originCode`·`rows` 를 **산출물에 보존** 했다
🔴🔴 **최신 GT 정정** — a07 의 `{SAME 4 · DIFFERENT 3}` 은 **과거 라벨** 이었다
      최신: **SAME 2 · DIFFERENT 3 · 라벨없음 6**(기존 7쌍 중 **4건이 최신 판정 없음**)
축    DESIGN **MATCH 11/11** · GT DIFFERENT 3 → DESIGN 3/3 · PRODUCT_TYPE 3/3 **MATCH**
      ⟹ 🔴 **상세설명 축은 DIFFERENT 를 가르지 못한다**(7→11 에서도 동일) · 가드 ON/OFF **0**
🔴 위험 1건  `C22 / donokids` GT DIFFERENT + MODEL_CODE **MATCH** · 🟢 PRINT_PATTERN 이 막는다
      🔴 ①의 「반례 1→0」과 **분모가 다르다**(IDENTITY_AXIS 26 ↔ 양쪽원문 11) — 섞지 않는다
```

🔵 **좌표** — ⑤⑥ → C → A → ③ → ① → **② 완료**. 🟡 다음 범위는 **CPO 지정**.
🔴 상세설명 품번 레버 거부는 **A 26쌍** 근거이고 이 보강이 건드리지 않았다(완화 0).

## §B-26 로드맵 ② 핵심 식별 전략 검증·안정화 — **완료** (2026-11-19 · 배포 `178353af`)

🔴 평가 전용 · HTTP 0 · 운영 변경 0 · **가드 복제 0**. 산출
`preserved/kids-identity-strategy-stabilization.json` · 하니스 계약 **5**.

```
전략(운영 소스 실측)  축 **9** · SAME_MIN_AXES **5** · PRESUMED **3**
   🟢 SAME 정원 제외 **둘** — `IMAGE` **그리고 1점 `TITLE`**(기전 = 축 배열 필터)
   🔴 주석의 `coreAxisCount` 는 **코드에 없는 낡은 이름** — 주석을 근거로 쓰면 틀린다
③ UNKNOWN  🟢🟢 「모른다 ↔ 달랐다」가 **집합으로 분리** 됨(관찰된차이 9) ·
   `BRAND_UNCONFIRMED`·`COLOR_VARIANT` 는 **보류**
   🔴🔴 **어휘 ≠ 발화** — `SIZE_SYSTEM` 은 집합에 있는데 **push 0**(WU-045 비차단 흔적)
④ 거부 레버 **8종 소유자 계약 실재** 확인(복제 0)
⑤ 안정화 가능 **5** ↔ 추가 근거 필요 **6**
```

🔴 **가드 교훈** — 「쓰기 호출 ＋ 파일명 언급」식 탐지는 **읽기만 하는 하니스를 거짓 양성**
으로 잡는다(①의 G-5 가 그래서 FAIL 했다). 🟢 **상수를 따라가는** 형태로 정밀화했다.

🔵 **좌표** — ⑤⑥ → C → A → ③ → ① → ② → **로드맵② 완료**.
🔴🔴 **안전한 범용 개선 레버는 여기서도 없었다** — C·A 결론 유지 · 운영 변경 0.
🟡 다음 범위는 **CPO 지정**. 🔴 CTO 가 선제적으로 WU 를 만들지 않는다.

## §B-27 KIDS MI 통합 안정화 **진입 판정 — 불가** (2026-11-19 · 배포 `b79fe226`)

🔴 평가 전용 · HTTP 0 · 운영 변경 0. 산출 `preserved/kids-mi-stabilization-entry.json` ·
하니스 `kids-mi-stabilization-entry.test.ts`(계약 4 · **기준 수 8 을 잠금**).

```
판정  **CANNOT_ENTER_YET** — 충족 **4** / 미충족 **4**
🟢 충족(전부 CTO 축)  단계표·한계 기록 / 거부 레버 8종 소유자 / 축 9·문턱 5/3 /
                     안전성 비완화(`opensGtDifferent` 2)
🔴 미충족 4          G5 Production verdict 분포(**CEO**) · G6 가격 측정(**동결 정책**) ·
                     G7 GT 라벨 분모(**CEO** · 13/26 · 최신 5/11) ·
                     G8 baseline 재현(**CTO** · 재현실패 5쌍)
경로  VERIFIED 1(③) · PARTIAL 3(①②④) · FROZEN_NOT_MEASURED 1(⑤)
```

🔴🔴 **CTO 가 열 수 있는 선행 조건은 «하나»** 다 — 재현실패 5쌍 원인 구분(기존 하니스 ·
재조사 0 · 🔴 범위는 **CPO 지정**). 나머지는 **CEO 1회 수행 2 · CEO 라벨 1 · 동결 1**.

🔴 「대체로 충족」을 진입으로 읽지 않는다 — 미충족이 하나라도 있으면 진입하지 않는다.
🔵 **좌표** — ⑤⑥ → C → A → ③ → ① → ② → 로드맵② → **진입 판정 완료(불가)**.

## §B-28 G8 baseline 미재현 5쌍 원인 구분 — **확정 4 / UNKNOWN 1** (2026-11-19 · `bf0cee1d`)

🔴 평가 전용 · HTTP 0 · **DB 0** · 덮어쓰기 0. 산출 `preserved/g8-baseline-cause.json` ·
하니스 `g8-baseline-not-reproduced-cause.test.ts`(계약 4).

```
🟢🟢 **이미 분류가 있었다** — `docs/MI-KIDS-BASELINE-REPRO-13.json`
     (`INPUT_MISSING` 11 · `CONNECT_FAIL` 2) + `kids-baseline-repro-contract.test.ts`
5쌍  전부 원상품 **B226AC009** · 🔴 조인은 **URL 축**(도메인은 `www.` 로 어긋난다)
확정 INPUT_MISSING **3**(biskuit · junioredition ×2) · CONNECT_FAIL **1**(tinyapple)
미확정 `m.luxboy.com` **UNKNOWN** — 13 집합은 「GT SAME + 미재현」이고 그 시점 GT 가
     DIFFERENT 였다(①에서 SAME 으로 갱신 · 그 산출물은 갱신 전 분모) · 확정엔 DB 실측 필요
```

🔴🔴 **원인의 «성질»** — 실행 실패가 아니라 **입력 부재** 다. `candidate_reviews` 는 설계상
`system_*` 와 `human_verdict` 가 **서로 덮지 않는다**(WU-131) ⟹ **GT 시딩 행에는 baseline 이
구조적으로 없다**. 🔴 그러므로 G8 을 「재현이 전건」으로 두면 **구조적으로 충족 불가** 일 수
있다 — **기준 재정의는 CPO 판정 사안**(CTO 가 바꾸지 않았다).

🔴 **G8 미충족 유지** · 🟡 부수 발견 — `candidateDomain` 공백 kw **5/109**(A 1건) ·
호스트 **수는 불변 9** · 🔴 이름 목록은 **URL 로 다시 뽑아야** 한다.

🔵 **좌표** — … → 진입판정(CANNOT_ENTER_YET) → **G8 원인 구분 완료**.
🟡 다음 = **재진입 판정**(CPO) · G5·G7 은 CEO · G6 가격 동결 유지.

## §B-29 G8 보완 — 조인 축·호스트 집계 정합성 (2026-11-19 · 배포 `977678a8`)

🔴 보완 전용 · HTTP 0 · **DB 0** · 분류 변경 **0건** · 덮어쓰기 0.
산출 `preserved/g8-join-host-integrity.json` · 하니스 계약 **11**.

```
A 조인  🟢 REPRO-13 키 = **(candidate_url, origin_code)** · 호스트 아님(합쳐짐 0)
        🔴 도메인 축은 어긋난다(`junioredition.com` ↔ `www.junioredition.com`)
        🔴🔴 **끊긴 자리** = `BASELINE_NOT_REPRODUCED` 생산지 입력이
           **`os.tmpdir()/mi-url-evidence/step1-targets.json`**(리포 밖·부재)
           ⟹ 코드로 재현 불가 · 연결 가능성은 **REPRO-13 의 DB 실측** 으로만 성립
B 호스트 🔴🔴 **③ 보고 정정** — 「9 = 9 ⟹ 영향 0」은 불완전 · **정규화 8** 이 유효 호스트
        null 5/109 · 전건 URL 에서 추출 가능(추출불가 0) · B군 109 = 도메인 24 / URL 26 / 정규화 25
        🔴 규칙: 「호스트 수」엔 **축을 같이 적는다**
C 계약  UNKNOWN 보존 · GT 갱신 소급 변경 금지 · 분모 13↔5 혼동 금지(겹침 4)
```

🔴 **CTO 판단 = G8 기준 «부분 충족»**(전체 충족 선언은 CPO) · 🔴 G5·G7 CEO · G6 가격 동결.
🔵 **좌표** — … → G8 원인 구분 → **G8 보완 완료**. 🟡 다음 = CPO 재진입 판정.

## §B-30 범용 시장 데이터 확보 역량 평가 — **후보 4 · 구현 0** (2026-11-19 · `25c33af7`)

🔴 평가 전용 · 구현 0 · HTTP 0 · DB 0 · **G6 동결 유지** · 덮어쓰기 0.
산출 `preserved/kids-mi-universal-readiness.json` · 하니스 계약 **8**.

```
범용 문제 **5**  P1 후보 품번 부재(83 · **17 호스트**) · P2 수집 접근 제한(**12 호스트**) ·
                P3 식별 축 **UNKNOWN 지배** · P4 산출물 조인 키 소실 · P5 라벨 truth 혼재
사이트 한정 **1** 설명문 부재 1건·1호스트 ⟹ **패스**(승격 0) · 분류 불가 **2**
후보 **4**      C1 조인키·호스트 축 표준화(동결 무충돌 · 근거 충분) ·
                C2 실패 사유 **운영 발화** 확인(CEO 1회 = G5 와 동일 작업) ·
                C3 후보측 식별 정보 확보(🔴 **거부 레버 충돌** + GT 보강 필요) ·
                C4 가격 부족 상태 표현(🔴 **G6 동결 충돌**)
   🔴 **지금 구현 가능한 것은 0** · 🟢 계약이 범용 후보에 **사이트 어휘 0** 을 잠근다
가격 구조  🟢 동일↔유사 **구분됨**(금액 자격 = SAME+PRESUMED_SAME) · 표시 owner 하나 ·
          단일 FX(없으면 null) · basis SINGLE↔RANGE · 부족 상태 어휘 O
   🟡 **자동 가격 결정을 「0」으로 단정하지 않는다** — 추천가 **칸은 있다**(원가축 A ·
      근거 없으면 null) · 시장 평균으로 「적정가」를 만드는 구조는 **없다**
```

🔵 **좌표** — … → G8 보완 → **범용성 평가 완료**. 🟡 다음 = **CPO 가 후보 승인/우선순위 결정**.
🔴 진입은 **CANNOT_ENTER_YET 불변**(G5·G7 CEO · G6 동결 · G8 부분).

## §B-31 🔵🔵🔵 **평가 트랙 종료 — CPO 판정 접수**(2026-11-19 · 코드 변경 0)

```
평가 작업  **승인** · 구현  **승인 보류**
C1 조인키·호스트 축 표준화   🟢 승인 가능 — **보완 결과 유지 · 추가 구현은 별도 승인**
C2 실패 사유 운영 발화       🟡 **CEO 확인 필요** — G5 실제 상품 분석과 **통합**(한 번에)
C3 후보측 식별 정보 확보     🔴 **보류** — 거부 레버를 **다시 시도하지 않는다**
                            (83건은 숫자다 · GT·안전성 근거 없이 완화 금지)
C4 가격 부족 상태 표현       🔴 **동결** — **G6 해제 전 변경 금지**
진입                        🔴 **CANNOT_ENTER_YET 유지**(G1~G4 충족 · G5~G8 현상 유지)
G8                          🔴 **개별 사이트 문제로 확대하지 않는다** — `m.luxboy.com` UNKNOWN 은
                            **평가의 증거 한계** 이고 제품 장애물이 아니다
```

🔴🔴 **CTO 금지(현행)** — C1~C4 추가 구현 · 특정 사이트 조사 · G6 동결 해제 ·
기존 산출물 변경 · 새 WU 생성 · **G5·G7 의 CEO 확인을 대신하기**.

🔵🔵 **CPO 가 고정한 제품 원칙 하나** — 「**원가 역산 추천가(A)** 와 **시장 참고 가격(B)** 은
서로 다른 기능이고 **화면에서 혼동시키면 안 된다**. 셀러가 시장 가격을 참고해 **직접 결정**한다.」
🟢 메모 `recommended-price-is-cost-based-a-not-market-b` 에 코드 앵커와 함께 고정했다.

🟡 **다음은 CEO 확인 1회** — 실제 상품 하나에서 ① Production verdict 분포 ② 수집 실패 사유
발화를 **같은 실행으로** 확인한다(조사 두 번 하지 않는다). 🔴 **CTO 가 요청하지 않는다**(CPO 전달).
🔵 그 뒤 CPO 가 남은 CEO 확인 조건을 정리하고 **진입 여부를 다시 판정** 한다.

## §B-32 🔵🔵🔵 국내 후보 0건 — **발견 경로 범용 분석**(2026-11-19 · `fc4165e9` · 구현 0)

🔴 **문제 정의 고정** — 「국내에 상품이 없다」 ≠ 「우리가 후보로 확보하지 못했다」.
산출 `preserved/domestic-discovery-gap.json` · 하니스 계약 **6**.

```
입구 전수  일시 5(__url_candidates__ · __gemini_discovery__ · __overseas_auto__ ·
          __domestic_listing__ · __web_search__) + 등록부 searchDomesticShops
범용 4  U1 등록부는 **요청을 안 보낸다**(전략 ≠ AUTO_* 또는 **어댑터 부재** · 26/34)
           🔴 해결이 **어댑터 추가로 수렴** ⟹ **금지 축**
        U2 **국내 질의 설계**(사이트 무관 · 범용) ← 🟡 승인 후보 ②
        U3 🔴🔴 **상품 상태 축 없음**(일반↔리퍼↔중고 · 운영 owner 셋에 어휘 0)
           ← 🟡 승인 후보 **①**(후보를 늘리기 «전» 에 정해야 한다)
        U4 동일 플랫폼 **중복 입점** 축 없음(플랫폼 축 존재는 **미확인**)
정책 2  P1 포털·오픈마켓 = **약관 금지**(`NOT_AVAILABLE` · 술어 owner `isCollectionBlocked`
           하나를 AI 경로·URL 풀이 같이 쓴다) ⟹ 🔴 **「발견 실패」로 세면 거짓**
        P2 가격 축 **G6 동결**(리퍼/일반 분리 **표시** 도 걸린다)
측정불가 3  등록부 상태(DB) · 그 실행의 실제 국내 질의(`searchRun.search.query` · CEO) ·
           리퍼가 실제로 섞였는지(G6)
```

🔴 **교훈 둘** — ⒜ 정책 게이트를 **주석으로 확인하면 틀린다**(bare 에 글자가 없었다 ·
실제는 `isCollectionBlocked(`·`notAvailableDomains`) ⒝ 금지 목록이 **내 설명 문장을 잡는다**
(자기참조 6번째 ⟹ 과녁을 **어댑터 «등록»** 으로 옮겼다).

🔵 **좌표** — … 평가 트랙 종료 → **국내 발견 경로 분석 완료(구현 0)**.
🟡 다음 = **CPO 가 U3 → U2 순서로 승인 여부 판단**. 🔴 U1 은 금지 축 · U4 는 G6 과 같이 판단.

## §B-33 🔵🔵🔵 **국내 발견 분석 종료 — CPO 판정 접수**(2026-11-19 · 코드 변경 0)

```
U1 등록부·어댑터   🔴 **제외** — 사이트별 어댑터 확장 **금지**
U2 국내 질의 설계  🟡 **개선 후보** — 범용 검색 전략으로 검토 · 🔴 **승인 전 보류**
U3 상품 상태       🔴🔴 **선행 정책 결정** — 일반/리퍼/중고/상태 미확인 구분 정책 설계
U4 플랫폼 중복     🟡 **후순위** — G6 가격 정책과 **함께** 판단
P1 약관 제한       🔴 **「발견 실패」로 계산하지 않는다**(CPO 명시)
X2 국내 질의       🟢 **확인 완료 · 재분석 불필요** —
   `"Bobo Choses" "B226AC033" Pop sweatshirt Midnight blue loose fit 국내해외 동일상품 판매처`
   🟡 **국내·해외를 한 질의에 섞었다** · 🔴 「국내를 충분히 탐색했는가」는 **미확인**
```

🔵 **CPO 전략 순서(고정)** — ① 상품 상태 정책 정의 → ② 범용 국내 검색 전략 → ③ 후보 품질↔가격
연결(SKU·상세 URL·상태·가격 근거 구분) → ④ 셀러 시장 가격 노출(일반 ↔ 별도 상태 **혼동 금지**).

🟡 **CEO 정책 확인 대기** — 「일반상품 = 기본 비교 대상 · 리퍼·중고 = 별도 참고 · **상태 미확인은
일반으로 간주하지 않는다**」. 승인되면 **CPO 가 U2 작업지시서**를 만든다.

🔴 **CTO 상태** — 운영 코드 변경 **없음** · U1 금지 · U3 결정 대기 · U2 보류 · G6 동결 ·
G5~G8 **소급 변경 0** · 새 WU **0**.
🟢 기억 고정 — `item-condition-axis-is-missing-and-blocks-candidate-expansion`(신규) ·
`portal-scraping-blocked-by-terms`(갱신 — 「약관 제한을 검색 실패로 세지 않는다」 + 술어 owner).

## §B-34 🔴🔴🔴 STEP A-1 — 신품 게이트 **BLOCKED**(2026-11-19 · `e3974e13` · 구현 0)

🔴 **차단 사유: 범위 충돌(§6).** 정책을 문자 그대로 켜면 **비교 집합이 0** 이 된다.
산출 `preserved/step-a1-item-condition-evidence.json` · 하니스 계약 **6**.

```
구조화 축  🔴 `itemCondition`·상태 칸이 운영 **타입·추출기 전수에 없다**
           (types · product-facts · seller-facts · product-url-facts)
텍스트 축  🔴 후보 **116 전수**(B 109 + A 7) **전건 UNKNOWN** —
           명시 NEW 0 · REFURB 0 · USED 0 · 🟢 제목 **116/116** · 설명문 105(「없어서」가 아니다)
정책 적용시 적격 **0** · 제외 **116/116** ⟹ 🔴 **해외 비교 근거까지 사라진다**
측정불가 3  라이브 JSON-LD `itemCondition`(미추출·HTTP 0) · Shopify `tags`(미보존) ·
           등록부/DB 판매처 성격(DB 금지 · 도메인 성격 추정은 **사이트 전용 처리**)
선행 조건 2 ① 상태 근거 **수집 축** 신설 — **CPO**(STEP A 범위 밖)
           ② 근거 없을 때의 **제품 동작 결정** — **CEO**(기능 손실 수용 ↔ 관측 전용)
STEP B(U2) 🔴 **착수 0**(CPO: STEP A 미통과 시 완료 처리 금지)
```

🔴 **하지 않은 것** — 임의 「NEW 추정」(정책 3번) · 게이트 끈 채 「적용 완료」 보고 ·
`D-4` 우회·삭제·약화 · 운영 owner 에 상태 어휘 추가 · G6/SAME/recommendedPrice/SINGLE-RANGE 변경.

🟡 **다음 한 수** — ①②는 **CPO·CEO 결정**. 🟢 승인되면 CTO 가 즉시 들어갈 수 있는 형태는
**「관측 전용 상태 판정 owner 신설(게이트 OFF)」** 이고, 그 자리는 `price-eligible-verdicts`
**옆의 새 순수 모듈** 이다(그 집합은 가격 정책이라 섞지 않는다).

## §B-35 🔵 AI Search 신상품 의도 — 질의 설계·비교(2026-11-20 · `7c6ec504` · 운영 질의 불변)

🟢 **owner 확정(STEP A)** — `packages/crawler/src/discovery-core/query-planner.ts`
`#buildCompositeDiscoveryQuery` + 껍데기 `#buildDiscoverySearchQuery` ·
`SELLER_SIGNAL = "국내해외 동일상품 판매처"`(**X2 접미사**) · 호출부 `web-search-pool.ts`(사본 0).
🔴 AI Search 는 **브라우저** 실행 · 서버는 `candidateUrls[]` 만 받는다(한계 유지).

```
후보 신호  `국내해외 동일상품 **새상품** 판매처`  — 짧은 **한국어 토큰 1개** 만 추가
근거      SP-08 **긴 목적 문장 NO-GO** · 효과의 정체 = **한국어 토큰**(영어 CONTROL 무효)
비교      분모 6(품번 O 5 · X 1) · 토큰 증분 **전건 1** · 식별자 **전건 보존** · 상품별 분기 0
채택      🔴🔴 **BLOCKED** — ⒝B1 `SELLER_SIGNAL` 은 **A/B 채택값**(🇰🇷 1→8)이고 소스에
          「이 상수를 다시 연구하지 않는다」가 **CPO 확정** 으로 있다 → CPO
          ⒞B2 효과 검증은 **Apify 유료 호출** ⟹ **비용** → CEO
🟢 측정은 **이미 있는 훅**(`options.signal` · 계약 Q12)으로 **문자열만** 했다 ·
   `Q-6` 이 **운영 질의 불변** 을 단언(인자 미전달 == 오늘 동작 · 운영 질의에 「새상품」 0)
미검증 5  결과 수 · 국내/해외 후보 · 중고·리퍼 감소 · 상품 URL 비율 ·
          실행 간 변동(같은 질의 URL 겹침 **3~30%** ⟹ 1회로 우열 판정 불가)
```

🟡 **다음 한 수** — ⒜ CPO 가 「상수 교체」를 승인하고 ⒝ CEO 가 **A/B 1회 비용**을 승인하면,
CTO 는 **훅으로 같은 10개 상품 A/B** 를 돌려 채택 여부를 **실측으로** 판정한다(새 설계 0).

## §B-36 🔵 Apify 연동 확정 + A/B 준비 — **실행 BLOCKED(자격증명)**(2026-11-20 · `7b5b9cfa`)

🔴 Apify 호출 **0** · 새 인프라 **0** · 운영 질의 **불변** · 토큰 **미기록**.
산출 `preserved/apify-ab-readiness.json` · 하니스 계약 **9**.

```
정정  「AI Search 는 브라우저에서 돈다」는 **붙여넣기 생산자**(`__url_candidates__`) 사실이고
      **Apify 는 «서버측» 검색 실행자**(`__web_search__`)다 — **다른 생산자**
구조  Actor `apify~google-search-scraper` · **Actor run-sync**(저장 Task 아님) ·
      호출 owner **하나** `web-search-pool.ts#apifySearch` · 질의 owner planner(사본 0) ·
      `queries` body · pages **2** · perPage **20** · `languageCode ko` · saveHtml false ·
      🔴 `countryCode` **없음**(롤백 · organic 2→0 반증) ·
      결과 → `collectWebSearchUrls`(URL만) → `__web_search__` → facts → MI
증거  🟢🟢 X2 질의가 `searchRun.search.query` 값이고 `SELLER_SIGNAL` 로 끝난다 ⟹
      **그 운영 실행이 Apify 경로였음이 기록으로 확인**(추정 아님)
준비  🟢 훅·주입점(`input.token`·`input.search`) **이미 있다** — 새로 만들 것 0
      호출량 10상품×2조건 = **20 run** · 2회 반복 **40** · 결과 상한 run당 40 / 1라운드 800
      🔴 반복 **2회 이상** 필요(URL 겹침 3~30% · SP-10)
차단  B1 `APIFY_API_TOKEN` **CTO 환경에 없다**(Production Sensitive · 읽을 수 없다) → CEO
         🟡 ⒜ 1회용 토큰 후 즉시 폐기 ⒝ 또는 운영에서 B 를 훅으로 1회 실행 → `searchRun` 전달
      B2 사용량·크레딧은 **외부 콘솔** ⟹ 「기존 비용 범위 안인가」 **측정불가** → CEO
```

🔴🔴 **영구 함정(새로 발견)** — 주석 제거 `//[^\n]*` 이 **`https://` 의 `//` 를 먹어
그 줄 꼬리까지 사라진다**. 🟢 **URL 단언은 원문으로** 한다. 그리고 비밀 금지 조건은
**토큰 «모양»** 으로 좁힌다(`apify_api` 통째 금지는 **환경변수 이름** 까지 잡는다).

🔵 **좌표** — … → AI Search 질의 설계(`7c6ec504`) → **Apify 연동 확정 · A/B 대기**.
🟡 다음 = **CEO 가 B1 둘 중 하나를 열면** CTO 가 즉시 A/B 실측(새 설계 0).

## §B-37 🔵 신상품 신호 A/B 하니스 — **준비 완료 · 기본 SKIP**(2026-11-20 · `f7ad9d26`)

🟢 기존 Apify 경로 재사용(새 인프라 0) · Apify 호출 **0** · 운영 상수 **불변**.
하니스 `ab-new-item-signal-live.test.ts`(계약 4 + 실행 1 SKIP).

```
게이트  `AB_SIGNAL_PROBE=1` **AND** `APIFY_API_TOKEN` 존재 — 아니면 **SKIP**
토큰    🔴🔴 **대화로 받지 않는다**(§10). CEO 가 **`scripts/.env` 에 직접** 적고
        A/B 직후 **그 줄 삭제 + Apify 콘솔에서 폐기**. 🟢 하니스는 값을 **넘기지 않는다**
        (생산자가 `process.env` 에서 직접 집는다 · `L-3` 이 잠근다)
설계    A `국내해외 동일상품 판매처` ↔ B `… **새상품** 판매처`(차이 **한 토큰**)
        6상품 × 2조건 × **2라운드** = **24 run** · 라운드마다 **A/B 순서 반전**
기록    URL · `.kr` TLD · 호스트 · 상품페이지 · 중고류 URL · organic/failed/errorStatus ·
        **반복 간 교집합**(SP-10 변동 대응)
🔴 분모 **6**(요청 10) — 기존 A/B 의 10개 목록이 **자산에 없다** ⟹ 10 은 **CPO 가 지정** 해야 한다
한계    `.kr` = TLD **휴리스틱**(운영 분류기 아님) · 중고류 = **URL 문자열** 축 ·
        표본 작다 · 🔴 **단순 URL 수로 B 를 채택하지 않는다**
```

🔴 **실행 명령**(CEO 가 토큰을 넣은 뒤):
`cd apps/admin && AB_SIGNAL_PROBE=1 npx vitest run src/app/api/price-history/_lib/__tests__/ab-new-item-signal-live.test.ts`

🔵 **좌표** — … → Apify 연동 확정 → **A/B 하니스 준비 완료 · 토큰 대기**.
🟡 다음 = 토큰이 들어오면 **즉시 실측 → 상품별 비교 → 채택 권고/기각** 보고(새 설계 0).

## §B-38 🔴🔴🔴 B226AC033 — **4갈래 분류 완료 · 다음 세션은 «수정» 부터 들어간다**

🔴 **새 조사가 아니다** — CPO 가 지정한 첫 수(「한 화면에 놓고 비교」)의 결과이고
기존 자산만 썼다(HTTP 0 · DB 0 · 코드 변경 0).

```
🇰🇷 국내  → **② 수집 문제**(검색 문제가 아니다)
   CASE-01 확정 — 후보 URL 은 있었고 **수집에서 죽었다**(HTTP_429 → TimeoutError)
   🔴 남은 원인은 **약관/429/어댑터** 이고 **금지 축** 이다(우회·어댑터 추가 금지)
🌎 해외  → **③ MI 판단 문제** ← 🔴🔴 **이번 스프린트의 수정 지점**
   기존 실행: 후보 **6** · **PRESUMED_SAME 6 · SAME 0** · 가격 **6 보유**
   🔴 `docs/MI-BRAND-TITLE-FILL-FINAL.json` 에 **human GT = SAME** 후보가 있다 —
      **`junioredition.com`**(brandAxis **MATCH** · state **CORRECT**)
   ⟹ 🔴 **사람이 SAME 이라 한 후보를 시스템이 PRESUMED_SAME 으로 둔다**(SAME 0)
   🟢 대조군 — `designerkidswear.com`(Stone Island) human **DIFFERENT** ⟹
      그것이 같이 열리는 수정은 **기각** 이다
💰 가격  → 🟢 **정상** — PRESUMED_SAME 은 가격 자격 집합(SAME+PRESUMED_SAME)에 들어가고
   CEO 화면에 GBP/CAD/USD 가 실제로 떴다 ⟹ **가격·연결 단계 문제가 아니다**
```

🔵 **다음 세션 첫 명령(조사 없이 바로)** — `junioredition.com × B226AC033` 쌍의
**blockers·축 개수**를 운영 함수로 꺼내 **SAME 을 막는 축 하나**를 특정한다.
```
읽을 것  fixtures/wu-059-gt-facts.json · docs/MI-KIDS-CODE-NAME-CAUSES.json ·
        preserved/a-identity-axis.json · docs/MI-BRAND-TITLE-FILL-FINAL.json
축 기준  SAME_MIN_AXES **5** · PRESUMED **3** · IMAGE 와 1점 TITLE 은 **정원 제외**
🔴 금지  threshold 완화 · 상세설명만으로 승격 · 이미지 단독 · 품번 충돌 무시 ·
        제목 토큰 → brandModelCode 승격(REJECT 선례) · 사이트 전용 예외
완료     수정 → KIDS 회귀 → 셀러 화면 E2E → Production
```
