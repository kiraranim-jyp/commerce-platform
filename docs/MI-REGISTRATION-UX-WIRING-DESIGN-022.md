# Phase A ⑤ — 등록 UX 배선 **설계서** (구현 0 · 승인 대기)

> 🔴🔴 **이 문서는 조사·설계다. 코드를 한 줄도 바꾸지 않았다.**
> Gemini 0 · HTTP 0 · DB 0 · UI 0 · deploy 0 · flag OFF. CEO 액션 없음.
> 🔴 CPO 가 ⑤를 **NEXT WORK 후보**로 고정했고 작업지시서는 아직 없다 — 그래서
> **승인 즉시 착수할 수 있는 상태까지만** 만들어 둔다.

---

## 1. 🔴🔴 가장 중요한 발견 — **렌더가 없어서가 아니다. 데이터 출처가 다르다**

```
DomesticPriceIntelligencePanel.tsx:1833
  fetch(`/api/domestic-price-sources/links?snapshotId=…`) → setCandidates(...)
🔴 후보 목록은 **DB 테이블 `domestic_product_links`** 를 읽는다.
🔴 그런데 Gemini 후보는 **그 테이블에 절대 쓰지 않는다**(저장 차단 :1067 · 불변식).
→ 🔴🔴 **그래서 「후보 카드에 렌더만 추가」로는 영구히 보이지 않는다.**
   「표시 코드가 없다」가 아니라 **「그 목록의 소스에 애초에 없다」** 가 정확한 진단이다.
```

### 두 번째 발견 — **GET 경로에는 Gemini 결과가 구조적으로 없다**

```
GET  /api/price-history/[snapshotId]/route.ts:22
       computeMarketIntelligence(snapshotId, auth.user.workspaceId)   ← **인자 2개**
🔴 세 번째 인자(geminiEvidence)를 넘기지 않는다 → `geminiEvidence: null` ·
   `candidateOverseasPrice` 전부 빈 값이 **항상** 나온다.
🔴 패널의 cost/decision/판정은 **이 GET 에서** 온다(:1822).
→ 🔴 즉 패널에 prop 만 연결해도 **GET 쪽에는 값이 영원히 없다.**
```

🔴 **그러면 GET 이 Gemini 를 부르게 하면?** → 화면을 열 때마다 Gemini 가 호출된다.
**비용 구조상 금지** 다(WU-016~018 의 전체 전제가 무너진다). **채택하지 않는다.**

### 🟢 세 번째 발견 — **POST 응답에는 이미 들어 있다**

```
POST /api/price-history/check/route.ts:111
       return NextResponse.json({ ...result, domesticShop });
🟢 `domesticShop` = `DomesticPriceCheckResult` 이고 거기에
   **`geminiEvidence`** 가 이미 실려 있다(WU-009 에서 추가 · :1300).
🟢 그 배열의 각 항목이 화면에 필요한 것을 **전부** 들고 있다:
   domain · discoveredUrl · matchTruth · verified · priceTier · crossSellerVerdict ·
   confidence · matchReasons · crossSellerBlockers · crossSellerConflicts ·
   priceAmount · priceCurrency · priceKrw · priceStatus · **market · basis**(WU-020)
🟢 그리고 **패널이 그 응답을 이미 파싱한다** — `const json = await res.json()` →
   `summarizeRecheckResult(json)`(:1977 부근). 🔴 다만 `domesticShop` 을 **버린다.**
🔴 자동 1회차는 `pipeline/page.tsx:465-478` 이 쏘는데 그쪽은 **응답을 통째로 버린다**
   (`.catch().finally()` 만 있고 `.then` 이 없다).
```

---

## 2. 🟢 그래서 채택안 — **transient prop 한 줄 배선** (A안)

```
POST /api/price-history/check  ──(이미 응답에 있음)──▶  domesticShop.geminiEvidence
        │                                                     │
        ├─ 패널의 「지금 확인」(:1955~)  ─ 이미 json 파싱함 ──▶ state 에 보관
        └─ page.tsx 의 자동 1회차(:465) ─ 지금은 버림 ───────▶ state 에 보관(선택)
                                                              │
                                              ▼ 기존 후보 카드와 **다른 구역** 에 렌더
                                        「웹 검색 후보(이번 확인 한정 · 저장 안 됨)」
```

| 축 | A안(채택) | B안 | C안 |
|---|---|---|---|
| 내용 | POST 응답을 state 로 들고 **별 구역** 렌더 | DB 에 저장해 기존 목록에 합침 | GET 이 Gemini 재호출 |
| DB/schema | 🟢 **0** | 🔴 저장 = **금지 불변식 위반** | 🟢 0 |
| 비용 | 🟢 **0** | 🟢 0 | 🔴 **화면 열 때마다 Gemini** |
| 파일 수 | 🟢 1~2 | 🔴 다수 | 🔴 라우트+비용 설계 |
| 판정/가격 오염 | 🟢 없음(별 구역) | 🔴 tier/최저가에 섞인다 | 🔴 같음 |

🔴 **B·C 는 CPO 가 이미 금지한 것들에 직접 걸린다** — 외부 URL 영구 저장 금지 ·
가격 추적 금지 · Gemini 를 기본 검색엔진으로 쓰지 않는다.

### 🟢🟢 A안의 가장 좋은 성질 — **flag OFF 면 화면이 한 픽셀도 안 바뀐다**

```
flag OFF  →  geminiEvidence === null  →  구역을 **아예 렌더하지 않는다**
🟢 즉 배선을 Production 에 올려도 **현재 화면은 불변** 이다.
🟢 그래서 ①(Gemini 비용 승인)을 기다리지 않고 ⑤를 먼저 닫을 수 있다.
🔴 단 그 상태에서는 「보인다」를 검증할 수 없다 — **빈 구역의 음성 대조만** 가능하다.
   (fixture 로 evidence 를 주입한 **마운트 DOM 테스트** 로 표시를 증명한다)
```

---

## 3. 화면에 **무엇을** 보여줄 것인가 — 🔴 거짓말하지 않는 설계

헌장 §4(「부분 구현으로 화면이 거짓말하게 만들지 않는다」)와 WU-011/020 의 안전규칙을
그대로 화면 규칙으로 옮긴다.

| 보여줄 것 | 근거 칸 | 🔴 규칙 |
|---|---|---|
| 판정 배지 | `crossSellerVerdict` / `matchTruth` / `priceTier` | 🟢 기존 `candidateLabel`(:363-399)의 🟢/🟡/⚪ 어휘를 **재사용**. 새 어휘 금지 |
| 판정 근거 | `matchReasons` · `crossSellerBlockers` · `crossSellerConflicts` | 🔴 근거 없이 배지만 보여주지 않는다(기존 정책 N-4.11 STEP2) |
| 가격 | `priceAmount` + **`priceCurrency` 그대로** | 🔴 **환산 금지.** `EUR 75` 는 `EUR 75` 로 적는다 |
| 시장 | `market` + `basis` | 🔴 `UNKNOWN` 을 「국내」로 적지 않는다. `basis` 를 사람 말로 보여준다 |
| 출처 | `domain` · `discoveredUrl` | 🟢 셀러가 직접 열어 확인할 수 있어야 한다 |
| **저장되지 않음** | — | 🔴🔴 **「이번 확인에만 쓰이고 저장되지 않습니다」를 구역 머리에 적는다** |

🔴 **절대 하지 않을 것 넷**:
```
❌ 이 구역의 가격을 「국내 최저가」·「동일상품 가격」으로 합산해 보여준다
   (국내 축 진입은 `market === "KR" && priceKrw != null` 하나뿐 — WU-020)
❌ 가격 없는 후보를 가격 있는 것처럼 보여준다 → 「가격 미확인」으로 **명시**
❌ 이 구역 때문에 판매판정(`sellerDecision.finalVerdict`)을 바꾼다
   → 🔴 P-32 와 같은 원칙이다. **표시면과 판정면을 섞지 않는다**
❌ 「동일상품 확인」 버튼을 이 구역에 달아 DB 링크로 승격시킨다 → **저장 금지 위반**
```

### 🔴 해외 가격 구역은 **이번 범위에서 제외** 를 제안한다

```
WU-020 이 만든 `candidateOverseasPrice` 는 **GET MI 반환** 에 있고 POST 응답에는 없다.
→ 보여주려면 POST 응답을 넓히거나 클라이언트에서 다시 집계해야 한다.
🔴 그리고 CPO 가 ⑤의 범위를 「상품정보/후보/판정 표시 + 기존 등록 흐름 연결」로
   한정했고, **가격 추적/외부 URL 관리는 금지** 다.
🟢 제안: 1차는 **후보 단위 가격을 통화 그대로** 보여주는 것까지만 한다
   (후보 카드 안의 한 줄). 해외 «집계» 구역은 별 WU 로 분리한다.
🔴 CPO 가 1차에 포함하라고 하면 POST 응답에 한 칸 추가로 가능하다 — 결정 사안.
```

---

## 4. 등록 흐름과의 연결 — 🟢 **이미 배선돼 있다. 건드릴 것이 없다**

```
DomesticPriceIntelligencePanel
  → onSellerVerdictChange(sellerDecision.finalVerdict)      ← 기존 prop(:1692)
    → CommerceWorkspace → buildSellAndRegisterView(sellVerdict, registration)
      → StageBody / 채널 패널의 「다음 행동」 문장
        → 등록 버튼 (registrationEnabled && outcome !== "BLOCKED")
```

🟢 **그래서 ⑤의 「기존 등록 흐름과 연결」은 새로 만드는 것이 아니다** — 이미 있다.
🔴 그리고 **그 선을 건드리지 않는 것이 맞다**(P-32: 판매 판정과 등록 준비는 상호 무영향).
→ 🟢 ⑤에서 실제로 필요한 작업은 **표시(후보·정보·판정) 하나** 다.

---

## 5. 변경 범위 (승인 시)

```
① apps/admin/.../DomesticPriceIntelligencePanel.tsx
     - 「지금 확인」 응답 타입에 `domesticShop.geminiEvidence` 추가 + state 보관
     - 전용 구역 컴포넌트 1개 추가(기존 CandidateCard 와 **분리**)
     - 🟢 기존 candidates / 판정 / 가격 로직은 **한 줄도 안 건드린다**
② apps/admin/src/app/pipeline/page.tsx  (선택 · 자동 1회차도 보이게 할 경우)
     - 지금 버리는 응답을 `.then` 으로 받아 state → 패널 prop
🟢 API 변경 0 · 라우트 추가 0 · DB/schema 0 · 새 엔드포인트 0 · Registry 0
```

### 테스트 계획 (헌장 §5 네 축)

```
Positive   fixture evidence 주입 → **마운트한 DOM** 에 판정·통화·시장·출처·
           「저장되지 않음」 문구가 보인다 (🔴 소스 문자열 PASS 로 끝내지 않는다)
Negative   ① evidence null → 구역이 **없다**  ② 가격 없는 후보 → 「가격 미확인」
           ③ market UNKNOWN → 「국내」 문구가 **없다**
Mutation   ⒜ 환산 로직을 넣으면 FAIL  ⒝ 이 구역 가격이 국내 최저가에 섞이면 FAIL
           ⒞ 「저장되지 않음」 문구를 지우면 FAIL  ⒟ 판정면에 영향 주면 FAIL
Regression admin 전수(현재 514 files / 7,663 tests) · typecheck baseline 10 · build
```

🔴 **Render PASS ≠ 소스 PASS** — 메모 `render-pass-is-not-source-pass` 의 그 함정이다.
🔴 `.test.tsx` 는 **수집되지 않는다**(include 가 `*.test.ts`) → `createElement` 로 쓴다.

---

## 6. 🔴 CPO 결정이 필요한 것 셋

```
① A안(transient 표시)을 승인하는가 — 저장 0 · 비용 0 · flag OFF 면 화면 불변
② 자동 1회차(page.tsx)도 포함하는가, 아니면 「지금 확인」 경로만 1차로 하는가
③ 해외 가격 «집계» 구역을 1차에 포함하는가 (제안: **제외**, 후보 카드 한 줄까지만)
```

🔴 **CTO 는 구현하지 않았다.** 승인 전에 Production UI 를 만지지 않는다.

---

## 7. 🔴 조사 중 정정한 것

```
🔴 대리 조사가 「`today` 라우트는 존재하지 않는다」고 보고했다 — **틀렸다.**
   `apps/admin/src/app/today/page.tsx` 가 **있다**(헌장의 `/today` 307 실측과 정합).
   🟢 직접 `ls` 로 확인해 정정했다. 대리 보고를 그대로 쓰지 않는다.
```
