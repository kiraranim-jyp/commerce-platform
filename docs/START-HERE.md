# ▶ MASTER HANDOFF — 스마트스토어 상품자동등록

> 🔴🔴🔴 **이 문서가 유일한 진입점이다.** 세 페이지(CPO · CTO · CEO) **전부** 이것을 먼저 읽는다.
> 🔴 **페이지가 바뀌어도 프로젝트 상태는 초기화되지 않는다.** 과거 조사·결정을 다시 읽지 않는다.
> 🔴 **두 번째 진입 문서를 만들지 않는다** — 둘이 되면 서로 다른 말을 한다(이 트랙에서 실제로 났다).
> 🟢 종료된 WU 상세는 `docs/ARCHIVE-CLOSED-WU.md` 와 `docs/HANDOFF-WU-*.md` 에 있고
> **막혔을 때만 해당 절 하나** 를 연다.

---

## 0. 한 줄 상태 — 이것만 보고도 다음 행동이 정해진다

```
CURRENT WU   **CORE-PRICE-SAME-05** — 🟡 **STEP 1~4 반사실 측정 완료 · 구현 «전» 에 STOP**
NEXT         🔴 **CPO 판정** — P0 전제가 반증됐다(§9-C) · leakage **측정불가** ⟹ 통합 미승인
CEO ACTION   🟡 **없다**
CLOSED       UX-01 · UX-02 · SAME-01 · SAME-02 · STEP 5 ·
             **SAME-03**(화면 + CEO GT 10/10) · **SAME-04**(FN 3건 원인 확정)
Git          clean · origin/main 0/0 · Production / 200
회귀         **684 files / 9,256 passed / 0 failed** · typecheck 0 · build 0
```

🔴 **CTO 가 할 코드 작업이 없다.** 다음은 **CPO 판정** 이다 — matcher 를 CTO 가 열지 않는다.
🔴 **용어는 여섯뿐** — MEASURED / CLOSED / HOLD / REJECT / 측정불가 / STOP.
🟢 종료된 WU 상세·정합표·과거 측정은 전부 `docs/ARCHIVE-CLOSED-WU.md` 에 있다(막혔을 때만 연다).

---

## 1. PROJECT RESUME — 페이지를 옮길 때 이것만 붙인다

```
[PROJECT RESUME] 따져(TTAEJYO) — 스마트스토어 상품자동등록

진입점     docs/START-HERE.md  ← **이것만 읽고 시작한다**(과거 세션 내용을 붙이지 않는다)
CURRENT    CORE-PRICE-SAME-05 — 반사실 측정 **완료** · 구현 전 STOP(§9-C) · **CPO 판정 대기**
역할       이 페이지는 [ CPO / CTO / CEO ] 중 하나다
금지       matcher · threshold · 8축 · priceTier · domesticReference · 국내가격 pipeline ·
           A/B 가격 · 셀러 UI · description 연결 · image scoring — **전부 변경 0**
재조사 금지  SAME-01 STEP 1·2·2-R 결론 · UX owner · A/B 정책 · STEP 5 · 8축
용어       MEASURED / CLOSED / HOLD / REJECT / 측정불가 / STOP — 이 여섯만 쓴다
```

🔴 **전체 역사를 복사하지 않는다.** 위 10줄이면 새 페이지가 이어서 일할 수 있다.
🔴 종료된 것은 `docs/ARCHIVE-CLOSED-WU.md` 에 있고 **막혔을 때만** 해당 절 하나를 연다.

---

## 2. 역할

| | 하는 일 | 🔴 하지 않는 일 |
|---|---|---|
| **CEO** | 실제 서비스 화면 사용 · 최종 UI/UX 판단 · 등록 결과 확인 | 코드 · Git · 아키텍처 · 중간 디버깅 |
| **CPO** (GPT) | 전략 · 우선순위 · 정책 · 작업지시 · 결과 판정 · STOP/HOLD/CLOSED · **세션 간 결론 연결** | 코드 설계 강요 |
| **CTO** (Claude) | 조사 → 구현 → 계약 → 변이 → 회귀 → typecheck → build → Git → deploy → 증거 보고 | 정책 결정 · 범위 임의 확장 |

🔴 **CTO 는 기술적으로 결정 가능한 것을 CPO 에게 반복 선택시키지 않는다.**
🔴 단 **제품 정책·전략 판단은 CPO 에게** 올린다. 🔴 **CEO 에게 「다음에 뭘 할까요」를 묻지 않는다.**

---

## 3. 🔴🔴 재조사 금지 프로토콜 — 새 페이지가 가장 먼저 읽는다

새 페이지는 **이 순서로만** 시작한다:

```
① MASTER HANDOFF 읽기 → ② §0 한 줄 상태 → ③ §11 CLOSED/HOLD/금지 → ④ §9 구현
```

**금지 행동 6**:

```
❌ 과거 작업 다시 조사            ❌ CLOSED 된 WU 재검토
❌ 이미 검증된 owner 재조사        ❌ 기존 정책을 새로 추론
❌ 과거와 결과가 다르다는 이유만으로 재실험
❌ 이전 페이지의 측정을 처음부터 반복
```

🟢 **reopen 은 CPO 가 「이 결론을 다시 검증한다」고 명시할 때만** 한다.

### 🔴 실제로 발생하면 안 되는 네 문장 (CEO 지목)

```
❌ 「국내가격이 왜 COMPARISON 인가요? 다시 조사해볼게요」      → 이미 조사됐다(§11)
❌ 「description 을 연결하면 정보가 많아지니 구현해볼까요?」    → CASE C 로 닫혔다(§10)
❌ 「B 가 88,000 이니 권장 판매가격도 88,000 으로 하죠」        → A/B 정책 확정(§6)
❌ 「판매판단은 한 곳만 두는 게 깔끔하니 오른쪽을 지웁니다」    → 「결론은 하나, 표현 위치는 둘」(§9)
```

---

## 4. NORTH STAR

이 제품은 **후보 검색 결과를 많이 보여주는 시스템이 아니다.**

```
상품 1개 입력 → 동일상품 후보 탐색 → MI 가 SAME 판정
→ SAME 상품의 판매상태/가격 확보 → 셀러에게 판매 여부와 판매가격 판단 근거 제공
```

| ❌ 중요하지 않다 | ✅ 중요하다 |
|---|---|
| 후보가 몇 개인가 | **동일상품 2~3개의 가격** |
| 유사상품·AI 결과 개수 | 🇰🇷 국내 **참고가격** · 🌎 해외 **최저 소싱가** |
| 셀러가 후보를 하나씩 판단 | **MI 판매판단 + 권장 판매가격 + 실제 판매가격 설정** |

🔴 **SIMILAR · DIFFERENT · UNDECIDED 는 seller surface 에 노출하지 않는다.**
🔴 셀러가 직접 SAME/SIMILAR 를 판단하지 않는다 — **MI 가 한다.**

**셀러가 5초 안에 답을 얻어야 한다**: 「팔아도 되는가 → 얼마에 팔면 되는가 → 왜 이 가격인가」

### 🔵 최종 방향 — 🔴 **아직 «열리지 않았다»**(CPO 확정 2026-10-24)

```
국내 시장가격 → 해외 최저 소싱가 → 비용/배송/세금/수수료 → 목표마진
             → 추천 판매가격 → 판매 여부
```

🔴🔴 **이 문장을 착수 승인으로 읽지 않는다.** `CLAUDE.md §00-B` 의 가격 보류가 그대로
유효하고 **추천 판매가 · 마진 · 예상수익 «계산» 은 §7 ABSOLUTE FREEZE 에 남아 있다.**
그 범위는 **CPO 가 따로 지정** 한다. 🟢 지금 열려 있는 입력은 **원가 한 칸** 이고, 화면은
그것이 비었다는 사실만 말한다(「🧾 현재 판단」).

### 🔴🔴 이 두 문장을 같은 말로 쓰지 않는다

```
동일상품 «확정»  = MI 가 엄격하게 SAME 으로 확정한 수   ← 🟢 **0 이어도 정상이다**
참고가격        = 동일상품으로 «보이는» 후보에서 확보한 실제 판매가격
⟹ 「MI 가 아직 확정하지 못했지만 **시장가격 정보는 확보했다**」는 상태를 숨기지 않는다
```

---

## 5. MARKET RULE

🔴 국내/해외는 **검색/MI 파이프라인을 분리하지 않는다.** 공통이다:

```
원상품 → 후보 수집 → MI SAME 판정 → 판매상태 → 가격 추출
```

**차이는 «최종 가격 해석» 만이다.**

```
🇰🇷 국내   SAME 0 → 가격대 없음 · SAME 1 → **가격대 확정 불가** · SAME 2~3 → **시장 가격대**
          🔴 평균 · 추천가격 계산 금지
🌎 해외   같은 통화 → **최저 확인가** · 여러 통화 → **통화별로 각각**
          🔴 환산 금지 · 🔴 통화가 다른 숫자를 서로 비교하지 않는다
```

---

## 6. 🔴🔴 가격 정책 A / B — 절대 혼동 금지

```
A = 권장 판매가격   «내가 얼마에 팔 것인가»   — 원가 기반 · 사용자에게 보여주는 값
    landed cost → fee → target margin → **suggestedPriceKrw**   (기존 계산 그대로)
    owner: CommerceWorkspace.tsx:1996 `recommendedPriceKrw`

B = 국내 시장가격   «시장에서 얼마에 팔리고 있는가»   — **근거** 다
    화면 명칭 「🇰🇷 국내 참고가격」 · owner: marketComparison.domesticReference
```

🔴 **금지 3** — B 를 권장 판매가격으로 사용 · A/B 를 합친 새 추천가격 생성 ·
「국내 최저가 = 권장 판매가격」으로 변경.

🟢 실측 기준선(재계산 금지) — 착지원가 ₩230,721 · **A ₩295,796** · **B ₩258,000**
(marketCase B · Net 0.6%) · 셀러 확정가 ₩295,800 ⟹ **셀러가 A 를 그대로 적용했다.**

---

## 7. ABSOLUTE FREEZE

```
MI 판정축 · SAME threshold · 8축 · crossSellerReserved · discovery algorithm ·
Registry · adapter · price_alerts · DB schema · Gemini/API 비용 구조 ·
추천 판매가격 계산 · 마진 계산 · 통화 환산 · 새 후보 검색 알고리즘 ·
새 seller candidate UI · 국내 SAME 판정축 개선
```

🔴🔴 **국내 SAME = 0 을 이번 WU 에서 해결하려 하지 않는다** — 별도 WU 다.
🟢 근거는 측정돼 있다: 첫 divergence 는 **공급**(국내 6·4 : 해외 30·25)이고 어댑터 게이트는
국내 0/2 · 해외 3/22 로 양쪽을 거의 같게 막는다. **재조사 금지.**

---

## 8. ALREADY DONE — 재구현하면 하나인 것을 둘로 쪼갠다

```
Seller Decision      최종 owner **하나**(`seller-decision`)
Price owner          시장가격 숫자를 여러 영역에서 중복 표시하지 않는다
Price interpretation 🇰🇷 가격대 · 🌎 최저 확인가 · 통화별 · 환산 0 · 추천 0
MI blocker           1차 **건수만** · 사유는 `▸ MI 상세 분석`(2차) — 삭제가 아니라 이동
후보 접힘             모든 후보 구역이 `candidate-fold`(기본 접힘 · `open` 금지)
STEP 4               권장 판매가격 A 1차 노출 + **ⓘ 가격 계산 기준 앵커 복구**(배포 `6fe1b0bf`)
```

### SAME_PRICE_CAP = 3 — 🔴 가격 «계산» 에만 적용

```
🔴 SAME **건수를 3개로 잘라 숨기지 않는다** — 「동일상품 확인 5곳」은 그대로 표시한다
🟢 가격 계산에 쓰는 데이터만 **통화별 최대 3개**(GBP 3 · USD 3 · EUR 3 …)
🔴🔴 전역 3개로 자르면 통화가 섞여 **「최저 확인가」가 거짓** 이 된다
```

🟢 계약·변이는 이미 검증됐다(`wu-148-market-price-signal` D) — **재사용하고 재구현하지 않는다.**

---

## 9. 🟢🟢 **CORE-PRICE-SAME-03 — 화면 구현 «완료» · CEO 판정 대기**

> 🟢 산출물 **`docs/core-same03-domestic-review.html`**(4.35MB · 자립형 · 원격 이미지 0).
> 🔴 변경 — matcher **0** · threshold **0** · priceTier **0** · domesticReference **0** ·
> 가격 pipeline **0** · **셀러 UI 0** · 운영 파일 **0**(전부 `__tests__` + `docs/`).
> 🔴 **CTO 가 판정하지 않았다** — 라디오 10 × 3 전부 미선택(`checked` 속성 0).

### 🟢 실측 결과 — **국내 후보 10 / 원상품 2**

```
🇰🇷 B226AC009  biskuit.kr          PRESUMED_SAME  COMPARISON  **국내가격 포함** · BRAND_MISMATCH+NO_TITLE_OVERLAP
              donokids.com        PRESUMED_SAME  COMPARISON  미포함(KRW 88,000 · 🔴 등록부 미조회) · BRAND_UNCONFIRMED
              global.trenbe.com   **SAME**       **EXACT**   미포함(USD 80 · 해외 통화) · 보류 0 · 🔴 CEO 라벨 **충돌**
              m.luxboy.com        PRESUMED_SAME  COMPARISON  미포함(KRW 59,000 · 🔴 등록부 미조회) · 🔴 CEO 라벨 **충돌**
              miniboutique.co.kr  **UNREACHABLE** — 측정불가(🔴 빼지 않고 표시했다)
🇰🇷 B226AC010  beaumonde.co.kr(목록) SIMILAR      EXCLUDED    미포함 · NO_TITLE_OVERLAP+BRAND_UNCONFIRMED
              beaumonde.co.kr(상세) **SAME**     **EXACT**   **국내가격 포함** · 보류 0
              kream.co.kr         **UNREACHABLE** — 측정불가(🔴 실행 간 OK ↔ UNREACHABLE 로 갈린다)
              luksusbaby.kr(1)    **REDIRECTED_AWAY** — 측정불가
              luksusbaby.kr(2)    CONFLICT       EXCLUDED    미포함 · 반증 COLOR
⟹ 페이지 읽기 **7/10** · 이미지 **7/10** · 국내 참고가격 포함 **2** · 과거 판정 충돌 **2**
```

### 🔴🔴🔴 지시서를 **실측으로 정정한 것 셋** — 다시 조사하지 않는다

```
① 「wu-059/067/074 는 originCode 가 없다」  → 🟢 **틀렸다. 전부 증명 가능하게 매핑된다**
   `wu-059.origins[searchId].canonicalProduct.sku.value` 가 그 맵이고,
   🟢 **증명 두 축** 으로 잠갔다 — 원상품 제목 **6/6 일치**(59↔67) ·
   같은 후보 id 가 세 파일에서 **같은 URL 19/19**. 🔴 증명이 깨지면 조인을 **쓰지 않는다**
② 「wu-116 kream.co.kr = AC009」          → 🔴 **AC010 이다**(fixture 가 그렇게 적어 뒀다)
③ 「국내 도메인 11개」                     → 🔴 **분모가 섞여 있었다.** 그 11 에는
   ⒜ 다른 원상품(wconcept → S6 트랙수트)과 ⒝ **가치 라벨**(`wu-099/100` ·
   USEFUL/NOISE · 원상품 **B226AC112**)의 도메인이 들어 있다 —
   `miniboutique` · `mustit` · `littleluna` 가 **거기서만** 나온다
   ⟹ 🟢 동일상품 GT + 원상품 확정 + 국내 = **후보 10 · 도메인 8**
🔴 그리고 「miniboutique 가 KRW 88,000 의 출처」도 **정정한다** — 실측 88,000 은
   **biskuit.kr**(국내 참고가격에 실제로 들어간다)과 **donokids.com** 이고,
   miniboutique 는 **읽히지 않아 가격이 없다**
```

### 🔴🔴 측정불가 / 한계 — **넘겨 읽지 않는다**

```
⒜ 🔴🔴 **이 화면은 국내 판매처 등록부를 조회할 수 없다**(service-role 키 없음) ⟹
   `classifyCandidateMarket` 의 「등록부 + KRW」·「판매자 증거 + KRW」 분기가 **발화하지 않는다**.
   그래서 **KRW 후보 둘**(donokids 88,000 · luxboy 59,000)의 「KR 아님」은 **측정불가** 다 —
   🟢 화면이 그 문장을 **직접** 말한다(「운영에서는 KR 로 확정될 수 있습니다(측정불가)」)
⒝ 🔴 페이지 읽기가 **실행 간 갈린다** — `kream.co.kr` 이 한 실행에서 OK(CONFLICT/COLOR),
   다음 실행에서 UNREACHABLE 이었다. 🔴 「그 사이트를 읽을 수 없다」로 적지 않는다
⒞ 🔴 후보 `imageUrl` 은 추출 경로에서 **하드코딩 null** 이라 **IMAGE 축이 계산되지 않는다** ⟹
   화면의 사진은 `og:image`/JSON-LD 보충이고 **판정에 쓰이지 않았다**(화면에 적었다)
⒟ 🔴 **실제 따져 화면이 아니다** — 이 산출물은 `docs/` 자립형 HTML 이고 셀러 UI 연결 **0**
```

### 🔴🔴 화면이 **드러낸** 것 — 「CEO 가 SAME 이라 봤는데 왜 막혔는가」

```
🟢 `global.trenbe.com` 은 **SAME/EXACT** 이고 보류가 **0** 이다 — 그런데 **CEO 라벨이
   충돌** 한다(wu-112/111 SAME ↔ wu-059 DIFFERENT) ⟹ 🔴 **이 한 건이 이번 판정의 핵심** 이다
🟢 `beaumonde.co.kr` 상세는 **SAME/EXACT + 국내가격 포함** 이다 ⟹ 🔴 「국내 SAME 0」은
   **AC009 에 대한 문장** 이고 AC010 에서는 성립하지 않는다(섹션을 섞어 읽지 않는다)
🔴 반증(`CONFLICT`)을 만난 후보는 `axes: []` 로 **조기 종료** 되어 나머지 축이
   **계산조차 되지 않는다** ⟹ 화면이 `NOT_AVAILABLE` + 「조기 종료」로 **UNKNOWN 과 가른다**
```

### 🟢 변경 파일 — 운영 **0**

```
신규  __tests__/core-same03-inventory.ts        인벤토리·원상품 조인 증명(순수 · 네트워크 0)
신규  __tests__/core-same03-evidence.ts         8축 읽기(순수 · MI 변경 0)
신규  __tests__/core-same03-inventory.test.ts   계약 **20**(CI 상주 · 네트워크 0)
신규  __tests__/core-same03-review-dom.test.ts  **마운트 DOM** 계약(jsdom · 네트워크 0)
신규  __tests__/core-same03-domestic-review-build.test.ts  화면 생성(🔴 `CORE_SAME03_LIVE=1` 로만)
신규  docs/core-same03-domestic-review.html     **CEO 판정 화면**
🔴 `core-2m` 빌더와 그 산출물은 **한 글자도 건드리지 않았다** — 그 파일의 「내부 토큰 0」
   계약과 이 WU 의 「내부 결과 노출」 요구가 **충돌** 하므로 **파일을 둘로 갈랐다**
🟢 변이 **M1~M11 전부 FAIL → 복구**(두 모듈 **바이트 동일** 확인 · 잔여 `MUTATION` 0)
🔴🔴 **변이가 내 계약 셋을 뚫었고 셋 다 메웠다** — ⒜ 원상품 미상 가드가 **발화한 적이 없었다**
   (합성 행으로 직접 찔러 잠갔다) ⒝ 「측정불가를 빼지 않았다」가 **이미 빠진 것을 못 본다**
   (인벤토리 수 ↔ 화면 수 대조로 바꿨다) ⒞ 등록부 경고 대조가 **`0 === 0` 으로 통과**
   (발화 단언 `> 0` 을 앞에 세웠다)
```


---

## 9-B. 🟢🟢 **CORE-PRICE-SAME-04 — CEO GT 10/10 + FN 3건 원인 확정**(운영 변경 0)

### 🔴🔴🔴 분모를 먼저 적는다 — **precision 은 측정불가** 다

```
CEO 라벨   동일 **5** · 판단불가 **5** · **다른제품 0**
⟹ 🔴 「시스템 SAME 인데 사람은 다르다」 분모가 **0** 이므로 **precision 을 측정할 수 없다**.
   🔴 「오포함 0」을 정밀도 근거로 쓰지 않는다 — 분모가 없는 0 이다.
🟢 재현율 — CEO 동일 5 중 system SAME 확정 **2** · 보류(PRESUMED_SAME) **3**
🟢 국내 참고가격 진입 — CEO 동일 5 중 **2**(biskuit · beaumonde)
🔴 판단불가 5 의 성질 — **읽기 실패 3** + 목록 URL 1 + 이미지 부족 1 ⟹ **판정 실패가 아니다**
🔴 사유 **3/10 은 근거 측정불가** — 입력 사유 네 건이 글자 그대로 같았다(붙여넣기) ⟹
   donokids · m.luxboy · beaumonde 의 「무엇을 보고 판단했는가」를 그 후보 서술로 쓰지 않는다
라벨 고정 `fixtures/core-same03-human-gt.json`(**URL 키** · WU-095 교훈)
```

### 🟢 FN 3건 — **실측 trace**(운영 함수 그대로 · 복제 계산은 교차검증했다)

`cross-seller.ts:1202` → `if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return "SAME"`

| 후보 | brand | 품번 | TITLE | corePoints | 보류 | **실패 조건 수** |
|---|---|---|---|---:|---|---:|
| biskuit.kr | 🔴 **「비스킷」**(판매처명) | exact | 🔴 겹침 0 | **4** | BRAND_MISMATCH · NO_TITLE_OVERLAP | **3** |
| m.luxboy.com | 🟢 BOBO CHOSES | exact | 🔴 겹침 0 | **5** ✓ | NO_TITLE_OVERLAP | 🔴🔴 **1** |
| donokids.com | 🔴 **null** | 🔴 **null** | 🟢 +2 | **3** | BRAND_UNCONFIRMED | **3** |
| 🟢 trenbe(baseline) | BOBO CHOSES | exact | +1 | 6 | 없음 | 0 |
| 🟢 beaumonde(baseline) | Bobo Choses | exact | +1 | 5 | 없음 | 0 |

🔴🔴 **「축 하나를 열면 3건이 산다」는 거짓이다** — `m.luxboy.com` 만 **단일 차단** 이고
나머지 둘은 **세 조건이 동시에** 실패한다. 🟢 복제식(`corePoints`·`brandOk`)은 운영
verdict 와 **5/5 대조 통과** 했다(틀린 복제로 원인을 적지 않았다).

### 🔴🔴 원인 분류 — **CEO 근거는 페이지에 «있다». 칸까지 오지 않는다**

```
① biskuit    EXTRACTION + NORMALIZATION + AXIS
   raw HTML 에 보보쇼즈 **26** · B226AC009 **21** · BOBO CHOSES **3** ⟹ 공급은 있다
   🔴 그런데 brand 칸 = **「비스킷」**(판매처가 그 자리에 자기 이름을 적었다)
      ⟹ `:807 brandKnown` 참 · `:808 brandOk` **거짓** → `:835 BRAND_MISMATCH`
      🟢 WU-080 이 「extractor 가 명시된 자리를 정직하게 읽었다(결함 아님)」로 닫은 그 모양
   🔴 제목이 **한글 음역만** 이다 — [보보쇼즈·허그·헤어리·몬스터·티셔츠] ↔ [hug·hairy·monster·shirt]
      ⟹ jaccard **0** → `:929 NO_TITLE_OVERLAP` (WU-078 이 음역 축을 REJECT 로 닫았다)
② m.luxboy   🔴🔴 **AXIS 단일** (근본은 SUPPLY)
   brand ✓ · 품번 exact ✓ · brandOk ✓ · corePoints **5** ✓ ⟹ **NO_TITLE_OVERLAP 하나** 가 막는다
   🔴 원인은 그 페이지 제목에 **상품명이 없다** — 「보보쇼즈(BOBO CHOSES) 키즈 긴팔티셔츠
      B226AC009 | SINCE 2002 … 럭스보이」 = 브랜드 + 카테고리 + 품번 + 판매처 홍보문뿐
③ donokids   EXTRACTION + SUPPLY + AXIS
   🔴 brand **null** — 페이지엔 보보쇼즈 10 · BOBO CHOSES 3 이 있고 **breadcrumb 에도** 있다
      (`categoryText = "BOBO CHOSES (대) > F/W 2026 (중)"`) ⟹ brand extractor 가 **제목·breadcrumb 를
      읽지 않는다** → `:1122 BRAND_UNCONFIRMED`
   🔴 품번 **null** — 그 페이지는 **`#226AC009`** 로 적는다(「B」가 없다 · raw 에 `B226AC009` **0회**)
      ⟹ `modelCode = unavailable` → MODEL_CODE 축 **0점**(baseline 둘은 +3)
   🟢 제목 축은 **정상 작동** 했다(+2 hug/hairy/monster) — 영문 상품명을 같이 적기 때문이다
🔴 MATCH_TRUTH **0건** · PRICE_TIER **0건** — `TEXT_CONFIRMED`(`match-truth.ts:233`
   `crossSellerReserved`)와 `COMPARISON`(`domestic-product-link.ts:88`)은 **PRESUMED_SAME 의
   정상 귀결** 이다. 🟢 가격 축은 이미 통과한다(biskuit 이 국내 참고가격에 들어간다)
🔴 luxboy·donokids 의 국내 미포함은 priceTier 가 아니라 **market UNKNOWN** 이고,
   그 판정은 **등록부 미조회 때문에 측정불가** 다(운영에서는 KR 일 수 있다)
```

### 🔴🔴🔴 **CPO 판정 1건 — 코드 주석의 전제가 CEO 라벨로 반증됐다**

```
`cross-seller.ts:802-804` 가 적어 둔 경고:
  「🔴 알려진 의존 — `m.luxboy.com` 은 품번 exact 인데 human **DIFFERENT** 다.
    C3 를 켜면 그 쌍을 막는 것이 **NO_TITLE_OVERLAP 하나** 가 되므로
    그 축을 완화하는 변경과 **절대 같이** 가면 안 된다」
🔴🔴 그 전제의 「human DIFFERENT」가 **이번 CEO 라벨에서 「동일」로 뒤집혔다.**
   그리고 그 주석이 예고한 상태가 **실측으로 그대로 재현** 됐다 — 막는 것이 그 축 하나다.
🔴 **CTO 는 열지 않았다.** 완화의 안전성을 **이 표본으로 증명할 수 없다** —
   「다른제품 0」이라 WU-063~080 이 측정한 「완화 = Human DIFFERENT 동반 개방」의
   위험을 **잴 분모가 없다**. ⟹ 재개 조건은 §10 의 **「GT 기반 정밀도 재측정 WU」** 와 같다.
```

🟢 **COLOR 반증은 이 표본에서 오차단하지 않았다** — 유일한 COLOR 반증(`luksusbaby` t-shirt)의
CEO 라벨이 **판단불가** 다(동일이 아니다) ⟹ 🔴 COLOR 완화 근거로 쓰지 않는다.

---

## 9-C. 🟡🟡 **CORE-PRICE-SAME-05 — STEP 1~4 반사실 측정 완료 · 구현 «전» STOP**

> 🔴 운영 코드 **0**(matcher · threshold · 8축 · priceTier · 가격 pipeline · 셀러 UI 전부 0).
> 🔴 §11 STEP 5(통합)의 전제 — 「P0/P1/P2 가 **각각 안전성을 통과** 했을 때만」 — 가
> **충족되지 않았다.** 그래서 통합하지 않고 STOP 한다.

### 🔴🔴🔴 핵심 — **분모가 둘로 갈려 있고, 그래서 §12 를 충족할 수 없다**

```
안전성(DIFFERENT) 분모   GT 33쌍  SAME 17 · DIFFERENT 10 · UNCERTAIN 6  (wu-059 + wu-068 저장 facts · 네트워크 0)
효과(제목 문제) 분모      SAME-03 FN 3건                                 🔴 **DIFFERENT 0**
🔴 두 분모를 합치면 「recall 올랐고 leakage 없다」가 **서로 다른 표본의 말** 이 된다.
```

### 🟢 baseline (STEP 1 · 계약으로 고정)

```
TP 5/17 · FN **12** · DIFFERENT 방어 8/10 · 🔴 **FP 2** · UNCERTAIN 6(시스템 SAME 0)
🔴🔴 **baseline FP 는 0 이 아니라 2 다** — 이미 알려진 False EXACT 둘이다:
   C06 `global.trenbe.com`(WU-060) · S1-6 `www.tinyapple.net`(WU-068)
   ⟹ §12 기준은 「FP 0」이 아니라 **「2 에서 늘지 않는다」** 다
🔴 FN 12 의 원인 — BRAND_UNCONFIRMED **5** · MODEL_CODE 반증 **3** · FIT 1 · 기타 3
🔴🔴 **P0 축(`NO_TITLE_OVERLAP`)이 막는 FN = 0 / 12** ⟹ 이 GT 로 P0 효과를 못 잰다
```

### 🔴🔴 STEP 2·3·4 반사실 — **안전성 분모에서 「발화 자체가 0」이다**

| 축 | 발화한 쌍 | SAME Δ | FP Δ | 판정 |
|---|---|---:|---:|---|
| P0 TITLE 음역 | **1** (`C27` beaumonde · human **SAME**) | +0 | +0 | 🔴 **leakage 측정불가** |
| P2 MODEL_CODE 복원 | **0** | +0 | +0 | 🔴 **측정불가**(발화 0) |
| P1 BRAND 보강 | **1** (`C27` · human **SAME**) | +0 | +0 | 🔴 **leakage 측정불가** |

🔴🔴 **DIFFERENT 쌍에서 발화한 반사실이 «하나도 없다»** ⟹ `FP +0` 은 **「leakage 가
없다」가 아니라 「측정할 기회가 0 이었다」** 다(§9 측정불가 규칙).
🟢 원인은 데이터다 — DIFFERENT 10 중 **한글 토큰 보유가 1**(C22)이고, 품번 절단형은 **0** 이다.

### 🟡 효과 분모 — FN 3건(라이브 · 운영 순서)

| 후보 | baseline | P0 단독 | P2 단독 | P1 단독 | **셋 통합** |
|---|---|---|---|---|---|
| biskuit.kr | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | 🔴 PRESUMED_SAME |
| m.luxboy.com | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | 🔴 PRESUMED_SAME |
| donokids.com | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | 🟢🟢 **SAME** |
| | | **0/3** | **0/3** | **0/3** | **1/3** |

🔴🔴🔴 **CPO 전제가 반증됐다** — 「가장 효과가 큰 `NO_TITLE_OVERLAP` 부터」였는데
**P0 단독 효과가 0/3** 이다. 🟢 유일한 회복(`donokids`)은 **P1+P2**(brand+code)에서 나온다.

```
🔴 biskuit 가 안 되는 이유 — brand 가 **「비스킷」(판매처명)으로 «선언»** 돼 있고,
   §6 이 「inferred 가 declared 를 이기게 하지 말라」고 했으므로 **덮지 않았다**
   ⟹ BRAND_MISMATCH 가 남아 `blocked` 가 유지된다
🔴 luxboy 가 안 되는 이유 — 그 페이지 제목에 **상품명이 아예 없다**(브랜드+카테고리+
   품번+홍보문) ⟹ **음역할 대상이 없다.** 🔴 **이것은 SUPPLY 문제이고 matcher 로 못 푼다**
🟢 donokids 가 되는 이유 — brand 보강(보보쇼즈→Bobo Choses)이 `brandOk` 를 열고,
   품번 복원(`#226AC009`→`B226AC009`)이 MODEL_CODE +3 을 줘 corePoints **6 ≥ 5**
```

### 🟢 통과한 안전 게이트(§10·§12 필수)

```
🟢 필수 안전 케이스 — **품번 exact + human DIFFERENT 2건**(`C19`·`C20` junioredition ·
   품번 재사용 실례)이 **모든 축·모든 모드에서 non-SAME 유지**
🟢 새 FP **0**(FP 2 → 2) · 기존 TP 유지(5 → 5)
🟢 P2 는 **후보 코드가 null 일 때만** 발화한다 ⟹ 값이 있는 후보를 덮지 않아
   `AC042↔AC043` 충돌 보호가 **한 글자도 안 바뀐다**(전수 단언)
🟢 음역 표는 **관측된 3토큰**(허그·헤어리·몬스터) + **기존 `lookupBrandAlias` 역방향** 뿐 —
   새 번역 사전 **0**(§4 금지 준수 · 계약으로 잠금)
```

### 🔴🔴 그래서 **구현하지 않았다** — 통합을 막는 것은 둘

```
① §11 STEP 5 가 「각 축이 **안전성을 통과** 했을 때만 통합」이라 했고,
   P1/P2 의 안전성은 **통과가 아니라 측정불가** 다(DIFFERENT 발화 0)
② §12 중요 — 「SAME recall 개선 **과** DIFFERENT leakage 없음」이 **동시** 여야 하는데
   그 둘이 **서로 다른 분모** 에서만 나온다
🔴 그리고 WU-164(CPO 2026-10-22)가 같은 축을 「leakage 1건이라도 생기면 NO-GO」로
   닫았고, WU-078 은 음역 축을 **종료** 했다 — 그 REJECT 사유를 **반증할 분모가 없다**
```

### 🔵 이것을 열려면 필요한 것 **하나**

```
🔴 **한글 제목 후보가 포함된 DIFFERENT GT** — 지금 GT 의 DIFFERENT 10 은 9 가 영문-영문이다.
🟢 그 GT 가 있으면 P0/P1/P2 의 leakage 를 **같은 분모** 에서 재서 §12 를 충족할 수 있다.
🔴 **CTO 가 새 DIFFERENT fixture 를 만들지 않았다**(§8 금지) — CEO 육안 라벨이 필요하다.
🟡 가장 값싼 경로 — SAME-03 화면에 **국내 후보를 더 넣어 CEO 가 「다른제품」을 라벨** 한다
   (그 화면과 하니스는 이미 있다 · `CORE_SAME03_LIVE=1`).
```

### 🟢 재사용 하니스(네트워크 0 · CI 상주)

```
core-same05-gt.ts              GT 적재 · 운영 판정 호출 · 집계(모듈)
core-same05-gt-baseline  5     baseline 고정 · FN 원인 분포 · 필수 안전 케이스
core-same05-counterfactual 7   축별 반사실 · **발화 확인 단언** · 필수 안전 케이스 전 모드
🔴 라이브 효과 축은 `CORE_SAME05_LIVE=1` 로만 (FN 3건)
```

🔴 **내 하니스 결함 넷을 측정이 잡았다**(그대로 보고했으면 전부 거짓 결론이었다) —
⒜ baseline FP 를 0 으로 단언(실제 **2**) ⒝ 반사실 발화를 0 으로 단언(실제 title 1 · brand 1)
⒞ 발화 쌍을 DIFFERENT 로 단언(실제 **SAME** ⟹ leakage 측정불가가 드러났다)
⒟ `all` 모드에서 **음역이 brand 추론보다 먼저** 돌아 브랜드 토큰을 없앴다
   ⟹ 「셋을 합쳐도 SAME 0」이라는 거짓이 될 자리였다(**brand → code → title** 로 고정).

---

## 10. 🟢🔴 STEP 5 = CLOSED (CPO 2026-10-26) — 재개 조건 **하나**

| 트랙 | 판정 |
|---|---|
| ① 품번/모델코드 | 🟢 **유지**(작동 중 · exact 3/4) |
| ② 상세설명 직접 연결 | 🔴🔴 **금지** — 정답 SAME 악화가 **서로 다른 분모에서 2회 재현** |
| ③ 상세 브랜드 단서 | 🔴 근거 부족(`descBrandEvidence` 1/8) |
| ③-b 품번→브랜드(C3) | 🟡 **HOLD**(AC009 이득 0 · 위험 0) |
| ④ 이미지 | 🟡 **HOLD**(후보 `imageUrl` 하드코딩 null · 공급 owner 없음) |
| ⑤ 국내가격 SAME 자격 | 🔴🔴 **HOLD** |

### 🔵 재개 조건 — 구현 WU 가 아니라 **「GT 기반 정밀도 재측정 WU」** 다

```
WU-063~080 의 GT 를 기준으로 **COLOR/FIT 축을 완화했을 때**
  ⒜ SAME precision 이 실제로 개선되는가   ⒝ HUMAN DIFFERENT 가 **함께 열리지 않는가**
🔴 안전한 축이 확인되기 전까지 **현재 운영 MI 를 보존** 한다.
🟢 재사용 하니스 — `core-step5-evidence-c3-gt`(27쌍) · `core-step5-e2-description-evidence`(8쌍) ·
   `core-step5-domestic-lineage`(AC009 live). 🔴 셋 다 **발화 단언** 을 들고 있다
   (반사실이 안 돌면 FAIL · 「변화 0 = 안전」 금지).
```

### 🔴🔴 이 트랙의 전략 결론 — **순서를 뒤집지 않는다**

> **국내가격을 더 많이 가져오는 것이 목표가 아니다.** 먼저 「같은 상품」이라는 증거가
> 신뢰할 수 있어야 하고, **그 다음에** 그 상품의 국내가격만 가격 판단에 쓴다.

🔴 뒤집으면 WU-063~080 이 쌓은 SAME 개선을 무너뜨린다(여덟 축 전수 측정).

---

## 11. CLOSED / HOLD / 금지 — 원장

```
🟢 CLOSED   가격 축(자격만 주면 기존 집계기가 작동 · 국내 59,000~88,000 ·
            해외 EUR 35~40 / GBP 33 / USD 56 · leakage 0) — **더 파지 않는다**(CPO)
            STEP 5 · CORE-2S/2T/2U-A/2V/2W/2X/2Y/2Z/2AA/2AC/2AO · WU-130~152 ·
            여덟 보호축(COLOR·TITLE·MODEL_CODE·LINE·MARKET·PRICE·LANGUAGE·BRAND)

🟡 HOLD     SI-3(품번 없는 후보에서만 발화 · 운영 미적용) · C3 · 이미지 축 ·
            국내가격 SAME 자격 · 소재 어휘 정규화 ·
            CPO 판정 2건 — ⒜ 후보측 brand null 시 BRAND_UNCONFIRMED
                          ⒝ 고도몰 `set_goods_price` 판매가 필드

🔴 금지     SAME-only / EXACT-only 가격 필터 · 국내가격 수집 로직 변경 ·
            priceTierFromLink 변경 · COLOR/FIT blocker 완화 · description 재연결 ·
            AUDIENCE_LINE 완화 · GARMENT_FORM 조건 추가 · SAME_MIN_AXES ·
            corePoints 산식 · TITLE partial 점수 · crossSellerReserved · threshold
```

🔴 **SAME 축에서 확정된 사실** — CEO 가 SAME 으로 확정한 **8개** 를 자동 MI 가 회복하지
못하는 원인은 **전부 blocker/conflict** 다(점수 부족은 1건뿐). CORE-2X 가 증거 레버 C0~C6
전수에서 **0/8** 을 측정했다(STOP-C). ⟹ 다음 범위는 **CPO 가 지정** 한다.

🔴 **SI-3 의 사정거리가 구조적으로 좁다** — 공식몰 AB/AC **108/108 이 MODEL_CODE conflict**
로 조기 반환(axes: [])되어 TITLE 축이 **계산조차 되지 않는다** ⟹ SI-3 은 발화할 수 없다.

🔴 **「국내 SAME 0」은 MI 문제가 «아니다»**(WU-150 · 재조사 금지) — B226AC009 국내 URL 7개 중
**5개는 페이지를 읽을 수 없고**(403 ×2 · SPA ×1 · 목록 ×2), 읽히는 1개(보몽드)는 **품번까지
맞춰 놓고 「brand 칸 하나」로 보류** 된다. 🟢 SKU 는 사라지지 않았다 —
`brandModelCode="B226AC009"` 가 MI 까지 정상 전달된다.

### 🟢 CI 상주 회귀 (네트워크 0 · 믿고 쓸 것)

```
core-2aa 17  국내 가격 회귀(KRW 59,000~88,000 · 3곳 · sellerKey dedupe)
core-2af  4  WU-143 false SAME 5쌍 — SI-1/2/3 재발 0/5
core-2ab  3  PLAIN_HTML 빈 칸 다섯 + Shopify 비대칭
core-2ac  8  parity 세 칸 범위(🔴 소재는 «채우지 않는다» 가 계약이다)
core-2ad  5  corePoints 산식 바이트 고정     core-2ae 5  AUDIENCE_LINE 발화 경로
core-2ag  4  표본 출처 / SI-3 정의          core-2ah 3  GT 합집합   core-2ai 4  반례 모양
core-same03-inventory  20  원상품 조인 **증명**(제목 6/6 · id→URL 19/19) · 분모 둘 ·
                           충돌 2건 · 가치라벨 fixture 격리 · 8축 읽기
core-same03-review-dom  2  생성된 검토 화면 **마운트 DOM**(jsdom · 섹션 2 · 라디오 미선택)
🔴 라이브 축은 환경변수로만 — CORE2Z/2AB/2AC/2AD/2AE/2AF/2AG/2AH/2AI_LIVE=1 ·
   **CORE_SAME03_LIVE=1**(검토 화면 재생성)
```

---

## 12. CONTRACT / SAFETY — 이 숫자를 다시 조사하지 않는다

```
handleRequestPriceReview     9 refs
marketEvidence               7 refs
PRICE_COMPARISON_ANCHOR_ID   4 refs   🔴 WU-141-R3 **보존 계약** — 지우지 않는다
PRICE_CALCULATION_ANCHOR_ID          🔴 STEP 4 가 되살린 앵커 — 지우지 않는다
```

🔴 계약은 그 구역의 **«존재» 를 글자로 단언** 한다 ⟹ 제거하면 「없다」로 **방향을 뒤집어**
다시 쓴다. 🔴 약화가 아니다 — 「seller 화면에 없다」 **그리고** 「backend/API 는 **살아 있다**」를
**같이** 단언한다. 🔴🔴 **계약을 지워서 테스트를 통과시키지 않는다.**

### 🔴 제거 계약엔 보존 단언을 «같이» 둔다

「없다」만 쓰면 다음 사람이 엔진까지 지운다. 금지 어휘는 전면 리터럴이 아니라 **범위/개수** 로
단언한다(필수 부정문이 리터럴 금지에 걸린 적이 **세 번** 있다 — 「평균은 부정문으로만」).

---

## 13. IMPLEMENTATION ORDER — 코드 변경 후 중단하지 않는다

```
1 좌표 확인(§9)  2 §7 freeze 재확인  3 구현  4 영향 계약 갱신(삭제로 우회 금지)
5 **targeted tests**   ← 🔴 전체 회귀보다 먼저
6 **mutation**         (전부 FAIL 해야 한다 · 실행 후 **바이트 복구**)
7 **2-product E2E**    (B226AC009 · B226AC010)
8 full regression   9 typecheck   10 build   11 deploy   12 production check   13 보고 1회
```

🔴 순서를 뒤집지 않는다 — 전체 회귀를 먼저 돌리면 **내 계약이 틀렸는지, 기존 계약이
깨졌는지** 를 가를 수 없다.

---

## 14. TEST RULE — 분모를 반드시 적는다

```
**680 files / 9,231 passed / 0 failed / 140 skipped**   ← 기준선(apps/admin · CORE-PRICE-SAME-03 후)
   🟢 직전 677/9,208 에서 **+3 files / +23 tests** = 이번 WU 가 더한 계약 전부
      (inventory 20 · DOM 2 · 라이브 게이트 1 · 🔴 라이브 생성 본편은 **skip** 된다)
typecheck PASS (0)      build PASS (exit 0)
🔴 라이브 네트워크 하니스 **2건이 병렬에서 간헐 FAIL · 단독 PASS** —
   `p54c1-grounding-redirect`(CPO 가 합산 제외한 baseline) ·
   `core-2m-visual-review-build`(외부 사이트 의존 · `packages/` 변경 0)
🟢 **그 둘이 같이 통과한 실행이 이 기준선이다**(그래서 직전 기록 675/9,180 보다 +1/+1)
🔴 숨기지 않는다 — 다음 실행에서 9,180 이 나오면 **회귀가 아니라 그 2건의 간헐 실패** 다
```

🔴 **기존 테스트를 통과시키려고 수정하지 않는다** — 기능 정책이 바뀐 경우에만 계약을
**의도적으로** 갱신한다. 🔴 소스 문자열 검사는 **주석을 벗기고** 한다.
🔴 화면은 **마운트한 DOM** 으로만 완료 선언한다(Render PASS ≠ 소스 PASS).

---

## 15. 🔴🔴 REPORT RULE — 중간 보고 없음 · 최종 1회 · **마지막 절은 필수**

```
1 목적        2 변경        3 실제 결과     4 회귀
5 변경 금지 영역 준수       6 Git          7 Deploy
8 STOP / Risk              9 CEO Action

+ 변경 파일 · 테스트 분모 · typecheck · build · Production 상태

🔴🔴 **마지막은 반드시 이것이다 (CEO 지시 · 생략 금지)**
   ▸ 현재 프로젝트가 **어디까지 왔는가**
   ▸ 다음에 **정확히 무엇을 해야 하는가**
```

🔴 「이번 세션에서 무엇을 했는가」보다 **「지금 좌표 + 다음 한 수」** 가 중요하다.
🔴 그리고 보고가 끝나면 **이 문서의 §0 과 §9 를 같이 갱신** 한다 — 갱신하지 않으면
다음 페이지가 다시 과거로 되돌아간다.

---

## 16. DEPLOY → PRODUCTION CHECK

```
git fetch origin --quiet ; git status ; git rev-list --left-right --count origin/main...HEAD
🔴 종료 보고에 clean 여부 **와** ahead/behind 숫자를 같이 적는다
배포 후 확인  /  ·  인증 redirect  ·  Seller Decision route  ·  상품 상세/판단 화면
🔴 「Deployment successful」만 적지 않는다 · 🔴 401/307 을 route 증거로 쓰지 않는다
🔴 `main` push 가 Production 배포를 부른다 · `vercel --prod` CLI 는 쓰지 않는다
```

---

## 17. STOP RULE

**아래일 때만** 안전 종료한다:

```
코드 변경 «전» 예상치 못한 구조적 위험 발견 · production destructive action 필요 ·
business/security policy 승인 필요 · 기존 freeze 를 깨야만 해결 가능
```

🔴 그 외에는 **코드 변경 → 검증 → 배포까지 계속 진행한다.**
🔴🔴 「코드 변경 후 세션이 부족할 것 같다」로 **중간 중단하지 않는다** —
**착수 «전» 에 범위를 잡고 끝까지 닫는다**(§4-C 용량 판단은 WU 단위다).

---

## 18. CEO RULE + 현재 CEO Action

CEO 는 코드·계약·commit 을 검토하지 않는다. **배포 전에는 아무것도 요청하지 않는다.**
배포 뒤 **최종 테스트 1회** 만 요청하고, 형식은 **넷** 이다:

```
테스트 URL:      테스트 상품:      테스트 순서:      예상 결과:
```

### 🟢 **[완료] CEO Action ③ — 국내 후보 10건 판정**(2026-10-26 수신 10/10 · §9-B)

🔴 **다시 하지 않는다.** 라벨은 `fixtures/core-same03-human-gt.json` 에 고정됐다.

```
파일        docs/core-same03-domestic-review.html   ← 브라우저로 **그냥 열면 된다**
            (자립형 · 로그인 0 · 네트워크 0 · 사진이 **파일 안에** 들어 있다)
무엇을      원상품 **둘**(B226AC009 · B226AC010) 각각의 국내 후보를
            [동일] / [다른제품] / [판단불가] 로 고르고 **사유 한 줄**
끝나면      맨 아래 **[판정 결과 복사하기]** → 그 JSON 을 붙여 주십시오
```

🔴🔴 **섹션을 넘어 비교하지 마십시오** — 원상품이 둘이고, 섞으면 비교가 거짓이 됩니다.
🔴 **가장 중요한 두 건**(과거 판정이 서로 달랐습니다 · 화면에 🔴 로 표시돼 있습니다):
`global.trenbe.com` · `m.luxboy.com`. 이 둘은 **반드시** 봐 주십시오.

🔴 **정상인데 FAIL 로 보이기 쉬운 것 넷**:
⒜ **측정불가 3건**(miniboutique · kream · luksusbaby) — 저희가 그 **페이지를 읽지 못한** 것이고
  「상품이 없다」가 아닙니다. 사진이 없으면 **판단불가** 가 정답입니다
⒝ `PASS` / `FAIL` 배지는 **시스템의 상태** 일 뿐이고 **정답이 아닙니다** — 대표님 판정이 기준입니다
⒞ `beaumonde.co.kr` 이 **두 줄** 인 것 — 하나는 **목록 페이지** 이고 하나는 상품 상세입니다(다른 URL)
⒟ 「조기 종료」라고 적힌 후보 — 반증을 먼저 만나서 **나머지 축을 계산하지 않은** 것이고,
  점수가 낮아서가 아닙니다

### 🟡🟡 **CEO Action ① — 한 글자 답변**(이것이 STEP 3 착수 여부를 가른다)

> 🔴 **새 상품을 다시 테스트하지 않는다.** 과거 실제 상품 검증 때 biskuit / luxboy 같은
> 후보를 SAME / DIFFERENT 로 판단하면서 **실제로 무엇을 눈으로 보고 판단했는지** 만 묻는다.

```
A. 상품 사진/이미지
B. 상세페이지의 색상·소재·핏 등의 정보
C. 둘 다
D. 둘 다 아니고 상품명/품번/브랜드만
```

🔵 **답에 따라 CTO 가 할 일이 정해진다**(CPO 확정):
```
A 또는 C  →  **STEP 3 IMAGE evidence 측정** 착수(측정 전용 · 구현 0)
B         →  image STEP 3 **보류** · description 은 **REJECT 유지** · 다른 공급선 검토
D         →  image·description 둘 다 보류 · **새 evidence 공급 조사**를 별도 WU 로
```

### 🟡 CEO Action ② — **화면 1회**(UX01 + STEP 4 를 한 번에)

🔵 **UX01 확인 9항** — `/pipeline` 에서 아무 상품 1개(「새 상품 분석」 또는 「🔄 다시 분석」):

```
[ ] 왼쪽 📊 영역에 **판매판단** 이 보인다
[ ] 오른쪽 Action Center 가 **그대로** 있다
[ ] 왼쪽/오른쪽 판매판단이 **동일하다**
[ ] 권장 판매가격 **₩A** 가 눈에 띈다
[ ] **[이 가격으로 설정]** 이 직관적이다
[ ] 🇰🇷 국내 참고가격이 **시장 근거** 로 이해된다
[ ] 🌎 해외 최저 소싱가가 명확하다
[ ] **ⓘ** 를 누르면 **A 의 가격 계산 기준** 이 열린다
[ ] 국내가격 B 를 권장 판매가격 A 로 **오해하지 않는다**
```

🔴 **세 질문에 즉시 답할 수 있어야 한다** — 「팔아도 돼?」 → 판매판단 · 「얼마에 팔아?」 →
권장 판매가격 · 「왜 그 가격이야?」 → 근거 + 계산 기준. **답이 안 나오면 UX01 FAIL** 이다.

### 🟡 같이 보는 것 — **STEP 4 화면**

```
테스트 URL   https://ttaejyo.vercel.app/pipeline   (로그인 필요)
테스트 상품   아무 상품 1개 — 「새 상품 분석」 또는 「🔄 다시 분석」
테스트 순서   ① 맨 위 「📊 가격 분석」 ② 「💡 판매가격 가이드」의 **권장 판매가격 ₩…**
             ③ **「ⓘ 가격 계산 기준 보기」를 누른다**
             ④ 바로 아래 계산 상세(원본가 → 환율 → 착지원가 → 수수료 → 마진)가 펼쳐지는가
             ⑤ 「＋ 상세정보 보기」의 「국내 시장가격에 맞추면 예상 마진 …」 한 줄
예상 결과     🟢 ①~⑤ 가 **한 화면에서** 끝난다 · 🟢 권장 판매가격 금액이 **한 번만** 뜬다
FAIL 기준     ③ 을 눌렀는데 아무 일도 없으면 FAIL · 권장 판매가격이 **두 번** 뜨면 FAIL
```

🔴 **정상인데 FAIL 로 보이기 쉬운 것 셋**:
⒜ 🇰🇷 가 「확인 1곳」이고 「가격대」가 아닌 것 — **1건을 가격대라 부르지 않는 것이 정책**(§5)
⒝ 「수익성 판단 보류 — 매입 원가를 입력하면 …」 — 원가는 셀러 입력이고 **UNKNOWN ≠ 실패**
⒞ 🌎 가 `GBP 37` 처럼 ISO 코드인 것 — **환산 금지 계약** 이고 ₩ 는 권장 판매가격에만 쓴다

🔴🔴 **작업 중 아래를 묻지 않는다 — 전부 이미 결정된 범위다**:

```
「legacy UI 를 제거할까요?」  「flag 로 숨길까요?」      「A/B 중 어떤 방식이?」
「국내 SAME 도 같이 고칠까요?」「Registry 를 늘릴까요?」  「adapter 를 추가할까요?」
「Gemini 를 다시 켤까요?」    「계약을 어떻게 바꿀까요?」「CEO 가 중간 테스트해볼까요?」
```

---

## 19. 세 페이지 운영 방식

| 페이지 | 역할 | 🔴 하지 않는 것 |
|---|---|---|
| **① CPO — MASTER / 전략** | 전략 · 정책 · WU 지정 · 보고 판정 · STOP/HOLD/CLOSED | 코드 직접 수정 |
| **② CTO — EXECUTION** | 조사 · 구현 · 계약 · 변이 · 회귀 · Git · deploy · 보고 | 정책 결정 · 범위 확장 |
| **③ CEO — QA / SCREEN** | Production 결과 · 실제 화면 · 캡처 · 최종 PASS/FAIL | 코드 임의 수정 |

🟢 **CEO 화면 피드백은 ① 로 가져가** 다음 WU 결정에 쓴다.
🔴 **세 페이지 모두 세션 시작에 이 문서를 읽고, 끝에 §0/§9 를 갱신한다.**

---

## 20. 실행 명령 (복붙)

```bash
# 회귀 — 🔴 출력을 파일로 받는다(실패 이름을 놓치지 않기 위해)
cd apps/admin && npx vitest run > /tmp/reg.txt 2>&1; grep -nE "FAIL |AssertionError" /tmp/reg.txt

# typecheck · build — 🔴 grep 종료코드를 tsc 의 것으로 읽지 않는다(파일로 받는다)
cd .. && npx tsc -p apps/admin/tsconfig.json --noEmit
cd apps/admin && npm run build

# 배포 확인
npx vercel ls --yes | grep -A1 "Age "
```

🔴 **변이는 `python3` 없이 `Edit` 로만** 한다(이 환경에 python3 이 없어 「적용 실패」가
「통과」로 읽힌 적이 있다 · 적용 여부를 `grep -c` 로 확인한다).
🔴 **미커밋 구현을 `git checkout` 으로 되돌리지 않는다** — 백업 후 **바이트 대조** 로 확인한다.

---

## 21. 아카이브 — 막혔을 때만 연다

```
docs/ARCHIVE-CLOSED-WU.md   종료된 WU 상세 45절   🔴 진입점이 아니다
docs/HANDOFF-WU-*.md         개별 WU 전문          🔴 해당 절 하나만 읽는다
CLAUDE.md §12                과거 결론 모음        🔴 작업 좌표가 아니다
```

🔴 **그 문서들의 「지금 여기」·「착수점」·「CEO 확인 대기」는 그때의 상태다.**
현재 좌표는 **이 문서 §0** 하나다.

---

## FINAL PRINCIPLE

> 이 프로젝트에서 가장 중요한 것은 **더 많은 기능을 만드는 것이 아니라,
> 이미 검증된 기능을 다시 깨지 않고 연결하는 것** 이다.

```
CLOSED = 닫힌 것      HOLD = 보류된 것
금지   = 건드리지 않는 것   CURRENT WU = 지금 할 것
```

🔴 **과거 작업을 다시 시작하지 않는다.** CPO 가 reopen 하지 않는 한 이전 단계는 **그대로
사실로 취급** 한다.

🔴 **후보를 많이 보여주는 것이 목적이 아니다.** 동일상품을 정확히 찾아 **2~3개의 가격
근거** 로 셀러가 「팔아도 되는가 → 얼마에 팔 것인가 → 왜 그런가」를 한 화면에서 판단하게
하는 것이 목적이다.
